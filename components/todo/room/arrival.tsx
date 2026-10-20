"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { PocketTodo } from "../pocket-todo";

/** Decode progress is the ceiling. Even cached rooms get a short, calm arrival. */
export function RoomArrival({
  ready,
  progress,
  female,
  reduced,
  complete,
  error,
  onRetry,
  onComplete,
}: {
  ready: boolean;
  progress: number;
  female: boolean;
  reduced: boolean;
  complete: boolean;
  error: string;
  onRetry: () => void;
  onComplete: () => void;
}) {
  const [percent, setPercent] = useState(0);
  const latest = useRef({ ready, progress, onComplete, reduced });
  latest.current = { ready, progress, onComplete, reduced };
  useEffect(() => {
    const start = performance.now();
    let finishedAt = 0;
    const tick = () => {
      const p = latest.current;
      const now = performance.now();
      const ceiling = p.ready ? 100 : Math.min(95, p.progress * 100);
      const value = p.reduced
        ? ceiling
        : Math.min(ceiling, (now - start) / 9.5);
      setPercent(Math.floor(value));
      if (p.ready && value >= 100) {
        if (!finishedAt) finishedAt = now;
        if (p.reduced || now - finishedAt >= 180) {
          clearInterval(timer);
          p.onComplete();
        }
      }
    };
    const timer = setInterval(tick, 32);
    return () => clearInterval(timer);
  }, []);
  return (
    <div
      className="room-arrival"
      data-complete={complete}
      aria-hidden={complete}
      inert={complete}
    >
      <div className="room-arrival-content">
        <p>Getting your room ready</p>
        <div
          className="room-arrival-track"
          style={{ "--arrival-progress": percent / 100 } as CSSProperties}
          role="progressbar"
          aria-label="Preparing your room"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span className="room-arrival-fill" />
          <span className="room-arrival-runner" aria-hidden="true">
            <PocketTodo female={female} happy={percent === 100} />
          </span>
        </div>
        <output aria-hidden="true">{percent}%</output>
        {error ? (
          <div className="room-arrival-error" role="alert">
            <p>{error}</p>
            <Button onClick={onRetry}>Try again</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
