import { setting } from "@/lib/todo/settings";
import type { AuthConfig } from "./types";

/** These four Firebase web settings identify the project. They are deliberately
 * public; service-account keys, OAuth secrets and refresh tokens never go here. */
export function authConfig(): AuthConfig {
  const apiKey = setting("TODO_FIREBASE_API_KEY") || "";
  const projectId = setting("TODO_FIREBASE_PROJECT_ID") || "";
  const authDomain = setting("TODO_FIREBASE_AUTH_DOMAIN") || "";
  const appId = setting("TODO_FIREBASE_APP_ID") || "";
  const configured = Boolean(
    apiKey &&
    /^[a-z0-9][a-z0-9-]{4,62}$/.test(projectId) &&
    /^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(authDomain) &&
    appId,
  );
  return {
    provider: "firebase",
    configured,
    ...(configured
      ? { firebase: { apiKey, projectId, authDomain, appId } }
      : {}),
  };
}
