"use client";

import { watchRoomAudio } from "./audio-access";
let unwatch: (() => void) | null = null;

export const TODO_VOICE = {
  success: {
    url: "/audio/todo-you-did-it-v1.mp3",
    text: "Hooray! You did it!",
  },
  break: {
    url: "/audio/todo-break-over-v1.mp3",
    text: "Break is over. Let us focus again.",
  },
} as const;
type Cue = keyof typeof TODO_VOICE;
let context: AudioContext | null = null;
const buffers = new Map<Cue, Promise<AudioBuffer>>();
let activeStop: (() => void) | null = null;

function engine() {
  if (!context || context.state === "closed") {
    unwatch?.();
    context = new AudioContext();
    unwatch = watchRoomAudio(context);
    buffers.clear();
  }
  return context;
}
function load(ctx: AudioContext, cue: Cue) {
  if (!buffers.has(cue)) {
    const pending = fetch(TODO_VOICE[cue].url, {
      signal: AbortSignal.timeout(4000),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Voice cue unavailable");
        return response.arrayBuffer();
      })
      .then((bytes) => ctx.decodeAudioData(bytes));
    buffers.set(cue, pending);
    void pending.catch(() => {
      if (buffers.get(cue) === pending) buffers.delete(cue);
    });
  }
  return buffers.get(cue)!;
}

/** Unlock and preload during a real gesture; timer alerts need no network TTS. */
export function primeTodoVoice() {
  try {
    const ctx = engine();
    void ctx.resume().catch(() => {});
    for (const cue of ["success", "break"] as const)
      void load(ctx, cue).catch(() => {});
  } catch {
    /* Devices without audio still keep the visual alerts. */
  }
}

/** Recorded voice first, browser speech fallback; cancellation never advances UI. */
export function playTodoVoice(cue: Cue, volume = 0.75, onEnd?: () => void) {
  activeStop?.();
  let cancelled = false,
    finished = false;
  let source: AudioBufferSourceNode | null = null,
    gain: GainNode | null = null;
  let speech: SpeechSynthesisUtterance | null = null;
  const finish = () => {
    if (cancelled || finished) return;
    finished = true;
    clearTimeout(watchdog);
    source?.disconnect();
    gain?.disconnect();
    if (activeStop === stop) activeStop = null;
    onEnd?.();
  };
  const stop = () => {
    if (cancelled) return;
    cancelled = true;
    clearTimeout(watchdog);
    if (source) {
      source.onended = null;
      try {
        source.stop();
      } catch {}
      source.disconnect();
    }
    gain?.disconnect();
    if (speech) {
      speech.onend = speech.onerror = null;
      window.speechSynthesis?.cancel();
    }
    if (activeStop === stop) activeStop = null;
  };
  const watchdog = setTimeout(finish, 5200);
  activeStop = stop;
  void (async () => {
    const ctx = engine();
    await ctx.resume();
    const buffer = await load(ctx, cue);
    if (cancelled || finished || ctx.state !== "running") return;
    source = ctx.createBufferSource();
    gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = Math.max(0, Math.min(1, volume));
    source.connect(gain);
    gain.connect(ctx.destination);
    source.onended = finish;
    source.start();
  })().catch(() => {
    if (cancelled || finished) return;
    try {
      speech = new SpeechSynthesisUtterance(TODO_VOICE[cue].text);
      speech.rate = 1.03;
      speech.pitch = 1.18;
      speech.volume = Math.max(0, Math.min(1, volume));
      speech.onend = speech.onerror = finish;
      window.speechSynthesis.speak(speech);
    } catch {
      finish();
    }
  });
  return stop;
}

export function releaseTodoVoice() {
  activeStop?.();
  unwatch?.();
  unwatch = null;
  const old = context;
  context = null;
  buffers.clear();
  if (old && old.state !== "closed") void old.close().catch(() => {});
}
