"use client";
import { useEffect, useRef, useState } from "react";
import {
  EMPTY_MIX,
  timeWeather,
  type EndCue,
  type RoomWeather,
} from "./cinema-config";
export const POLISH_DEFAULTS = {
  volume: 0.5,
  glass: 0,
  muted: false,
  mix: EMPTY_MIX,
  matchTime: false,
  thunder: false,
  cue: "voice" as EndCue,
  outfit: "original",
};
export function useRoomPolish(setWeather: (value: RoomWeather) => void) {
  const [settings, setSettings] = useState(POLISH_DEFAULTS),
    [ready, setReady] = useState(false);
  const latest = useRef(setWeather);
  latest.current = setWeather;
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem("todo.room.polish.v1") || "{}");
      setSettings((v) => ({
        ...v,
        volume: 0.5,
        glass:
          typeof p.glass === "number" ? Math.max(0, Math.min(1, p.glass)) : 0,
        muted: false,
        matchTime: p.matchTime === true,
        thunder: false,
        // Old defaults chose a bell behind a now-removed SFX switch. Use the
        // requested voice alerts, preserving an explicit silent preference.
        cue: p.cue === "silent" ? "silent" : "voice",
        outfit: ["original", "glasses", "star"].includes(p.outfit)
          ? p.outfit
          : v.outfit,
        mix: EMPTY_MIX,
      }));
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem("todo.room.polish.v1", JSON.stringify(settings));
      } catch {}
  }, [ready, settings]);
  useEffect(() => {
    if (!settings.matchTime) return;
    const update = () => latest.current(timeWeather());
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [settings.matchTime]);
  return {
    settings,
    update: (patch: Partial<typeof POLISH_DEFAULTS>) =>
      setSettings((v) => ({ ...v, ...patch })),
  };
}
export function CountUp({
  value,
  reduced = false,
}: {
  value: number;
  reduced?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const node = ref.current;
    let disposed = false,
      animation: GSAPTween | undefined;
    if (reduced) {
      node.textContent = String(value);
      return;
    }
    void import("gsap").then(({ gsap }) => {
      if (disposed) return;
      const count = { value: 0 };
      animation = gsap.to(count, {
        value,
        duration: 0.85,
        ease: "power2.out",
        onUpdate: () => {
          node.textContent = String(Math.round(count.value));
        },
      });
    });
    return () => {
      disposed = true;
      animation?.kill();
    };
  }, [value, reduced]);
  return (
    <strong className="cinema-count" ref={ref} aria-label={String(value)}>
      {reduced ? value : 0}
    </strong>
  );
}
export function ClockDigits({ clock }: { clock: string }) {
  return (
    <span className="cinema-digit-track" role="timer" aria-label={clock}>
      {clock.split("").map((digit, i) => (
        <span
          className="cinema-clock-digit"
          aria-hidden="true"
          key={`${i}-${digit}`}
        >
          {digit}
        </span>
      ))}
    </span>
  );
}

export function WordReveal({ text }: { text: string }) {
  return (
    <span aria-label={text}>
      {text.split(" ").map((word, i) => (
        <span
          className="cinema-word"
          aria-hidden="true"
          key={i}
          style={{ animationDelay: `${i * 0.04}s` }}
        >
          {word}
          {i < text.split(" ").length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}
