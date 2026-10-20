import { test, expect, type Page } from "@playwright/test";
import { promises as fs } from "node:fs";
async function enter(page: Page) {
  await page.goto("/signin-with-chatgpt?return_to=/");
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
  );
  await expect(page.locator(".round-room-art")).toHaveAttribute(
    "data-intro",
    "awake",
  );
}

test("bokeh entry wakes Todo and interactive props stay usable without changing session state", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/signin-with-chatgpt?return_to=/");
  await page
    .getByRole("button", { name: "Focus with Todo", exact: true })
    .click();
  await expect(page.locator(".room-arrival-wordmark")).toContainText("todo");
  await expect(page.locator(".round-room-art")).toHaveAttribute(
    "data-intro",
    "sleep",
  );
  await expect(page.locator(".round-room-art")).toHaveAttribute(
    "data-intro",
    "wake",
  );
  await expect(page.locator(".round-room-art")).toHaveAttribute(
    "data-intro",
    "awake",
  );
  await page.getByRole("button", { name: "Pour a little tea" }).click();
  await expect(page.locator(".round-room-art")).toHaveAttribute(
    "data-prop-action",
    "pour",
  );
  await page.getByRole("button", { name: "Turn the notebook page" }).click();
  await expect(page.locator(".round-room-art")).toHaveAttribute(
    "data-prop-action",
    "page",
  );
  await page
    .getByRole("button", { name: "Make a wish on a shooting star" })
    .click();
  await page.getByRole("button", { name: "Turn table lamp off" }).click();
  await expect(page.locator(".round-room-art")).toHaveAttribute(
    "data-lamp-on",
    "false",
  );
  await page.getByRole("button", { name: "Turn table lamp on" }).click();
  await page.getByRole("button", { name: "Say hello to Todo" }).click();
  const first = await page.locator(".room-pet").getAttribute("data-reaction");
  await expect(page.locator(".room-pet")).toHaveAttribute(
    "data-reaction",
    "idle",
  );
  await page.getByRole("button", { name: "Say hello to Todo" }).click();
  const second = await page.locator(".room-pet").getAttribute("data-reaction");
  expect(first).not.toBe(second);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("todo.timer.v1")!).started,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});

test("five scenes crossfade only inside the window, keep audio independent, and remember sound comfort", async ({
  page,
}) => {
  await enter(page);
  await page.getByRole("button", { name: "Ambience", exact: true }).click();
  for (const [label, value] of [
    ["Day", "morning"],
    ["Rain", "rain"],
    ["Snow", "snow"],
    ["Sunset", "sunset"],
    ["Night", "night"],
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator(".round-room-art")).toHaveAttribute(
      "data-weather",
      value,
    );
    await expect(
      page.getByRole("button", { name: "Sound off", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("iframe")).toHaveCount(0);
  }
  await page.getByText("Room sounds & comfort", { exact: true }).click();
  await page.getByRole("slider", { name: "Master volume" }).fill("0.3");
  await page.getByRole("slider", { name: "Warm pad" }).fill("0.2");
  await page.getByRole("switch", { name: "Mute all room sounds" }).click();
  await page.getByRole("switch", { name: "Match my time of day" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("todo.room.polish.v1")!).mix.pad,
      ),
    )
    .toBe(0.2);
  await page.reload();
  await page
    .getByRole("button", { name: "Focus with Todo", exact: true })
    .click();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-arriving",
    "false",
  );
  await page.getByRole("button", { name: "Ambience", exact: true }).click();
  await page.getByText("Room sounds & comfort", { exact: true }).click();
  await expect(page.getByRole("slider", { name: "Master volume" })).toHaveValue(
    "0.3",
  );
  await expect(
    page.getByRole("switch", { name: "Mute all room sounds" }),
  ).toBeChecked();
});

test("focus keeps props calm, has a smooth ring and usable pause and +5 controls", async ({
  page,
}) => {
  await enter(page);
  await page
    .getByRole("button", { name: "Start table timer", exact: true })
    .click();
  await page.getByRole("button", { name: "15 min", exact: true }).click();
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-working",
    "true",
  );
  await expect(
    page.getByRole("group", { name: "Focus controls" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pour a little tea" }),
  ).toBeDisabled();
  await expect(page.locator(".round-room-art")).toHaveAttribute(
    "data-behavior",
    "idle",
  );
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("todo.timer.v1")!),
  );
  await page.getByRole("button", { name: "Add five minutes" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("todo.timer.v1")!).duration,
      ),
    )
    .toBe(before.duration + 300);
  const offset = await page
    .locator(".round-timer-progress")
    .evaluate((el) => parseFloat((el as SVGElement).style.strokeDashoffset));
  await expect
    .poll(() =>
      page
        .locator(".round-timer-progress")
        .evaluate((el) =>
          parseFloat((el as SVGElement).style.strokeDashoffset),
        ),
    )
    .not.toBe(offset);
  await page.getByRole("button", { name: "Pause focus", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Tasks", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-working",
    "false",
  );
});

