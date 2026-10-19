import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import fs from "node:fs/promises";

test.beforeEach(async ({ page }, info) => {
  if (info.title.startsWith("backend")) return;
  await page.goto("/signin-with-chatgpt?return_to=/");
  await expect(page.locator(".intro-experience")).toHaveAttribute(
    "data-loaded",
    "true",
  );
  await expect(
    page.getByRole("button", { name: /Focus with Todo/ }),
  ).toBeVisible();
  await expect(page.locator(".todo-root")).toHaveAttribute(
    "data-ready",
    "true",
  );
});

test("homepage, live pupil tracking, glass hover, scroll handoff and character persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.mouse.move(100, 140);
  await page.waitForTimeout(500);
  const left = await page
    .locator(".intro-male .leftEye .intro-pupil")
    .first()
    .getAttribute("style");
  await page.mouse.move(1300, 700);
  await page.waitForTimeout(500);
  const right = await page
    .locator(".intro-male .leftEye .intro-pupil")
    .first()
    .getAttribute("style");
  expect(left).not.toEqual(right);
  const first = page.getByRole("button", { name: /Focus with Todo/ });
  await first.hover();
  await expect(first).toHaveCSS("border-color", "rgb(232, 185, 140)");
  await page.mouse.move(800, 80);
  await page.screenshot({ path: "outputs/todo-desktop.png" });
  await page.getByRole("button", { name: "Choose her", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Choose her" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.waitForFunction(
    () =>
      window.scrollY >=
      document.querySelector<HTMLElement>(".intro-experience")!.offsetHeight -
        window.innerHeight -
        2,
  );
  await page.screenshot({ path: "outputs/todo-female.png" });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Choose her" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});

test("task create, complete, reload persistence, timer pause and saved history", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Focus with Todo/ }).click();
  await page
    .getByRole("button", { name: "Focus & tasks", exact: true })
    .click();
  const task = `Read chapter ${Date.now()}`;
  await page.getByRole("textbox", { name: "New task" }).fill(task);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: `Complete ${task}` }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start focusing", exact: true })
    .click();
  await page.waitForTimeout(1800);
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator(".desk-clock")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Your room is waiting/ }).click();
  await page
    .getByRole("button", { name: "Focus & tasks", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Keep going", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start focusing", exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: `Complete ${task}` }).click();
  await expect(
    page.getByRole("checkbox", { name: `Complete ${task}` }),
  ).toBeChecked();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    page.locator(".history-item").filter({ hasText: task }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to focus" }).click();
  await page
    .getByRole("button", { name: "Focus & tasks", exact: true })
    .click();
  await page
    .getByRole("button", { name: `Delete ${task}`, exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: `Complete ${task}` }),
  ).toHaveCount(0);
});

test("write and persist note; export a real paginated PDF", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Focus with Todo/ }).click();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  const title = `Study notes ${Date.now()}`;
  await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
  await page
    .getByRole("textbox", { name: "Your notes", exact: true })
    .fill(
      "Photosynthesis\nPlants use sunlight to make food.\n" +
        "A clear study note with useful details. ".repeat(230),
    );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const pdf = await PDFDocument.load(await fs.readFile(path!));
  expect(pdf.getPageCount()).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Title", exact: true }),
  ).toHaveValue("");
  await page.getByRole("tab", { name: /Saved notes/ }).click();
  await expect(
    page.getByRole("button", { name: new RegExp("^" + title) }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: /Focus with Todo/ }).click();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page.getByRole("tab", { name: /Saved notes/ }).click();
  await expect(
    page.getByRole("button", { name: new RegExp("^" + title) }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Delete note ${title}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: new RegExp("^" + title) }),
  ).toHaveCount(0);
});

test("AI setup state is honest; text uploads work and failed sends preserve the draft", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Focus with Todo/ }).click();
  await page.getByRole("button", { name: "Agent", exact: true }).click();
  await expect(
    page.getByText(/The AI connection isn’t set up yet/),
  ).toBeVisible();
  await page.getByLabel("Attach text or image").setInputFiles({
    name: "chapter.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "The water cycle includes evaporation and condensation.",
    ),
  });
  const composer = page.getByRole("textbox", { name: "Message Todo" });
  await expect(composer).toHaveValue(/water cycle/);
  await page.getByRole("tab", { name: "Summarize", exact: true }).click();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("private API connection");
  await expect(composer).toHaveValue(/water cycle/);
  await page.getByLabel("Attach text or image").setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jq3cAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.locator(".image-attachment")).toContainText("photo.png");
  await page.getByRole("button", { name: "Remove attached image" }).click();
  await expect(page.locator(".image-attachment")).toHaveCount(0);
});

