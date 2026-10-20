import { setting } from "@/lib/todo/settings";
import type { PublicConfig } from "./protocol";
/** Public connection settings only. Uses Todo's existing verified Firebase identity. */
export function tableConfig(): PublicConfig {
  const url = (setting("TODO_FIREBASE_DATABASE_URL") || "")
    .trim()
    .replace(/\/+$/, "");
  const configured =
    /^https:\/\/[a-z0-9-]+\.(?:firebaseio\.com|[a-z0-9-]+\.firebasedatabase\.app)$/.test(
      url,
    );
  const turn = setting("TODO_TURN_URL"),
    username = setting("TODO_TURN_USERNAME"),
    credential = setting("TODO_TURN_CREDENTIAL");
  const iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
  if (turn && /^(turn|turns):/.test(turn) && username && credential)
    iceServers.push({ urls: turn, username, credential });
  return {
    enabled: setting("TODO_FEATURE_TABLES") !== "0",
    voice: setting("TODO_FEATURE_VOICE") !== "0",
    games: setting("TODO_FEATURE_BREAK_GAMES") !== "0",
    configured,
    url: configured ? url : "",
    iceServers,
  };
}
