import { test, expect } from "@playwright/test";
import {
  breathPhase,
  readStroke,
  BreakGameSession,
} from "../lib/todo/table/games";
import { TableSession } from "../lib/todo/table/session";
test("breathing cycle, late phase and stroke validation", () => {
  expect(breathPhase(0, 0).label).toBe("Breathe in");
  expect(breathPhase(4000, 0).label).toBe("Hold");
  expect(breathPhase(7000, 0).label).toBe("Breathe out");
  expect(breathPhase(19000, 12000)).toEqual(breathPhase(7000, 0));
  expect(breathPhase(60000, 0).finished).toBe(true);
  expect(breathPhase(64000, 0).progress).toBe(0);
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
  games.start("breathe", 5000);
  expect(games.getSnapshot().startAt).toBe(5000);
  games.dispose();
});
