import { setting } from "@/lib/todo/settings";
import type { PublicConfig } from "./protocol";
import { createRelayIssuer, createMeteredRelayIssuer } from "./relay";
const issueRelay = createRelayIssuer();
const issueMeteredRelay = createMeteredRelayIssuer();
/** Public connection settings only. Uses Todo's existing verified Firebase identity. */
export function tableConfig(): PublicConfig {
  const url = (setting("TODO_FIREBASE_DATABASE_URL") || "")
    .trim()
    .replace(/\/+$/, "");
  const configured =
    /^https:\/\/[a-z0-9-]+\.(?:firebaseio\.com|[a-z0-9-]+\.firebasedatabase\.app)$/.test(
      url,
    );
  const iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
  return {
    enabled: setting("TODO_FEATURE_TABLES") !== "0",
    voice: setting("TODO_FEATURE_VOICE") !== "0",
    games: setting("TODO_FEATURE_BREAK_GAMES") !== "0",
    configured,
    url: configured ? url : "",
    iceServers,
  };
}

/** Guests can discover table availability, but never receive relay credentials. */
export async function authenticatedTableConfig(
  userId: string | null,
): Promise<PublicConfig> {
  const config = tableConfig();
  if (!userId || !config.enabled || !config.voice || !config.configured)
    return config;
  const host = setting("TODO_TURN_METERED_HOST"),
    apiKey = setting("TODO_TURN_METERED_API_KEY");
  if (host && apiKey) {
    try {
      config.iceServers.push(
        ...(await issueMeteredRelay(userId, { host, apiKey })),
      );
    } catch {
      /* A relay outage must not prevent table chat or direct voice. */
    }
    return config;
  }
  const id = setting("TODO_TURN_KEY_ID"),
    token = setting("TODO_TURN_API_TOKEN");
  if (id && token) {
    try {
      config.iceServers.push(...(await issueRelay(userId, { id, token })));
    } catch {
      /* Direct calls and table chat remain available during provider outages. */
    }
    return config;
  }
  // Compatibility for an owner's existing relay; never sent to anonymous visitors.
  const turn = setting("TODO_TURN_URL"),
    username = setting("TODO_TURN_USERNAME"),
    credential = setting("TODO_TURN_CREDENTIAL");
  if (turn && /^turns?:/.test(turn) && username && credential)
    config.iceServers.push({ urls: turn, username, credential });
  return config;
}
