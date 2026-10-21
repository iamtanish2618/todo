import { test, expect, type Page } from "@playwright/test";
import { promises as fs } from "node:fs";
test.use({ channel: "chrome", launchOptions: { args: [] } });
async function enter(page: Page, query = "") {
  await page.goto(
    "/signin-with-chatgpt?return_to=" + encodeURIComponent("/" + query),
  );
  await expect(page.locator(".todo-root")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Focus with Todo", exact: true })
    .click();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-arriving",
    "false",
    { timeout: 45000 },
  );
  await expect(page.locator(".round-room-art")).toHaveAttribute(
    "data-intro",
    "awake",
    { timeout: 15000 },
  );
}
const dock = (page: Page, id: string) =>
  page.locator(`[data-dock-item="${id}"]`);

test("dock replaces the old controls, waves without overlap and settles after repeated launch", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  await expect(
    page.getByRole("navigation", { name: "Room dock" }),
  ).toBeVisible();
  await expect(
    page.locator(".room-edge-tabs,.room-home-card,.room-mode-toggle"),
  ).toHaveCount(0);
  for (const id of ["notes", "ambience", "friends", "agent"]) {
    await dock(page, id).hover();
    await page.waitForTimeout(350);
    const geometry = await page
      .locator(".todo-dock-button")
      .evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return {
            left: r.left,
            right: r.right,
            scale: getComputedStyle(n.parentElement!.parentElement!).transform,
          };
        }),
      );
    for (let i = 1; i < geometry.length; i++)
      expect(geometry[i].left - geometry[i - 1].right).toBeGreaterThan(-2);
  }
  await dock(page, "notes").click();
  await dock(page, "ambience").click();
  await dock(page, "friends").click();
  await expect(page.locator(".dock-panel")).toHaveCount(1);
  await expect(page.locator(".dock-panel")).toHaveAttribute(
    "data-dock-pane",
    "friends",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".dock-panel")).toHaveCount(0);
  await page.mouse.move(100, 100);
  await page.waitForTimeout(1100);
  const settled = await page
    .locator(".todo-dock-hop")
    .evaluateAll((nodes) =>
      nodes.map((n) => new DOMMatrix(getComputedStyle(n).transform).m42),
    );
  expect(settled.every((y) => Math.abs(y) < 0.1)).toBe(true);
  expect(errors).toEqual([]);
});

test("glass panels avoid Todo and window, switch one at a time, close outside and restore focus", async ({
  page,
}) => {
  await enter(page);
  for (const id of ["notes", "ambience", "friends"]) {
    await dock(page, id).click();
    const panel = page.locator(".dock-panel");
    await expect(panel).toHaveAttribute("data-dock-pane", id);
    await page.waitForTimeout(500);
    const safe = await panel.evaluate((n) => {
      const r = n.getBoundingClientRect(),
        s = n.closest(".cozy-room-stage")!.getBoundingClientRect();
      return {
        left: (r.left - s.left) / s.width,
        right: (r.right - s.left) / s.width,
        top: (r.top - s.top) / s.height,
      };
    });
    expect(safe.right <= 0.43 || safe.left >= 0.57).toBe(true);
    if (id !== "friends") expect(safe.right).toBeLessThan(0.27);
    await expect(page.getByRole("dialog")).toHaveCount(1);
  }
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await expect(dock(page, "friends")).toBeFocused();
  await dock(page, "notes").click();
  await page.mouse.click(900, 650);
  await expect(page.locator(".dock-panel")).toHaveCount(0);
});

