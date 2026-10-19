import { setting } from "./settings";
import { ROOM_CONFIG } from "@/components/todo/room/config";
export function dailyLimit() {
  return Math.min(
    100,
    Math.max(
      1,
      Number(setting("TODO_AI_DAILY_LIMIT")) || ROOM_CONFIG.dailyLimit,
    ),
  );
}
export function usageDay(now = new Date()) {
  return now.toISOString().slice(0, 10);
}
export function quotaReset(now = new Date()) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).toISOString();
}
