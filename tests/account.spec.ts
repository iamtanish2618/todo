import { test, expect } from "@playwright/test";

test("minimal anonymous home connects to real hosted sign-in, not a fake password form", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".intro-experience")).toHaveAttribute(
    "data-loaded",
    "true",
  );
  await expect(page.locator(".intro-cards-male .intro-greeting")).toHaveText(
    "Hey, you.",
  );
  await expect(
    page.getByRole("button", { name: /Focus with Todo/ }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /Ask Todo|Join friends/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  const link = page.getByRole("link", { name: /Continue with ChatGPT/ });
  await expect(link).toHaveAttribute("target", "_top");
  await expect(link).toHaveAttribute(
    "href",
    "/signin-with-chatgpt?return_to=%2F",
  );
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await link.click();
  await expect(
    page.getByRole("button", { name: "Your account", exact: true }),
  ).toBeVisible();
});

test("profile saves to the database, greeting returns by name, mascot follows fields and celebrates", async ({
  page,
}) => {
  await page.goto("/signin-with-chatgpt?return_to=/");
  await expect(page.locator(".intro-experience")).toHaveAttribute(
    "data-loaded",
    "true",
  );
  await page.getByRole("button", { name: "Your account", exact: true }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Avery");
  await page.getByLabel("Your signed-in email").focus();
  await expect(page.locator(".account-mascot-rail")).toHaveClass(/at-email/);
  await page.getByLabel("Your name", { exact: true }).focus();
  await expect(page.locator(".account-mascot-rail")).toHaveClass(/at-name/);
  await page.getByRole("button", { name: /Make it mine|Save changes/ }).click();
  await expect(
    page.getByRole("heading", { name: "Lovely to meet you, Avery." }),
  ).toBeVisible();
  await expect(page.locator(".pocket-todo")).toHaveClass(/pocket-happy/);
  await page.getByRole("button", { name: "Back to Todo", exact: true }).click();
  await expect(page.locator(".intro-cards-male .intro-greeting")).toHaveText(
    "Hey, Avery.",
  );
  await page.reload();
  await expect(page.locator(".intro-cards-male .intro-greeting")).toHaveText(
    "Welcome back, Avery.",
  );
  await page.getByRole("button", { name: /Focus with Todo/ }).click();
  await expect(page.locator(".study-room.room-entered")).toBeVisible();
  await page.getByRole("button", { name: "Agent", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Message Todo" }),
  ).toBeVisible();
});

test("profile API enforces identity, origin, input size, and server-owned user ID", async ({
  request,
}) => {
  expect((await request.get("/api/profile")).status()).toBe(401);
  expect(
    (
      await request.put("/api/profile", {
        data: { name: "Fake" },
        headers: {
          "oai-authenticated-user-id": "forged",
          "oai-authenticated-user-email": "fake@example.com",
        },
      })
    ).status(),
  ).toBe(401);
  await request.get("/signin-with-chatgpt?return_to=/");
  expect(
    (await request.put("/api/profile", { data: { name: "" } })).status(),
  ).toBe(400);
  expect(
    (
      await request.put("/api/profile", { data: { name: "x".repeat(51) } })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.put("/api/profile", {
        data: { name: "Someone", userId: "forged" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.put("/api/profile", {
        data: { name: "Someone" },
        headers: { Origin: "https://another.invalid" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.put("/api/profile", { data: { name: "x".repeat(3000) } })
    ).status(),
  ).toBe(413);
});
