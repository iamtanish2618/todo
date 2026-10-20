"use client";
import { useEffect, useRef, useState } from "react";
import { SOUND_RECORDINGS, type Recording } from "./ambience";

/** Decode once, then let the audio thread loop sample-accurately. No media player,
 * encoder padding, onended restart, or main-thread timer sits at the loop boundary. */
export function RoomSoundPlayer({
  recording,
  paused,
  volume = 0.5,
  onStop,
}: {
  recording: Recording;
  paused: boolean;
  volume?: number;
  onStop: () => void;
}) {
  const context = useRef<AudioContext | null>(null);
  const gain = useRef<GainNode | null>(null);
  const buffers = useRef(new Map<Recording, AudioBuffer>());
  const latest = useRef({ paused, volume });
  latest.current = { paused, volume };
  const [status, setStatus] = useState("loading");
  const [frames, setFrames] = useState(0);
  useEffect(() => {
    const ctx = new AudioContext({ sampleRate: 44100 });
    context.current = ctx;
    void ctx.resume().catch(() => setStatus("blocked"));
    return () => {
      context.current = null;
      // Give the source cleanup its short fade before releasing the audio device.
      setTimeout(() => {
        void ctx.close().catch(() => {});
      }, 200);
    };
  }, []);
  useEffect(() => {
    const ctx = context.current;
    if (!ctx) return;
    const controller = new AbortController();
    let disposed = false,
      source: AudioBufferSourceNode | null = null,
      level: GainNode | null = null;
    setStatus("loading");
    void (async () => {
      let buffer = buffers.current.get(recording);
      if (!buffer) {
        const response = await fetch(SOUND_RECORDINGS[recording].src, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Recording unavailable");
        buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        if (disposed) return;
        buffers.current.set(recording, buffer);
      }
      if (disposed) return;
      if (ctx.state !== "running") setStatus("blocked");
      await ctx.resume();
      if (disposed) return;
      source = ctx.createBufferSource();
      level = ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = buffer.duration;
      level.gain.setValueAtTime(0, ctx.currentTime);
      level.gain.linearRampToValueAtTime(
        latest.current.paused ? 0 : latest.current.volume,
        ctx.currentTime + 0.25,
      );
      source.connect(level);
      level.connect(ctx.destination);
      gain.current = level;
      source.start(ctx.currentTime + 0.015);
      setFrames(buffer.length);
      setStatus(ctx.state === "running" ? "playing" : "blocked");
    })().catch(() => {
      if (!disposed) setStatus("error");
    });
    return () => {
      disposed = true;
      controller.abort();
      if (gain.current === level) gain.current = null;
      if (source && level && ctx.state !== "closed") {
        const oldSource = source,
          oldLevel = level;
        oldLevel.gain.cancelScheduledValues(ctx.currentTime);
        oldLevel.gain.setValueAtTime(oldLevel.gain.value, ctx.currentTime);
        oldLevel.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
        oldSource.stop(ctx.currentTime + 0.17);
        oldSource.onended = () => {
          oldSource.disconnect();
          oldLevel.disconnect();
        };
      }
    };
  }, [recording]);
  useEffect(() => {
    const ctx = context.current,
      level = gain.current;
    if (!ctx || !level || ctx.state === "closed") return;
    level.gain.cancelScheduledValues(ctx.currentTime);
    level.gain.setTargetAtTime(paused ? 0 : volume, ctx.currentTime, 0.08);
  }, [paused, volume]);
  if (status === "error" || status === "blocked")
    return (
      <p className="room-audio-notice" role="status">
        {status === "blocked"
          ? "Tap to play your sound."
          : "That recording could not load."}
        {status === "blocked" ? (
          <button
            onClick={() =>
              void context.current
                ?.resume()
                .then(() => setStatus("playing"))
                .catch(() => setStatus("error"))
            }
          >
            Play sound
          </button>
        ) : null}
        <button onClick={onStop}>Sound off</button>
      </p>
    );
  return (
    <span
      className="room-audio-state sr-only"
      role="status"
      data-state={paused ? "paused" : status}
      data-recording={recording}
      data-loop="true"
      data-frames={frames}
      data-sample-rate="44100"
    >
      {SOUND_RECORDINGS[recording].label}: {paused ? "paused" : status}
    </span>
  );
}
