import { test, expect, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import fs from "node:fs/promises";
import { ROOM_CONFIG } from "../components/todo/room/config";

async function enter(page: Page) {
  await page.goto("/signin-with-chatgpt?return_to=/");
  await expect(page.locator(".intro-experience")).toHaveAttribute(
    "data-loaded",
    "true",
  );
  await page
    .getByRole("button", { name: "Focus with Todo", exact: true })
    .click();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-loaded",
    "true",
  );
  await expect(page.locator(".room-pose.pose-visible")).toHaveJSProperty(
    "complete",
    true,
  );
}
function intersects(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

test("desktop room is fully visible at all requested desktop sizes; one invitation and unobstructed safe panels", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(size);
    const photo = page.locator(".cozy-room-image");
    await expect(photo).toHaveCSS("object-fit", "contain");
    const r = (await photo.boundingBox())!;
    expect(r.width / r.height).toBeCloseTo(1.5, 4);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(size.width + 0.1);
    expect(r.y + r.height).toBeLessThanOrEqual(size.height + 0.1);
    expect(
      await photo.evaluate((e) => ({
        width: (e as HTMLImageElement).naturalWidth,
        height: (e as HTMLImageElement).naturalHeight,
      })),
    ).toEqual({ width: 1536, height: 1024 });
    expect(await page.locator("[data-room-ui]").count()).toBeLessThanOrEqual(6);
    await expect(page.locator(".room-home-card button")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const pet = (await page.locator(".room-seated-anchor").boundingBox())!,
      card = (await page.locator(".room-home-card").boundingBox())!;
    expect(intersects(pet, card)).toBe(false);
    const window = {
      x: r.x + (r.width * ROOM_CONFIG.zones.window.x) / 100,
      y: r.y + (r.height * ROOM_CONFIG.zones.window.y) / 100,
      width: (r.width * ROOM_CONFIG.zones.window.width) / 100,
      height: (r.height * ROOM_CONFIG.zones.window.height) / 100,
    };
    for (const name of ["Ambience", "Tasks", "Notes"]) {
      await page.getByRole("button", { name, exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(1);
      const panel = (await page.getByRole("dialog").boundingBox())!;
      expect(intersects(panel, pet)).toBe(false);
      expect(intersects(panel, window)).toBe(false);
      await page
        .getByRole("button", { name: "Close panel", exact: true })
        .click();
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "outputs/cozy-room-desktop.png" });
  expect(errors).toEqual([]);
});

test("tasks persist, three can be selected, completion is saved and privately owned", async ({
  page,
}) => {
  await enter(page);
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  const names = Array.from(
    { length: 4 },
    (_, i) => `Room task ${Date.now()} ${i}`,
  );
  for (const title of names) {
    await page.getByLabel("New task", { exact: true }).fill(title);
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    await expect(
      page.getByRole("button", { name: `Focus on ${title}`, exact: true }),
    ).toBeVisible();
  }
  for (const title of names.slice(0, 3)) {
    await page
      .getByRole("button", { name: `Focus on ${title}`, exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: `Focus on ${names[3]}`, exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Three is a good little handful",
  );
  await expect(
    page.getByRole("button", { name: `Focus on ${names[3]}`, exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page
    .getByRole("button", { name: `Complete ${names[0]}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: `Reopen ${names[0]}`, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await page
    .getByRole("button", { name: "Focus with Todo", exact: true })
    .click();
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Reopen ${names[0]}`, exact: true }),
  ).toBeVisible();
  const stored = await (await page.request.get("/api/tasks")).json();
  expect(
    stored.find((t: { title: string }) => t.title === names[0]).completedAt,
  ).toBeGreaterThan(0);
  for (const title of names) {
    await page
      .getByRole("button", { name: `Delete ${title}`, exact: true })
      .click();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  }
});

test("a sit persists its timer, updates the document title, saves once, then offers a real five-minute break", async ({
  page,
}) => {
  await enter(page);
  const before = await (await page.request.get("/api/room-summary")).json();
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  const title = `A quiet timer check ${Date.now()}`;
  await page.getByLabel("New task", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page
    .getByRole("button", { name: `Focus on ${title}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await page
    .getByRole("button", { name: "Start table timer", exact: true })
    .click();
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(page.locator(".room-pet")).toHaveAttribute(
    "data-pose",
    "writing",
  );
  await expect(page).toHaveTitle(/24:5\d - Todo/);
  await page
    .getByRole("button", { name: "Pause table timer", exact: true })
    .click();
  const paused = await page.locator(".round-timer-face strong").innerText();
  await page.waitForTimeout(1100);
  expect(await page.locator(".round-timer-face strong").innerText()).toBe(
    paused,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Focus with Todo", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Resume table timer", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Finish focus session", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Session complete", exact: true }),
  ).toBeVisible();
  const after = await (await page.request.get("/api/room-summary")).json();
  expect(after.totalSits).toBe(before.totalSits + 1);
  await page
    .getByRole("button", { name: "Todo, take a break", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Take five minutes", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".room-pet")).toHaveAttribute("data-pose", "tea");
  await page
    .getByRole("button", { name: "Take five minutes", exact: true })
    .click();
  await expect(page).toHaveTitle(/04:5\d - Todo/);
  await page.getByRole("button", { name: "Finish break", exact: true }).click();
  expect(
    (await (await page.request.get("/api/room-summary")).json()).totalSits,
  ).toBe(after.totalSits);
});

test("notes save across reload and create a real multi-page PDF; self-written flashcards persist and flip", async ({
  page,
}) => {
  await enter(page);
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  const title = `Quiet notes ${Date.now()}`;
  await page.getByLabel("Note title").fill(title);
  await page
    .getByLabel("Your notes", { exact: true })
    .fill(
      "Photosynthesis: plants use light to make food.\n" +
        "A calm page of useful study notes. ".repeat(260),
    );
  const file = page.waitForEvent("download");
  await page.getByRole("button", { name: "Make a PDF", exact: true }).click();
  const downloaded = await file;
  const pdf = await PDFDocument.load(
    await fs.readFile((await downloaded.path())!),
  );
  expect(pdf.getPageCount()).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Flashcards", exact: true }).click();
  await page
    .getByLabel("Question", { exact: true })
    .fill("What do plants need?");
  await page
    .getByLabel("Answer", { exact: true })
    .fill("Light, water and carbon dioxide.");
  await page
    .getByRole("button", { name: "Keep this card", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Flip card: What do plants need?",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Light, water and carbon dioxide.", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Focus with Todo", exact: true })
    .click();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Delete note ${title}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Flashcards", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Flip card: What do plants need?",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Delete flashcard What do plants need?",
      exact: true,
    })
    .click();
});

const ready = {
  ai: true,
  vision: true,
  provider: "Mock test provider",
  friends: false,
  quota: {
    used: 0,
    limit: 25,
    resting: false,
    resetsAt: "2099-01-01T00:00:00.000Z",
  },
};
test("Agent pending animation follows a real pending browser request, saves notes and returns to Companion on quota (mock provider)", async ({
  page,
}) => {
  await page.route("**/api/status", (route) => route.fulfill({ json: ready }));
  let limited = false;
  await page.route("**/api/chat", async (route) => {
    if (limited) {
      await route.fulfill({
        status: 429,
        json: { error: "I'm resting for today, but I'm still here with you." },
      });
      return;
    }
    expect(route.request().postDataJSON().mode).toBe("notes");
    await new Promise((r) => setTimeout(r, 1500));
    await route.fulfill({
      json: {
        text: "Water cycle study notes\nEvaporation turns water into vapor.",
      },
    });
  });
  await enter(page);
  await page.getByRole("button", { name: "Agent", exact: true }).click();
  await page.getByLabel("What would help?").selectOption("notes");
  await page.getByLabel("Message Todo").fill("Make notes about evaporation.");
  await page.getByRole("button", { name: "Send to Todo", exact: true }).click();
  await expect(page.locator(".room-pet")).toHaveAttribute(
    "data-pose",
    "typing",
  );
  await expect(
    page.getByText("Todo is working", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".room-chat-message.assistant")).toContainText(
    "Evaporation turns water",
  );
  await expect(page.locator(".room-pet")).toHaveAttribute("data-pose", "idle");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page.getByText("Saved in your notebook.", { exact: true }),
  ).toBeVisible();
  limited = true;
  await page.getByLabel("Message Todo").fill("One more question.");
  await page.getByRole("button", { name: "Send to Todo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Companion", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Agent", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("I'm resting for today, but I'm still here with you.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("unconfigured AI is honest, uploads still read locally, settings and friends stay quiet and keyboard-close", async ({
  page,
}) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { ...ready, ai: false } }),
  );
  await enter(page);
  await page.getByRole("button", { name: "Agent", exact: true }).click();
  await expect(
    page.getByText("Todo’s AI connection isn’t ready yet.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Attach text or image").setInputFiles({
    name: "chapter.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Evaporation and condensation."),
  });
  await expect(page.getByLabel("Message Todo")).toHaveValue(/Evaporation/);
  await expect(
    page.getByRole("button", { name: "Send to Todo", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open room settings", exact: true })
    .click();
  await page
    .getByRole("switch", { name: "Gentler motion", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Let Todo rest", exact: true })
    .click();
  await expect(page.locator(".room-pet")).toHaveAttribute(
    "data-pose",
    "sleeping",
  );
  await page
    .getByRole("button", { name: "Bring friends", exact: true })
    .click();
  await expect(
    page.getByText("A preview for now.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Friend room code").fill("quiet-room");
  await page.getByRole("button", { name: "Join room", exact: true }).click();
  await expect(
    page.getByText("no room has been joined.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".race-track")).toHaveCount(0);
});

test("natural timer completion shows recap and the calm break, with no games", async ({
  page,
}) => {
  await page.goto("/signin-with-chatgpt?return_to=/");
  await page.evaluate(() =>
    localStorage.setItem(
      "todo.timer.v1",
      JSON.stringify({
        remaining: 1,
        duration: 60,
        deadline: Date.now() + 800,
        task: "Natural finish check",
        phase: "focus",
        started: true,
        id: crypto.randomUUID(),
        startedAt: Date.now() - 59000,
      }),
    ),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Session complete", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await page
    .getByRole("button", { name: "Todo, take a break", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little breather.", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".room-pet")).toHaveAttribute("data-pose", "tea");
  await expect(page.locator(".race-track")).toHaveCount(0);
});

test("new backend endpoints reject anonymous and forged ownership; flashcard validation is bounded", async ({
  request,
}) => {
  for (const path of ["/api/flashcards", "/api/room-summary"])
    expect((await request.get(path)).status()).toBe(401);
  expect(
    (
      await request.post("/api/chat", {
        data: { mode: "chat", messages: [{ role: "user", content: "Hi" }] },
      })
    ).status(),
  ).toBe(401);
  await request.get("/signin-with-chatgpt?return_to=/");
  expect(
    (
      await request.post("/api/flashcards", {
        data: { question: "Q", answer: "A", userId: "someone-else" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/flashcards", {
        data: { question: "x".repeat(501), answer: "A" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/flashcards", {
        headers: { Origin: "https://attacker.invalid" },
        data: { question: "Q", answer: "A" },
      })
    ).status(),
  ).toBe(403);
  expect((await request.get("/api/room-summary")).status()).toBe(200);
});

test("table flow requires chosen tasks; task completion leads to coffee, ambience changes and uploaded notes are readable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  await expect(
    page.getByLabel("Your wooden study table", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start table timer", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("choose up to three");
  const title = `Desk flow ${Date.now()}`;
  await page.getByLabel("New task", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page
    .getByRole("button", { name: `Focus on ${title}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Choose timer", exact: true }).click();
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-working",
    "true",
  );
  await expect(page.locator(".room-pet")).toHaveAttribute(
    "data-pose",
    "writing",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await page
    .getByRole("button", { name: `Complete ${title}`, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Session complete", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Todo, take a break", exact: true })
    .click();
  await expect(page.locator(".room-pet")).toHaveAttribute("data-pose", "tea");
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await page.getByRole("button", { name: "Ambience", exact: true }).click();
  await page.getByRole("button", { name: "Night", exact: true }).click();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-tone",
    "night",
  );
  await page.getByRole("switch", { name: "Rain outside", exact: true }).check();
  await expect(page.locator(".cozy-room")).toHaveAttribute("data-rain", "true");
  await page.getByLabel("Soft sounds", { exact: true }).selectOption("rain");
  await page.getByLabel("Ambience volume", { exact: true }).fill("0.15");
  await page.getByLabel("Soft sounds", { exact: true }).selectOption("off");
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page.getByLabel("Upload study notes", { exact: true }).setInputFiles({
    name: "chapter.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("The water cycle includes evaporation."),
  });
  await expect(page.getByLabel("Your notes", { exact: true })).toHaveValue(
    "The water cycle includes evaporation.",
  );
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await page
    .getByRole("button", { name: `Delete ${title}`, exact: true })
    .click();
  expect(errors).toEqual([]);
});

test("round table has a grounded dimensional timer, dimensional notebook and direct lamp toggle", async ({
  page,
}) => {
  await enter(page);
  const scene = page.locator(".round-room-art");
  await expect(scene).toHaveAttribute("data-entry", "ready");
  await expect(scene).toHaveAttribute("data-lamp-on", "false");
  await page
    .getByRole("button", { name: "Turn table lamp on", exact: true })
    .click();
  await expect(page.locator(".desk-book")).toHaveCSS("opacity", "1");
  const clock = (await page.locator(".round-timer").boundingBox())!;
  expect(clock.width / clock.height).toBeCloseTo(1, 1);
  const photo = (await page.locator(".cozy-room-image").boundingBox())!;
  // Feet contact the TOP surface (~62.5%); the front rim is at ~73%.
  expect((clock.y + clock.height - photo.y) / photo.height).toBeLessThan(0.65);
  await page
    .getByRole("button", { name: "Turn table lamp off", exact: true })
    .click();
  await expect(scene).toHaveAttribute("data-lamp-on", "false");
  await expect(scene).toHaveAttribute("data-entry", "ready");
  await page
    .getByRole("button", { name: "Turn table lamp on", exact: true })
    .click();
  await expect(scene).toHaveAttribute("data-lamp-on", "true");
  await expect(page.locator(".round-timer-case")).toBeVisible();
  await expect(page.locator(".round-timer-shadow")).toBeVisible();
  await page.screenshot({ path: "outputs/todo-round-room-desktop.png" });
});

test("morning replaces the moon; lamp leaves no hand; real writing and coffee flippers move and Timer panel is absent", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  await expect(
    page.getByRole("button", { name: "Timer", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator(
      ".round-reaching-flipper,.round-resting-flipper,.room-writing-hand,.room-ring",
    ),
  ).toHaveCount(0);
  await expect(page.locator(".round-timer-adjust")).toHaveCount(0);
  await expect(page.locator(".round-room-art")).toHaveAttribute(
    "data-lamp-on",
    "false",
  );
  await page
    .getByRole("button", { name: "Turn table lamp on", exact: true })
    .click();
  await page.getByRole("button", { name: "Ambience", exact: true }).click();
  await page.getByRole("button", { name: "Day", exact: true }).click();
  await expect(page.locator(".room-window-world")).toHaveAttribute(
    "data-sky",
    "day",
  );
  await expect(page.locator(".room-morning-sky")).toHaveCSS("opacity", "1");
  await expect(page.locator(".room-morning-sky")).toHaveJSProperty(
    "naturalWidth",
    1536,
  );
  await page.getByRole("switch", { name: "Rain outside", exact: true }).check();
  const duration = await page
    .locator(".window-rain-drops i")
    .first()
    .evaluate((e) => parseFloat(getComputedStyle(e).animationDuration));
  expect(duration).toBeGreaterThanOrEqual(2.8);
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await page.screenshot({ path: "outputs/todo-calm-morning.png" });
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  const title = `Flipper motion ${Date.now()}`;
  await page.getByLabel("New task", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page
    .getByRole("button", { name: `Focus on ${title}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Choose timer", exact: true }).click();
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  const matrix = (selector: string) =>
    page.locator(selector).evaluate((e) => getComputedStyle(e).transform);
  await expect(page.locator(".todo-writing-rig")).toHaveCSS("opacity", "1");
  const left = await matrix(".todo-write-left"),
    right = await matrix(".todo-write-right");
  await page.waitForTimeout(650);
  expect(await matrix(".todo-write-left")).not.toBe(left);
  expect(await matrix(".todo-write-right")).not.toBe(right);
  await page.screenshot({ path: "outputs/todo-writing-flippers.png" });
  await page
    .getByRole("button", { name: "Pause table timer", exact: true })
    .click();
  await expect(page.locator(".todo-writing-rig")).toHaveCSS("opacity", "0");
  await page
    .getByRole("button", { name: "Finish focus session", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Todo, take a break", exact: true })
    .click();
  await expect(page.locator(".todo-coffee-rig")).toHaveCSS("opacity", "1");
  const cup = await matrix(".todo-sip-cup");
  await page.waitForTimeout(4900);
  expect(await matrix(".todo-sip-cup")).not.toBe(cup);
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await page.screenshot({ path: "outputs/todo-coffee-sip.png" });
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await page
    .getByRole("button", { name: `Delete ${title}`, exact: true })
    .click();
  expect(errors).toEqual([]);
});

test("calmer audio plays an actual rain recording at a controlled level, crossfades off and cleans up on exit", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    const observed: Array<{ ctx: AudioContext; analyser: AnalyserNode }> = [];
    (window as unknown as { __todoAudio: typeof observed }).__todoAudio =
      observed;
    window.AudioContext = class extends Original {
      readonly probe: AnalyserNode;
      constructor(options?: AudioContextOptions) {
        super(options);
        this.probe = super.createAnalyser();
        const silent = super.createGain();
        silent.gain.value = 0;
        this.probe.connect(silent);
        silent.connect(this.destination);
        observed.push({ ctx: this, analyser: this.probe });
      }
      createDynamicsCompressor() {
        const node = super.createDynamicsCompressor();
        node.connect(this.probe);
        return node;
      }
    };
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  await page.getByRole("button", { name: "Ambience", exact: true }).click();
  const recording = page.waitForResponse((r) =>
    r.url().endsWith("/audio/quiet-rain.mp3"),
  );
  await page.getByLabel("Soft sounds", { exact: true }).selectOption("rain");
  expect((await recording).status()).toBe(200);
  await page.waitForTimeout(2300);
  const rms = await page.evaluate(() => {
    const list = (
      window as unknown as {
        __todoAudio: Array<{ ctx: AudioContext; analyser: AnalyserNode }>;
      }
    ).__todoAudio;
    const a = list.at(-1)!;
    const samples = new Float32Array(2048);
    a.analyser.getFloatTimeDomainData(samples);
    return {
      state: a.ctx.state,
      value: Math.sqrt(samples.reduce((s, v) => s + v * v, 0) / samples.length),
    };
  });
  expect(rms.state).toBe("running");
  expect(rms.value).toBeGreaterThan(0.00001);
  expect(rms.value).toBeLessThan(0.16);
  await page.getByLabel("Soft sounds", { exact: true }).selectOption("off");
  await page.waitForTimeout(1200);
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { __todoAudio: Array<{ ctx: AudioContext }> }
      ).__todoAudio.every((a) => a.ctx.state === "closed"),
    ),
  ).toBe(true);
  await page.getByLabel("Soft sounds", { exact: true }).selectOption("day");
  await page
    .getByRole("button", { name: "Choose companion", exact: true })
    .click();
  await page.waitForTimeout(1200);
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { __todoAudio: Array<{ ctx: AudioContext }> }
      ).__todoAudio.every((a) => a.ctx.state === "closed"),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("custom focus setup darkens selected tasks, hides controls, prepares Todo and pauses accessibly", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  await expect(page.locator(".round-room-art")).toHaveAttribute(
    "data-lamp-on",
    "false",
  );
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  const title = `Quiet custom focus ${Date.now()}`;
  await page.getByLabel("New task", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  const task = page.getByRole("button", {
    name: `Focus on ${title}`,
    exact: true,
  });
  await task.click();
  await expect(task).toHaveAttribute("aria-pressed", "true");
  await expect(task.locator("..")).toHaveClass(/task-selected/);
  expect(
    await task.evaluate((e) => getComputedStyle(e).textDecorationLine),
  ).toBe("none");
  const tasks = await (await page.request.get("/api/tasks")).json();
  expect(tasks.find((t: { title: string }) => t.title === title).done).toBe(
    false,
  );
  await page.getByRole("button", { name: "Choose timer", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName(
    "A little time for you.",
  );
  await page.getByLabel("Focus minutes", { exact: true }).fill("121");
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-working",
    "false",
  );
  await page.getByLabel("Focus minutes", { exact: true }).fill("37");
  await page.screenshot({ path: "outputs/todo-focus-setup.png" });
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-quiet",
    "true",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".room-edge-tabs")).toBeHidden();
  await expect(page.locator(".room-mode-toggle")).toBeHidden();
  await expect(page.locator(".room-home-card")).toBeHidden();
  await expect(page.locator(".room-nav-settings")).toBeHidden();
  await expect(page.locator(".round-room-art")).toHaveAttribute(
    "data-work-phase",
    "writing",
  );
  await expect(page.locator(".round-room-art")).toHaveAttribute(
    "data-lamp-on",
    "true",
  );
  await expect(page.locator(".round-timer-face strong")).toHaveText(
    /3[67]:[0-5]\d/,
  );
  await expect(page).toHaveTitle(/3[67]:[0-5]\d - Todo/);
  await expect
    .poll(async () =>
      page
        .locator(".room-scene-world")
        .evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a),
    )
    .toBeGreaterThan(1.05);
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(size);
    const fits = await page
      .locator(".round-timer-face strong")
      .evaluate(
        (e) =>
          e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight,
      );
    expect(fits).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "outputs/todo-quiet-focus.png" });
  await page.keyboard.press("Escape");
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-quiet",
    "false",
  );
  await expect(
    page.getByRole("button", { name: "Tasks", exact: true }),
  ).toBeVisible();
  const paused = await page.locator(".round-timer-face strong").innerText();
  await page.waitForTimeout(1200);
  await expect(page.locator(".round-timer-face strong")).toHaveText(paused);
  await page
    .getByRole("button", { name: "Resume table timer", exact: true })
    .click();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-quiet",
    "true",
  );
  await page
    .getByRole("button", { name: "Pause table timer", exact: true })
    .click();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-quiet",
    "false",
  );
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await page
    .getByRole("button", { name: `Delete ${title}`, exact: true })
    .click();
  expect(errors).toEqual([]);
});
