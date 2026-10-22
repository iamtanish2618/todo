"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ROOM_CONFIG as C } from "./config";
import { playTodoVoice, TODO_VOICE } from "./voice-cues";
import "./break-return.css";

export const BREAK_OVER_MESSAGE = TODO_VOICE.break.text;

/** One announcement, one covered scene swap, then the same room is ready again. */
export function BreakReturn({
  female,
  reduced,
  silent = false,
  onCovered,
  onComplete,
}: {
  female: boolean;
  reduced: boolean;
  silent?: boolean;
  onCovered: () => Promise<boolean>;
  onComplete: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef({ onCovered, onComplete });
  latest.current = { onCovered, onComplete };
  const start = useRef<() => void>(() => {});
  const retry = useRef<() => void>(() => {});
  const [error, setError] = useState(false);
  const [stage, setStage] = useState("announce");
  const image = female
    ? C.poses.idle.replace(".png", "-pink.png")
    : C.poses.idle;

  useEffect(() => {
    const element = root.current!;
    element.focus({ preventScroll: true });
    let disposed = false,
      sweeping = false,
      voiceDone = false;
    let stopRecording = () => {};
    let timeline: GSAPTimeline | null = null;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const startedAt = performance.now();
    const later = (fn: () => void, ms: number) => {
      timers.push(setTimeout(fn, ms));
    };
    const stopVoice = () => {
      stopRecording();
    };
    const replaceRoom = async () => {
      try {
        if (!(await latest.current.onCovered()))
          throw new Error("Room not ready");
        if (disposed) return;
        setError(false);
        setStage("reveal");
        timeline?.resume();
      } catch {
        if (!disposed) setError(true);
      }
    };
    retry.current = () => {
      setError(false);
      void replaceRoom();
    };
    const sweep = async () => {
      if (disposed || sweeping) return;
      sweeping = true;
      timers.forEach(clearTimeout);
      stopVoice();
      setStage("sweep");
      const { gsap } = await import("gsap");
      if (disposed) return;
      const veil = element.querySelector(".break-return-veil")!;
      const traveler = element.querySelector(".break-return-traveler")!;
      const announcement = element.querySelector(".break-return-message")!;
      const width = innerWidth,
        height = innerHeight;
      timeline = gsap.timeline({
        onComplete: () => {
          if (!disposed) latest.current.onComplete();
        },
      });
      timeline.to(
        announcement,
        { opacity: 0, y: reduced ? 0 : -10, duration: 0.25 },
        0,
      );
      if (!reduced) {
        timeline.fromTo(
          traveler,
          {
            x: -width * 1.5,
            y: height * 1.6,
            rotation: -12,
            scale: 0.85,
            autoAlpha: 1,
          },
          {
            x: 0,
            y: 0,
            rotation: -3,
            scale: 1.06,
            duration: 0.9,
            ease: "power2.inOut",
          },
          0,
        );
      }
      timeline.to(
        veil,
        { opacity: 1, duration: reduced ? 0.3 : 0.65, ease: "power2.inOut" },
        0,
      );
      timeline.addPause(reduced ? 0.32 : 0.92, () => {
        setStage("covered");
        void replaceRoom();
      });
      const reveal = reduced ? 0.34 : 0.94;
      if (!reduced)
        timeline.to(
          traveler,
          {
            x: width * 1.5,
            y: -height * 1.6,
            rotation: 9,
            scale: 1.12,
            duration: 1.0,
            ease: "power2.inOut",
          },
          reveal,
        );
      timeline.to(
        veil,
        { opacity: 0, duration: reduced ? 0.35 : 0.7, ease: "power2.inOut" },
        reveal + (reduced ? 0 : 0.2),
      );
      timeline.to(
        element,
        { opacity: 0, duration: 0.15 },
        reveal + (reduced ? 0.35 : 0.95),
      );
    };
    start.current = () => void sweep();
    const finishVoice = () => {
      if (disposed || voiceDone) return;
      voiceDone = true;
      later(
        () => void sweep(),
        Math.max(0, 2200 - (performance.now() - startedAt)),
      );
    };
    // Speech is an explicit break reminder, separate from optional ambient recordings/chimes.
    try {
      if (silent) throw new Error("Silent alerts");
      stopRecording = playTodoVoice("break", 0.75, finishVoice);
    } catch {
      finishVoice();
    }
    later(() => {
      stopVoice();
      finishVoice();
    }, 5500); // Autoplay/voice failures must never hold the room hostage.
    return () => {
      disposed = true;
      timers.forEach(clearTimeout);
      timeline?.kill();
      stopVoice();
    };
  }, [female, reduced, silent]);

  return (
    <div
      ref={root}
      className={`break-return ${reduced ? "break-return-reduced" : ""}`}
      data-stage={stage}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="break-return-title"
      aria-describedby="break-return-description"
      tabIndex={-1}
    >
      <div className="break-return-veil" aria-hidden="true" />
      <div className="break-return-message">
        <img
          src={image}
          width={1254}
          height={1254}
          alt=""
          className="break-return-greeting"
        />
        <div className="break-return-bubble">
          <h2 id="break-return-title">Break’s over!</h2>
          <p id="break-return-description">{BREAK_OVER_MESSAGE}</p>
          <Button variant="ghost" onClick={() => start.current()}>
            Back to focus <span aria-hidden="true">↗</span>
          </Button>
        </div>
      </div>
      <div className="break-return-traveler" aria-hidden="true">
        <img src={image} width={1254} height={1254} alt="" />
      </div>
      {error ? (
        <div className="break-return-error" role="alert">
          <p>Let’s get your room ready.</p>
          <Button onClick={() => retry.current()}>Return to room</Button>
        </div>
      ) : null}
    </div>
  );
}
