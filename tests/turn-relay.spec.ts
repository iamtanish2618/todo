import { test, expect } from "@playwright/test";
import {
  createRelayIssuer,
  createMeteredRelayIssuer,
} from "../lib/todo/table/relay";
const key = { id: "a".repeat(32), token: "test-only-server-token" };
const payload = {
  iceServers: [
    { urls: ["stun:stun.cloudflare.com:3478"] },
    {
      urls: [
        "turn:turn.cloudflare.com:3478?transport=udp",
        "turns:turn.cloudflare.com:443?transport=tcp",
        "turn:turn.cloudflare.com:53",
      ],
      username: "temporary-user",
      credential: "temporary-password",
    },
  ],
};
test("relay uses fixed provider, private key and four-hour TTL; reuses per-user credentials and refreshes", async () => {
  let calls = 0,
    now = 1000;
  const issue = createRelayIssuer(
    async (url, init) => {
      calls++;
      expect(String(url)).toBe(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${key.id}/credentials/generate-ice-servers`,
      );
      expect(new Headers(init?.headers).get("authorization")).toBe(
        `Bearer ${calls === 4 ? "rotated-test-key" : key.token}`,
      );
      expect(JSON.parse(String(init?.body))).toEqual({ ttl: 14400 });
      expect(init?.redirect).toBe("error");
      return Response.json(payload, { status: 201 });
    },
    () => now,
  );
  const [a, b] = await Promise.all([
    issue("user-a", key),
    issue("user-a", key),
  ]);
  expect(calls).toBe(1);
  expect(a).toEqual(b);
  expect(a[0].urls).toHaveLength(2);
  expect(JSON.stringify(a)).not.toContain(key.token);
  await issue("user-b", key);
  expect(calls).toBe(2);
  now += 3600001;
  await issue("user-a", key);
  expect(calls).toBe(3);
  await issue("user-a", { ...key, token: "rotated-test-key" });
  expect(calls).toBe(4);
});

test("Metered keeps its scoped API key server-side, caches ICE settings, refreshes and rejects arbitrary hosts", async () => {
  let calls = 0,
    now = 0;
  const key = { host: "todo.metered.live", apiKey: "test-only-scoped-key" };
  const issue = createMeteredRelayIssuer(
    async (url, init) => {
      calls++;
      expect(String(url)).toBe(
        "https://todo.metered.live/api/v1/turn/credentials?apiKey=test-only-scoped-key",
      );
      expect(init?.redirect).toBe("error");
      return Response.json([
        { urls: "stun:stun.relay.metered.ca:80" },
        {
          urls: "turn:standard.relay.metered.ca:80",
          username: "short-user",
          credential: "short-password",
        },
        {
          urls: "turns:standard.relay.metered.ca:443?transport=tcp",
          username: "short-user",
          credential: "short-password",
        },
        { urls: "turn:attacker.example:443", username: "a", credential: "b" },
      ]);
    },
    () => now,
  );
  await expect(issue("", key)).rejects.toThrow("not configured");
  await expect(
    issue("user", { ...key, host: "todo.metered.live.attacker.example" }),
  ).rejects.toThrow("not configured");
  expect(calls).toBe(0);
  const [a, b] = await Promise.all([
    issue("user", key),
    issue("other-user", key),
  ]);
  expect(a).toEqual(b);
  expect(a).toHaveLength(2);
  expect(calls).toBe(1);
  expect(JSON.stringify(a)).not.toContain(key.apiKey);
  now += 300001;
  await issue("user", key);
  expect(calls).toBe(2);
});

test("invalid identity/key never contacts provider; failures and redirects never leak its response", async () => {
  let calls = 0;
  const issue = createRelayIssuer(async () => {
    calls++;
    return Response.json({ secret: key.token }, { status: 403 });
  });
  await expect(issue("", key)).rejects.toThrow("not configured");
  await expect(
    issue("user", { ...key, id: "../../other-host" }),
  ).rejects.toThrow("not configured");
  expect(calls).toBe(0);
  await expect(issue("user", key)).rejects.toThrow(
    "Relay provider unavailable",
  );
  expect(calls).toBe(1);
  await expect(issue("user", key)).rejects.toThrow(
    "Relay provider unavailable",
  );
  expect(calls).toBe(2);
});

test("provider cannot inject arbitrary TURN destinations or missing credentials", async () => {
  for (const iceServers of [
    [],
    [{ urls: "turn:attacker.example:443", username: "a", credential: "b" }],
    [{ urls: "turns:turn.cloudflare.com:443?transport=tcp" }],
  ]) {
    const issue = createRelayIssuer(async () => Response.json({ iceServers }));
    await expect(issue("user", key)).rejects.toThrow("relay settings");
  }
});
