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
