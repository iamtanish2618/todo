"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { TableSession } from "@/lib/todo/table/session";
import type { Status, PublicConfig } from "@/lib/todo/table/protocol";
export function useTable(active: boolean, status: Status) {
  const [session] = useState(() => new TableSession());
  const table = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/rooms/config", { signal: abort.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (c && !abort.signal.aborted) session.configure(c as PublicConfig);
      })
      .catch(() => {});
    return () => abort.abort();
  }, [session]);
  useEffect(() => {
    session.setStatus(status);
  }, [session, status]);
  useEffect(() => {
    if (!active) void session.leave();
  }, [active, session]);
  useEffect(() => {
    const leave = () => {
      void session.leave();
    };
    window.addEventListener("pagehide", leave);
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("beforeunload", leave);
      leave();
    };
  }, [session]);
  return { session, table };
}
