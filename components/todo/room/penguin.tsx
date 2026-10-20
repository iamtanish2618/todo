"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { ROOM_CONFIG as C, type RoomPose } from "./config";

export function RoomPenguin({
  pose,
  female,
  reduced,
  active,
}: {
  pose: RoomPose;
  female: boolean;
  reduced: boolean;
  active: boolean;
}) {
  const root = useRef<HTMLButtonElement>(null);
  const [reaction, setReaction] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const reactionTime = useRef(0),
    cleanup = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (cleanup.current) clearTimeout(cleanup.current);
    },
    [],
  );
  useEffect(() => {
    if (!active || reduced || !root.current) return;
    const element = root.current;
    let removeTick = () => {},
      disposed = false,
      rect = element.getBoundingClientRect();
    let targetX = 0,
      targetY = 0,
      x = 0,
      y = 0,
      blinkUntil = 0,
      nextBlink = performance.now() + C.timing.blinkMin + Math.random() * 3000,
      nextGlance = performance.now() + 6000,
      glanceUntil = 0;
    const measure = () => {
      rect = element.getBoundingClientRect();
    };
    const pointer = (e: PointerEvent) => {
      targetX = Math.max(
        -1,
        Math.min(1, (e.clientX - rect.x - rect.width / 2) / 200),
      );
      targetY = Math.max(
        -1,
        Math.min(1, (e.clientY - rect.y - rect.height / 2) / 180),
      );
    };
    const leave = () => {
      targetX = targetY = 0;
    };
    const tick = () => {
      if (disposed || document.hidden) return;
      const now = performance.now();
      const tracking =
        pose !== "sleeping" && pose !== "typing" && pose !== "writing";
      if (now > nextGlance) {
        glanceUntil = now + 900;
        nextGlance = now + 7000 + Math.random() * 5000;
      }
      x +=
        ((tracking ? (now < glanceUntil ? -0.8 : targetX) : 0) - x) *
        C.timing.lerp;
      y += ((tracking ? targetY : 0) - y) * C.timing.lerp;
      element.style.setProperty("--gaze-x", `${x * 1.7}px`);
      element.style.setProperty("--gaze-y", `${y * 1.2}px`);
      if (now > nextBlink) {
        blinkUntil = now + 140;
        nextBlink = now + C.timing.blinkMin + Math.random() * 3000;
      }
      element.dataset.blink = String(
        now < blinkUntil &&
          pose !== "sleeping" &&
          pose !== "typing" &&
          now - reactionTime.current > 1200,
      );
    };
    window.addEventListener("pointermove", pointer, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    document.addEventListener("pointerleave", leave);
    // Share GSAP's existing RAF with the introduction; no second frame loop.
    void import("gsap").then(({ gsap }) => {
      if (disposed) return;
      gsap.ticker.add(tick);
      removeTick = () => gsap.ticker.remove(tick);
    });
    return () => {
      disposed = true;
      removeTick();
      window.removeEventListener("pointermove", pointer);
      window.removeEventListener("resize", measure);
      document.removeEventListener("pointerleave", leave);
    };
  }, [active, reduced, pose]);
  const boop = () => {
    const now = performance.now();
    if (now - reactionTime.current < C.timing.reaction + C.timing.cooldown)
      return;
    reactionTime.current = now;
    setReaction(["awe", "pop", "giggle"][Math.floor(Math.random() * 3)]);
    if (cleanup.current) clearTimeout(cleanup.current);
    cleanup.current = setTimeout(() => setReaction(""), C.timing.reaction);
  };
  // Focus artwork has a real lowered head and downward pupils, with no baked-in props.
  const poseSource = (p: RoomPose) => {
    const base =
      p === "writing" ? C.focusedPose : C.poses[p === "tea" ? "idle" : p];
    return female ? base.replace(".png", "-pink.png") : base;
  };
  const source = (p: RoomPose) =>
    !missing.includes(poseSource(p))
      ? poseSource(p)
      : !missing.includes(poseSource("idle"))
        ? poseSource("idle")
        : "/art/todo-seated.png";
  const eyeMap = C.eyes.idle;
  return (
    <button
      ref={root}
      className={`room-pet ${reduced ? "pet-gentle" : ""}`}
      data-pose={pose}
      data-attention={pose === "writing" ? "notebook" : "room"}
      data-reaction={reaction || "idle"}
      aria-label="Say hello to Todo"
      onClick={boop}
    >
      <span className="room-pet-breathe">
        {(Object.keys(C.poses) as RoomPose[]).map((p) => (
          <img
            key={`${p}-${female}`}
            src={source(p)}
            alt=""
            aria-hidden="true"
            draggable={false}
            className={`room-pose ${p === pose ? "pose-visible" : ""}`}
            onError={(event) => {
              const failed = event.currentTarget.getAttribute("src")!;
              setMissing((m) => (m.includes(failed) ? m : [...m, failed]));
            }}
          />
        ))}
        <span
          className="room-gaze"
          style={{
            transform: "translate3d(var(--gaze-x,0px),var(--gaze-y,0px),0)",
          }}
        >
          {(["left", "right"] as const).map((side) => {
            const x = eyeMap[side].x - C.eyes.width / 2,
              y = eyeMap[side].y - C.eyes.height / 2;
            return (
              <span
                key={side}
                className="room-live-eye"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${C.eyes.width}%`,
                  height: `${C.eyes.height}%`,
                }}
              >
                <img
                  className="room-eye-patch"
                  src={source(pose)}
                  alt=""
                  aria-hidden="true"
                  style={{
                    width: `${10000 / C.eyes.width}%`,
                    height: `${10000 / C.eyes.height}%`,
                    left: `${(-x / C.eyes.width) * 100}%`,
                    top: `${(-y / C.eyes.height) * 100}%`,
                  }}
                />
                <span className="room-idle-lid" />
              </span>
            );
          })}
        </span>
      </span>
      {reaction === "awe" ? (
        <Sparkles className="room-pet-spark" size={22} />
      ) : null}
      {reaction === "giggle" ? (
        <span className="room-pet-heart" aria-hidden="true">
          ♡
        </span>
      ) : null}
    </button>
  );
}
