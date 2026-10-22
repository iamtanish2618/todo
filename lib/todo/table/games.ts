import { RELIABILITY } from "../reliability";
import { object, type Envelope, type Game } from "./protocol";
import type { TableSession } from "./session";
import type { TableMessage } from "./session";
export type Stroke = { sid: string; color: string; pts: [number, number][] };
export function readStroke(data: Record<string, unknown>): Stroke | null {
  if (
    typeof data.sid !== "string" ||
    !/^[a-z0-9.-]{1,64}$/i.test(data.sid) ||
    typeof data.color !== "string" ||
    data.color.length > 20 ||
    !Array.isArray(data.pts) ||
    !data.pts.length ||
    data.pts.length > 50
  )
    return null;
  const pts: [number, number][] = [];
  for (const p of data.pts) {
    if (
      !Array.isArray(p) ||
      p.length !== 2 ||
      !p.every((n) => typeof n === "number" && Number.isFinite(n))
    )
      return null;
    pts.push([Math.max(0, Math.min(1, p[0])), Math.max(0, Math.min(1, p[1]))]);
  }
  return { sid: data.sid, color: data.color, pts };
}
export const BUBBLE_COUNT = 24;
export type BubblePop = { index: number; startAt: number; at: number };
export function readBubblePop(
  data: Record<string, unknown>,
  startAt: number,
  now: number,
): BubblePop | null {
  return Number.isInteger(data.index) &&
    Number(data.index) >= 0 &&
    Number(data.index) < BUBBLE_COUNT &&
    data.startAt === startAt &&
    typeof data.at === "number" &&
    Number.isFinite(data.at) &&
    data.at >= Math.max(startAt, now - 10000) &&
    data.at <= now + 1500
    ? { index: Number(data.index), startAt, at: data.at }
    : null;
}
type GameEvent = Envelope & { at: number };
export type GameSnapshot = {
  active: boolean;
  game: Game | null;
  menu: boolean;
  startAt: number;
  invite: { from: string; name: string; game: Game; startAt: number } | null;
  notice: string;
};
/** Both games share a lifecycle. This controller never changes the existing focus timer. */
export class BreakGameSession {
  private snapshot: GameSnapshot = {
    active: false,
    game: null,
    menu: false,
    startAt: 0,
    invite: null,
    notice: "",
  };
  private listeners = new Set<() => void>();
  private remote = new Set<(m: Envelope) => void>();
  private off: () => void = () => {};
  private presenceOff: () => void = () => {};
  private queried = false;
  private history: GameEvent[] = [];
  private syncing: { from: string; nonce: string; until: number; chunks: Set<number> } | null = null;
  private remember(event: Envelope, at = this.now()) {
    this.history = [
      ...this.history.filter((e) => this.now() - e.at < 20000),
      { ...event, at },
    ].slice(-RELIABILITY.gameHistory);
  }
  private emit(event: Envelope, at = this.now()) {
    this.remember(event, at);
    this.remote.forEach((fn) => fn(event));
  }
  private invitations = new Map<string, { game: Game; startAt: number }>();
  constructor(private table: TableSession) {}
  connect() {
    this.off();
    this.presenceOff();
    this.off = this.table.onMessage((m) => this.onRemoteEvent(m));
    this.presenceOff = this.table.subscribe(() => this.query());
  }
  private query() {
    const t = this.table.getSnapshot();
    if (t.state === "idle") {
      this.invitations.clear();
      this.queried = false;
    }
    for (const [id, invite] of this.invitations) {
      const member = t.members.find((m) => m.id === id);
      if (
        !member ||
        member.status !== "break" ||
        member.playing !== invite.game
      )
        this.invitations.delete(id);
    }
    if (
      this.snapshot.active &&
      !this.queried &&
      t.state === "joined" &&
      t.members.find((m) => m.id === t.id)?.status === "break"
    ) {
      this.queried = true;
      this.table.send("game_query", {});
    }
  }
  color() {
    const t = this.table.getSnapshot();
    return t.members.find((m) => m.id === t.id)?.color || "blue";
  }
  getSnapshot = () => this.snapshot;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private update(next: Partial<GameSnapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    this.listeners.forEach((fn) => fn());
  }
  setBreak(active: boolean) {
    if (active === this.snapshot.active) return;
    if (!active) {
      const played = !!this.snapshot.game;
      this.stop();
      this.update({
        active: false,
        invite: null,
        menu: false,
        notice: played ? "Break's over, we'll save your spot." : "",
      });
    } else {
      this.update({ active: true, notice: "" });
      this.queried = false;
      this.query();
    }
  }
  showMenu() {
    if (this.snapshot.active) this.update({ menu: !this.snapshot.menu });
  }
  start(game: Game, startAt?: number) {
    if (!this.snapshot.active) return;
    this.history = [];
    this.syncing = null;
    const at = startAt ?? Date.now() + this.table.getSnapshot().offset;
    this.update({ game, startAt: at, menu: false, invite: null, notice: "" });
    this.table.setPlaying(game);
    if (startAt === undefined)
      this.table.send("game_invite", { game, startAt: at });
  }
  canJoin(message: TableMessage) {
    const member = this.table
      .getSnapshot()
      .members.find((m) => m.id === message.from);
    const invitation = this.invitations.get(message.from);
    return (
      this.snapshot.active &&
      member?.status === "break" &&
      member.playing === message.game &&
      invitation?.game === message.game &&
      invitation.startAt === message.startAt
    );
  }
  joinInvitation(message: TableMessage) {
    if (!this.snapshot.active) {
      this.update({ notice: "Available when you take a break." });
      return false;
    }
    if (!this.canJoin(message) || !message.game) {
      this.update({ notice: "That game has ended." });
      return false;
    }
    this.start(message.game, message.startAt);
    const nonce = crypto.randomUUID();
    this.syncing = { from: message.from, nonce, until: this.now() + 5000, chunks: new Set() };
    this.table.send("game_sync_request", {
      to: message.from,
      game: message.game,
      startAt: message.startAt,
      nonce,
    });
    return true;
  }
  stop() {
    if (this.snapshot.game)
      this.table.send("game_stop", {
        game: this.snapshot.game,
        startAt: this.snapshot.startAt,
      });
    this.history = [];
    this.syncing = null;
    this.update({ game: null, menu: false, startAt: 0 });
    this.table.setPlaying(null);
  }
  dismissInvite() {
    this.update({ invite: null });
  }
  sendStroke(stroke: Stroke) {
    if (this.snapshot.active && this.snapshot.game === "doodle") {
      const data = { ...stroke, startAt: this.snapshot.startAt };
      this.table.send("doodle", data);
      this.remember({
        from: this.table.getSnapshot().id,
        event: "doodle",
        data,
      });
    }
  }
  popBubble(index: number) {
    if (!this.snapshot.active || this.snapshot.game !== "bubbles") return;
    const data = readBubblePop(
      { index, startAt: this.snapshot.startAt, at: this.now() },
      this.snapshot.startAt,
      this.now(),
    );
    if (!data) return;
    this.table.send("bubble_pop", data);
    this.emit({ from: this.table.getSnapshot().id, event: "bubble_pop", data });
  }
  clear() {
    if (this.snapshot.active && this.snapshot.game === "doodle") {
      this.history = [];
      this.table.send("doodle_clear", { startAt: this.snapshot.startAt });
      this.remote.forEach((fn) =>
        fn({
          from: this.table.getSnapshot().id,
          event: "doodle_clear",
          data: {},
        }),
      );
    }
  }
  listen(fn: (m: Envelope) => void) {
    this.remote.add(fn);
    for (const event of this.history)
      fn({ ...event, data: { ...event.data, replayAt: event.at } });
    return () => {
      this.remote.delete(fn);
    };
  }
  now() {
    return Date.now() + this.table.getSnapshot().offset;
  }
  onRemoteEvent(m: Envelope) {
    const table = this.table.getSnapshot(),
      member = table.members.find((p) => p.id === m.from);
    if (!member) return;
    if (m.event === "game_stop") {
      const invite = this.invitations.get(m.from);
      if (
        invite &&
        invite.startAt === m.data.startAt &&
        invite.game === m.data.game
      ) {
        this.invitations.delete(m.from);
        if (this.snapshot.invite?.from === m.from)
          this.update({ invite: null });
      }
      return;
    }
    if (m.event === "game_sync_request") {
      if (
        m.data.to !== table.id ||
        m.data.game !== this.snapshot.game ||
        m.data.startAt !== this.snapshot.startAt ||
        typeof m.data.nonce !== "string" ||
        m.data.nonce.length > 50 ||
        !this.snapshot.active ||
        member.status !== "break"
      )
        return;
      const history = this.history.filter((e) => this.now() - e.at < 20000);
      for (let i = 0; i < history.length; i += 16)
        this.table.send("game_sync_state", {
          to: m.from,
          nonce: m.data.nonce,
          game: this.snapshot.game,
          startAt: this.snapshot.startAt,
          chunk: i / 16,
          entries: history.slice(i, i + 16),
        });
      return;
    }
    if (m.event === "game_sync_state") {
      if (
        !this.syncing ||
        this.syncing.from !== m.from ||
        this.syncing.until < this.now() ||
        m.data.nonce !== this.syncing.nonce ||
        m.data.to !== table.id ||
        m.data.game !== this.snapshot.game ||
        m.data.startAt !== this.snapshot.startAt ||
        !Array.isArray(m.data.entries) ||
        m.data.entries.length > 16
      )
        return;
      const chunk = m.data.chunk;
      if (
        !Number.isInteger(chunk) ||
        Number(chunk) < 0 ||
        Number(chunk) >= Math.ceil(RELIABILITY.gameHistory / 16) ||
        this.syncing.chunks.has(Number(chunk))
      )
        return;
      this.syncing.chunks.add(Number(chunk));
      for (const entry of m.data.entries) {
        if (
          !object(entry) ||
          !object(entry.data) ||
          typeof entry.at !== "number" ||
          entry.at > this.now() + 1500 ||
          entry.at < this.now() - 20000
        )
          continue;
        const original = table.members.find((p) => p.id === entry.from);
        if (
          !original ||
          !["doodle", "bubble_pop"].includes(String(entry.event))
        )
          continue;
        this.acceptEvent(
          { from: original.id, event: String(entry.event), data: entry.data },
          original.color,
          entry.at,
        );
      }
      return;
    }
    if (m.event === "game_query" && this.snapshot.game) {
      this.table.send("game_state", {
        to: m.from,
        game: this.snapshot.game,
        startAt: this.snapshot.startAt,
      });
      return;
    }
    if (m.event === "game_invite" || m.event === "game_state") {
      if (m.event === "game_state" && m.data.to !== table.id) return;
      const { game, startAt } = m.data;
      if (
        !["doodle", "bubbles"].includes(String(game)) ||
        typeof startAt !== "number" ||
        !Number.isFinite(startAt) ||
        startAt > this.now() + 5000 ||
        startAt < this.now() - 5400000
      )
        return;
      this.invitations.set(m.from, { game: game as Game, startAt });
      if (!this.snapshot.game)
        this.update({
          invite: {
            from: m.from,
            name: member.name,
            game: game as Game,
            startAt,
          },
        });
      return;
    }
    if (
      !this.snapshot.active ||
      member.status !== "break" ||
      member.playing !== this.snapshot.game
    )
      return;
    this.acceptEvent(m, member.color);
  }
  private acceptEvent(m: Envelope, color: string, at = this.now()) {
    if (m.data.startAt !== this.snapshot.startAt) return;
    if (m.event === "bubble_pop" && this.snapshot.game === "bubbles") {
      const pop = readBubblePop(m.data, this.snapshot.startAt, this.now());
      if (pop) this.emit({ ...m, data: pop }, at);
    }
    if (this.snapshot.game !== "doodle") return;
    if (m.event === "doodle") {
      const stroke = readStroke(m.data);
      if (stroke)
        this.emit(
          {
            ...m,
            data: {
              ...stroke,
              color,
              replayAt: at,
              startAt: this.snapshot.startAt,
            },
          },
          at,
        );
    }
    if (m.event === "doodle_clear") {
      this.history = [];
      this.remote.forEach((fn) => fn(m));
    }
  }

  dispose() {
    this.stop();
    this.off();
    this.presenceOff();
    this.remote.clear();
    this.invitations.clear();
  }
}
