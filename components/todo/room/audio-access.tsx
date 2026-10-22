"use client";
import { useEffect, useState } from "react";
const contexts = new Set<AudioContext>();
const notify = () => window.dispatchEvent(new Event("todo:audio-access"));
/** Room audio only. Live call playback keeps its existing independent permission UI. */
export function watchRoomAudio(context: AudioContext) {
  contexts.add(context);
  const changed = () => {
    if (context.state === "closed") contexts.delete(context);
    notify();
  };
  context.addEventListener("statechange", changed);
  changed();
  return () => {
    contexts.delete(context);
    context.removeEventListener("statechange", changed);
    notify();
  };
}
export function AudioAccess({ muted }: { muted: boolean }) {
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const sync = () =>
      setBlocked([...contexts].some((c) => c.state === "suspended"));
    sync();
    window.addEventListener("todo:audio-access", sync);
    return () => window.removeEventListener("todo:audio-access", sync);
  }, []);
  if (!blocked || muted) return null;
  return (
    <button
      className="room-audio-unlock"
      onClick={() => {
        for (const context of contexts)
          if (context.state === "suspended")
            void context.resume().catch(() => notify());
      }}
    >
      Tap to enable sound
    </button>
  );
}
