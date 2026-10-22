/** User-supplied recordings, trimmed and circularly crossfaded. Weather stays independent. */
export const SOUND_RECORDINGS = {
  white: { label: "White noise", src: "/audio/white-noise-loop.wav" },
  brown: { label: "Brown noise", src: "/audio/brown-noise-loop.wav" },
  rain: { label: "Rainy noise", src: "/audio/rain-noise-loop.wav" },
} as const;
export type Recording = keyof typeof SOUND_RECORDINGS;
export type Soundscape = "off" | Recording;
