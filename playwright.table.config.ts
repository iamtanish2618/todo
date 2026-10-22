import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "table-*.spec.ts",
  workers: 1,
  timeout: 90000,
  expect: { timeout: 20000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    channel: "chrome",
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        // Exercise rendering without relying on the host Mac audio device.
        "--disable-audio-output",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${resolve("outputs/qa-microphone.wav")}`,
      ],
    },
  },
});
