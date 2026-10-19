/** Soft envelopes and real rainfall; all audio begins only after an explicit choice. */
export type Soundscape = "off" | "day" | "night" | "rain";
export async function startSoundscape(
  kind: Soundscape,
  volume: number,
  signal?: AbortSignal,
) {
  if (kind === "off") return null;
  const context = new AudioContext();
  let stopped = false;
  let scheduler: ReturnType<typeof setInterval> | undefined;
  const sources = new Set<AudioScheduledSourceNode>();
  const master = context.createGain();
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 20;
  compressor.ratio.value = 2;
  compressor.attack.value = 0.08;
  compressor.release.value = 1;
  master.gain.value = 0;
  master.connect(compressor);
  compressor.connect(context.destination);
  const level = (value: number) =>
    Math.max(0, Math.min(1, value)) * (kind === "rain" ? 0.62 : 0.5);
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(scheduler);
    signal?.removeEventListener("abort", abort);
    if (context.state === "closed") return;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(0, context.currentTime, 0.18);
    // Let the short fade finish rather than cutting a waveform mid-cycle.
    setTimeout(() => {
      for (const source of sources) {
        try {
          source.stop();
        } catch {}
      }
      if (context.state !== "closed") void context.close();
    }, 900);
  };
  const abort = () => {
    stopped = true;
    clearInterval(scheduler);
    void context.close();
  };
  signal?.addEventListener("abort", abort, { once: true });
  const watch = (source: AudioScheduledSourceNode, nodes: AudioNode[]) => {
    sources.add(source);
    source.onended = () => {
      sources.delete(source);
      source.disconnect();
      for (const node of nodes) node.disconnect();
    };
  };
  try {
    await context.resume();
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = kind === "rain" ? 4200 : 1000;
    filter.Q.value = 0.3;
    filter.connect(master);
    if (kind === "rain") {
      const response = await fetch("/audio/quiet-rain.mp3", { signal });
      if (!response.ok) throw new Error("Rain recording could not load.");
      const buffer = await context.decodeAudioData(
        await response.arrayBuffer(),
      );
      if (signal?.aborted || stopped)
        throw new DOMException("Cancelled", "AbortError");
      const highpass = context.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 110;
      highpass.connect(filter);
      let sum = 0;
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const normalise = Math.min(
        3,
        0.15 / Math.max(0.001, Math.sqrt(sum / data.length)),
      );
      const fade = Math.min(1.8, buffer.duration / 4),
        step = buffer.duration - fade;
      let next = context.currentTime + 0.06;
      const schedule = () => {
        if (stopped) return;
        while (next < context.currentTime + 22) {
          const source = context.createBufferSource(),
            envelope = context.createGain();
          source.buffer = buffer;
          envelope.gain.setValueAtTime(0, next);
          envelope.gain.linearRampToValueAtTime(normalise, next + fade);
          envelope.gain.setValueAtTime(
            normalise,
            next + buffer.duration - fade,
          );
          envelope.gain.linearRampToValueAtTime(0, next + buffer.duration);
          source.connect(envelope);
          envelope.connect(highpass);
          watch(source, [envelope]);
          source.start(next);
          next += step;
        }
      };
      schedule();
      scheduler = setInterval(schedule, 4000);
    } else {
      // Spacious, low-register ambient notes: no metronomic beeps or sharp attacks.
      const notes =
        kind === "day"
          ? [130.81, 196, 164.81, 146.83, 196, 164.81]
          : [110, 164.81, 130.81, 146.83, 164.81, 130.81];
      let index = 0,
        next = context.currentTime + 0.06;
      const schedule = () => {
        if (stopped) return;
        while (next < context.currentTime + 25) {
          const source = context.createOscillator(),
            envelope = context.createGain(),
            pan = context.createStereoPanner();
          source.type = "sine";
          source.frequency.value = notes[index % notes.length];
          pan.pan.value = index % 2 ? 0.12 : -0.12;
          envelope.gain.setValueAtTime(0.00001, next);
          envelope.gain.exponentialRampToValueAtTime(0.23, next + 3.8);
          envelope.gain.exponentialRampToValueAtTime(0.00001, next + 12.5);
          source.connect(envelope);
          envelope.connect(pan);
          pan.connect(filter);
          watch(source, [envelope, pan]);
          source.start(next);
          source.stop(next + 13);
          next += 9.5 + (index % 3) * 0.8;
          index++;
        }
      };
      schedule();
      scheduler = setInterval(schedule, 4000);
    }
    master.gain.setTargetAtTime(level(volume), context.currentTime, 0.8);
    signal?.removeEventListener("abort", abort);
    return {
      setVolume: (value: number) =>
        master.gain.setTargetAtTime(level(value), context.currentTime, 0.25),
      stop,
    };
  } catch (error) {
    stopped = true;
    clearInterval(scheduler);
    signal?.removeEventListener("abort", abort);
    if (context.state !== "closed") await context.close();
    throw error;
  }
}
