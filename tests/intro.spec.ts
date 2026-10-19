import { test, expect, type Page } from "@playwright/test";
const root = ".intro-experience";
async function progress(page: Page, p: number) {
  // A rebuild uses Lenis's immediate restore; let its native-scroll suppression clear
  // before issuing another programmatic scroll (real wheel input uses a different path).
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
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
      ) <
      Math.max(
        0.0006,
        1.1 /
          (document.querySelector<HTMLElement>(".intro-experience")!
            .offsetHeight -
            innerHeight),
      ),
    p,
  );
  // Wait for scrub to reach the *actual rounded browser scroll coordinate*.
  // Merely entering a one-pixel window can sample opposite sides of a steep veil
  // curve when reversing direction, before the intentionally delayed scrub settles.
  await page.waitForFunction(() => {
    const element = document.querySelector<HTMLElement>(".intro-experience")!;
    const destination = scrollY / (element.offsetHeight - innerHeight);
    return (
      Math.abs(Number(element.dataset.scrollProgress) - destination) < 0.00006
    );
  });
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
    lid: (
      document.querySelector(".intro-male .intro-closed-eye") as HTMLElement
    ).style.opacity,
    density: Number(
      (document.querySelector(".intro-experience") as HTMLElement).dataset
        .density,
    ),
  }));
}
test.beforeEach(async ({ page }) => {
  await page.goto("/signin-with-chatgpt?return_to=/");
  await expect(page.locator(root)).toHaveAttribute("data-loaded", "true");
});

test("cinematic sequence: closed eyes, hidden swap, reveal, and identical reverse timeline", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await progress(page, 0.21);
  const closing = await page
    .locator(".intro-male .intro-closed-eye")
    .evaluateAll((nodes) =>
      nodes.map((node) => Number((node as SVGElement).style.opacity)),
    );
  expect(closing[0]).toBeGreaterThan(0);
  expect(closing[0]).toBeLessThan(1);
  expect(closing[0]).toBeCloseTo(closing[1], 5);
  await progress(page, 0.3);
  const closed = await snapshot(page);
  expect(Number(closed.lid)).toBe(1);
  await expect(page.locator(".intro-cards-male")).toHaveCSS(
    "visibility",
    "hidden",
  );
  await expect(
    page.getByRole("button", { name: /Focus with Todo/ }),
  ).toHaveCount(0);
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
    .locator(".intro-female .intro-pupil")
    .first()
    .getAttribute("style");
  expect(Number(opening?.match(/scaleY\(([-\d.]+)\)/)?.[1])).toBeGreaterThan(1);
  await progress(page, 1);
  await expect(page.locator(root)).toHaveAttribute(
    "data-tracking-female",
    "1.000",
  );
  await expect(
    page.getByRole("button", { name: "Choose her" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: /Focus with Todo/ }),
  ).toHaveCount(1);
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
  await expect(
    page.getByRole("button", { name: /Focus with Todo/ }),
  ).toBeVisible();
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
  await page.getByRole("button", { name: /Focus with Todo/ }).click();
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
  await expect(
    page.locator(".intro-female .intro-closed-eye").first(),
  ).toHaveCSS("opacity", "0");
  await progress(page, 0.35);
  await page.waitForTimeout(700);
  await expect(page.locator(".intro-male")).toHaveCSS("opacity", "1");
});

test("one long wheel gesture completes the story; companions move up with the original avatar and separate clothes", async ({
  page,
}) => {
  const range = await page
    .locator(root)
    .evaluate((e) => e.clientHeight - innerHeight);
  expect(range).toBeLessThan(await page.evaluate(() => innerHeight));
  const sources = await page
    .locator(".intro-base-art")
    .evaluateAll((images) =>
      images.map((image) => (image as HTMLImageElement).getAttribute("src")),
    );
  expect(new Set(sources)).toEqual(new Set(["/art/todo-face.webp"]));
  const outfits = await page
    .locator(".intro-wardrobe")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("src")));
  expect(new Set(outfits).size).toBe(2);
  await expect(page.locator(".intro-headband")).toHaveCount(0);
  const before = await page
    .locator(".intro-male")
    .evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m42);
  await progress(page, 0.3);
  const leaving = await page
    .locator(".intro-male")
    .evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m42);
  expect(leaving).toBeLessThan(before - 30);
  await progress(page, 0.66);
  const arriving = await page
    .locator(".intro-female")
    .evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m42);
  expect(arriving).toBeGreaterThan(20);
  await progress(page, 0);
  await page.mouse.wheel(0, await page.evaluate(() => innerHeight * 0.85));
  await expect
    .poll(() => page.locator(root).getAttribute("data-scroll-progress"))
    .toBe("1.0000");
  await expect(page.getByRole("button", { name: "Choose her" })).toBeVisible();
});

test("cursor sways the original avatar and renders refraction; clicking cheeks reacts without blinking", async ({
  page,
}) => {
  await expect(page.locator(root)).toHaveAttribute("data-lens", "webgl");
  await page.mouse.move(80, 220);
  await page.waitForTimeout(450);
  const left = await page.locator(".intro-male").getAttribute("style");
  const draws = Number(
    await page.locator(root).getAttribute("data-lens-draws"),
  );
  await page.mouse.move(1320, 620);
  await page.waitForTimeout(450);
  expect(await page.locator(".intro-male").getAttribute("style")).not.toBe(
    left,
  );
  await expect
    .poll(async () =>
      Number(await page.locator(root).getAttribute("data-lens-draws")),
    )
    .toBeGreaterThan(draws);
  await expect(page.locator(".intro-art-lens")).toHaveCSS("opacity", "1");
  const ratio = await page
    .locator(".intro-male .intro-pupil")
    .first()
    .evaluate(
      (e) =>
        e.getBoundingClientRect().width /
        e.parentElement!.getBoundingClientRect().width,
    );
  expect(ratio).toBeLessThan(0.56);
  for (const [index, expected] of ["wiggle", "bounce", "nuzzle"].entries()) {
    await page.mouse.click(index ? 1200 : 150, 560);
    await expect(page.locator(root)).toHaveAttribute("data-reaction", expected);
    await page.waitForTimeout(170);
    const clothing = await page
      .locator(".intro-male .intro-wardrobe")
      .getAttribute("style");
    expect(clothing).toContain("rotate(");
    expect(clothing).not.toContain("rotate(0.000deg) scale(1.0000,1.0000)");
    const lids = await page
      .locator(".intro-male .intro-closed-eye")
      .evaluateAll((nodes) =>
        nodes.map((n) => Number((n as SVGElement).style.opacity)),
      );
    expect(lids).toEqual([0, 0]);
    await expect
      .poll(async () =>
        Number(
          await page
            .locator(".intro-male .intro-blush")
            .first()
            .evaluate((e) => e.style.opacity),
        ),
      )
      .toBeGreaterThan(0.05);
    if (index > 0)
      await expect
        .poll(async () =>
          Number(
            await page
              .locator(".intro-male .intro-delight")
              .first()
              .evaluate((e) => e.style.opacity),
          ),
        )
        .toBeGreaterThan(0.1);
    await expect(page.locator(root)).toHaveAttribute("data-reaction", "idle");
  }
  await page.getByRole("button", { name: "Play with him" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(root)).toHaveAttribute("data-reaction", "wiggle");
  await progress(page, 1);
  await page.mouse.move(1100, 560);
  await page.waitForTimeout(400);
  await expect(page.locator(".intro-female .intro-art-lens")).toHaveCount(1);
  await page.getByRole("button", { name: "Play with her" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(root)).toHaveAttribute("data-reaction", "bounce");
});
