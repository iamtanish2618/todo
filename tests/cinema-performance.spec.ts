import { test, expect, type Page } from "@playwright/test";
import { promises as fs } from "node:fs";
test.use({ channel: "chrome", launchOptions: { args: [] } });
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
test("desktop frame budget and parallax settle; hidden tabs stop decorative updates", async ({
  page,
}) => {
  await enter(page);
  await page.mouse.move(250, 230);
  await page.mouse.move(1250, 650);
  await expect
    .poll(() =>
      page
        .locator(".cozy-room")
        .evaluate((el) =>
          parseFloat((el as HTMLElement).style.getPropertyValue("--depth-x")),
        ),
    )
    .toBeGreaterThan(0.1);
  const sample = await page.evaluate(
    () =>
      new Promise<{ mean: number; p95: number }>((resolve) => {
        const times: number[] = [];
        let last = 0;
        const measure = (now: number) => {
          if (last) times.push(now - last);
          last = now;
          if (times.length < 150) requestAnimationFrame(measure);
          else {
            const sorted = [...times].sort((a, b) => a - b);
            resolve({
              mean: times.reduce((a, b) => a + b, 0) / times.length,
              p95: sorted[Math.floor(sorted.length * 0.95)],
            });
          }
        };
        requestAnimationFrame(measure);
      }),
  );
  await fs.mkdir("outputs", { recursive: true });
  await fs.writeFile(
    "outputs/todo-cinema-frame-budget.json",
    JSON.stringify(sample, null, 2),
  );
  expect(sample.mean).toBeLessThan(25);
  expect(sample.p95).toBeLessThan(34);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-tab-hidden",
    "true",
  );
  const x = await page.locator(".cozy-room").getAttribute("style");
  await page.mouse.move(300, 200);
  await page.waitForTimeout(150);
  expect(await page.locator(".cozy-room").getAttribute("style")).toBe(x);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-tab-hidden",
    "false",
  );
  await page.screenshot({
    path: "outputs/todo-cinematic-room.png",
    animations: "disabled",
  });
});
