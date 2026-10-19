"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { AuthConfig, TodoIdentity } from "./types";
import { setAuthTokenGetter } from "@/lib/todo/client";

type Runtime = {
  sdk: typeof import("firebase/auth");
  auth: import("firebase/auth").Auth;
};
export type AuthController = ReturnType<typeof useTodoAuth>;

export function authMessage(error: unknown) {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    "auth/popup-closed-by-user":
      "Google sign-in was closed. You can try again whenever you’re ready.",
    "auth/popup-blocked":
      "Your browser blocked Google sign-in. Allow the sign-in popup and try again.",
    "auth/unauthorized-domain":
      "This website needs to be added to Todo’s Firebase authorized domains.",
    "auth/operation-not-allowed":
      "This sign-in method hasn’t been enabled for Todo yet.",
    "auth/network-request-failed":
      "Couldn’t reach the sign-in service. Check your connection and try again.",
    "auth/too-many-requests":
      "A few too many attempts. Please wait a little, then try again.",
    "auth/weak-password":
      "Please use a stronger password with at least 8 characters.",
    "auth/account-exists-with-different-credential":
      "Try your existing email sign-in for this account first.",
  };
  if (code)
    return (
      messages[code] ||
      "Couldn’t sign in. Check your details, or try resetting your password."
    );
  return error instanceof Error
    ? error.message
    : "Couldn’t connect. Please try again.";
}

async function session(method: "POST" | "DELETE", token?: string) {
  const response = await fetch("/api/auth/session", {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify({ token }) : undefined,
  });
  const result = await response.json() as { identity?: TodoIdentity; newAccount?: boolean; error?: string };
  if (!response.ok) throw new Error(result.error || "Please sign in again.");
  return {
    identity: (result.identity || null) as TodoIdentity,
    newAccount: Boolean(result.newAccount),
  };
}

export function useTodoAuth(initialIdentity: TodoIdentity, config: AuthConfig) {
  const [identity, setIdentity] = useState(initialIdentity);
  const [ready, setReady] = useState(
    config.provider === "chatgpt" || !config.configured,
  );
  const [error, setError] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [newAccount, setNewAccount] = useState(false);
  const freshUser = useRef("");
  const runtime = useRef<Runtime | null>(null);
  const generation = useRef(0);
  const sync = useRef<(user: User | null) => Promise<void>>(async () => {});

  useEffect(() => {
    if (config.provider !== "firebase" || !config.firebase) return;
    let cancelled = false,
      unsubscribe = () => {};
    const initialize = async () => {
      const [appSDK, sdk] = await Promise.all([
        import("firebase/app"),
        import("firebase/auth"),
      ]);
      if (cancelled) return;
      const app =
        appSDK.getApps().find((app) => app.name === "todo-auth") ||
        appSDK.initializeApp(config.firebase!, "todo-auth");
      const auth = sdk.getAuth(app);
      await sdk.setPersistence(auth, sdk.browserLocalPersistence);
      if (cancelled) return;
      runtime.current = { sdk, auth };
      // Fresh bearer tokens protect API calls even if a background tab allowed
      // the short-lived SSR cookie to expire. Firebase owns refresh credentials.
      setAuthTokenGetter(async () =>
        auth.currentUser?.emailVerified ? auth.currentUser.getIdToken() : null,
      );
      let queue = Promise.resolve();
      sync.current = (user) => {
        const epoch = ++generation.current;
        // Serialize cookie mutations: a slow prior sign-in must not overwrite
        // the sign-out cookie, or the cookie for a subsequent account.
        queue = queue
          .catch(() => {})
          .then(async () => {
            if (cancelled || epoch !== generation.current) return;
            try {
              const verified = user?.emailVerified;
              const next = verified
                ? await session("POST", await user.getIdToken())
                : await session("DELETE");
              if (!cancelled && epoch === generation.current) {
                if (next.newAccount && next.identity)
                  freshUser.current = next.identity.id;
                setNewAccount(
                  Boolean(
                    next.identity && freshUser.current === next.identity.id,
                  ),
                );
                setIdentity(next.identity);
                setPendingEmail(user && !verified ? user.email || "" : "");
                setError("");
              }
            } catch (error) {
              if (!cancelled && epoch === generation.current) {
                setIdentity(null);
                setError(authMessage(error));
              }
              throw error;
            } finally {
              if (!cancelled && epoch === generation.current) setReady(true);
            }
          });
        return queue;
      };
      unsubscribe = sdk.onIdTokenChanged(
        auth,
        (user) => {
          void sync.current(user).catch(() => {});
        },
        () => {
          if (!cancelled) {
            setReady(true);
            setError("Couldn’t restore your sign-in. Please try again.");
          }
        },
      );
    };
    initialize().catch(() => {
      if (!cancelled) {
        setReady(true);
        setError("Couldn’t load Todo sign-in. Refresh to try again.");
      }
    });
    return () => {
      cancelled = true;
      generation.current++;
      unsubscribe();
      runtime.current = null;
      setAuthTokenGetter(null);
    };
  }, [config.provider, config.firebase]);

  const requireRuntime = () => {
    if (!runtime.current)
      throw new Error(
        "Todo login isn’t connected yet. Please try again after setup.",
      );
    return runtime.current;
  };
  return {
    provider: config.provider,
    configured: config.configured,
    identity,
    ready,
    error,
    pendingEmail,
    newAccount,
    async google() {
      const { sdk, auth } = requireRuntime();
      // Start popup synchronously in the click's user-activation context.
      const result = await sdk.signInWithPopup(
        auth,
        new sdk.GoogleAuthProvider(),
      );
      await sync.current(result.user);
    },
    async email(email: string, password: string) {
      const { sdk, auth } = requireRuntime();
      const result = await sdk.signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      await sync.current(result.user);
    },
    async signup(name: string, email: string, password: string) {
      const { sdk, auth } = requireRuntime();
      const policy = await sdk.validatePassword(auth, password);
      if (password.length < 8 || !policy.isValid)
        throw new Error(
          "Choose a password with at least 8 characters that meets the account’s password policy.",
        );
      const result = await sdk.createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      await sdk.updateProfile(result.user, {
        displayName: name.trim().slice(0, 50),
      });
      await sync.current(result.user);
      await sdk.sendEmailVerification(result.user, {
        url: location.origin + "/",
        handleCodeInApp: false,
      });
    },
    async reset(email: string) {
      const { sdk, auth } = requireRuntime();
      try {
        await sdk.sendPasswordResetEmail(auth, email.trim(), {
          url: location.origin + "/",
          handleCodeInApp: false,
        });
      } catch (error) {
        if ((error as { code?: string }).code !== "auth/user-not-found")
          throw error;
      }
    },
    async resend() {
      const { sdk, auth } = requireRuntime();
      if (!auth.currentUser) throw new Error("Please sign in again first.");
      await sdk.sendEmailVerification(auth.currentUser, {
        url: location.origin + "/",
        handleCodeInApp: false,
      });
    },
    async verify() {
      const { sdk, auth } = requireRuntime();
      if (!auth.currentUser) throw new Error("Please sign in again first.");
      await sdk.reload(auth.currentUser);
      if (!auth.currentUser.emailVerified)
        throw new Error(
          "Open the link in your verification email first, then come back here.",
        );
      await auth.currentUser.getIdToken(true);
      await sync.current(auth.currentUser);
    },
    async logout() {
      const { sdk, auth } = requireRuntime();
      await sdk.signOut(auth);
      await sync.current(null);
    },
  };
}
