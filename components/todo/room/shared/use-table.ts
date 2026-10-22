"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { TableSession } from "@/lib/todo/table/session";
import type { Status, PublicConfig } from "@/lib/todo/table/protocol";
import { api } from "@/lib/todo/client";
export function useTable(active: boolean, status: Status) {
  const [session] = useState(() => new TableSession());
  const table = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  useEffect(() => {
    const abort = new AbortController();
    const refresh = () =>
      api<PublicConfig>("/api/rooms/config", "GET", undefined, abort.signal)
        .then((c) => {
          if (c && !abort.signal.aborted) session.configure(c as PublicConfig);
        })
        .catch(() => {});
    session.setConfigLoader(refresh);
    void refresh();
    // Refresh expiring credentials before a long study session can outlive them.
    const timer = active ? setInterval(refresh, 30 * 60 * 1000) : null;
    const visible = () => {
      if (!document.hidden && active) void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      abort.abort();
      session.setConfigLoader(null);
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [session, active]);
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
