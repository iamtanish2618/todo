import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: ["dock.spec.ts", "break-return.spec.ts"],
  timeout: 90000,
  expect: { timeout: 15000 },
  use: {
    ...base.use,
    baseURL: process.env.TODO_TEST_URL || "http://127.0.0.1:5173",
    channel: "chrome",
    launchOptions: { args: [] },
    trace: "off",
  },
});
