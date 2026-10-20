import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "table-*.spec.ts",
  workers: 1,
  timeout: 30000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    channel: "chrome",
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${resolve("outputs/qa-microphone.wav")}`,
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
  },
});
