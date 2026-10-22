"use client";
import { useEffect, useState } from "react";
import "./reliability.css";
import { OFFLINE_MESSAGE, RELIABILITY } from "@/lib/todo/reliability";
export function ConnectionNotice({ reconnecting }: { reconnecting: boolean }) {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  if (!RELIABILITY.enabled || (!offline && !reconnecting)) return null;
  return (
    <p className="room-connection-notice" role="status">
      {offline ? OFFLINE_MESSAGE : "Reconnecting…"}
    </p>
  );
}
