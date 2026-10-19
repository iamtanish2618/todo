import { test, expect } from "@playwright/test";
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from "jose";
import { verifyFirebaseToken } from "../lib/auth/verify-token";

const project = "todo-auth-test";
const pair = await generateKeyPair("RS256");
const publicJWK = { ...await exportJWK(pair.publicKey), kid: "test-key", alg: "RS256" };
const keys = createLocalJWKSet({ keys: [publicJWK] });
async function token(overrides: Record<string, unknown> = {}, kid = "test-key") {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: "user-a", email: "avery@example.test", email_verified: true,
    name: "Avery", auth_time: now - 30, iat: now - 30, exp: now + 300,
    aud: project, iss: `https://securetoken.google.com/${project}`,
    firebase: { sign_in_provider: "google.com" }, ...overrides })
    .setProtectedHeader({ alg: "RS256", kid }).sign(pair.privateKey);
}

test("Google and verified email tokens establish a namespaced owner; other identities cannot be forged", async () => {
  expect(await verifyFirebaseToken(await token(), project, keys)).toMatchObject({ id: "firebase:user-a", name: "Avery", email: "avery@example.test" });
  expect(await verifyFirebaseToken(await token({ firebase: { sign_in_provider: "password" } }), project, keys)).toHaveProperty("id", "firebase:user-a");
  const now = Math.floor(Date.now() / 1000);
  for (const invalid of [
    { aud: "another-project" }, { iss: "https://attacker.example" }, { exp: now - 1 },
    { iat: now + 300 }, { auth_time: now + 300 }, { auth_time: undefined }, { exp: undefined },
    { sub: "" }, { sub: 123 }, { sub: "x".repeat(129) }, { email_verified: false }, { email_verified: "true" },
    { email: undefined }, { firebase: { sign_in_provider: "anonymous" } },
  ]) await expect(verifyFirebaseToken(await token(invalid), project, keys)).rejects.toThrow();
  await expect(verifyFirebaseToken(await token({}, "unknown-key"), project, keys)).rejects.toThrow();
  const signed = await token();
  const pieces = signed.split(".");
  pieces[1] = Buffer.from(JSON.stringify({ sub: "other-user", email_verified: true })).toString("base64url");
  await expect(verifyFirebaseToken(pieces.join("."), project, keys)).rejects.toThrow();
  await expect(verifyFirebaseToken("x".repeat(9000), project, keys)).rejects.toThrow();
  await expect(verifyFirebaseToken("eyJhbGciOiJub25lIn0.eyJzdWIiOiJhIn0.", project, keys)).rejects.toThrow();
});
