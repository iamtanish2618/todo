import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

// A fixed Google key endpoint: neither a request nor a decoded token can choose
// where we fetch keys. jose caches keys and checks RS256 signatures and key IDs.
const googleKeys = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

/** The optional key resolver is for isolated cryptographic tests only. Runtime
 * callers always use Google's public keys; there is no emulator/unsigned bypass. */
export async function verifyFirebaseToken(
  token: string,
  projectId: string,
  keys: JWTVerifyGetKey = googleKeys,
) {
  if (token.length > 8192) throw new Error("Invalid identity token");
  const { payload, protectedHeader } = await jwtVerify(token, keys, {
    algorithms: ["RS256"],
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    requiredClaims: ["exp", "iat", "auth_time", "sub"],
  });
  const now = Math.floor(Date.now() / 1000);
  const provider = (
    payload.firebase as { sign_in_provider?: string } | undefined
  )?.sign_in_provider;
  if (
    !protectedHeader.kid ||
    typeof payload.sub !== "string" ||
    !payload.sub ||
    payload.sub.length > 128 ||
    typeof payload.iat !== "number" ||
    payload.iat > now ||
    typeof payload.auth_time !== "number" ||
    payload.auth_time > now ||
    payload.email_verified !== true ||
    typeof payload.email !== "string" ||
    !payload.email.includes("@") ||
    !["google.com", "password"].includes(provider || "")
  )
    throw new Error("Invalid or unverified account");
  return {
    id: `firebase:${payload.sub}`,
    name: typeof payload.name === "string" ? payload.name.slice(0, 100) : null,
    email: payload.email,
    expiresAt: payload.exp!,
  };
}
