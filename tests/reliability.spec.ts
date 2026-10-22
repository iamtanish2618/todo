import { test, expect } from "@playwright/test";
import {
  requestMessage,
  validTimer,
  friendlyError,
} from "../lib/todo/reliability";
import { RequestError } from "../lib/todo/client";
import { BreakGameSession } from "../lib/todo/table/games";
import {
  EMPTY_CONFIG,
  type Member,
  type Envelope,
} from "../lib/todo/table/protocol";
import type {
  TableSession,
  TableMessage,
  TableSnapshot,
} from "../lib/todo/table/session";
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002";
function harness(id: string, other: string) {
  const member = (id: string): Member => ({
    id,
    name: id === a ? "Ava" : "Bo",
    companion: "male",
    color: "blue",
    joinedAt: 1,
    status: "break",
    mic: "muted",
    hasMicPermission: false,
    playing: "bubbles",
  });
  const state: TableSnapshot = {
    config: EMPTY_CONFIG,
    state: "joined",
    code: "PENG-ABC234",
    members: [member(id), member(other)],
    id,
    host: a,
    message: "",
    sit: null,
    offset: 0,
    reactions: [],
    conversation: [],
  };
  const sent: Envelope[] = [];
  const table = {
    getSnapshot: () => state,
    subscribe: () => () => {},
    onMessage: () => () => {},
    setPlaying: (game: Member["playing"]) => {
      state.members[0].playing = game;
    },
    send: (event: string, data: Record<string, unknown>) =>
      sent.push({ from: id, event, data }),
  } as unknown as TableSession;
  const games = new BreakGameSession(table);
  games.connect();
  games.setBreak(true);
  return { games, state, sent };
}
function invitation(startAt: number): TableMessage {
  return {
    id: "invite",
    from: a,
    name: "Ava",
    text: "started Bubble Pop",
    at: Date.now(),
    kind: "game",
    game: "bubbles",
    startAt,
  };
}
test("API errors never reveal raw provider/stack text; known validation remains useful", () => {
  expect(requestMessage(500, "secret provider stack")).not.toContain("secret");
  expect(requestMessage(429)).toContain("resting for today");
  expect(requestMessage(401)).toContain("sign in");
  expect(requestMessage(400, "Choose a task.")).toBe("Choose a task.");
  expect(friendlyError(new TypeError("Failed to fetch"))).not.toContain(
    "fetch",
  );
  expect(friendlyError(new RequestError("Try again gently.", 0))).toBe(
    "Try again gently.",
  );
});
test("timer storage rejects corrupt or impossible clocks but retains running deadlines", () => {
  const timer = {
    task: "Read",
    remaining: 1405,
    duration: 1500,
    deadline: Date.now() - 1000,
    phase: "focus",
    started: true,
    id: "sit",
  };
  expect(validTimer(timer)).toBe(true);
  for (const change of [
    { remaining: NaN },
    { remaining: -1 },
    { duration: Infinity },
    { deadline: "later" },
    { deadline: 1, started: false },
    { id: "" },
    { phase: "unknown" },
  ])
    expect(validTimer({ ...timer, ...change })).toBe(false);
});
test("old Join actions explain break-only and ended games instead of silently doing nothing", () => {
  const { games, state } = harness(b, a),
    startAt = Date.now(),
    message = invitation(startAt);
  games.onRemoteEvent({
    from: a,
    event: "game_invite",
    data: { game: "bubbles", startAt },
  });
  games.setBreak(false);
  expect(games.joinInvitation(message)).toBe(false);
  expect(games.getSnapshot().notice).toBe("Available when you take a break.");
  games.setBreak(true);
  games.onRemoteEvent({
    from: a,
    event: "game_stop",
    data: { game: "bubbles", startAt },
  });
  expect(games.joinInvitation(message)).toBe(false);
  expect(games.getSnapshot().notice).toBe("That game has ended.");
  expect(state.members[0].playing).toBeNull();
  games.dispose();
});
test("late join replays bounded current bubble state; stale snapshots are ignored", () => {
  const source = harness(a, b),
    target = harness(b, a),
    startAt = Date.now();
  source.games.start("bubbles", startAt);
  source.games.popBubble(3);
  target.games.onRemoteEvent({
    from: a,
    event: "game_invite",
    data: { game: "bubbles", startAt },
  });
  expect(target.games.joinInvitation(invitation(startAt))).toBe(true);
  source.games.onRemoteEvent(
    target.sent.find((m) => m.event === "game_sync_request")!,
  );
  const packet = source.sent.find((m) => m.event === "game_sync_state")!;
  expect(packet.data.entries).toHaveLength(1);
  target.games.onRemoteEvent({
    ...packet,
    data: { ...packet.data, nonce: "stale" },
  });
  const replay: Envelope[] = [];
  const off = target.games.listen((m) => replay.push(m));
  expect(replay).toHaveLength(0);
  target.games.onRemoteEvent(packet);
  expect(replay[0].data.index).toBe(3);
  off();
  source.games.dispose();
  target.games.dispose();
});

test("late doodle join retains the game instance and clear removes replay history", () => {
  const source = harness(a, b),
    target = harness(b, a),
    startAt = Date.now();
  source.state.members.forEach((m) => (m.playing = "doodle"));
  target.state.members.forEach((m) => (m.playing = "doodle"));
  source.games.start("doodle", startAt);
  source.games.sendStroke({
    sid: "stroke-1",
    color: "blue",
    pts: [
      [0.1, 0.2],
      [0.3, 0.4],
    ],
  });
  target.games.onRemoteEvent({
    from: a,
    event: "game_invite",
    data: { game: "doodle", startAt },
  });
  expect(
    target.games.joinInvitation({ ...invitation(startAt), game: "doodle" }),
  ).toBe(true);
  source.games.onRemoteEvent(
    target.sent.find((m) => m.event === "game_sync_request")!,
  );
  const state = source.sent.find((m) => m.event === "game_sync_state")!;
  target.games.onRemoteEvent(state);
  const events: Envelope[] = [];
  const off = target.games.listen((m) => events.push(m));
  expect(events[0].event).toBe("doodle");
  expect(events[0].data.startAt).toBe(startAt);
  target.games.onRemoteEvent({
    from: a,
    event: "doodle_clear",
    data: { startAt },
  });
  off();
  const after: Envelope[] = [];
  target.games.listen((m) => after.push(m));
  expect(after).toHaveLength(0);
  source.games.dispose();
  target.games.dispose();
});
