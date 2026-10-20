import { test, expect, type Page } from "@playwright/test";

async function expiringBreak(page: Page) {
  await page.goto("/signin-with-chatgpt?return_to=/");
  await expect(page.locator(".todo-root")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const before = await (await page.request.get("/api/room-summary")).json();
  await page.evaluate(() =>
    localStorage.setItem(
      "todo.timer.v1",
      JSON.stringify({
        remaining: 1,
        duration: 60,
        deadline: Date.now() + 800,
        phase: "break",
        started: true,
        task: "A little rest",
        id: crypto.randomUUID(),
        startedAt: Date.now() - 59000,
      }),
    ),
  );
  await page.reload();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-arriving",
    "false",
    { timeout: 45000 },
  );
  await expect(
    page.getByRole("alertdialog", { name: "Break’s over!" }),
  ).toBeVisible();
  return before;
}
async function readyRoom(page: Page, before: { totalSits: number }) {
  await expect(page.locator(".break-return")).toHaveCount(0);
  await expect(page.locator(".cozy-room")).toHaveClass(/cozy-room-active/);
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-resting",
    "false",
  );
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-working",
    "false",
  );
  await expect(
    page.getByRole("heading", { name: "What are we doing?", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".cozy-room-stage")).not.toHaveAttribute("inert");
  expect(
    (await (await page.request.get("/api/room-summary")).json()).totalSits,
  ).toBe(before.totalSits);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("todo.timer.v1")!).started,
    ),
  ).toBe(false);
}
async function mockSpeech(page: Page, finish: boolean) {
  await page.addInitScript(
    ({ finish }) => {
      const observations = { messages: [] as string[], cancelled: 0 };
      Object.assign(window, { __breakVoice: observations });
      Object.defineProperty(window, "SpeechSynthesisUtterance", {
        configurable: true,
        value: class {
          text: string;
          constructor(text: string) {
            this.text = text;
          }
        },
      });
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: {
          getVoices: () => [
            { name: "Alex", lang: "en-US", localService: true },
          ],
          speak: (utterance: SpeechSynthesisUtterance) => {
            observations.messages.push(utterance.text);
            if (finish)
              setTimeout(
                () => utterance.onend?.({} as SpeechSynthesisEvent),
                150,
              );
          },
          cancel: () => {
            observations.cancelled++;
          },
        },
      });
    },
    { finish },
  );
}

test("expired break speaks once, wipes diagonally, and restores tools without recording focus", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockSpeech(page, true);
  const before = await expiringBreak(page);
  await expect(
    page.getByText("The break is over. We need to focus once again.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".break-return")).toHaveAttribute(
    "data-stage",
    "sweep",
  );
  await expect(page.locator(".break-return-traveler")).toBeVisible();
  await readyRoom(page, before);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __breakVoice: { messages: string[] } })
          .__breakVoice.messages,
    ),
  ).toEqual(["The break is over. We need to focus once again."]);
  expect(errors).toEqual([]);
});

test("reduced motion and unavailable speech still return automatically", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: undefined,
    });
  });
  const before = await expiringBreak(page);
  await expect(page.locator(".break-return-traveler")).toBeHidden();
  await readyRoom(page, before);
});

test("Back to focus cancels a stalled voice and completes the return once", async ({
  page,
}) => {
  await mockSpeech(page, false);
  const before = await expiringBreak(page);
  await page.getByRole("button", { name: "Back to focus" }).click();
  await readyRoom(page, before);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __breakVoice: { cancelled: number } })
          .__breakVoice.cancelled,
    ),
  ).toBe(1);
});
