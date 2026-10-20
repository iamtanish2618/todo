/** Exact user-selected recordings. Weather deliberately has no audio mapping. */
export const SOUND_RECORDINGS = {
  white: { label: "White noise", videoId: "ooyuJ-01TS0" },
  brown: { label: "Brown noise", videoId: "InlECJg9FFw" },
  rain: { label: "Rainy noise", videoId: "CpS5Ex1Wx-4" },
} as const;
export type Recording = keyof typeof SOUND_RECORDINGS;
export type Soundscape = "off" | Recording;
