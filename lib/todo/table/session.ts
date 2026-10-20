import {
  EMPTY_CONFIG,
  TABLE,
  RateGate,
  newCode,
  nickname,
  normalizeCode,
  ordered,
  readEnvelope,
  readMember,
  uniqueName,
  validId,
  type Color,
  type Envelope,
  type Member,
  type PublicConfig,
  type Reaction,
  type Status,
} from "./protocol";
import { firebaseTransport, type Transport } from "./transport";
export type Sit = { startAt: number; minutes: number; host: string };
export type TableSnapshot = {
  config: PublicConfig;
  state: "idle" | "connecting" | "joined" | "reconnecting";
  code: string;
  members: Member[];
  id: string;
  host: string;
  message: string;
  sit: Sit | null;
  offset: number;
  reactions: { id: string; kind: Reaction; at: number }[];
};
export class TableSession {
  private snapshot: TableSnapshot = {
    config: EMPTY_CONFIG,
    state: "idle",
    code: "",
    members: [],
    id: "",
    host: "",
    message: "",
    sit: null,
    offset: 0,
    reactions: [],
  };
  private listeners = new Set<() => void>();
  private messages = new Set<(m: Envelope) => void>();
  private transport: Transport | null = null;
  private local: Member | null = null;
  private gate = new RateGate();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private pulse: ReturnType<typeof setInterval> | null = null;
  private lastTrack = 0;
  private trackPending = false;
  private status: Status = "idle";
  private initial: ((members: Member[]) => void) | null = null;
  private generation = 0;
  private peerId = "";
  private bestRtt = Infinity;
  private pendingMessages: { msg: Envelope; at: number }[] = [];
  constructor(private factory = firebaseTransport) {}
  getSnapshot = () => this.snapshot;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  onMessage(fn: (m: Envelope) => void) {
    this.messages.add(fn);
    return () => {
      this.messages.delete(fn);
    };
  }
  private update(next: Partial<TableSnapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    this.listeners.forEach((fn) => fn());
  }
  configure(config: PublicConfig) {
    this.update({ config });
  }
  notice(message: string) {
    this.update({ message });
  }
  private later(fn: () => void, ms: number) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
    return t;
  }
  async join(create: boolean, rawCode: string, rawName: string, color: Color) {
    if (!this.snapshot.config.enabled || !this.snapshot.config.configured) {
      this.notice(
        "Shared tables need a connection first. Solo focus is ready to use.",
      );
      return;
    }
    const name = nickname(rawName),
      code = create ? newCode() : normalizeCode(rawCode);
    if (!name) {
      this.notice("Choose a nickname with 2–16 letters or numbers.");
      return;
    }
    if (!code) {
      this.notice("Check the code — it looks like PENG-ABC234.");
      return;
    }
    await this.leave();
    const gen = ++this.generation,
      id = this.peerId || (this.peerId = crypto.randomUUID());
    this.update({ state: "connecting", id, code, message: "Connecting…" });
    try {
      const transport = await this.factory(this.snapshot.config);
      if (gen !== this.generation) {
        await transport.close();
        return;
      }
      this.transport = transport;
      const initial = new Promise<Member[]>((resolve, reject) => {
        this.initial = resolve;
        this.later(() => {
          this.initial = null;
          reject(new Error("timeout"));
        }, TABLE.syncTimeoutMs);
      });
      await Promise.all([
        transport.connect(code, id, this.sync, this.receive, (connected) => {
          if (gen !== this.generation) return;
          if (!connected && this.local)
            this.update({ state: "reconnecting", message: "Reconnecting…" });
          else if (connected && this.local) {
            this.update({ state: "joined", message: "Back at your table." });
            this.flushTrack(true);
          }
        }),
        initial,
      ]).then(async ([, members]) => {
        if (gen !== this.generation) return;
        if (!create && !members.length) throw new Error("missing");
        if (members.length >= TABLE.maxMembers) throw new Error("full");
        this.local = {
          id,
          name: uniqueName(name, members),
          color,
          joinedAt: Math.max(Date.now(), ...members.map((m) => m.joinedAt + 1)),
          status: "arriving",
          mic: "muted",
          hasMicPermission: false,
          playing: null,
        };
        this.update({
          message: "",
          members: ordered([...members, this.local]),
        });
        await transport.track(this.local);
        if (gen !== this.generation) return;
        this.update({ state: "joined" });
        this.lastTrack = Date.now();
        this.later(() => {
          if (this.local) {
            this.local.status = this.status;
            this.flushTrack();
          }
        }, TABLE.arrivalMs);
        this.pulse = setInterval(() => {
          if (this.trackPending) this.flushTrack();
        }, TABLE.presenceMs);
        this.measureClock();
      });
    } catch (e) {
      if (gen !== this.generation) return;
      const kind = e instanceof Error ? e.message : "connection";
      await this.leave(
        kind === "missing"
          ? "We couldn't find a table with that code."
          : kind === "full"
            ? "This table is full."
            : "Couldn't reach the table. Please try again.",
      );
    }
  }
  private sync = (state: Record<string, unknown[]>) => {
    const map = new Map<string, Member>();
    Object.entries(state)
      .slice(0, 64)
      .forEach(([key, values]) => {
        if (!Array.isArray(values)) return;
        for (const v of values) {
          const m = readMember(v, key);
          if (m) map.set(key, m);
        }
      });
    const members = ordered([...map.values()]);
    if (this.initial) {
      const done = this.initial;
      this.initial = null;
      done(members);
    }
    if (!this.local) return;
    const own = members.find((m) => m.id === this.local!.id);
    if (own) this.local.joinedAt = own.joinedAt;
    const rank = members.findIndex((m) => m.id === this.local!.id);
    if (rank >= TABLE.maxMembers) {
      void this.leave("This table is full.");
      return;
    }
    const previousHost = this.snapshot.host;
    const admitted = members.slice(0, TABLE.maxMembers);
    this.update({ members: admitted, host: admitted[0]?.id || "" });
    const queued = this.pendingMessages.splice(0);
    for (const item of queued)
      if (
        Date.now() - item.at < 5000 &&
        admitted.some((m) => m.id === item.msg.from)
      )
        this.receive(item.msg);
    // Resolve simultaneous nickname collisions deterministically without changing the earlier member.
    if (rank >= 0) {
      const before = members.slice(0, rank);
      const corrected = uniqueName(this.local.name, before);
      if (corrected !== this.local.name) {
        this.local.name = corrected;
        this.flushTrack();
      }
    }
    if (previousHost !== this.snapshot.host) {
      this.bestRtt = Infinity;
      this.update({ offset: 0, sit: null });
      this.measureClock();
    }
  };
  private flushTrack(force = false) {
    if (!this.local || !this.transport || this.snapshot.state !== "joined")
      return;
    if (!force && Date.now() - this.lastTrack < TABLE.presenceMs) {
      this.trackPending = true;
      return;
    }
    this.trackPending = false;
    this.lastTrack = Date.now();
    void this.transport
      .track({ ...this.local })
      .catch(() =>
        this.update({ state: "reconnecting", message: "Reconnecting…" }),
      );
  }
  setStatus(status: Status) {
    this.status = status;
    if (
      !this.local ||
      this.local.status === "arriving" ||
      this.local.status === status
    )
      return;
    this.local.status = status;
    if (status !== "break") this.local.playing = null;
    this.flushTrack();
  }
  setMic(live: boolean, permission: boolean) {
    if (!this.local) return;
    this.local.mic = live ? "live" : "muted";
    this.local.hasMicPermission = permission;
    this.flushTrack();
  }
  setPlaying(playing: Member["playing"]) {
    if (!this.local || (playing && this.status !== "break")) return;
    this.local.playing = playing;
    this.flushTrack();
  }
  send(event: string, data: Record<string, unknown>) {
    if (this.snapshot.state !== "joined" || !this.local) return;
    const max =
      event === "reaction"
        ? 1
        : event === "doodle"
          ? 20
          : event === "signal"
            ? TABLE.signalPerSecond
            : 8;
    if (!this.gate.allow(`out:${event}:${String(data.to || "")}`, max)) return;
    const msg = { from: this.local.id, event, data };
    this.transport?.send(msg);
    if (event === "reaction") this.react(this.local.id, data.kind as Reaction);
  }
  private react(id: string, kind: Reaction) {
    const reactions = [
      ...this.snapshot.reactions.filter((r) => Date.now() - r.at < 2200),
      { id, kind, at: Date.now() },
    ];
    this.update({ reactions });
    this.later(
      () =>
        this.update({
          reactions: this.snapshot.reactions.filter(
            (r) => Date.now() - r.at < 2200,
          ),
        }),
      2300,
    );
  }
  reaction(kind: Reaction) {
    this.send("reaction", { kind });
  }
  hostAction(
    event: "kick" | "close_room" | "host_mute_request",
    targetId?: string,
  ) {
    if (this.snapshot.host !== this.snapshot.id) return;
    this.send(event, targetId ? { targetId } : {});
    if (event === "close_room") void this.leave("You closed the table.");
  }
  startSit(minutes: number) {
    if (
      this.snapshot.host !== this.snapshot.id ||
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      minutes > 90
    )
      return;
    const sit = { startAt: Date.now() + 3000, minutes, host: this.snapshot.id };
    this.send("sit_start", { startAt: sit.startAt, minutes });
    this.update({ sit });
  }
  dismissSit() {
    this.update({ sit: null });
  }
  private measureClock() {
    if (
      !this.local ||
      !this.snapshot.host ||
      this.snapshot.host === this.local.id
    )
      return;
    for (let i = 0; i < 3; i++)
      this.later(
        () => this.send("ping", { t0: Date.now(), to: this.snapshot.host }),
        i * 150,
      );
  }
  private receive = (value: unknown) => {
    const msg = readEnvelope(value);
    if (!msg || msg.from === this.snapshot.id) return;
    if (!this.snapshot.members.some((m) => m.id === msg.from)) {
      if (msg.event === "signal" && this.pendingMessages.length < 80)
        this.pendingMessages.push({ msg, at: Date.now() });
      return;
    }
    const max =
      msg.event === "reaction"
        ? 1
        : msg.event === "doodle"
          ? 20
          : msg.event === "signal"
            ? TABLE.signalPerSecond
            : 10;
    if (!this.gate.allow(`${msg.from}:${msg.event}`, max)) return;
    const { event, data, from } = msg;
    if (
      ["kick", "close_room", "host_mute_request", "sit_start"].includes(
        event,
      ) &&
      from !== this.snapshot.host
    )
      return;
    if (event === "close_room") {
      void this.leave("The host closed the table.");
      return;
    }
    if (event === "kick" && data.targetId === this.snapshot.id) {
      void this.leave("You were removed from this table.");
      return;
    }
    if (
      event === "ping" &&
      this.snapshot.host === this.snapshot.id &&
      data.to === this.snapshot.id &&
      typeof data.t0 === "number"
    )
      this.send("pong", { to: from, t0: data.t0, hostNow: Date.now() });
    if (
      event === "pong" &&
      from === this.snapshot.host &&
      data.to === this.snapshot.id &&
      typeof data.t0 === "number" &&
      typeof data.hostNow === "number"
    ) {
      const rtt = Date.now() - data.t0;
      if (
        rtt >= 0 &&
        rtt < this.bestRtt &&
        rtt < 3000 &&
        Number.isFinite(data.hostNow)
      ) {
        this.bestRtt = rtt;
        this.update({ offset: data.hostNow - (data.t0 + Date.now()) / 2 });
      }
    }
    if (
      event === "sit_start" &&
      typeof data.startAt === "number" &&
      Number.isFinite(data.startAt) &&
      Math.abs(data.startAt - (Date.now() + this.snapshot.offset)) < 15000 &&
      Number.isInteger(data.minutes) &&
      Number(data.minutes) >= 1 &&
      Number(data.minutes) <= 90
    )
      this.update({
        sit: {
          startAt: data.startAt,
          minutes: Number(data.minutes),
          host: from,
        },
      });
    if (
      event === "reaction" &&
      ["wave", "cheer", "heart", "coffee"].includes(String(data.kind))
    )
      this.react(from, data.kind as Reaction);
    if (
      event === "signal" &&
      (!validId(data.to) || data.to !== this.snapshot.id)
    )
      return;
    this.messages.forEach((fn) => fn(msg));
  };
  async leave(message = "") {
    ++this.generation;
    this.initial = null;
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    if (this.pulse) clearInterval(this.pulse);
    this.pulse = null;
    this.local = null;
    this.trackPending = false;
    this.gate.clear();
    this.pendingMessages = [];
    const old = this.transport;
    this.transport = null;
    this.update({
      state: "idle",
      code: "",
      id: "",
      members: [],
      host: "",
      message,
      sit: null,
      offset: 0,
      reactions: [],
    });
    await old?.close();
  }
}
