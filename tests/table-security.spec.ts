import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
async function account() {
  const email = `rules-${randomUUID()}@example.test`,
    password = "EmulatorOnly123!",
    base = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/";
  let response = await fetch(base + "accounts:signUp?key=fake-api-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const user = (await response.json()) as { localId: string };
  await fetch(base + "accounts:update?key=fake-api-key", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer owner",
    },
    body: JSON.stringify({ localId: user.localId, emailVerified: true }),
  });
  response = await fetch(
    base + "accounts:signInWithPassword?key=fake-api-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  return (await response.json()) as { localId: string; idToken: string };
}
const db = (path: string, token: string, method = "GET", value?: unknown) =>
  fetch(
    `http://127.0.0.1:9000/${path}.json?ns=demo-todo-default-rtdb&auth=${encodeURIComponent(token)}`,
    {
      method,
      headers: { "Content-Type": "application/json" },
      ...(value === undefined ? {} : { body: JSON.stringify(value) }),
    },
  );
test("Firebase rules deny public/root access, impersonation, edited join order and forged signals", async () => {
  const a = await account(),
    b = await account(),
    code = "PENG-ABC234",
    id = randomUUID(),
    other = randomUUID();
  expect((await db("", a.idToken)).status).toBe(401);
  expect((await db(`tables/${code}/members`, "")).status).toBe(401);
  expect(
    (await db(`tableClaims/${code}/${id}`, a.idToken, "PUT", a.localId)).ok,
  ).toBe(true);
  const member = {
    id,
    name: "Safe",
    color: "blue",
    joinedAt: { ".sv": "timestamp" },
    status: "idle",
    mic: "muted",
    hasMicPermission: false,
  };
  expect(
    (await db(`tables/${code}/members/${id}`, a.idToken, "PUT", member)).ok,
  ).toBe(true);
  expect(
    (
      await db(
        `tables/${code}/members/${id}/playing`,
        a.idToken,
        "PUT",
        "bubbles",
      )
    ).ok,
  ).toBe(true);
  expect(
    (
      await db(
        `tables/${code}/members/${id}/playing`,
        a.idToken,
        "PUT",
        "unknown-game",
      )
    ).status,
  ).toBe(401);
  expect(
    (
      await db(
        `tables/${code}/members/${id}/name`,
        b.idToken,
        "PUT",
        "Imposter",
      )
    ).status,
  ).toBe(401);
  expect(
    (await db(`tables/${code}/members/${id}/joinedAt`, a.idToken, "PUT", 1))
      .status,
  ).toBe(401);
  expect((await db(`tableClaims/${code}/${id}`, a.idToken)).status).toBe(401);
  expect(
    (await db(`tableClaims/${code}/${other}`, b.idToken, "PUT", b.localId)).ok,
  ).toBe(true);
  expect(
    (
      await db(`tables/${code}/members/${other}`, b.idToken, "PUT", {
        ...member,
        id: other,
        name: "Listener",
      })
    ).ok,
  ).toBe(true);
  const forged = {
    from: id,
    body: JSON.stringify({ from: id, event: "close_room", data: {} }),
    sentAt: { ".sv": "timestamp" },
  };
  expect(
    (
      await db(
        `tables/${code}/inbox/${other}/${id}/fake`,
        b.idToken,
        "PUT",
        forged,
      )
    ).status,
  ).toBe(401);
  expect(
    (
      await db(
        `tables/${code}/inbox/${other}/${id}/real`,
        a.idToken,
        "PUT",
        forged,
      )
    ).ok,
  ).toBe(true);
  expect((await db(`tables/${code}/inbox/${other}`, a.idToken)).status).toBe(
    401,
  );
  expect((await db(`tables/${code}/inbox/${other}`, b.idToken)).ok).toBe(true);
  await db("", a.idToken, "PATCH", {
    [`tables/${code}/members/${id}`]: null,
    [`tables/${code}/inbox/${id}`]: null,
    [`tables/${code}/inbox/${other}/${id}`]: null,
    [`tableClaims/${code}/${id}`]: null,
  });
  await db("", b.idToken, "PATCH", {
    [`tables/${code}/members/${other}`]: null,
    [`tables/${code}/inbox/${other}`]: null,
    [`tableClaims/${code}/${other}`]: null,
  });
});
