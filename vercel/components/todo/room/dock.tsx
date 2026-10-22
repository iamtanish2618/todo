"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { gsap } from "gsap";
import {
  BookOpen,
  CloudSun,
  Target,
  Users,
  Sparkles,
  Pause,
} from "lucide-react";
import "./dock.css";

export type DockItem = "notes" | "ambience" | "focus" | "friends" | "agent";
export const DOCK_CONFIG = {
  enabled: true, // ?dock=0 restores the previous room UI without changing saved data.
  wave: { maximum: 1.25, centerMaximum: 1.06, radius: 130, lerp: 0.18 },
  bounce: { height: 7, delay: 0.07, follow: [1, 0.45, 0.2, 0.08, 0.04] },
};
const ITEMS = [
  { id: "notes", label: "Notes", Icon: BookOpen },
  { id: "ambience", label: "Ambience", Icon: CloudSun },
  { id: "focus", label: "Start focusing", Icon: Target },
  { id: "friends", label: "Friends", Icon: Users },
  { id: "agent", label: "Agent", Icon: Sparkles },
] as const;

/** The GSAP ticker is shared with the scene. This listener sleeps after its spring settles. */
export function RoomDock({
  active,
  ready = true,
  reduced,
  focus,
  hidden,
  agent,
  resting,
  onChoose,
  onPause,
  onEnd,
}: {
  active: string | null;
  ready?: boolean;
  reduced: boolean;
  focus: boolean;
  hidden: boolean;
  agent: boolean;
  resting: boolean;
  onChoose: (item: DockItem) => void;
  onPause: () => void;
  onEnd: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const launch = useRef<(i: number) => void>(() => {});
  const expanded = active === "focus";
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const animateLayout = useRef<() => void>(() => {});
  const [hover, setHover] = useState<number | null>(null);
  const [intro, setIntro] = useState(false);
  useEffect(() => {
    if (!ready || hidden) return;
    try {
      if (!localStorage.getItem("todo.dock.welcome.v1")) {
        setIntro(true);
        localStorage.setItem("todo.dock.welcome.v1", "1");
        const timeout = setTimeout(() => setIntro(false), 6500);
        return () => clearTimeout(timeout);
      }
    } catch {}
  }, [ready, hidden]);
  useEffect(() => {
    const nav = root.current;
    if (!nav) return;
    const slots = Array.from(
      nav.querySelectorAll<HTMLElement>(".todo-dock-slot"),
    );
    const waves = slots.map((n) =>
      n.querySelector<HTMLElement>(".todo-dock-wave")!,
    );
    const hops = slots.map((n) =>
      n.querySelector<HTMLElement>(".todo-dock-hop")!,
    );
    const rings = slots.map((n) =>
      n.querySelector<HTMLElement>(".todo-dock-pulse")!,
    );
    const values = ITEMS.map(() => ({ scale: 1, x: 0 }));
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    let left = 0,
      width = 0,
      ratio = 1,
      pointer: number | null = null,
      ticking = false;
    let bounce: gsap.core.Timeline | null = null;
    const measure = () => {
      const rect = nav.getBoundingClientRect();
      left = rect.left;
      width = rect.width;
      ratio = (nav.parentElement?.clientWidth || 960) / 960;
    };
    const tick = (_time: number, delta: number) => {
      const lerp =
        1 - Math.pow(1 - DOCK_CONFIG.wave.lerp, Math.min(delta, 50) / 16.667);
      const targets = ITEMS.map((_, i) => {
        if (pointer === null) return 1;
        const distance = Math.abs(pointer - (width * (i + 0.5)) / 5);
        const bell =
          (1 +
            Math.cos(
              Math.PI *
                Math.min(distance / (DOCK_CONFIG.wave.radius * ratio), 1),
            )) /
          2;
        return (
          1 +
          ((i === 2
            ? DOCK_CONFIG.wave.centerMaximum
            : DOCK_CONFIG.wave.maximum) -
            1) *
            bell
        );
      });
      // Spread by the visual extra width of each icon, retaining a centered row.
      const extra = targets.map((s, i) => {
        const wide = i === 2 && expandedRef.current;
        const base = i === 2 ? (wide ? 144 : 76) : 70;
        return ((s - 1) * base + (wide ? 68 : 0)) * ratio;
      });
      const total = extra.reduce((a, b) => a + b, 0);
      let before = 0,
        unsettled = false;
      values.forEach((v, i) => {
        const x = before + extra[i] / 2 - total / 2;
        before += extra[i];
        v.scale += (targets[i] - v.scale) * lerp;
        v.x += (x - v.x) * lerp;
        if (Math.abs(v.scale - targets[i]) > 0.001 || Math.abs(v.x - x) > 0.02)
          unsettled = true;
        waves[i].style.transform =
          `translate3d(${v.x.toFixed(3)}px,0,0) scale(${v.scale.toFixed(4)})`;
      });
      if (pointer === null && !unsettled) {
        gsap.ticker.remove(tick);
        nav.dataset.waving = "false";
        ticking = false;
      }
    };
    const wake = () => {
      if (!ticking) {
        ticking = true;
        gsap.ticker.add(tick);
      }
    };
    const move = (event: PointerEvent) => {
      if (reduced || motion.matches || !fine.matches || hidden || focus) return;
      pointer = event.clientX - left;
      nav.dataset.waving = "true";
      wake();
    };
    const leave = () => {
      pointer = null;
      wake();
    };
    animateLayout.current = wake;
    launch.current = (index) => {
      bounce?.kill();
      gsap.set(hops, { y: 0 });
      gsap.set(rings, { opacity: 0, scale: 1 });
      if (reduced || motion.matches) return;
      bounce = gsap.timeline();
      hops.forEach((node, i) => {
        const d = Math.abs(index - i),
          y = -DOCK_CONFIG.bounce.height * ratio * DOCK_CONFIG.bounce.follow[d];
        const at = d * DOCK_CONFIG.bounce.delay;
        bounce!
          .to(node, { y, duration: 0.19, ease: "power2.out" }, at)
          .to(node, { y: 0, duration: 0.2, ease: "power2.in" }, at + 0.19)
          .to(
            node,
            { y: y * 0.3, duration: 0.17, ease: "power2.out" },
            at + 0.39,
          )
          .to(node, { y: 0, duration: 0.23, ease: "power2.in" }, at + 0.56);
      });
      bounce.fromTo(
        rings[index],
        { opacity: 0.8, scale: 0.8 },
        { opacity: 0, scale: 1.85, duration: 0.7, ease: "power2.out" },
        0,
      );
    };
    measure();
    const observer = new ResizeObserver(() => {
      bounce?.kill();
      gsap.set(hops, { y: 0 });
      measure();
      leave();
    });
    observer.observe(nav);
    window.addEventListener("resize", measure);
    nav.addEventListener("pointermove", move);
    nav.addEventListener("pointerleave", leave);
    return () => {
      bounce?.kill();
      gsap.ticker.remove(tick);
      observer.disconnect();
      nav.removeEventListener("pointermove", move);
      nav.removeEventListener("pointerleave", leave);
      window.removeEventListener("resize", measure);
      launch.current = () => {};
      animateLayout.current = () => {};
      gsap.set(waves, { clearProps: "transform" });
      gsap.set(hops, { clearProps: "transform" });
    };
  }, [reduced, focus, hidden]);
  useEffect(() => {
    animateLayout.current();
  }, [expanded]);
  const keyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const direction =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!direction && !["Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const buttons = Array.from(
      root.current!.querySelectorAll<HTMLButtonElement>("[data-dock-item]"),
    );
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? 4
          : (index + direction + 5) % 5;
    buttons[next].focus();
  };
  return (
    <nav
      ref={root}
      className="todo-dock"
      aria-label="Room dock"
      data-focus={focus}
      data-hidden={hidden}
      data-expanded={active === "focus"}
      inert={hidden}
      aria-hidden={hidden}
    >
      <div className="todo-dock-glass" aria-hidden="true" />
      {ITEMS.map(({ id, label, Icon }, i) => (
        <div className="todo-dock-slot" key={id}>
          <div className="todo-dock-wave">
            <div className="todo-dock-hop">
              <button
                type="button"
                className={`todo-dock-button ${id === "focus" ? "todo-dock-center" : ""}`}
                data-dock-item={id}
                data-active={active === id || (id === "agent" && agent)}
                data-resting={id === "agent" && resting}
                aria-describedby={
                  hover === i || (intro && i === 2)
                    ? `todo-dock-hint-${id}`
                    : undefined
                }
                aria-label={focus && id === "focus" ? "Pause session" : label}
                aria-pressed={id === "agent" ? agent : undefined}
                aria-expanded={id !== "agent" ? active === id : undefined}
                tabIndex={focus && id !== "focus" ? -1 : 0}
                aria-disabled={
                  (focus && id !== "focus") || (id === "agent" && resting)
                }
                title={
                  id === "agent" && resting
                    ? "Todo needs a little rest. Your daily AI allowance returns tomorrow."
                    : undefined
                }
                onPointerEnter={() => {
                  setHover(i);
                  setIntro(false);
                }}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onKeyDown={(e) => keyboard(e, i)}
                onClick={() => {
                  if ((focus && id !== "focus") || (id === "agent" && resting))
                    return;
                  setIntro(false);
                  launch.current(i);
                  if (focus) onPause();
                  else onChoose(id);
                }}
              >
                <i className="todo-dock-pulse" aria-hidden="true" />
                {focus && id === "focus" ? (
                  <Pause strokeWidth={1.8} />
                ) : (
                  <Icon strokeWidth={1.8} />
                )}
                <span>{id === "focus" ? "Start focusing" : label}</span>
              </button>
              {(hover === i || (intro && i === 2)) &&
              !(id === "focus" && active === "focus") ? (
                <span
                  id={`todo-dock-hint-${id}`}
                  className="todo-dock-tooltip"
                  data-first-hint={intro && i === 2}
                  role="tooltip"
                >
                  {id === "agent" && resting
                    ? "A little rest. Back tomorrow."
                    : label}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ))}
      {focus ? (
        <button className="todo-dock-end" onClick={onEnd}>
          End session
        </button>
      ) : null}
    </nav>
  );
}
