"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { gsap } from "gsap";
import { Wind, PencilLine, X, Sparkles } from "lucide-react";
import {
  BreakGameSession,
  breathPhase,
  type Stroke,
} from "@/lib/todo/table/games";
import { COLORS } from "@/lib/todo/table/protocol";
import type { TableSession } from "@/lib/todo/table/session";
import { Button } from "@/components/ui/button";
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
  sound,
}: {
  games: BreakGameSession;
  reduced: boolean;
  sound: boolean;
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
      {state.invite && !state.game && (
        <div className="table-game-invite" role="status">
          <span>
            {state.invite.name} started{" "}
            {state.invite.game === "breathe"
              ? "Breathing Bubble"
              : "Window Doodle"}
          </span>
          <Button
            onClick={() =>
              games.start(state.invite!.game, state.invite!.startAt)
            }
          >
            Join
          </Button>
          <button
            aria-label="Dismiss game invite"
            onClick={() => games.dismissInvite()}
          >
            <X size={14} />
          </button>
        </div>
      )}
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
              Window Doodle<small>Make a little space in the mist.</small>
            </span>
          </button>
          <button
            className="table-game-choice"
            onClick={() => games.start("breathe")}
          >
            <Wind size={20} />
            <span>
              Breathing Bubble<small>One quiet minute, together.</small>
            </span>
          </button>
        </section>
      )}
      {state.game === "doodle" && (
        <>
          <DoodleCanvas games={games} reduced={reduced} />
          <div className="table-game-toolbar">
            <span>
              <PencilLine size={15} />
              Window Doodle
            </span>
            <Button variant="ghost" onClick={() => games.clear()}>
              Clear
            </Button>
            <Button variant="ghost" onClick={() => games.stop()}>
              Done
            </Button>
          </div>
        </>
      )}
      {state.game === "breathe" && (
        <BreathingBubble games={games} reduced={reduced} sound={sound} />
      )}
    </>
  );
}
function DoodleCanvas({
  games,
  reduced,
}: {
  games: BreakGameSession;
  reduced: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    clip = `doodle-${useId().replace(/:/g, "")}`;
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
    <>
      <svg width="0" height="0" aria-hidden="true">
        <defs>
          <clipPath id={clip} clipPathUnits="objectBoundingBox">
            <path d="M.273 .269V.211C.273 .149 .324 .09 .395 .077V.269Z" />
            <path d="M.408 .077C.48 .081 .529 .148 .531 .211V.269H.408Z" />
            <path d="M.273 .287H.395V.423H.273Z" />
            <path d="M.408 .287H.531V.423H.408Z" />
          </clipPath>
        </defs>
      </svg>
      <canvas
        ref={ref}
        className="table-doodle"
        style={{ clipPath: `url(#${clip})` }}
        aria-label="Draw on the misty window. Use Clear to start again."
      />
    </>
  );
}
function BreathingBubble({
  games,
  reduced,
  sound,
}: {
  games: BreakGameSession;
  reduced: boolean;
  sound: boolean;
}) {
  const root = useRef<HTMLElement>(null),
    [tone, setTone] = useState(false);
  const state = games.getSnapshot();
  useEffect(() => {
    const el = root.current,
      bubble = el?.querySelector<HTMLElement>(".table-breath-orb"),
      label = el?.querySelector<HTMLElement>(".table-breath-label");
    if (!el || !bubble || !label) return;
    const tick = () => {
      const phase = breathPhase(games.now(), state.startAt),
        smooth = phase.progress * phase.progress * (3 - 2 * phase.progress);
      bubble.style.transform = reduced
        ? "none"
        : `scale(${0.65 + 0.35 * smooth})`;
      bubble.style.opacity = String(reduced ? 0.65 + 0.35 * smooth : 1);
      label.textContent = phase.label;
      el.dataset.phase = phase.label;
      el.closest<HTMLElement>(".cozy-room")?.style.setProperty(
        "--table-breath",
        String(smooth),
      );
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      el.closest<HTMLElement>(".cozy-room")?.style.removeProperty(
        "--table-breath",
      );
    };
  }, [games, reduced, state.startAt]);
  useEffect(() => {
    if (!tone || !sound) return;
    const ctx = new AudioContext(),
      osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0;
    osc.start();
    void ctx.resume();
    const tick = () => {
      const p = breathPhase(games.now(), state.startAt);
      gain.gain.setTargetAtTime(
        document.hidden || p.finished ? 0 : 0.003 + 0.003 * p.progress,
        ctx.currentTime,
        0.15,
      );
      osc.frequency.setTargetAtTime(
        196 + 24 * p.progress,
        ctx.currentTime,
        0.15,
      );
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      osc.stop(ctx.currentTime + 0.08);
      setTimeout(() => void ctx.close(), 100);
    };
  }, [games, tone, sound, state.startAt]);
  return (
    <section
      ref={root}
      className="table-game-panel table-breath-panel"
      aria-label="Breathing Bubble"
    >
      <header>
        <h2>Breathing Bubble</h2>
        <button
          onClick={() => games.stop()}
          aria-label="Close Breathing Bubble"
        >
          <X size={16} />
        </button>
      </header>
      <div className="table-breath-space">
        <div className="table-breath-orb">
          <Sparkles size={24} />
        </div>
      </div>
      <p className="table-breath-label" aria-live="off">
        Breathe in
      </p>
      {sound && (
        <Button
          variant="ghost"
          aria-pressed={tone}
          onClick={() => setTone((v) => !v)}
        >
          {tone ? "Tone on" : "Tone off"}
        </Button>
      )}
      <Button variant="ghost" onClick={() => games.stop()}>
        Done
      </Button>
    </section>
  );
}
