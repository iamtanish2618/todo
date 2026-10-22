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
    if (!this.canJoin(message) || !message.game) return;
    this.start(message.game, message.startAt);
  }
  stop() {
    this.update({ game: null, menu: false, startAt: 0 });
    this.table.setPlaying(null);
  }
  dismissInvite() {
    this.update({ invite: null });
  }
  sendStroke(stroke: Stroke) {
    if (this.snapshot.active && this.snapshot.game === "doodle")
      this.table.send("doodle", stroke);
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
    this.remote.forEach((fn) =>
      fn({ from: this.table.getSnapshot().id, event: "bubble_pop", data }),
    );
  }
  clear() {
    if (this.snapshot.active && this.snapshot.game === "doodle") {
      this.table.send("doodle_clear", {});
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
    if (!this.snapshot.active || member.status !== "break") return;
    if (
      m.event === "bubble_pop" &&
      this.snapshot.game === "bubbles" &&
      member.playing === "bubbles"
    ) {
      const pop = readBubblePop(m.data, this.snapshot.startAt, this.now());
      if (pop) this.remote.forEach((fn) => fn({ ...m, data: pop }));
      return;
    }
    if (this.snapshot.game !== "doodle" || member.playing !== "doodle") return;
    if (m.event === "doodle" && object(m.data)) {
      const stroke = readStroke(m.data);
      if (stroke)
        this.remote.forEach((fn) =>
          fn({ ...m, data: { ...stroke, color: member.color } }),
        );
    }
    if (m.event === "doodle_clear") this.remote.forEach((fn) => fn(m));
  }
  dispose() {
    this.stop();
    this.off();
    this.presenceOff();
    this.remote.clear();
    this.invitations.clear();
  }
}
