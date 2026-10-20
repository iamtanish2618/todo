// Deterministic fake microphone for browser tests; never a product ambience file.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const rate = 48000,
  samples = rate,
  data = Buffer.alloc(44 + samples * 2);
data.write("RIFF", 0);
data.writeUInt32LE(data.length - 8, 4);
data.write("WAVEfmt ", 8);
data.writeUInt32LE(16, 16);
data.writeUInt16LE(1, 20);
data.writeUInt16LE(1, 22);
data.writeUInt32LE(rate, 24);
data.writeUInt32LE(rate * 2, 28);
data.writeUInt16LE(2, 32);
data.writeUInt16LE(16, 34);
data.write("data", 36);
data.writeUInt32LE(samples * 2, 40);
for (let i = 0; i < samples; i++)
  data.writeInt16LE(
    Math.round(9000 * Math.sin((2 * Math.PI * 440 * i) / rate)),
    44 + i * 2,
  );
await mkdir(resolve("outputs"), { recursive: true });
await writeFile(resolve("outputs/qa-microphone.wav"), data);
