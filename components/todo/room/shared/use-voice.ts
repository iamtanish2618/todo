"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { TableVoice } from "@/lib/todo/table/voice";
import type { TableSession } from "@/lib/todo/table/session";
export function useTableVoice(
  session: TableSession,
  active: boolean,
  focus: boolean,
) {
  const [voice] = useState(() => new TableVoice());
  const state = useSyncExternalStore(
    voice.subscribe,
    voice.getSnapshot,
    voice.getSnapshot,
  );
  useEffect(() => {
    if (active) voice.join(session);
    return () => voice.leave();
  }, [voice, session, active]);
  useEffect(() => {
    voice.setFocus(focus);
  }, [voice, focus]);
  return { voice, state };
}
