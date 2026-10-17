/** QA only: record the real intro into a Chrome DevTools-compatible trace.
 * Requires the local server. These emulated profiles do not replace physical-phone testing. */
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
await fs.mkdir("outputs", { recursive: true });
const pointerOnly = process.argv.includes("--pointer");
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const summaries = [];
try {
  for (const profile of [
    { name: "desktop", width: 1440, height: 960, dpr: 1, cpu: 1 },
    { name: "portrait", width: 390, height: 844, dpr: 2, cpu: 4 },
  ].filter(
    (profile) =>
      !process.argv.includes("--desktop") || profile.name === "desktop",
  )) {
    const page = await browser.newPage({
      viewport: { width: profile.width, height: profile.height },
      deviceScaleFactor: profile.dpr,
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.__introCLS = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (!entry.hadRecentInput) window.__introCLS += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(process.env.TODO_PROFILE_URL || "http://localhost:3000/");
    await page.locator(".intro-experience[data-loaded=true]").waitFor();
    await page.waitForTimeout(500);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
    await cdp.send("Tracing.start", {
      categories:
        "devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline.frame,cc",
      transferMode: "ReturnAsStream",
    });
    // Scroll events are test inputs. The application still uses only GSAP's shared ticker.
    await page.evaluate(
      (pointerOnly) =>
        new Promise((resolve) => {
          let n = 0;
          const distance =
            document.querySelector(".intro-experience").offsetHeight -
            innerHeight;
          const timer = setInterval(() => {
            const p = n <= 150 ? n / 150 : (300 - n) / 150;
            if (pointerOnly) {
              window.dispatchEvent(
                new PointerEvent("pointermove", {
                  pointerType: "mouse",
                  clientX: innerWidth * (0.5 + 0.37 * Math.sin(n * 0.055)),
                  clientY: innerHeight * (0.45 + 0.23 * Math.cos(n * 0.045)),
                }),
              );
              if (n % 75 === 0)
                document.querySelector(".intro-male .intro-pet-target").click();
            } else scrollTo(0, distance * Math.max(0, p));
            n++;
            if (n > 300) {
              clearInterval(timer);
              resolve();
            }
          }, 25);
        }),
      pointerOnly,
    );
    await page.waitForTimeout(1000);
    const done = new Promise((resolve) =>
      cdp.once("Tracing.tracingComplete", resolve),
    );
    await cdp.send("Tracing.end");
    const { stream } = await done;
    let trace = "";
    for (;;) {
      const chunk = await cdp.send("IO.read", { handle: stream });
      trace += chunk.data;
      if (chunk.eof) break;
    }
    await cdp.send("IO.close", { handle: stream });
    await fs.writeFile(
      `outputs/intro-${profile.name}${pointerOnly ? "-pointer" : ""}-trace.json`,
      trace,
    );
    const events = JSON.parse(trace).traceEvents;
    const draws = events
      .filter((e) => e.name === "DrawFrame")
      .map((e) => e.ts)
      .sort((a, b) => a - b);
    const intervals = draws
      .slice(1)
      .map((t, i) => (t - draws[i]) / 1000)
      .filter((ms) => ms > 1 && ms < 250)
      .sort((a, b) => a - b);
    const data = await page.locator(".intro-experience").evaluate((e) => ({
      tickerFPS: e.dataset.fps,
      lens: e.dataset.lens,
      lensDraws: e.dataset.lensDraws,
      remainingParticles: e.dataset.particles,
      dpr: e.dataset.dpr,
      qualityDrops: e.dataset.qualityDrops,
      cls: window.__introCLS,
    }));
    const median = intervals[Math.floor(intervals.length * 0.5)] ?? null,
      p95 = intervals[Math.floor(intervals.length * 0.95)] ?? null;
    summaries.push({
      ...profile,
      ...data,
      drawFrames: draws.length,
      medianFrameMs: median,
      p95FrameMs: p95,
      estimatedMedianFPS: median ? 1000 / median : null,
      layoutEvents: events.filter((e) => e.name === "Layout").length,
      errors,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
await fs.writeFile(
  `outputs/intro-${pointerOnly ? "pointer-" : ""}performance.json`,
  JSON.stringify(
    {
      recordedAt: new Date().toISOString(),
      environment:
        "Local headless Chromium; portrait emulation uses 4x CPU throttling, not a physical device",
      profiles: summaries,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(summaries, null, 2));
