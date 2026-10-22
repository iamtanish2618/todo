/** Small, explicit dials for the room's motion. Positions share the 1536 × 1024 art. */
export const CINEMA = {
  entry: { reveal: 1.2, sleep: 1500, wake: 1450 },
  idle: { min: 6000, max: 12000, sleep: 60000, blinkMin: 3000, blinkMax: 6000 },
  particles: { full: 86, low: 28, snow: 72, rain: 42, dust: 20 },
  colors: { gold: "#f5d9a3", ink: "#49392e", cream: "#fff8ed" },
  starInterval: 120000,
} as const;
export type RoomWeather = "morning" | "night" | "rain" | "snow" | "sunset";
export type RoomMix = {
  rain: number;
  fire: number;
  cafe: number;
  waves: number;
  pad: number;
};
export const EMPTY_MIX: RoomMix = {
  rain: 0,
  fire: 0,
  cafe: 0,
  waves: 0,
  pad: 0,
};
export type EndCue = "chime" | "voice" | "silent";
export function timeWeather(hour = new Date().getHours()): RoomWeather {
  return hour >= 7 && hour < 17
    ? "morning"
    : hour >= 17 && hour < 20
      ? "sunset"
      : "night";
}
/** Local visual events never start, finish, or mutate a user's session. */
export function roomEffect(target: Element | null, kind: string) {
  target
    ?.closest(".cozy-room")
    ?.dispatchEvent(new CustomEvent("todo:room-effect", { detail: { kind } }));
}
