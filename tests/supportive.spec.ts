import { test, expect } from "@playwright/test";
import {
  SUPPORT,
  completionCue,
  elapsedFocusSeconds,
  isAwayReturn,
  nudgeDelay,
  fallbackSteps,
} from "../lib/todo/support";

test("completion defaults migrate to chime while explicit current choices survive", () => {
  expect(completionCue({})).toBe("chime");
  expect(completionCue({ cue: "voice" })).toBe("chime");
  expect(completionCue({ cue: "silent" })).toBe("silent");
  expect(completionCue({ supportVersion: 1, cue: "voice" })).toBe("voice");
  expect(completionCue({ supportVersion: 1, cue: "chime" })).toBe("chime");
});
test("focused time uses the actual deadline or paused remainder, including extensions", () => {
  expect(elapsedFocusSeconds(1500, 1500, 101000, 100000)).toBe(1499);
  expect(elapsedFocusSeconds(1500, 1405, null, 100000)).toBe(95);
  expect(elapsedFocusSeconds(1800, 1705, null, 100000)).toBe(95);
  expect(elapsedFocusSeconds(1500, 1500, 1600000, 100000)).toBe(0);
  expect(elapsedFocusSeconds(1500, 0, 500, 100000)).toBe(1500);
});
test("welcome-back threshold is gentle and never treats a first visit or future date as absence", () => {
  const now = 10 * SUPPORT.returnAfterMs;
  expect(isAwayReturn(0, now)).toBe(false);
  expect(isAwayReturn(Number.NaN, now)).toBe(false);
  expect(isAwayReturn(now + 1, now)).toBe(false);
  expect(isAwayReturn(now - SUPPORT.returnAfterMs, now)).toBe(true);
  expect(isAwayReturn(now - 60000, now)).toBe(false);
});
test("nudge reaches 50 minutes only after an uninterrupted run; fallback always has three ideas", () => {
  expect(SUPPORT.nudgeAfterMs).toBe(50 * 60 * 1000);
  expect(nudgeDelay(1000, 1000 + 49 * 60 * 1000)).toBe(60000);
  expect(nudgeDelay(1000, 1000 + 50 * 60 * 1000)).toBe(0);
  expect(nudgeDelay(2000, 2000)).toBe(SUPPORT.nudgeAfterMs);
  expect(fallbackSteps()).toHaveLength(3);
  expect(fallbackSteps(1)).not.toEqual(fallbackSteps());
  expect(new Set(fallbackSteps(100)).size).toBe(3);
});
