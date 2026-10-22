"use client";

import TodoApp from "./todo-app";
import { useTodoAuth } from "@/lib/auth/use-todo-auth";
import type { AuthConfig, TodoIdentity } from "@/lib/auth/types";

export default function AuthShell({
  identity,
  config,
  signInPath,
  signOutPath,
}: {
  identity: TodoIdentity;
  config: AuthConfig;
  signInPath: string;
  signOutPath: string;
}) {
  const auth = useTodoAuth(identity, config);
  // Switching accounts tears down every room, pending request, profile and task
  // list. A late response from one account cannot populate another account's UI.
  return (
    <TodoApp
      key={auth.identity?.id || "guest"}
      identity={auth.identity}
      auth={auth}
      signInPath={signInPath}
      signOutPath={signOutPath}
    />
  );
}
