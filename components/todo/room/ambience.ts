/** Quiet browser-generated soundscapes. Audio starts only from an explicit click. */
export type Soundscape = "off" | "day" | "night" | "rain";
export async function startSoundscape(kind: Soundscape, volume: number) {
  if (kind === "off") return null;
  const context = new AudioContext();
  try {
    await context.resume();
    const master = context.createGain();
    master.gain.value = volume * 0.22;
    master.connect(context.destination);
    if (kind === "rain") {
      const buffer = context.createBuffer(
        1,
        context.sampleRate * 3,
        context.sampleRate,
      );
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      source.buffer = buffer;
      source.loop = true;
      filter.type = "lowpass";
      filter.frequency.value = 1100;
      source.connect(filter);
      filter.connect(master);
      source.start();
    } else {
      // An original, slow pentatonic phrase; no downloaded or licensed music.
      const phrase =
        kind === "day"
          ? [261.63, 329.63, 392, 440, 392, 329.63, 293.66, 261.63]
          : [196, 246.94, 293.66, 369.99, 293.66, 246.94, 220, 196];
      for (let i = 0; i < 8; i++) {
        const oscillator = context.createOscillator(),
          envelope = context.createGain();
        envelope.gain.value = 0;
        oscillator.type = "sine";
        oscillator.frequency.value = phrase[i];
        // Loop a calm phrase using a periodic amplitude curve.
        const curve = new Float32Array(128);
        for (let j = 0; j < curve.length; j++)
          curve[j] = 0.22 * Math.sin((Math.PI * j) / (curve.length - 1)) ** 2;
        const play = (time: number) => {
          envelope.gain.setValueAtTime(0, time);
          envelope.gain.setValueCurveAtTime(curve, time + i * 2, 3.8);
        };
        play(context.currentTime + 0.1);
        oscillator.connect(envelope);
        envelope.connect(master);
        oscillator.start();
        // All events are scheduled on AudioContext; no animation/frame loop.
        for (let loop = 1; loop < 240; loop++)
          play(context.currentTime + 0.1 + loop * 18);
      }
    }
    return {
      setVolume: (value: number) =>
        master.gain.setTargetAtTime(value * 0.22, context.currentTime, 0.1),
      stop: () => void context.close(),
    };
  } catch (error) {
    await context.close();
    throw error;
  }
}