test("notebook accepts real drops, prints a PDF, and flashcards flip without leaking the hidden side", async ({
  page,
}) => {
  await enter(page);
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  const file = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.items.add(
      new File(["A quiet page about orbital motion."], "Orbit.txt", {
        type: "text/plain",
      }),
    );
    return dt;
  });
  await page
    .locator(".room-tool-panel")
    .dispatchEvent("dragenter", { dataTransfer: file });
  await expect(
    page.getByText("Drop into your notebook", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".room-tool-panel")
    .dispatchEvent("drop", { dataTransfer: file });
  await expect(
    page.getByRole("textbox", { name: "Note title", exact: true }),
  ).toHaveValue("Orbit");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Make a PDF", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("Orbit.pdf");
  await expect(page.locator(".cinema-pdf-receipt")).toBeVisible();
  const card = await (
    await page.request.post("/api/flashcards", {
      data: { question: "Cinema question", answer: "Cinema answer" },
    })
  ).json();
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Focus with Todo", exact: true })
    .click();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-arriving",
    "false",
  );
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page.getByRole("button", { name: "Flashcards", exact: true }).click();
  await page
    .getByRole("button", { name: "Flip card: Cinema question" })
    .click();
  await expect(
    page.locator(".room-flashcard").filter({ hasText: "Cinema question" }),
  ).toHaveAttribute("data-flipped", "true");
  await expect(
    page
      .locator(".room-flashcard")
      .filter({ hasText: "Cinema question" })
      .locator(".cinema-flash-face:not(.cinema-flash-back)"),
  ).toHaveAttribute("aria-hidden", "true");
  await page.request.delete("/api/flashcards", { data: { id: card.id } });
});

test("reduced motion and low-power devices simplify decoration without breaking the room", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "hardwareConcurrency", { value: 2 }),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-quality",
    "low",
  );
  await expect(page.locator(".cinema-cursor")).toBeHidden();
  await expect(page.locator(".cinema-grain")).toBeHidden();
  await page
    .getByRole("button", { name: "Start table timer", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Focus minutes", exact: true }),
  ).toBeVisible();
});

test("local weather is opt-in, sends coarse coordinates, and respects manual scene changes", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"], {
    origin: "http://localhost:3000",
  });
  await context.setGeolocation({ latitude: 28.634, longitude: 77.227 });
  const calls: string[] = [];
  await page.route("https://api.open-meteo.com/**", async (route) => {
    calls.push(route.request().url());
    await route.fulfill({ json: { current: { weather_code: 73, is_day: 1 } } });
  });
  await enter(page);
  await page.getByRole("button", { name: "Ambience", exact: true }).click();
  expect(calls).toEqual([]);
  await page.getByText("Weather nearby", { exact: true }).click();
  await page
    .getByRole("button", { name: "Use local weather", exact: true })
    .click();
  await expect(page.locator(".round-room-art")).toHaveAttribute(
    "data-weather",
    "snow",
  );
  expect(calls).toHaveLength(1);
  const url = new URL(calls[0]);
  expect(url.searchParams.get("latitude")).toBe("28.6");
  expect(url.searchParams.get("longitude")).toBe("77.2");
  await page.getByRole("button", { name: "Night", exact: true }).click();
  await expect(page.locator(".round-room-art")).toHaveAttribute(
    "data-weather",
    "night",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("todo.room.polish.v1")),
  ).not.toContain("28.6");
});

test("denied weather permission keeps the room usable and makes no weather request", async ({
  page,
}) => {
  let calls = 0;
  await page.route("https://api.open-meteo.com/**", (route) => {
    calls++;
    return route.abort();
  });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (
          _success: unknown,
          error: (e: { code: number }) => void,
        ) => error({ code: 1 }),
      },
    }),
  );
  await enter(page);
  await page.getByRole("button", { name: "Ambience", exact: true }).click();
  await page.getByText("Weather nearby", { exact: true }).click();
  await page
    .getByRole("button", { name: "Use local weather", exact: true })
    .click();
  await expect(
    page.getByText("No problem. Choose any scene you like.", { exact: true }),
  ).toBeVisible();
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "Day", exact: true }).click();
  await expect(page.locator(".round-room-art")).toHaveAttribute(
    "data-weather",
    "morning",
  );
});

test("dragging reorders saved tasks without completing or selecting them", async ({
  page,
}) => {
  await enter(page);
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  const titles = [1, 2, 3].map((n) => `Cinema order ${Date.now()} ${n}`);
  const ids: string[] = [];
  try {
    for (const title of titles) {
      await page
        .getByRole("textbox", { name: "New task", exact: true })
        .fill(title);
      await page.getByRole("button", { name: "Add task", exact: true }).click();
      await expect(
        page.getByRole("button", { name: `Focus on ${title}`, exact: true }),
      ).toBeVisible();
    }
    const all = await (await page.request.get("/api/tasks")).json();
    ids.push(
      ...all
        .filter((t: { title: string }) => titles.includes(t.title))
        .map((t: { id: string }) => t.id),
    );
    await page
      .locator(".room-task-row")
      .filter({ hasText: titles[0] })
      .locator(".cinema-drag-handle")
      .dragTo(page.locator(".room-task-row").filter({ hasText: titles[2] }));
    await expect(page.locator(".room-task-row").first()).toContainText(
      titles[0],
    );
    for (const title of titles)
      await expect(
        page.getByRole("button", { name: `Focus on ${title}`, exact: true }),
      ).toHaveAttribute("aria-pressed", "false");
    const after = await (await page.request.get("/api/tasks")).json();
    expect(
      after
        .filter((t: { id: string; done: boolean }) => ids.includes(t.id))
        .every((t: { done: boolean }) => !t.done),
    ).toBe(true);
  } finally {
    for (const id of ids)
      await page.request.delete("/api/tasks", { data: { id } });
  }
});
