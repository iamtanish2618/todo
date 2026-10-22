"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import { CircleDashed, PencilLine, X } from "lucide-react";
import { BreakGameSession, type Stroke } from "@/lib/todo/table/games";
import { COLORS } from "@/lib/todo/table/protocol";
import type { TableSession } from "@/lib/todo/table/session";
import { Button } from "@/components/ui/button";
import { BubbleField } from "./bubble-game";
import "./games.css";
export function useBreakGames(table: TableSession, active: boolean) {
  const [games] = useState(() => new BreakGameSession(table));
  const state = useSyncExternalStore(
    games.subscribe,
    games.getSnapshot,
    games.getSnapshot,
  );
  useEffect(() => {
    games.connect();
    return () => games.dispose();
  }, [games]);
  useEffect(() => {
    games.setBreak(active);
    return () => games.setBreak(false);
  }, [games, active]);
  return { games, state };
}
export function BreakGames({
  games,
  reduced,
}: {
  games: BreakGameSession;
  reduced: boolean;
}) {
  const state = useSyncExternalStore(
    games.subscribe,
    games.getSnapshot,
    games.getSnapshot,
  );
  if (!state.active)
    return state.notice ? (
      <p className="table-game-end" role="status">
        {state.notice}
      </p>
    ) : null;
  return (
    <>
      {state.menu && (
        <section className="table-game-panel" aria-label="Break games">
          <header>
            <h2>Break games</h2>
            <button
              aria-label="Close break games"
              onClick={() => games.showMenu()}
            >
              <X size={16} />
            </button>
          </header>
          <button
            className="table-game-choice"
            onClick={() => games.start("doodle")}
          >
            <PencilLine size={20} />
            <span>
              Doodle Art<small>A whole screen to draw together.</small>
            </span>
          </button>
          <button
            className="table-game-choice"
            onClick={() => games.start("bubbles")}
          >
            <CircleDashed size={20} />
            <span>
              Bubble Pop<small>Little bubbles. Satisfying little pops.</small>
            </span>
          </button>
        </section>
      )}
      {state.game && (
        <GameOverlay
          key={state.game}
          games={games}
          reduced={reduced}
          game={state.game}
        />
      )}
    </>
  );
}
/** Portal avoids the room stage's aspect ratio, zoom and clipping ancestors. */
function GameOverlay({
  games,
  reduced,
  game,
}: {
  games: BreakGameSession;
  reduced: boolean;
  game: "doodle" | "bubbles";
}) {
  const root = useRef<HTMLElement>(null),
    exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [closing, setClosing] = useState(false);
  const [popCount, setPopCount] = useState(0);
  const exit = useCallback(() => {
    if (exitTimer.current) return;
    setClosing(true);
    exitTimer.current = setTimeout(() => games.stop(), reduced ? 150 : 450);
  }, [games, reduced]);
  useEffect(
    () => () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    },
    [],
  );
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    root.current
      ?.querySelector<HTMLButtonElement>("[data-doodle-done]")
      ?.focus();
    const keys = (event: KeyboardEvent) => {
      if ((event.target as Element)?.closest?.(".table-conversation")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        exit();
      }
      if (event.key === "Tab") {
        const buttons =
          root.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!buttons?.length) return;
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", keys, true);
    return () => {
      document.removeEventListener("keydown", keys, true);
      if (
        previous?.isConnected &&
        previous !== document.body &&
        previous !== document.documentElement
      )
        previous.focus();
      else
        document
          .querySelector<HTMLButtonElement>(
            ".cozy-room-active .table-game-play",
          )
          ?.focus();
    };
  }, [exit]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <section
      ref={root}
      className={`table-doodle-screen table-game-screen ${game === "bubbles" ? "table-bubbles-screen" : ""}`}
      data-leaving={closing}
      role="dialog"
      aria-modal="true"
      aria-label={game === "doodle" ? "Doodle Art" : "Bubble Pop"}
      aria-describedby="doodle-help"
    >
      {game === "doodle" ? (
        <DoodleCanvas games={games} reduced={reduced} />
      ) : (
        <BubbleField
          games={games}
          reduced={reduced}
          closing={closing}
          onPop={() => setPopCount((n) => n + 1)}
        />
      )}
      <div className="table-game-toolbar">
        <span>
          {game === "doodle" ? (
            <PencilLine size={16} />
          ) : (
            <CircleDashed size={16} />
          )}
          {game === "doodle" ? "Doodle Art" : "Bubble Pop"}
        </span>
        {game === "bubbles" && (
          <span
            className="table-pop-count"
            role="status"
            aria-label="Bubbles popped"
            aria-live="polite"
          >
            <strong>{popCount}</strong> popped
          </span>
        )}
        {game === "doodle" && (
          <Button
            variant="ghost"
            disabled={closing}
            onClick={() => games.clear()}
          >
            Clear
          </Button>
        )}
        <Button
          data-doodle-done
          variant="ghost"
          disabled={closing}
          onClick={exit}
        >
          Done <X size={14} />
        </Button>
      </div>
      <p id="doodle-help" className="table-doodle-help">
        {game === "doodle"
          ? "Draw anywhere · Esc to return"
          : "Tap a bubble · Space works too · Esc to return"}
      </p>
    </section>,
    document.body,
  );
}
function DoodleCanvas({
  games,
  reduced,
}: {
  games: BreakGameSession;
  reduced: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const fog = document.createElement("canvas"),
      f = fog.getContext("2d")!,
      brush = document.createElement("canvas");
    brush.width = brush.height = 64;
    const b = brush.getContext("2d")!,
      gradient = b.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "#000");
    gradient.addColorStop(0.65, "#000");
    gradient.addColorStop(1, "#0000");
    b.fillStyle = gradient;
    b.fillRect(0, 0, 64, 64);
    let rect = canvas.getBoundingClientRect(),
      w = rect.width,
      h = rect.height,
      dpr = Math.min(devicePixelRatio || 1, 2),
      drawing = false,
      sid = "",
      queue: [number, number][] = [],
      lastSend = 0,
      lastFog = 0,
      lastPoint: [number, number] | null = null;
    const tints = Object.fromEntries(
      Object.entries(COLORS).map(([key, color]) => {
        const sprite = document.createElement("canvas");
        sprite.width = sprite.height = 64;
        const c = sprite.getContext("2d")!,
          g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, color);
        g.addColorStop(1, color + "00");
        c.fillStyle = g;
        c.fillRect(0, 0, 64, 64);
        return [key, sprite];
      }),
    );
    const strokes = new Set<string>(),
      dots = Array.from({ length: 36 }, () => ({
        x: 0,
        y: 0,
        life: 0,
        color: "#fff7cf",
      }));
    let nextDot = 0;
    const resize = () => {
      rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = fog.width = Math.round(w * dpr);
      canvas.height = fog.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      f.setTransform(dpr, 0, 0, dpr, 0, 0);
      f.fillStyle = "#e7f2f5b3";
      f.fillRect(0, 0, w, h);
      lastPoint = null;
    };
    resize();
    const erase = (
      pts: [number, number][],
      sparkle: boolean,
      color = games.color(),
    ) => {
      f.globalCompositeOperation = "destination-out";
      const radius = (w / 960) * 18;
      let previous: [number, number] | null = null;
      for (const p of pts) {
        const x = p[0] * w,
          y = p[1] * h;
        if (previous) {
          const distance = Math.hypot(x - previous[0], y - previous[1]),
            steps = Math.min(30, Math.ceil(distance / (radius * 0.4)));
          for (let i = 1; i < steps; i++) {
            const t = i / steps;
            f.drawImage(
              brush,
              previous[0] + (x - previous[0]) * t - radius,
              previous[1] + (y - previous[1]) * t - radius,
              radius * 2,
              radius * 2,
            );
          }
        }
        f.drawImage(brush, x - radius, y - radius, radius * 2, radius * 2);
        previous = [x, y];
        if (sparkle && !reduced) {
          const dot = dots[nextDot++ % dots.length];
          dot.x = x;
          dot.y = y;
          dot.life = 1;
          dot.color = COLORS[color as keyof typeof COLORS] || "#fff7cf";
        }
      }
      f.globalCompositeOperation = "source-over";
      f.globalAlpha = 0.12;
      const tint = tints[color] || tints.blue;
      for (const p of pts)
        f.drawImage(
          tint,
          p[0] * w - radius,
          p[1] * h - radius,
          radius * 2,
          radius * 2,
        );
      f.globalAlpha = 1;
    };
    const off = games.listen((m) => {
      if (m.event === "doodle_clear") {
        f.clearRect(0, 0, w, h);
        f.fillStyle = "#e7f2f5b3";
        f.fillRect(0, 0, w, h);
        strokes.clear();
      } else if (m.event === "doodle") {
        const stroke = m.data as unknown as Stroke;
        if (!strokes.has(stroke.sid)) {
          if (strokes.size >= 200)
            strokes.delete(strokes.values().next().value!);
          strokes.add(stroke.sid);
        }
        erase(stroke.pts, true, stroke.color as ReturnType<typeof games.color>);
      }
    });
    const point = (e: PointerEvent): [number, number] => [
      Math.max(0, Math.min(1, (e.clientX - rect.left) / w)),
      Math.max(0, Math.min(1, (e.clientY - rect.top) / h)),
    ];
    const down = (e: PointerEvent) => {
      drawing = true;
      sid = crypto.randomUUID();
      lastPoint = point(e);
      queue = [lastPoint];
      erase(queue, true);
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drawing) return;
      const p = point(e);
      erase(lastPoint ? [lastPoint, p] : [p], true);
      lastPoint = p;
      if (queue.length < 50) queue.push(p);
      else queue[49] = p;
    };
    const up = () => {
      drawing = false;
      lastPoint = null;
    };
    const tick = (time: number, delta: number) => {
      if (document.hidden) return;
      if (time - lastSend >= 0.05 && queue.length) {
        games.sendStroke({ sid, color: games.color(), pts: queue });
        queue = [];
        lastSend = time;
      }
      if (time - lastFog >= 0.5) {
        f.fillStyle = "#e7f2f5";
        f.globalAlpha = 0.055;
        f.fillRect(0, 0, w, h);
        f.globalAlpha = 1;
        lastFog = time;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(fog, 0, 0, w, h);
      if (!reduced) {
        for (const dot of dots) {
          if (dot.life <= 0) continue;
          dot.life = Math.max(0, dot.life - Math.min(delta, 50) / 700);
          ctx.globalAlpha = dot.life * 0.75;
          ctx.fillStyle = dot.color;
          ctx.fillRect(dot.x - 1, dot.y - 3, 2, 6);
          ctx.fillRect(dot.x - 3, dot.y - 1, 6, 2);
        }
        ctx.globalAlpha = 1;
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      observer.disconnect();
      off();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      queue = [];
    };
  }, [games, reduced]);
  return (
    <canvas
      ref={ref}
      className="table-doodle"
      aria-label="Draw anywhere on the misty screen. Use Clear to start again."
    />
  );
}
