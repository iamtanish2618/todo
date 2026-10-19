/** Coordinates are percentages of the uncropped 1536 × 1024 artwork. */
export const ROOM_CONFIG = {
  image: "/art/study-room.png",
  aspectRatio: 3 / 2,
  zones: {
    window: { x: 0, y: 0, width: 29, height: 68 },
    chair: { x: 39, y: 49, width: 29, height: 29 },
    wall: { x: 40, y: 3, width: 20, height: 45 },
    painting: { x: 61, y: 15, width: 15, height: 30 },
    lamp: { x: 80, y: 25, width: 10, height: 48 },
    shelf: { x: 90, y: 0, width: 10, height: 77 },
    rug: { x: 0, y: 78, width: 100, height: 22 },
  },
  penguin: { x: 39.5, y: 31, width: 28, height: 42 },
  shadow: { x: 44, y: 67, width: 20, height: 3 },
  home: { x: 32, y: 81, width: 37, height: 16 },
  panel: { x: 71, y: 13, width: 27, height: 64 },
  chat: { x: 70, y: 18, width: 28, height: 57 },
  bubble: { x: 42, y: 41, width: 23, height: 6 },
  chairFront:
    "polygon(39.2% 61%, 40.6% 60%, 41.6% 62%, 41.6% 70%, 46% 68.3%, 60% 68.3%, 65.7% 70%, 65.7% 62%, 66.6% 60%, 67.7% 61%, 67.7% 77.7%, 39.2% 77.7%)",
  poses: {
    idle: "/art/room-todo-idle.png",
    writing: "/art/room-todo-writing.png",
    typing: "/art/room-todo-typing.png",
    tea: "/art/room-todo-tea.png",
    sleeping: "/art/room-todo-sleeping.png",
  },
  eyes: {
    width: 11,
    height: 11,
    idle: { left: { x: 39.1, y: 42.6 }, right: { x: 61.9, y: 43 } },
    writing: { left: { x: 42.7, y: 47.4 }, right: { x: 62.4, y: 51.1 } },
    tea: { left: { x: 39.5, y: 43.5 }, right: { x: 62.5, y: 44.4 } },
  },
  colors: {
    primary: "#2B2622",
    cream: "#FFF8ED",
    orange: "#E8A24A",
    dusk: "#71899F",
    glass: "rgba(255,255,255,.6)",
  },
  timing: {
    panel: 240,
    pose: 250,
    reaction: 600,
    cooldown: 600,
    blinkMin: 3000,
    blinkMax: 6000,
    lerp: 0.1,
  },
  dailyLimit: 25,
  defaultMinutes: 25,
  breakMinutes: 5,
  restMessage: "I'm resting for today, but I'm still here with you.",
} as const;
export type RoomPose = keyof typeof ROOM_CONFIG.poses;
export const zoneStyle = (z: {
  x: number;
  y: number;
  width: number;
  height: number;
}) => ({
  left: `${z.x}%`,
  top: `${z.y}%`,
  width: `${z.width}%`,
  height: `${z.height}%`,
});
