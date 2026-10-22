"use client";
import {
  useLayoutEffect,
  useRef,
  type RefObject,
  type KeyboardEvent,
} from "react";
import { gsap } from "gsap";
import "./dock-panels.css";

export function dockOrigin(pane: string | null) {
  return pane === "notes" ||
    pane === "ambience" ||
    pane === "friends" ||
    pane === "agent"
    ? pane
    : pane === "settings" || pane === "help"
      ? "settings"
      : "focus";
}
export function useDockPanelMotion(
  root: RefObject<HTMLElement | null>,
  pane: string | null,
  enabled: boolean,
  reduced: boolean,
) {
  const returnTo = useRef<string>("focus");
  useLayoutEffect(() => {
    if (!enabled || !pane) return;
    const room = root.current,
      panel = room?.querySelector<HTMLElement>(".dock-panel");
    if (!room || !panel) return;
    const origin = dockOrigin(pane);
    returnTo.current = origin;
    const button = room.querySelector<HTMLElement>(
      origin === "settings"
        ? ".room-nav-settings"
        : `[data-dock-item="${origin}"]`,
    );
    const r = panel.getBoundingClientRect(),
      b = button?.getBoundingClientRect();
    panel.style.transformOrigin = `${b ? b.left + b.width / 2 - r.left : r.width / 2}px 100%`;
    const calm =
      reduced || matchMedia("(prefers-reduced-motion: reduce)").matches;
    const context = gsap.context(() => {
      gsap.fromTo(
        panel,
        { opacity: 0, scale: calm ? 1 : 0.96, y: calm ? 0 : 7 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: calm ? 0.15 : 0.36,
          ease: calm ? "none" : "power3.out",
          clearProps: "transform,opacity",
        },
      );
      const children = panel.querySelectorAll(".room-panel-body > *");
      if (!calm && children.length)
        gsap.fromTo(
          children,
          { opacity: 0, y: 4 },
          {
            opacity: 1,
            y: 0,
            duration: 0.24,
            stagger: 0.025,
            delay: 0.08,
            clearProps: "transform,opacity",
          },
        );
    }, panel);
    // Keep the cached origin aligned on resize. No layout reads in ticker callbacks.
    const measure = () => {
      const rect = panel.getBoundingClientRect(),
        anchor = button?.getBoundingClientRect();
      if (anchor)
        panel.style.transformOrigin = `${anchor.left + anchor.width / 2 - rect.left}px 100%`;
    };
    const observer = new ResizeObserver(measure);
    observer.observe(room);
    return () => {
      context.revert();
      observer.disconnect();
    };
  }, [root, pane, enabled, reduced]);
  return returnTo;
}
/** Radix provides dialog semantics; keep Tab inside without making the dock unclickable. */
export function trapDockPanel(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const nodes = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]):not([aria-disabled="true"]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),summary,[tabindex="0"]',
    ),
  ).filter((n) => n.getClientRects().length && !n.closest("[inert]"));
  if (!nodes.length) {
    event.preventDefault();
    event.currentTarget.focus();
    return;
  }
  const first = nodes[0],
    last = nodes[nodes.length - 1];
  if (
    event.shiftKey &&
    (document.activeElement === first ||
      !nodes.includes(document.activeElement as HTMLElement))
  ) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
