"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import type { Color } from "@/lib/todo/table/protocol";
import { ROOM_CONFIG as C, type RoomPose } from "./config";

export function RoomPenguin({
  pose,
  female,
  reduced,
  active,
  calm = false,
  intro = "awake",
  beanie,
}: {
  pose: RoomPose;
  female: boolean;
  reduced: boolean;
  active: boolean;
  calm?: boolean;
  intro?: string;
  beanie?: Color;
}) {
  const root = useRef<HTMLButtonElement>(null);
  const [reaction, setReaction] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const lastReaction = useRef("");
  const reactionTime = useRef(0),
    cleanup = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (cleanup.current) clearTimeout(cleanup.current);
    },
    [],
  );
  useEffect(() => {
    if (!root.current) return;
    const element = root.current;
    // Stopping the ticker during a blink must never freeze the eyelids shut.
    element.dataset.blink = "false";
    element.style.setProperty("--gaze-x", "0px");
    element.style.setProperty("--gaze-y", "0px");
    if (!active || reduced) return;
    let removeTick = () => {},
      disposed = false,
      rect = element.getBoundingClientRect();
    let targetX = 0,
      targetY = 0,
      x = 0,
      y = 0,
      velocityX = 0,
      velocityY = 0,
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
      const behavior =
        element.closest<HTMLElement>(".round-room-art")?.dataset.behavior;
      const desiredX = tracking
        ? behavior === "window" || now < glanceUntil
          ? -0.8
          : targetX
        : 0;
      velocityX = (velocityX + (desiredX - x) * 0.12) * 0.7;
      velocityY = (velocityY + ((tracking ? targetY : 0) - y) * 0.12) * 0.7;
      x = Math.max(-1.05, Math.min(1.05, x + velocityX));
      y = Math.max(-1.05, Math.min(1.05, y + velocityY));
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
      element.dataset.blink = "false";
      window.removeEventListener("pointermove", pointer);
      window.removeEventListener("resize", measure);
      document.removeEventListener("pointerleave", leave);
    };
  }, [active, reduced, pose]);
  const boop = () => {
    const now = performance.now();
    if (calm || intro !== "awake" || now - reactionTime.current < 600) return;
    reactionTime.current = now;
    const reactions = [
      "awe",
      "pop",
      "giggle",
      "tickle",
      ...(Math.random() < 0.12 ? ["hearts"] : []),
    ].filter((r) => r !== lastReaction.current);
    const next = reactions[Math.floor(Math.random() * reactions.length)];
    lastReaction.current = next;
    setReaction(next);
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
      data-intro={intro}
      aria-disabled={calm}
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
        {beanie && beanie !== "blue" && beanie !== "pink" && (
          <>
            <img
              className="table-knit-tint table-knit-cap"
              data-color={beanie}
              src={source(pose)}
              alt=""
              aria-hidden="true"
            />
            <img
              className="table-knit-tint table-knit-scarf"
              data-color={beanie}
              src={source(pose)}
              alt=""
              aria-hidden="true"
            />
          </>
        )}
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
        <img
          className="cinema-pom-patch"
          src={source("idle")}
          alt=""
          aria-hidden="true"
        />
        <img
          className="cinema-scarf-patch"
          src={source("idle")}
          alt=""
          aria-hidden="true"
        />
        <span className="cinema-yawn" aria-hidden="true" />
        <span className="cinema-glasses" aria-hidden="true">
          <i />
          <i />
        </span>
        <span className="cinema-hat-pin" aria-hidden="true">
          ✦
        </span>
        <span className="cinema-heart-eyes" aria-hidden="true">
          ♥<i>♥</i>
        </span>
      </span>
      {reaction === "pop" ? (
        <span className="cinema-surprise-mark" aria-hidden="true">
          !
        </span>
      ) : null}
      {reaction === "awe" ? (
        <Sparkles className="room-pet-spark" size={22} />
      ) : null}
      {reaction === "giggle" || reaction === "hearts" ? (
        <span className="room-pet-heart" aria-hidden="true">
          ♡
        </span>
      ) : null}
    </button>
  );
}
