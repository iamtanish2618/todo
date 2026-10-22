import { headers, cookies } from "next/headers";
import { authConfig } from "./config";
import { verifyFirebaseToken } from "./verify-token";
import type { TodoIdentity } from "./types";

export const sessionCookie = "__Host-todo_session";
export const localSessionCookie = "todo_session_local";

export async function getTodoUser(): Promise<TodoIdentity> {
  const config = authConfig();
  if (config.provider !== "firebase") return null;
  // In Firebase mode platform headers confer no Todo identity, even if supplied
  // by the host. Google/email accounts must independently pass token validation.
  if (!config.firebase) return null;
  const h = await headers();
  const authorization = h.get("authorization");
  const jar = await cookies();
  const token =
    authorization !== null
      ? authorization.startsWith("Bearer ")
        ? authorization.slice(7)
        : ""
      : jar.get(sessionCookie)?.value ||
        (process.env.NODE_ENV !== "production"
          ? jar.get(localSessionCookie)?.value
          : "");
  if (!token) return null;
  try {
    const { expiresAt: _, ...identity } = await verifyFirebaseToken(
      token,
      config.firebase.projectId,
    );
    return identity;
  } catch {
    return null;
  }
}
