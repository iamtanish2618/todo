import { test, expect, type Page } from "@playwright/test";
const root = ".intro-experience";
async function progress(page: Page, p: number) {
  await page.evaluate(
    (value) =>
      window.scrollTo(
        0,
        value *
          (document.querySelector<HTMLElement>(".intro-experience")!
            .offsetHeight -
            innerHeight),
      ),
    p,
  );
  await page.waitForFunction(
    (value) =>
      Math.abs(
        Number(
          document
            .querySelector(".intro-experience")
            ?.getAttribute("data-scroll-progress"),
        ) - value,
      ) < 0.0006,
    p,
  );
  // Numeric scrub catches up, then inspect exact layer styles, independent of the continuing particle positions.
  await page.waitForTimeout(180);
}
async function snapshot(page: Page) {
  return page.evaluate(() => ({
    veil: Number(
      (document.querySelector(".intro-veil") as HTMLElement).style.opacity,
    ),
    male: Number(
      (document.querySelector(".intro-male") as HTMLElement).style.opacity,
    ),
    female: Number(
      (document.querySelector(".intro-female") as HTMLElement).style.opacity,
    ),
    lid: (document.querySelector(".intro-male .intro-lid-upper") as HTMLElement)
      .style.transform,
    density: Number(
      (document.querySelector(".intro-experience") as HTMLElement).dataset
        .density,
    ),
  }));
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(root)).toHaveAttribute("data-loaded", "true");
});

test("cinematic sequence: closed eyes, hidden swap, reveal, and identical reverse timeline", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await progress(page, 0.3);
  const closed = await snapshot(page);
  expect(closed.lid).toContain("0%, 0px)");
  await expect(page.locator(".intro-cards-male")).toHaveCSS(
    "visibility",
    "hidden",
  );
  await expect(page.getByRole("button", { name: /Focus solo/ })).toHaveCount(0);
  await progress(page, 0.4);
  const forward = await snapshot(page);
  for (const p of [0.46, 0.48, 0.5, 0.52, 0.54]) {
    await progress(page, p);
    expect((await snapshot(page)).veil).toBe(1);
  }
  await page.screenshot({ path: "outputs/intro-whiteout.png" });
  await progress(page, 0.7);
  expect((await snapshot(page)).female).toBe(1);
  await expect(page.locator(root)).toHaveAttribute(
    "data-tracking-female",
    "0.000",
  );
  await progress(page, 0.83);
  const opening = await page
    .locator(".intro-female .intro-lid-upper")
    .first()
    .getAttribute("style");
  expect(Number(opening?.match(/,\s*(-?[\d.]+)%/)?.[1])).toBeLessThan(-70);
  await progress(page, 1);
  await expect(page.locator(root)).toHaveAttribute(
    "data-tracking-female",
    "1.000",
  );
  await expect(
    page.getByRole("button", { name: "Choose her" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /Focus solo/ })).toHaveCount(1);
  await progress(page, 0.4);
  const reverse = await snapshot(page);
  expect(reverse.veil).toBeCloseTo(forward.veil, 3);
  expect(reverse.density).toBeCloseTo(forward.density, 2);
  expect(reverse.male).toBe(forward.male);
  expect(reverse.lid).toBe(forward.lid);
  await progress(page, 0);
  await expect(page.locator(root)).toHaveAttribute(
    "data-tracking-male",
    "1.000",
  );
  expect(errors).toEqual([]);
});

test("fast scroll, resize at a stopped transition, and live timing controls do not get stuck", async ({
  page,
}) => {
  await page.goto("/?debug=1");
  await expect(page.locator(root)).toHaveAttribute("data-loaded", "true");
  await page.evaluate(() => {
    scrollTo(0, 99999);
  });
  await page.waitForTimeout(80);
  await progress(page, 0.63);
  await page.setViewportSize({ width: 1100, height: 760 });
  await page.waitForTimeout(400);
  const registration = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".intro-face")).map((face) => {
      const image = face.querySelector("img")!.getBoundingClientRect(),
        eye = face.querySelector(".leftEye")!.getBoundingClientRect();
      return {
        cx: (eye.x + eye.width / 2 - image.x) / image.width,
        cy: (eye.y + eye.height / 2 - image.y) / image.height,
      };
    }),
  );
  for (const eye of registration) {
    expect(eye.cx).toBeCloseTo(0.262, 3);
    expect(eye.cy).toBeCloseTo(0.416, 3);
  }
  await expect(page.locator(".intro-debug-readout")).toContainText("Snow");
  const timing = page.getByRole("slider", { name: "Eyes open · start" });
  await timing.fill("0.72");
  await expect(timing).toHaveValue("0.72");
  await expect(page.locator(root)).toHaveAttribute("data-open-start", "0.72");
  await progress(page, 0.79);
  await expect(page.locator(root)).toHaveAttribute("data-phase", "opening");
  await progress(page, 1);
  await expect(page.getByRole("button", { name: "Choose her" })).toBeVisible();
  await progress(page, 0);
  await expect(page.getByRole("button", { name: /Focus solo/ })).toBeVisible();
});

test("390 × 844 portrait framing keeps both eyes in view with native keyboard scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(root)).toHaveAttribute("data-viewport", "390x844");
  const eyes = await page
    .locator(".intro-male .intro-eye")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect();
        return { x: r.x, right: r.right, y: r.y, bottom: r.bottom };
      }),
    );
  for (const eye of eyes) {
    expect(eye.x).toBeGreaterThanOrEqual(0);
    expect(eye.right).toBeLessThanOrEqual(390);
    expect(eye.y).toBeGreaterThan(100);
    expect(eye.bottom).toBeLessThan(550);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({ path: "outputs/intro-portrait.png" });
  await page.keyboard.press("PageDown");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await page.waitForTimeout(500); // Let the browser-native PageDown scroll finish before the next test input.
  await progress(page, 0.5);
  await expect(page.locator(root)).toHaveAttribute("data-whiteout", "1");
  await progress(page, 1);
  await page.screenshot({ path: "outputs/intro-portrait-female.png" });
  await page.getByRole("button", { name: /Focus solo/ }).click();
  await expect(page.locator(".study-room.room-entered")).toBeVisible();
});

test("reduced motion uses the quiet crossfade without snow or scripted lids", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator(root)).toHaveAttribute("data-loaded", "true");
  await progress(page, 0.65);
  await page.waitForTimeout(700);
  await expect(page.locator(root)).toHaveAttribute("data-particles", "0");
  await expect(page.locator(".intro-female")).toHaveCSS("opacity", "1");
  expect(
    await page
      .locator(".intro-female .intro-lid-upper")
      .first()
      .getAttribute("style"),
  ).toContain("-70%");
  await progress(page, 0.35);
  await page.waitForTimeout(700);
  await expect(page.locator(".intro-male")).toHaveCSS("opacity", "1");
});
