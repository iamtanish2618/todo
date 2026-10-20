"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  EMPTY_MIX,
  timeWeather,
  type EndCue,
  type RoomMix,
  type RoomWeather,
} from "./cinema-config";
export const POLISH_DEFAULTS = {
  volume: 0.5,
  muted: false,
  mix: EMPTY_MIX,
  matchTime: false,
  thunder: false,
  cue: "chime" as EndCue,
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
        volume:
          typeof p.volume === "number"
            ? Math.max(0, Math.min(1, p.volume))
            : v.volume,
        muted: p.muted === true,
        matchTime: p.matchTime === true,
        thunder: p.thunder === true,
        cue: ["chime", "voice", "silent"].includes(p.cue) ? p.cue : v.cue,
        outfit: ["original", "glasses", "star"].includes(p.outfit)
          ? p.outfit
          : v.outfit,
        mix: Object.fromEntries(
          Object.keys(EMPTY_MIX).map((k) => [
            k,
            typeof p.mix?.[k] === "number"
              ? Math.max(0, Math.min(1, p.mix[k]))
              : 0,
          ]),
        ) as RoomMix,
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
export function SoundMixControls({
  settings,
  update,
  onQuiet,
}: {
  settings: typeof POLISH_DEFAULTS;
  update: (patch: Partial<typeof POLISH_DEFAULTS>) => void;
  onQuiet: () => void;
}) {
  return (
    <details className="cinema-mixer">
      <summary>Room sounds &amp; comfort</summary>
      <label>
        <span>Mute all room sounds</span>
        <Switch
          aria-label="Mute all room sounds"
          checked={settings.muted}
          onCheckedChange={(muted) => update({ muted })}
        />
      </label>
      <label>
        <span>Master volume</span>
        <input
          aria-label="Master volume"
          type="range"
          min="0"
          max="1"
          step=".01"
          value={settings.volume}
          onChange={(e) => update({ volume: Number(e.target.value) })}
        />
      </label>
      {(
        [
          ["rain", "Soft rain"],
          ["fire", "Warm crackle"],
          ["cafe", "Café hush"],
          ["waves", "Shoreline"],
          ["pad", "Warm pad"],
        ] as const
      ).map(([key, label]) => (
        <label key={key}>
          <span>{label}</span>
          <input
            aria-label={label}
            type="range"
            min="0"
            max="1"
            step=".01"
            value={settings.mix[key]}
            onChange={(e) =>
              update({
                mix: { ...settings.mix, [key]: Number(e.target.value) },
              })
            }
          />
        </label>
      ))}
      <label>
        <span>Distant lightning</span>
        <Switch
          aria-label="Distant lightning"
          checked={settings.thunder}
          onCheckedChange={(thunder) => update({ thunder })}
        />
      </label>
      <label>
        <span>Session ending</span>
        <select
          aria-label="Session ending sound"
          value={settings.cue}
          onChange={(e) => update({ cue: e.target.value as EndCue })}
        >
          <option value="chime">Soft chime</option>
          <option value="voice">Todo’s voice</option>
          <option value="silent">Silent</option>
        </select>
      </label>
      <Button className="cinema-room-quiet" variant="outline" onClick={onQuiet}>
        Quiet mode
      </Button>
      <p className="room-helper" style={{ fontSize: 11 }}>
        Room textures are softly synthesized. Recordings above keep their
        original players.
      </p>
    </details>
  );
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