test("focus reuses saved tasks and real timer deadline; pause and extend remain usable", async ({
  page,
}) => {
  await enter(page);
  await dock(page, "focus").click();
  await expect(page.locator(".dock-focus-setup")).toBeVisible();
  await page.getByRole("button", { name: "Add or edit tasks" }).click();
  const title = `Dock focus ${Date.now()}`;
  await page.getByRole("textbox", { name: "New task" }).fill(title);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page
    .getByRole("button", { name: `Focus on ${title}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Choose timer", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Focus minutes" }).fill("16");
  await dock(page, "focus").click();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-working",
    "true",
  );
  await expect(page.locator(".dock-panel")).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Room dock", includeHidden: true }),
  ).toBeHidden();
  const timer = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("todo.timer.v1")!),
  );
  expect(timer.task).toBe(title);
  expect(timer.duration).toBe(960);
  expect(timer.deadline).toBeGreaterThan(Date.now());
  await page.getByRole("button", { name: "Add five minutes" }).click();
  await page.getByRole("button", { name: "Pause focus", exact: true }).click();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-working",
    "false",
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("todo.timer.v1")!).remaining,
    ),
  ).toBeGreaterThan(1200);
});

test("keyboard trap, arrows, reduced motion, tint persistence, winter sky and cursor contrast", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await dock(page, "notes").focus();
  await page.keyboard.press("ArrowRight");
  await expect(dock(page, "ambience")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".dock-panel")).toHaveAttribute(
    "data-dock-pane",
    "ambience",
  );
  const close = page.getByRole("button", { name: "Close panel", exact: true });
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  expect(
    await page
      .locator(".dock-panel")
      .evaluate((n) => n.contains(document.activeElement)),
  ).toBe(true);
  await page.getByRole("button", { name: "Snow", exact: true }).click();
  await expect(page.locator(".room-window-world")).toHaveAttribute(
    "data-weather",
    "snow",
  );
  const bg = await page
    .locator(".cinema-snow-sky")
    .evaluate((n) => getComputedStyle(n).backgroundImage);
  expect(bg).toContain("evening");
  expect(bg).not.toContain("morning");
  const day = await page
    .locator(".room-morning-sky")
    .evaluate((n) => getComputedStyle(n).opacity);
  expect(day).toBe("0");
  const color = await page
    .locator(".cinema-cursor-dot")
    .evaluate((n) => getComputedStyle(n).backgroundColor);
  expect(color).toBe("rgb(169, 103, 29)");
  await page.keyboard.press("Escape");
  await expect(dock(page, "ambience")).toBeFocused();
  await page.getByRole("button", { name: "Open room settings" }).click();
  await page.getByRole("slider", { name: "Glass tint" }).fill("0.7");
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("todo.room.polish.v1")!).glass,
      ),
    )
    .toBe(0.7);
});

test("AI toggle, genuine pending status and quota response preserve companion mode", async ({
  page,
}) => {
  const ready = {
    ai: true,
    vision: true,
    provider: "gemini",
    friends: false,
    quota: { used: 0, limit: 20, resting: false, resetsAt: "tomorrow" },
  };
  await page.route("**/api/status", (route) => route.fulfill({ json: ready }));
  await page.route("**/api/chat", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.fulfill({
      status: 429,
      json: { error: "A little rest. Back tomorrow." },
    });
  });
  await enter(page);
  await dock(page, "agent").click();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-mode",
    "agent",
  );
  await expect(
    page.getByRole("textbox", { name: "Message Todo" }),
  ).toBeVisible();
  await dock(page, "agent").click();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-mode",
    "companion",
  );
  await dock(page, "agent").click();
  await page.getByRole("textbox", { name: "Message Todo" }).fill("Hello Todo");
  await page.getByRole("button", { name: "Send to Todo", exact: true }).click();
  await expect(page.locator(".room-speech-pill")).toContainText(
    "Todo is working",
  );
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-mode",
    "companion",
  );
  await expect(page.locator(".dock-panel")).toHaveCount(0);
  await expect(dock(page, "agent")).toHaveAttribute("aria-disabled", "true");
});

test("legacy feature flag preserves the old room controls", async ({
  page,
}) => {
  await enter(page, "?dock=0");
  await expect(page.locator(".todo-dock")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ambience", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".room-home-card")).toBeVisible();
  await page
    .getByRole("button", { name: "Start table timer", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Focus minutes" }),
  ).toBeVisible();
});

test("hardware frame budget while moving across dock and glass panel", async ({
  page,
}) => {
  await enter(page);
  await dock(page, "ambience").click();
  await page.getByRole("button", { name: "Rainy noise", exact: true }).click();
  await expect(page.locator(".room-audio-state")).toHaveAttribute(
    "data-state",
    "playing",
  );
  await page.waitForTimeout(1000);
  const sampling = page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const values: number[] = [];
        let last = performance.now();
        const tick = (now: number) => {
          values.push(now - last);
          last = now;
          if (values.length === 120) resolve(values.slice(5));
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  const dockRect = (await page.locator(".todo-dock").boundingBox())!;
  for (let step = 0; step < 28; step++) {
    const x = dockRect.x + dockRect.width * (0.1 + (0.8 * (step % 14)) / 13);
    await page.mouse.move(x, dockRect.y + dockRect.height / 2);
    await page.waitForTimeout(35);
  }
  const samples = await sampling;
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length,
    p95 = sorted[Math.floor(sorted.length * 0.95)];
  await fs.mkdir("outputs", { recursive: true });
  await fs.writeFile(
    "outputs/todo-dock-frame-budget.json",
    JSON.stringify({ mean, p95, samples: samples.length }, null, 2),
  );
  expect(mean).toBeLessThan(25);
  expect(p95).toBeLessThan(34);
  await page.screenshot({ path: "outputs/todo-dock-ambience.png" });
});

test("notes still save, import, export PDF and create flashcards inside the dock shell", async ({
  page,
}) => {
  await enter(page);
  await dock(page, "notes").click();
  await page.getByLabel("Upload study notes", { exact: true }).setInputFiles({
    name: "dock-note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("A quiet note from the new dock."),
  });
  await expect(
    page.getByRole("textbox", { name: "Your notes", exact: true }),
  ).toHaveValue("A quiet note from the new dock.");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Make a PDF", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.locator(".room-saved-notes")).toContainText("dock-note");
  await page.getByRole("button", { name: "Flashcards", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Question", exact: true })
    .fill("What does Todo do?");
  await page
    .getByRole("textbox", { name: "Answer", exact: true })
    .fill("Keeps you company.");
  await page
    .getByRole("button", { name: "Keep this card", exact: true })
    .click();
  await expect(
    page
      .locator(".room-flashcard")
      .filter({ hasText: "What does Todo do?" })
      .first(),
  ).toContainText("What does Todo do?");
});

test("resize leaves no stuck animation or off-screen panel", async ({
  page,
}) => {
  await enter(page);
  await dock(page, "notes").click();
  await page.setViewportSize({ width: 1050, height: 740 });
  await expect(page.locator(".dock-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".dock-panel")).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 960 });
  await dock(page, "focus").click();
  await expect(page.locator(".dock-focus-setup")).toBeVisible();
});

test.describe("touch dock", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  test("tap opens a reachable sheet without magnification", async ({
    page,
  }) => {
    await enter(page);
    await dock(page, "notes").tap();
    const panel = page.locator(".dock-panel");
    await expect(panel).toBeVisible();
    const r = await panel.boundingBox();
    expect(r!.x).toBeGreaterThanOrEqual(0);
    expect(r!.x + r!.width).toBeLessThanOrEqual(391);
    await page.getByRole("button", { name: "Close panel", exact: true }).tap();
    await expect(panel).toHaveCount(0);
  });
});

test("keyboard can start from the focus form without leaving the dialog", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await dock(page, "focus").click();
  await page.getByRole("spinbutton", { name: "Focus minutes" }).fill("12");
  await page.getByRole("spinbutton", { name: "Focus minutes" }).press("Enter");
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-working",
    "true",
  );
});

test("expanded focus pill leaves its neighbors clear and fast mode switches cannot restore stale panels", async ({
  page,
}) => {
  await enter(page);
  await dock(page, "focus").click();
  for (const id of ["ambience", "friends", "focus"]) {
    await dock(page, id).hover();
    await page.waitForTimeout(350);
    const rects = await page.locator(".todo-dock-button").evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return { left: r.left, right: r.right };
      }),
    );
    for (let i = 1; i < rects.length; i++)
      expect(rects[i].left - rects[i - 1].right).toBeGreaterThan(-2);
  }
  await dock(page, "notes").click({ force: true });
  await dock(page, "agent").click({ force: true });
  await expect(page.locator(".dock-panel")).toHaveAttribute(
    "data-dock-pane",
    "agent",
  );
  await page.waitForTimeout(400);
  await expect(page.locator(".dock-panel")).toHaveAttribute(
    "data-dock-pane",
    "agent",
  );
});

test("retired Quiet shortcut restores motion once and Ambience contains only scene and recording controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "todo.settings.v1",
      JSON.stringify({ reduced: true, sound: false }),
    );
    localStorage.setItem(
      "todo.room.polish.v1",
      JSON.stringify({ muted: true, mix: { rain: 1, fire: 1 } }),
    );
  });
  await enter(page);
  await expect(page.locator(".cozy-room")).not.toHaveClass(/cozy-room-reduced/);
  await dock(page, "ambience").click();
  await expect(
    page.getByRole("button", { name: "Weather nearby", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Room sounds & comfort", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Quiet mode", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("group", { name: "Room textures", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("todo.settings.v1")!).version,
      ),
    )
    .toBe(2);
});

test("stopping motion mid-blink always opens both eyes", async ({ page }) => {
  await enter(page);
  await page.getByRole("button", { name: "Open room settings" }).click();
  // Reproduce the exact stuck state at the instant the animation ticker stops.
  await page
    .locator(".room-pet")
    .evaluate((n) => n.setAttribute("data-blink", "true"));
  await page
    .getByRole("switch", { name: "Gentler motion", exact: true })
    .click();
  await expect(page.locator(".room-pet")).toHaveAttribute(
    "data-blink",
    "false",
  );
  const eyes = await page
    .locator(".room-idle-lid")
    .evaluateAll((nodes) =>
      nodes.map((n) => new DOMMatrix(getComputedStyle(n).transform).m22),
    );
  expect(eyes).toEqual([0, 0]);
  await page
    .getByRole("switch", { name: "Gentler motion", exact: true })
    .click();
  await expect(page.locator(".cozy-room")).not.toHaveClass(/cozy-room-reduced/);
});

test("OS reduced motion keeps visible open eyes and remains respected", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem(
      "todo.settings.v1",
      JSON.stringify({ reduced: true, sound: false }),
    );
    localStorage.setItem(
      "todo.room.polish.v1",
      JSON.stringify({ muted: true }),
    );
  });
  await enter(page);
  await expect(page.locator(".cozy-room")).toHaveClass(/cozy-room-reduced/);
  await expect(page.locator(".room-pet")).toHaveAttribute(
    "data-blink",
    "false",
  );
  await expect(page.locator(".room-live-eye")).toHaveCount(2);
});

test("supplied audio loops play without an iframe, switch and stop; weather never selects audio", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  await dock(page, "ambience").click();
  for (const [name, id] of [
    ["Brown noise", "brown"],
    ["White noise", "white"],
    ["Rainy noise", "rain"],
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".room-audio-state")).toHaveAttribute(
      "data-state",
      "playing",
    );
    await expect(page.locator(".room-audio-state")).toHaveAttribute(
      "data-recording",
      id,
    );
    await expect(page.locator(".room-audio-state")).toHaveAttribute(
      "data-loop",
      "true",
    );
    expect(
      Number(
        await page.locator(".room-audio-state").getAttribute("data-frames"),
      ),
    ).toBeGreaterThan(350000);
    await page.getByRole("button", { name: "Day", exact: true }).click();
    await expect(page.locator(".room-audio-state")).toHaveAttribute(
      "data-recording",
      id,
    );
  }
  await page.getByRole("button", { name: "Sound off", exact: true }).click();
  await expect(page.locator(".room-audio-state")).toHaveCount(0);
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("decoded audio crosses each loop boundary with no inserted silence", async ({
  page,
}) => {
  await page.goto("/");
  const checks = await page.evaluate(async () => {
    const results = [];
    for (const id of ["white", "brown", "rain"]) {
      const offline = new OfflineAudioContext(2, 13230, 44100);
      const bytes = await (
        await fetch(`/audio/${id}-noise-loop.wav`)
      ).arrayBuffer();
      const buffer = await offline.decodeAudioData(bytes);
      const source = offline.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(offline.destination);
      const boundary = 6615;
      source.start(0, (buffer.length - boundary) / 44100);
      const rendered = await offline.startRendering();
      const data = rendered.getChannelData(0),
        original = buffer.getChannelData(0);
      const rms = (start: number) =>
        Math.sqrt(
          data.slice(start, start + 441).reduce((sum, v) => sum + v * v, 0) /
            441,
        );
      results.push({
        id,
        before: rms(boundary - 441),
        after: rms(boundary),
        boundaryError: Math.abs(data[boundary] - original[0]),
        tailError: Math.abs(data[boundary - 1] - original[buffer.length - 1]),
      });
    }
    return results;
  });
  for (const check of checks) {
    expect(check.before).toBeGreaterThan(0.001);
    expect(check.after).toBeGreaterThan(0.001);
    expect(check.boundaryError).toBeLessThan(0.00001);
    expect(check.tailError).toBeLessThan(0.00001);
  }
  await fs.writeFile(
    "outputs/todo-audio-browser-checks.json",
    JSON.stringify(checks, null, 2),
  );
});

test("shooting-star cursor stays visible on the light rendering path and dock hover stays gentle", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      get: () => 4,
    }),
  );
  await enter(page);
  await page.mouse.move(1050, 700, { steps: 8 });
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-quality",
    "low",
  );
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-custom-cursor",
    "true",
  );
  const star = await page
    .locator(".cinema-cursor-dot")
    .evaluate((n) => getComputedStyle(n, "::after").content);
  expect(star).toContain("✦");
  await dock(page, "notes").hover();
  await page.waitForTimeout(350);
  const scales = await page
    .locator(".todo-dock-wave")
    .evaluateAll((nodes) =>
      nodes.map((n) => new DOMMatrix(getComputedStyle(n).transform).m11),
    );
  expect(Math.max(...scales)).toBeLessThanOrEqual(1.251);
  await dock(page, "notes").click();
  const sizes = await page.locator(".dock-panel").evaluate(
    (n) =>
      new Promise<number[]>((resolve) => {
        const samples: number[] = [];
        const tick = () => {
          samples.push(new DOMMatrix(getComputedStyle(n).transform).m11);
          if (samples.length === 35) resolve(samples);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  expect(Math.max(...sizes)).toBeLessThanOrEqual(1.001);
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(0.95);
  await page.screenshot({ path: "outputs/todo-gentle-dock-cursor.png" });
});

test("cursor follows input while the room cutouts stay registered", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      get: () => 8,
    }),
  );
  await enter(page);
  await page.waitForTimeout(1500);
  const layers = page.locator(
    ".cozy-room-image, .cinema-furniture-layer, .cinema-foreground-layer, .round-table-front, .room-window-world",
  );
  const snapshot = () =>
    layers.evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect(),
          css = getComputedStyle(n);
        return {
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
          transform: css.transform,
          translate: css.translate,
        };
      }),
    );
  await page.mouse.move(160, 120);
  await page.waitForTimeout(400);
  const before = await snapshot();
  expect(before.length).toBeGreaterThanOrEqual(5);
  await page.mouse.move(1150, 700, { steps: 12 });
  await page.waitForTimeout(400);
  expect(await snapshot()).toEqual(before);
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-custom-cursor",
    "true",
  );
  const pos = await page.locator(".cinema-cursor-dot").evaluate((el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return { x: m.m41, y: m.m42 };
  });
  expect(pos.x).toBeCloseTo(1150, 0);
  expect(pos.y).toBeCloseTo(700, 0);
  await page.screenshot({ path: "outputs/todo-stable-room-cursor.png" });
});

test("daylight break keeps Todo awake, invites play and returns gently from bubbles", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  await dock(page, "ambience").click();
  await page.getByRole("button", { name: "Day", exact: true }).click();
  await page.keyboard.press("Escape");
  await dock(page, "focus").click();
  await dock(page, "focus").click();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-working",
    "true",
  );
  await expect(page.locator(".todo-dock")).toBeHidden();
  await expect(page.locator(".round-room-art")).toHaveAttribute(
    "data-work-phase",
    "writing",
  );
  expect(
    await page
      .locator(".todo-writing-rig")
      .evaluate((el) => getComputedStyle(el).filter),
  ).toContain("brightness(1.22)");
  await page.screenshot({ path: "outputs/todo-focus-dock-hidden.png" });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Take a break", exact: true }).click();
  await page.getByRole("button", { name: "Start break", exact: true }).click();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-resting",
    "true",
  );
  await expect(page.locator(".room-rest-transition")).toHaveCount(1);
  await expect(page.locator(".round-room-art")).toHaveAttribute(
    "data-intro",
    "awake",
  );
  await expect(page.locator(".room-pet .room-gaze")).toHaveCSS("opacity", "1");
  await expect(page.locator(".dock-panel")).toHaveCount(0);
  await expect(page.locator(".todo-dock")).toBeHidden();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-break-transition",
    "settled",
  );
  await page.waitForTimeout(700);
  await page.clock.install();
  await page.clock.fastForward(65000);
  await page.mouse.move(1150, 700);
  await page.clock.runFor(300);
  await page.waitForTimeout(250);
  await expect(page.locator(".round-room-art")).not.toHaveAttribute(
    "data-behavior",
    "sleepy",
  );
  const eyes = await page
    .locator(".room-seated-anchor .room-idle-lid")
    .evaluateAll((nodes) =>
      nodes.map((n) => new DOMMatrix(getComputedStyle(n).transform).m22),
    );
  expect(eyes.every((y) => y < 0.05)).toBe(true);
  const rim = await page
    .locator(".todo-sip-left .todo-fur-rim")
    .evaluate((el) => Number(getComputedStyle(el).opacity));
  expect(rim).toBeGreaterThan(0.5);
  await page.screenshot({ path: "outputs/todo-daylight-break-fixed.png" });
  const play = page.getByRole("button", { name: "Play", exact: true });
  await expect(play).toBeVisible();
  await play.hover();
  await page.clock.runFor(350);
  expect(
    await play.evaluate(
      (el) => new DOMMatrix(getComputedStyle(el).transform).m11,
    ),
  ).toBeGreaterThan(1);
  await play.click();
  await page.clock.runFor(500);
  await expect(page.getByRole("region", { name: "Break games" })).toBeVisible();
  await expect(page.getByText("Breathing Bubble", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: /^Bubble Pop/ }).click();
  await page.clock.runFor(500);
  await expect(page.locator(".table-pop-bubble")).toHaveCount(24);
  await page.getByRole("button", { name: "Pop bubble 4", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Pop bubble 4", exact: true }),
  ).toHaveAttribute("data-popped", "true");
  await page.clock.runFor(1800);
  await expect(
    page.getByRole("button", { name: "Pop bubble 4", exact: true }),
  ).toHaveAttribute("data-popped", "false");
  await page.screenshot({ path: "outputs/todo-bubble-game-desktop.png" });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".table-game-screen")).toHaveAttribute(
    "data-leaving",
    "true",
  );
  await page.clock.runFor(400);
  await expect(page.locator(".table-game-screen")).toHaveCount(0);
  await page.clock.runFor(1200);
  await expect(play).toBeVisible();
  await expect(play).toBeFocused();
  await page.getByRole("button", { name: "End break", exact: true }).click();
  await page.clock.runFor(4000);
  await expect(page.locator(".todo-dock")).toBeVisible();
  expect(errors).toEqual([]);
});
