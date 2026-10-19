import { authConfig } from "@/lib/auth/config";
import {
  getTodoUser,
  sessionCookie,
  localSessionCookie,
} from "@/lib/auth/server";
import { verifyFirebaseToken } from "@/lib/auth/verify-token";
import { ApiError, body, fail } from "@/lib/todo/server";
import { z } from "zod";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";

function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new ApiError("Please use Todo’s own sign-in screen.", 403);
}
function cookieName(request: Request) {
  const local =
    process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname);
  return { name: local ? localSessionCookie : sessionCookie, secure: !local };
}
export async function GET() {
  return Response.json(
    { identity: await getTodoUser() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const config = authConfig();
    if (config.provider !== "firebase" || !config.firebase)
      throw new ApiError("Todo login isn’t connected yet.", 503);
    const parsed = z
      .object({ token: z.string().min(1).max(8192) })
      .strict()
      .safeParse(await body(request, 10_000));
    if (!parsed.success) throw new ApiError("Please sign in again.", 401);
    let user;
    try {
      user = await verifyFirebaseToken(
        parsed.data.token,
        config.firebase.projectId,
      );
    } catch {
      throw new ApiError(
        "Please sign in with a verified Google or email account.",
        401,
      );
    }
    const { expiresAt, ...identity } = user;
    const displayName = (
      identity.name?.trim() || identity.email.split("@")[0]
    ).slice(0, 50);
    const created = await getDb()
      .insert(profiles)
      .values({
        userId: identity.id,
        name: displayName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .onConflictDoNothing()
      .returning({ id: profiles.userId });
    const cookie = cookieName(request);
    return Response.json(
      { identity, newAccount: created.length > 0 },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Set-Cookie": `${cookie.name}=${parsed.data.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.min(3600, expiresAt - Math.floor(Date.now() / 1000)))}${cookie.secure ? "; Secure" : ""}`,
        },
      },
    );
  } catch (error) {
    return fail(error);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const cookie = cookieName(request);
    return Response.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "no-store",
          "Set-Cookie": `${cookie.name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${cookie.secure ? "; Secure" : ""}`,
        },
      },
    );
  } catch (error) {
    return fail(error);
  }
}
