/** Small, deterministic helpers shared by the room and its existing timer. */
export const SUPPORT = {
  enabled: true,
  starterMinutes: 5,
  nudgeAfterMs: 50 * 60 * 1000,
  returnAfterMs: 2 * 24 * 60 * 60 * 1000,
  fallbackSteps: [
    "Open what you need for this task. That can be your first step.",
    "Pick one tiny part and write its first line. It does not need to be perfect.",
    "Read just one paragraph or look at one example. You can stop there for now.",
  ],
} as const;
export type EndCue = "chime" | "voice" | "silent";
/** Older builds always persisted voice as a default, without an exposed choice. */
export function completionCue(saved: {
  supportVersion?: unknown;
  cue?: unknown;
}): EndCue {
  if (saved.cue === "silent") return "silent";
  if (saved.supportVersion === 1 && saved.cue === "voice") return "voice";
  return "chime";
}
export function elapsedFocusSeconds(
  duration: number,
  remaining: number,
  deadline?: number | null,
  now = Date.now(),
) {
  const left = deadline
    ? Math.max(0, Math.ceil((deadline - now) / 1000))
    : remaining;
  return Math.max(0, Math.min(duration, duration - left));
}
export function isAwayReturn(lastSeen: number, now = Date.now()) {
  return (
    Number.isFinite(lastSeen) &&
    lastSeen > 0 &&
    now - lastSeen >= SUPPORT.returnAfterMs
  );
}
export function nudgeDelay(started: number, now = Date.now()) {
  return Math.max(0, SUPPORT.nudgeAfterMs - Math.max(0, now - started));
}
export function fallbackSteps(index = 0) {
  return SUPPORT.fallbackSteps.map(
    (_, i) => SUPPORT.fallbackSteps[(i + index) % SUPPORT.fallbackSteps.length],
  );
}
