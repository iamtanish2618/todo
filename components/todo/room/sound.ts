"use client";
import { useEffect, useRef, type RefObject } from "react";
import type { RoomMix } from "./cinema-config";

/** Original synthesized sound design. No downloaded or unlicensed recordings. */
export function useRoomSound(
  root: RefObject<HTMLElement | null>,
  active: boolean,
  enabled: boolean,
  volume: number,
  mix: RoomMix,
) {
  const latest = useRef({ enabled, volume, mix });
  latest.current = { enabled, volume, mix };
  const engine = useRef<{
    context: AudioContext;
    master: GainNode;
    gains: GainNode[];
    depths: GainNode[];
    buffer: AudioBuffer;
  } | null>(null);
  useEffect(() => {
    if (!active || !root.current) return;
    const element = root.current;
    let stopped = false;
    const make = () => {
      if (
        engine.current ||
        stopped ||
        (!latest.current.enabled &&
          !Object.values(latest.current.mix).some(Boolean))
      )
        return engine.current;
      try {
        const context = new AudioContext(),
          master = context.createGain();
        master.gain.value = latest.current.volume;
        master.connect(context.destination);
        const length = context.sampleRate * 8,
          buffer = context.createBuffer(1, length, context.sampleRate),
          data = buffer.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < length; i++) {
          brown = (brown + (Math.random() * 2 - 1) * 0.02) / 1.02;
          data[i] = brown * 3.5;
        }
        // Blend the tail into the first sample so an eight-second loop never clicks.
        const seam = Math.floor(context.sampleRate * 0.08),
          first = data[0];
        for (let i = 0; i < seam; i++) {
          const t = (1 - Math.cos(((i + 1) / seam) * Math.PI)) / 2;
          const index = length - seam + i;
          data[index] = data[index] * (1 - t) + first * t;
        }
        const depths: GainNode[] = [];
        const gains = Object.keys(latest.current.mix).map((name, i) => {
          const gain = context.createGain(),
            pan = context.createStereoPanner();
          gain.gain.value = 0;
          const depth = context.createGain();
          depth.gain.value = 0;
          depths.push(depth);
          pan.pan.value = name === "rain" ? -0.5 : name === "fire" ? 0.4 : 0;
          gain.connect(pan);
          pan.connect(master);
          if (name === "pad") {
            [174.61, 220, 261.63].forEach((f) => {
              const osc = context.createOscillator();
              osc.type = "sine";
              osc.frequency.value = f;
              osc.connect(gain);
              osc.start();
            });
          } else {
            const source = context.createBufferSource(),
              filter = context.createBiquadFilter();
            source.buffer = buffer;
            source.loop = true;
            source.playbackRate.value = [0.8, 0.45, 1.3, 0.6][i] || 0.8;
            filter.type = "lowpass";
            filter.frequency.value = [1800, 500, 650, 1100][i] || 900;
            source.connect(filter);
            filter.connect(gain);
            source.start();
            const lfo = context.createOscillator();
            lfo.frequency.value = name === "waves" ? 0.12 : 0.035;
            depth.gain.value = 0;
            lfo.connect(depth);
            depth.connect(gain.gain);
            lfo.start();
          }
          return gain;
        });
        engine.current = { context, master, gains, depths, buffer };
        apply();
        return engine.current;
      } catch {
        return null;
      }
    };
    const apply = () => {
      const e = engine.current;
      if (!e) return;
      e.master.gain.setTargetAtTime(
        latest.current.volume,
        e.context.currentTime,
        0.25,
      );
      Object.values(latest.current.mix).forEach((value, i) => {
        e.depths[i].gain.setTargetAtTime(
          i === 4 ? 0 : value * 0.025,
          e.context.currentTime,
          0.45,
        );
        e.gains[i].gain.setTargetAtTime(
          value * (i === 4 ? 0.018 : 0.16),
          e.context.currentTime,
          0.45,
        );
      });
    };
    const unlock = () => {
      const e = make();
      if (e?.context.state === "suspended")
        void e.context.resume().catch(() => {});
      apply();
    };
    const cue = (event: Event) => {
      const kind = (event as CustomEvent<{ kind: string }>).detail.kind;
      if (
        !latest.current.enabled ||
        document.hidden ||
        ["star", "task", "halfway", "celebrate"].includes(kind)
      )
        return;
      const e = make();
      if (!e) return;
      const { context, master } = e,
        now = context.currentTime;
      if (["pour", "page", "print", "lamp", "thunder"].includes(kind)) {
        const source = context.createBufferSource(),
          filter = context.createBiquadFilter(),
          gain = context.createGain(),
          pan = context.createStereoPanner();
        source.buffer = e.buffer;
        filter.type =
          kind === "page"
            ? "highpass"
            : kind === "thunder"
              ? "lowpass"
              : "bandpass";
        filter.frequency.value =
          kind === "thunder"
            ? 140
            : kind === "pour"
              ? 1700
              : kind === "lamp"
                ? 1100
                : 700;
        filter.Q.value = 0.6;
        const length =
          kind === "thunder"
            ? 2
            : kind === "pour"
              ? 0.8
              : kind === "print"
                ? 0.6
                : kind === "lamp"
                  ? 0.07
                  : 0.3;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(
          kind === "lamp" ? 0.09 : 0.05,
          now + 0.015,
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
        pan.pan.value = kind === "lamp" ? 0.3 : -0.3;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(pan);
        pan.connect(master);
        source.start(now, Math.random() * 3);
        source.stop(now + length + 0.05);
        return;
      }
      const osc = context.createOscillator(),
        gain = context.createGain(),
        pan = context.createStereoPanner();
      osc.type = "sine";
      osc.frequency.setValueAtTime(
        kind === "pour" ? 450 : kind === "page" ? 280 : 640,
        now,
      );
      osc.frequency.exponentialRampToValueAtTime(
        kind === "pour" ? 700 : 220,
        now + 0.18,
      );
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.025, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + (kind === "pour" ? 0.7 : 0.18),
      );
      pan.pan.value = kind === "lamp" ? 0.3 : -0.25;
      osc.connect(gain);
      gain.connect(pan);
      pan.connect(master);
      osc.start();
      osc.stop(now + 0.8);
    };
    const visibility = () => {
      const e = engine.current;
      if (!e) return;
      if (document.hidden) void e.context.suspend().catch(() => {});
      else if (e.context.state === "suspended")
        void e.context.resume().catch(() => {});
    };
    element.addEventListener("pointerdown", unlock, { passive: true });
    element.addEventListener("todo:room-effect", cue);
    element.addEventListener("todo:room-audio", apply);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      stopped = true;
      element.removeEventListener("pointerdown", unlock);
      element.removeEventListener("todo:room-effect", cue);
      element.removeEventListener("todo:room-audio", apply);
      document.removeEventListener("visibilitychange", visibility);
      const e = engine.current;
      engine.current = null;
      if (e && e.context.state !== "closed") {
        e.master.gain.setTargetAtTime(0, e.context.currentTime, 0.04);
        setTimeout(() => {
          if (e.context.state !== "closed") void e.context.close();
        }, 180);
      }
    };
  }, [active, root]);
  useEffect(() => {
    root.current?.dispatchEvent(new Event("todo:room-audio"));
  }, [enabled, volume, mix, root]);
}
