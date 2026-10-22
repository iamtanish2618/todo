/** Stage 3 uses the existing controllers, without a new service or dependency. */
export const RELIABILITY = { enabled: true, gameHistory: 96 } as const;
export const OFFLINE_MESSAGE =
  "You're offline. Your timer can keep going. We'll reconnect when you're back.";
export function requestMessage(status: number, detail?: unknown) {
  if (status === 401) return "Please sign in again. Your room will be here.";
  if (status === 403) return "Please refresh Todo and try again.";
  if (status === 429)
    return "I'm resting for today, but I'm still here with you.";
  // Keep useful, deliberately written validation prompts; never display a provider/stack response.
  if (
    [400, 413, 422].includes(status) &&
    typeof detail === "string" &&
    /^(Choose |Add |Keep |Please |This image |That file |Some characters )/.test(
      detail,
    ) &&
    detail.length < 240
  )
    return detail;
  return status === 404
    ? "We couldn't find that. Please refresh and try again."
    : "Couldn't connect just now. Your work is still here. Please try again.";
}
export function friendlyError(
  error: unknown,
  fallback = "Couldn't do that just now. Please try again.",
) {
  return error instanceof Error && error.name === "TodoRequestError"
    ? error.message
    : fallback;
}
/** Restored deadlines keep counting; invalid storage is ignored instead of stranding a clock. */
export function validTimer(value: unknown): value is {
  task: string;
  remaining: number;
  duration: number;
  deadline: number | null;
  phase: "focus" | "break";
  started: boolean;
  id: string;
} {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.task === "string" &&
    t.task.length <= 180 &&
    typeof t.duration === "number" &&
    Number.isFinite(t.duration) &&
    t.duration > 0 &&
    t.duration <= 7200 &&
    typeof t.remaining === "number" &&
    Number.isFinite(t.remaining) &&
    t.remaining >= 0 &&
    t.remaining <= t.duration &&
    (t.deadline === null ||
      (typeof t.deadline === "number" &&
        Number.isFinite(t.deadline) &&
        t.deadline > 0 &&
        t.started === true)) &&
    (t.phase === "focus" || t.phase === "break") &&
    typeof t.started === "boolean" &&
    typeof t.id === "string" &&
    (!t.started || t.id.length > 0)
  );
}
