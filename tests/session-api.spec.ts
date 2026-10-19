import { test, expect } from "@playwright/test";

test("session API never trusts a client identity or cross-origin cookie mutation", async ({ request }) => {
  const current = await request.get("/api/auth/session");
  expect(await current.json()).toEqual({ identity: null });
  expect(current.headers()["cache-control"]).toContain("no-store");
  for (const method of ["post", "delete"] as const) {
    expect((await request[method]("/api/auth/session", {
      headers: { Origin: "https://another-site.invalid" }, data: { token: "fake" },
    })).status()).toBe(403);
  }
  expect((await request.post("/api/auth/session", { data: { token: "fake" } })).status()).toBe(403);
  // The legacy preview provider must not accept Firebase session requests.
  const fake = await request.post("/api/auth/session", { headers: { Origin: "http://localhost:3000" }, data: { token: "fake" } });
  expect([401, 503]).toContain(fake.status());
  const logout = await request.delete("/api/auth/session", { headers: { Origin: "http://localhost:3000" } });
  expect(logout.status()).toBe(200);
  expect(logout.headers()["set-cookie"]).toContain("Max-Age=0");
  expect(logout.headers()["set-cookie"]).toContain("HttpOnly");
  expect(logout.headers()["set-cookie"]).toContain("SameSite=Lax");
});
