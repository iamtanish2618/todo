import { test, expect } from "@playwright/test";
import {
  readBubblePop,
  readStroke,
  BreakGameSession,
} from "../lib/todo/table/games";
import { TableSession } from "../lib/todo/table/session";
test("bubble events validate the current game, time and slot; strokes stay bounded", () => {
  const pop = { index: 2, startAt: 1000, at: 2000 };
  expect(readBubblePop(pop, 1000, 2000)).toEqual(pop);
  for (const data of [
    { ...pop, index: -1 },
    { ...pop, index: 24 },
    { ...pop, index: 1.5 },
    { ...pop, at: NaN },
    { ...pop, at: Infinity },
    { ...pop, at: 4000 },
    { ...pop, startAt: 999 },
  ])
    expect(readBubblePop(data, 1000, 2000)).toBeNull();
  expect(readBubblePop(pop, 1000, 20000)).toBeNull();
  expect(
    readStroke({ sid: "abc", color: "blue", pts: [[-1, 2]] })?.pts,
  ).toEqual([[0, 1]]);
  expect(
    readStroke({
      sid: "abc",
      color: "blue",
      pts: Array.from({ length: 51 }, () => [0, 0]),
    }),
  ).toBeNull();
  expect(readStroke({ sid: "abc", color: "blue", pts: [[NaN, 1]] })).toBeNull();
});
test("games are break-only, optional and close without touching the timer", () => {
  const table = new TableSession(),
    games = new BreakGameSession(table);
  games.connect();
  games.start("doodle");
  expect(games.getSnapshot().game).toBeNull();
  games.setBreak(true);
  games.start("doodle");
  expect(games.getSnapshot().game).toBe("doodle");
  games.setBreak(false);
  expect(games.getSnapshot().game).toBeNull();
  expect(games.getSnapshot().notice).toContain("Break's over");
  games.setBreak(true);
  expect(games.getSnapshot().notice).toBe("");
  games.start("bubbles", 5000);
  expect(games.getSnapshot().startAt).toBe(5000);
  games.dispose();
});