test("backend rejects anonymous, forged identity, malformed input and cross-origin writes", async ({
  request,
}) => {
  expect((await request.get("/api/tasks")).status()).toBe(401);
  expect(
    (
      await request.get("/api/tasks", {
        headers: {
          "oai-authenticated-user-id": "forged",
          "oai-authenticated-user-email": "fake@example.com",
        },
      })
    ).status(),
  ).toBe(401);
  await request.get("/signin-with-chatgpt?return_to=/");
  expect(
    (await request.post("/api/tasks", { data: { title: "" } })).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/tasks", {
        data: { title: "No" },
        headers: { Origin: "https://another-site.invalid" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.patch("/api/tasks", {
        data: { id: "not-an-id", done: true },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.delete("/api/tasks", {
        data: { id: "22222222-2222-4222-8222-222222222222" },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.post("/api/assistant", {
        data: { mode: "chat", messages: [{ role: "user", content: "Hello" }] },
      })
    ).status(),
  ).toBe(503);
  expect(
    (
      await request.post("/api/assistant", {
        data: { mode: "chat", messages: [] },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/assistant", {
        data: {
          mode: "chat",
          messages: [{ role: "user", content: "Hi" }],
          image: "https://unsafe.example/image",
        },
      })
    ).status(),
  ).toBe(400);
});

test("settings, keyboard dismissal, reduced motion and transparent friends status", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("switch", { name: "Gentler motion" }).check();
  await page.getByRole("switch", { name: "Little sound effects" }).check();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".todo-root")).toHaveClass(/reduce-motion/);
  await page.reload();
  await expect(page.locator(".todo-root")).toHaveClass(/reduce-motion/);
  await page.getByRole("button", { name: "Choose her", exact: true }).click();
  await expect(page.locator(".intro-cards-female")).toHaveCSS("opacity", "1");
  await expect(
    page.getByRole("button", { name: /Focus with Todo/ }),
  ).toHaveCount(1);
  await expect(page.locator(".intro-experience")).toHaveAttribute(
    "data-particles",
    "0",
  );
  await page.getByRole("button", { name: /Focus with Todo/ }).click();
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  await expect(page.getByText("We’re getting the room ready.")).toBeVisible();
  await page.getByRole("button", { name: /Focus with Todo for now/ }).click();
  await expect(
    page.getByRole("region", { name: "Your shared Todo workspace" }),
  ).toBeVisible();
});

test("mobile layout has no horizontal overflow and every primary control opens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForTimeout(600);
  await page.screenshot({ path: "outputs/todo-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const name of ["Focus & tasks", "Friends", "Agent"]) {
    await page.getByRole("button", { name: /Focus with Todo/ }).click();
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".study-room.room-entered")).toBeVisible();
    if (name === "Focus & tasks") {
      await expect(page.locator(".study-room")).toHaveCSS("opacity", "1");
      await page.screenshot({ path: "outputs/room-mobile-v2.png" });
    }
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page
      .getByRole("button", { name: "Choose companion", exact: true })
      .click();
  }
});

test("AI answer can be saved as a note (mocked provider response; no live AI claim)", async ({
  page,
}) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({
      json: {
        ai: true,
        vision: true,
        provider: "Test provider",
        friends: false,
      },
    }),
  );
  await page.route("**/api/assistant", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.mode).toBe("notes");
    expect(body.messages.at(-1).content).toContain("evaporation");
    await route.fulfill({
      json: {
        text: "Water cycle study notes\nEvaporation turns liquid water into vapor. Condensation forms clouds.",
      },
    });
  });
  await page.reload();
  await expect(page.locator(".todo-root")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.getByRole("button", { name: /Focus with Todo/ }).click();
  await page.getByRole("button", { name: "Agent", exact: true }).click();
  await page.getByRole("tab", { name: "Make notes", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Message Todo" })
    .fill("Make notes on evaporation and condensation.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".chat-message.assistant")).toContainText(
    "Evaporation turns liquid water",
  );
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByText("Saved in your notes.")).toBeVisible();
});

test("a completed focus session leads to a quiet break with games on hold", async ({
  page,
}) => {
  await page.evaluate(() =>
    localStorage.setItem(
      "todo.timer.v1",
      JSON.stringify({
        remaining: 1,
        duration: 60,
        deadline: Date.now() + 400,
        task: "Break flow check",
        phase: "focus",
        started: true,
        id: crypto.randomUUID(),
      }),
    ),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Take a little breather." }),
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("A little space to recharge.")).toBeVisible();
  await expect(page.locator(".race-track")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /waddle|race/i })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Start break", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Back to focus", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to focus", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Let’s do one small thing." }),
  ).toBeVisible();
});

test("solo is a room; tool panels preserve the scene, timer, and background AI work", async ({
  page,
}) => {
  await page.route("**/api/assistant", async (route) => {
    await new Promise((r) => setTimeout(r, 2200));
    await route.fulfill({
      json: { text: "A calm plan: read, make notes, then take a break." },
    });
  });
  await page.getByRole("button", { name: /Focus with Todo/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const room = page.getByRole("region", { name: "Your shared Todo workspace" });
  await expect(room).toBeVisible();
  await expect(room).toHaveCSS("opacity", "1");
  await expect(page.locator(".room-laptop")).toBeVisible();
  await expect(page.locator(".coffee-cup")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Room focus task" })
    .fill("Study with my penguin");
  await page
    .getByRole("button", { name: "Start focusing", exact: true })
    .click();
  await expect(room).toHaveClass(/is-working/);
  await page.screenshot({ path: "outputs/room-v2.png" });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const before = await page.locator(".room-companion").boundingBox();
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "Focus & tasks", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "What are you working on?" }),
    ).toHaveValue("Study with my penguin");
    await page.getByRole("button", { name: "Close", exact: true }).click();
  }
  const after = await page.locator(".room-companion").boundingBox();
  expect(Math.abs(before!.x - after!.x)).toBeLessThan(1);
  await page.getByRole("button", { name: "Agent", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Message Todo" })
    .fill("Help me make a plan.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator(".room-presence")).toContainText(
    "Working on your request.",
  );
  await expect(room).toHaveAttribute("data-mode", "agent");
  await page.getByRole("button", { name: "Agent", exact: true }).click();
  await expect(page.locator(".chat-message.assistant")).toContainText(
    "A calm plan",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Companion", exact: true }).click();
  await expect(room).toHaveAttribute("data-mode", "companion");
  await page
    .getByRole("button", { name: "Focus & tasks", exact: true })
    .click();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
});
