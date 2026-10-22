/** Public, temporary table protocol. No account identifiers or history belong here. */
export const TABLE = {
  maxMembers: 4,
  alphabet: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
  arrivalMs: 3000,
  syncTimeoutMs: 10000,
  presenceMs: 500,
  signalPerSecond: 40,
} as const;
export const COLORS = {
  blue: "#6d93bc",
  pink: "#d696af",
  sage: "#8ba98c",
  honey: "#c9a468",
  lavender: "#a698ba",
  rust: "#bd8c75",
} as const;
export type Color = keyof typeof COLORS;
export type Status = "arriving" | "idle" | "focusing" | "break";
export type Game = "doodle" | "bubbles";
export type Member = {
  id: string;
  name: string;
  color: Color;
  companion: "male" | "female";
  joinedAt: number;
  status: Status;
  mic: "muted" | "live";
  hasMicPermission: boolean;
  playing: Game | null;
};
export type Reaction = "wave" | "cheer" | "heart" | "coffee";
export type Envelope = {
  from: string;
  event: string;
  data: Record<string, unknown>;
};
export type PublicConfig = {
  enabled: boolean;
  configured: boolean;
  voice: boolean;
  games: boolean;
  url: string;
  iceServers: RTCIceServer[];
};
export const EMPTY_CONFIG: PublicConfig = {
  enabled: true,
  configured: false,
  voice: false,
  games: true,
  url: "",
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};
export const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export const validId = (v: unknown): v is string =>
  typeof v === "string" && /^[a-f0-9-]{36}$/i.test(v);
export function normalizeCode(value: string) {
  const v = value.trim().toUpperCase().replace(/[\s-]/g, "");
  return /^PENG[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(v)
    ? `PENG-${v.slice(4)}`
    : null;
}
export function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `PENG-${Array.from(bytes, (b) => TABLE.alphabet[b % 32]).join("")}`;
}
export function nickname(value: string) {
  const v = value.trim().replace(/\s+/g, " ");
  if (
    v.length < 2 ||
    v.length > 16 ||
    !/^[\p{L}\p{N} ._'!-]+$/u.test(v) ||
    /\b(fuck|shit|bitch|asshole|nigger|cunt)\b/i.test(v)
  )
    return null;
  return v;
}
export function uniqueName(name: string, members: Member[]) {
  let n = name,
    i = 2;
  while (members.some((m) => m.name.toLowerCase() === n.toLowerCase())) {
    const tail = ` ${i++}`;
    n = name.slice(0, 16 - tail.length) + tail;
  }
  return n;
}
export const ordered = (members: Member[]) =>
  [...members].sort(
    (a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id),
  );
export function readMember(value: unknown, key: string): Member | null {
  if (
    !object(value) ||
    value.id !== key ||
    !validId(value.id) ||
    typeof value.name !== "string" ||
    nickname(value.name) !== value.name ||
    typeof value.color !== "string" ||
    !Object.hasOwn(COLORS, value.color) ||
    (value.companion !== undefined &&
      value.companion !== "male" &&
      value.companion !== "female") ||
    typeof value.joinedAt !== "number" ||
    !Number.isFinite(value.joinedAt) ||
    value.joinedAt < 0 ||
    !["arriving", "idle", "focusing", "break"].includes(String(value.status)) ||
    !["muted", "live"].includes(String(value.mic)) ||
    typeof value.hasMicPermission !== "boolean" ||
    ![null, undefined, "doodle", "bubbles", "breathe"].includes(
      value.playing as null,
    )
  )
    return null;
  return {
    id: value.id,
    name: value.name,
    color: value.color as Color,
    companion:
      value.companion === "female" ||
      (!value.companion && value.color === "pink")
        ? "female"
        : "male",
    joinedAt: value.joinedAt,
    status: value.status as Status,
    mic: value.mic as Member["mic"],
    hasMicPermission: value.hasMicPermission,
    playing: (value.playing === "breathe"
      ? "bubbles"
      : value.playing || null) as Member["playing"],
  };
}
export function readEnvelope(value: unknown): Envelope | null {
  if (
    !object(value) ||
    !validId(value.from) ||
    typeof value.event !== "string" ||
    ![
      "kick",
      "close_room",
      "host_mute_request",
      "sit_start",
      "ping",
      "pong",
      "reaction",
      "signal",
      "voice_retry",
      "game_invite",
      "game_query",
      "game_state",
      "doodle",
      "doodle_clear",
      "bubble_pop",
      "chat",
    ].includes(value.event) ||
    !object(value.data)
  )
    return null;
  try {
    if (JSON.stringify(value).length > 70000) return null;
  } catch {
    return null;
  }
  return value as Envelope;
}
/** Sliding fixed window; separate bucket per sender and event. */
export class RateGate {
  private buckets = new Map<string, { at: number; count: number }>();
  allow(key: string, max: number, window = 1000) {
    const now = Date.now(),
      b = this.buckets.get(key);
    if (!b || now - b.at >= window) {
      this.buckets.set(key, { at: now, count: 1 });
      return true;
    }
    return ++b.count <= max;
  }
  clear() {
    this.buckets.clear();
  }
}
