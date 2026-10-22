import { test } from "node:test";
import assert from "node:assert/strict";
import { proxyTodo, MAX_BODY_BYTES } from "../lib/server/backend-proxy.mjs";

const origin = "https://todo-penguin.aniketyadav982.chatgpt.site";
const clientOrigin = "https://sit-with-todo.vercel.app";
const req = (path, options = {}) => new Request(`${clientOrigin}/api/${path}`, options);

test("rejects unknown paths, wrong methods, and untrusted backend configuration", async () => {
  const fetcher = () => { throw new Error("Must not fetch"); };
  for (const [path, method, backend, expected] of [
    ["../admin", "GET", origin, 404], ["constructor", "GET", origin, 404],
    ["tasks", "PUT", origin, 405], ["tasks", "GET", "https://evil.example", 503],
  ]) assert.equal((await proxyTodo(req(path, { method }), path, { origin: backend, fetcher })).status, expected);
});

test("write requests require Todo's origin and JSON; rejects declared and streamed oversized bodies", async () => {
  const fetcher = () => { throw new Error("Must not fetch"); };
  assert.equal((await proxyTodo(req("tasks", { method: "POST", headers: { origin: "https://evil.example" } }), "tasks", { origin, fetcher })).status, 403);
  assert.equal((await proxyTodo(req("tasks", { method: "POST", headers: { origin: clientOrigin }, body: "bad" }), "tasks", { origin, fetcher })).status, 415);
  for (const declared of [false, true]) {
    const headers = { origin: clientOrigin, "content-type": "application/json" };
    if (declared) headers["content-length"] = String(MAX_BODY_BYTES + 1);
    const request = req("tasks", { method: "POST", headers, body: declared ? "{}" : "x".repeat(MAX_BODY_BYTES + 1) });
    assert.equal((await proxyTodo(request, "tasks", { origin, fetcher })).status, 413);
  }
});

test("preserves identity, data, and API errors without forwarding unrelated cookies or platform identity", async () => {
  let captured;
  const fetcher = async (url, options) => {
    captured = { url, ...options };
    return Response.json({ error: "Sign in to save your work." }, { status: 401 });
  };
  const request = req("tasks", { headers: {
    authorization: "Bearer test-token", cookie: "other=secret; __Host-todo_session=test-session; vercel=private",
    "x-openai-user-id": "fake-user", "x-forwarded-host": "evil.example",
  } });
  const response = await proxyTodo(request, "tasks", { origin, fetcher });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Sign in to save your work." });
  assert.equal(captured.url, `${origin}/api/tasks`);
  assert.equal(captured.headers.get("Authorization"), "Bearer test-token");
  assert.equal(captured.headers.get("Cookie"), "__Host-todo_session=test-session");
  assert.equal(captured.headers.get("x-openai-user-id"), null);
  assert.equal(captured.headers.get("x-forwarded-host"), null);
  assert.equal(captured.redirect, "manual");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("bridges a same-origin session exchange and only the host-bound Todo cookie", async () => {
  const request = req("auth/session", { method: "POST", body: JSON.stringify({ token: "test-token" }), headers: { origin: clientOrigin, "content-type": "application/json" } });
  const response = await proxyTodo(request, "auth/session", { origin, fetcher: async (url, options) => {
    assert.equal(options.headers.get("Origin"), origin);
    assert.deepEqual(JSON.parse(new TextDecoder().decode(options.body)), { token: "test-token" });
    const headers = new Headers({ "content-type": "application/json" });
    headers.append("Set-Cookie", "__Host-todo_session=test-token; Path=/; Secure; HttpOnly; SameSite=Lax");
    headers.append("Set-Cookie", "unrelated=private; Path=/");
    headers.append("Set-Cookie", "__Host-todo_session=wrong; Domain=other.example; Path=/");
    return new Response('{"identity":{"id":"test"}}', { headers });
  } });
  assert.equal(response.status, 200);
  assert.deepEqual(response.headers.getSetCookie(), ["__Host-todo_session=test-token; Path=/; Secure; HttpOnly; SameSite=Lax"]);
});

test("never follows upstream redirects or exposes non-JSON server failures", async () => {
  for (const result of [Response.redirect("https://evil.example"), new Response("private server details", { status: 500 })]) {
    const response = await proxyTodo(req("tasks"), "tasks", { origin, fetcher: async () => result });
    assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes("private server details"));
  }
});

test("accepts a bodyless sign-out behind Next's normalized internal URL, rejects forged browser origins", async () => {
  const url = "http://localhost:3100/api/auth/session";
  const make = (origin) => new Request(url, { method: "DELETE", headers: { host: "127.0.0.1:3100", origin }, body: "" });
  const fetcher = async () => Response.json({ ok: true });
  assert.equal((await proxyTodo(make("http://127.0.0.1:3100"), "auth/session", { origin, fetcher })).status, 200);
  assert.equal((await proxyTodo(make("https://evil.example"), "auth/session", { origin, fetcher })).status, 403);
  const insecure = new Request(`${clientOrigin}/api/auth/session`, { method: "DELETE", headers: { origin: "http://sit-with-todo.vercel.app" } });
  assert.equal((await proxyTodo(insecure, "auth/session", { origin, fetcher })).status, 403);
});
