"use client";
import { useEffect, useRef, type PointerEvent } from "react";

/** Measure on entry/resize, never on every pointer move. CSS eases the tiny offsets. */
export function useMagneticSurface(travel = 4, tilt = 2) {
  const bounds = useRef<DOMRect | null>(null);
  const enabled = useRef(false);
  useEffect(() => {
    const resize = () => {
      bounds.current = null;
    };
    window.addEventListener("resize", resize, { passive: true });
    return () => window.removeEventListener("resize", resize);
  }, []);
  const reset = (event: PointerEvent<HTMLElement>) => {
    const style = event.currentTarget.style;
    for (const name of ["x", "y", "rx", "ry"])
      style.removeProperty(`--surface-${name}`);
    event.currentTarget.removeAttribute("data-magnetic-active");
    enabled.current = false;
  };
  return {
    onPointerEnter(event: PointerEvent<HTMLElement>) {
      enabled.current =
        event.pointerType === "mouse" &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches;
      bounds.current = event.currentTarget.getBoundingClientRect();
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (!enabled.current) return;
      const box = (bounds.current ??=
        event.currentTarget.getBoundingClientRect());
      const x = Math.max(
        -1,
        Math.min(1, ((event.clientX - box.left) / box.width) * 2 - 1),
      );
      const y = Math.max(
        -1,
        Math.min(1, ((event.clientY - box.top) / box.height) * 2 - 1),
      );
      const style = event.currentTarget.style;
      style.setProperty("--surface-x", `${x * travel}px`);
      style.setProperty("--surface-y", `${y * travel}px`);
      style.setProperty("--surface-rx", `${-y * tilt}deg`);
      style.setProperty("--surface-ry", `${x * tilt}deg`);
      style.setProperty("--surface-line-x", `${event.clientX - box.left}px`);
      style.setProperty("--surface-line-y", `${event.clientY - box.top}px`);
      event.currentTarget.setAttribute("data-magnetic-active", "true");
    },
    onPointerLeave: reset,
    onPointerCancel: reset,
  };
}
