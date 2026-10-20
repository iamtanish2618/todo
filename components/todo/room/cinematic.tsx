"use client";
import { useEffect, useRef, type RefObject, type CSSProperties } from "react";
import { CINEMA as C, type RoomWeather } from "./cinema-config";

type CinemaState = {
  active: boolean;
  reduced: boolean;
  focus: boolean;
  running: boolean;
  remaining: number;
  duration: number;
  timerId: string;
  weather: RoomWeather;
  panel: string | null;
  celebrating: boolean;
  thunder: boolean;
};

export function RoomAtmosphere() {
  return (
    <>
      <canvas className="cinema-particles" aria-hidden="true" />
      <div className="cinema-rays" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="cinema-light-bloom" aria-hidden="true" />
      <div className="cinema-lamp-dim" aria-hidden="true" />
      <div className="cinema-vignette" aria-hidden="true" />
      <div className="cinema-scene-grade" aria-hidden="true">
        <i className="cinema-grade-night" />
        <i className="cinema-grade-day" />
        <i className="cinema-grade-cool" />
        <i className="cinema-grade-sunset" />
      </div>
      <div className="cinema-grain" aria-hidden="true" />
      <div className="cinema-scene-sweep" aria-hidden="true" />
      <div className="cinema-seasonal" aria-hidden="true">
        <span className="cinema-snowglobe">❅</span>
        <span className="cinema-blossom">✿</span>
      </div>
      <div className="cinema-string-lights" aria-hidden="true">
        {[
          [18.2, 2.7],
          [22.3, 5.5],
          [27.3, 7.4],
          [32.2, 8.8],
          [37.4, 8],
          [42.8, 5.9],
          [47.6, 2.8],
        ].map(([x, y], i) => (
          <i
            key={i}
            style={
              { left: `${x}%`, top: `${y}%`, "--bulb": i } as CSSProperties
            }
          />
        ))}
      </div>
      <p className="cinema-halfway" role="status" aria-hidden="true">
        Halfway there. One little step at a time.
      </p>
      <span className="cinema-sleep-z" aria-hidden="true">
        z<span>z</span>
        <span>z</span>
      </span>
    </>
  );
}
export function RoomCursor() {
  return (
    <div className="cinema-cursor" aria-hidden="true">
      <i className="cinema-cursor-dot" />
      <i className="cinema-cursor-ring" />
      {Array.from({ length: 5 }, (_, i) => (
        <i className="cinema-cursor-trail" key={i} />
      ))}
      <i className="cinema-click-spark">✦</i>
      <i className="cinema-click-ripple" />
    </div>
  );
}

/** Shared GSAP ticker: cached geometry, one sprite, bounded particle pools, no render per frame. */
export function useRoomCinema(
  root: RefObject<HTMLElement | null>,
  state: CinemaState,
) {
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => {
    if (!state.active || !root.current) return;
    const element = root.current,
      stage = element.querySelector<HTMLElement>(".cozy-room-stage")!;
    const art = element.querySelector<HTMLElement>(".round-room-art")!;
    const canvas =
      element.querySelector<HTMLCanvasElement>(".cinema-particles")!;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    for (const [key, value] of Object.entries(C.parallax))
      if (key !== "lerp")
        element.style.setProperty(`--cinema-${key}`, String(value));
    const pointerMedia = matchMedia("(pointer:fine)");
    const lowPower =
      innerWidth < 800 ||
      navigator.hardwareConcurrency <= 4 ||
      ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ??
        8) <= 4;
    let low = lowPower,
      disposed = false,
      removeTick = () => {},
      last = 0,
      frame = 0,
      slowFrames = 0;
    let bounds = stage.getBoundingClientRect(),
      width = bounds.width,
      height = bounds.height,
      dpr = 1;
    let px = innerWidth / 2,
      py = innerHeight / 2,
      tx = 0,
      ty = 0,
      x = 0,
      y = 0,
      lastInput = performance.now(),
      hover = false,
      pointerSeen = false;
    let behaviorUntil = 0,
      lastBehavior = "",
      nextBehavior = performance.now() + 6500,
      nextStar = performance.now() + C.starInterval;
    let starAt = -1e8,
      birdAt = performance.now() - 5000,
      nextBird = performance.now() + 18000,
      constellation = 0,
      starsClicked = 0,
      celebrationAt = -1e8;
    let lastTimer = "",
      lastRemaining = state.remaining,
      snapshot = performance.now(),
      halfwayId = "",
      lastFavicon = -1;
    const setData = (
      node: HTMLElement,
      key: string,
      value: string | boolean,
    ) => {
      const next = String(value);
      if (node.dataset[key] !== next) node.dataset[key] = next;
    };
    let lastThunderCycle = -1;
    let lastScene = state.weather;
    let lastCelebration = state.celebrating;
    const originalIcon =
      document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const oldIconHref = originalIcon?.href;
    const icon =
      originalIcon ||
      Object.assign(document.createElement("link"), { rel: "icon" });
    if (!originalIcon) document.head.appendChild(icon);
    const dot = element.querySelector<HTMLElement>(".cinema-cursor-dot")!,
      ring = element.querySelector<HTMLElement>(".cinema-cursor-ring")!;
    const trails = Array.from(
      element.querySelectorAll<HTMLElement>(".cinema-cursor-trail"),
    );
    const trailPoints = trails.map(() => ({ x: px, y: py }));
    const spark = element.querySelector<HTMLElement>(".cinema-click-spark")!;
    const ripple = element.querySelector<HTMLElement>(".cinema-click-ripple")!;
    let clickAt = -1e8,
      clickX = 0,
      clickY = 0,
      sparkleAt = -1e8;
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 32;
    const sc = sprite.getContext("2d")!,
      grad = sc.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "#fffbea");
    grad.addColorStop(0.2, "#fff5d5e0");
    grad.addColorStop(1, "#fff5d500");
    sc.fillStyle = grad;
    sc.fillRect(0, 0, 32, 32);
    const particles = Array.from({ length: 100 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.7 + Math.random() * 2,
      speed: 0.012 + Math.random() * 0.025,
      phase: Math.random() * 6.28,
      depth: i % 3,
    }));
    const drops = Array.from({ length: 42 }, (_, i) => ({
      x: 0.275 + Math.random() * 0.25,
      y: 0.08 + Math.random() * 0.345,
      speed: 0.006 + Math.random() * 0.012,
      phase: i * 0.7,
      size: 1 + Math.random() * 1.5,
    }));
    const burst = Array.from({ length: 32 }, (_, i) => ({
      x: 0.7,
      y: 0.55,
      vx: (Math.random() - 0.5) * 0.12,
      vy: -0.035 - Math.random() * 0.09,
      phase: i * 0.4,
      life: Math.random(),
    }));
    let progressRing = element.querySelector<SVGCircleElement>(
      ".round-timer-progress",
    );
    let displayedRing = 100 * (state.remaining / Math.max(1, state.duration)),
      lastPaint = 0;
    let panes: Path2D;
    const resize = () => {
      bounds = stage.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      dpr = Math.min(devicePixelRatio || 1, low ? 1 : 1.75);
      canvas.width = Math.round(width * (low ? 0.26 : 1) * dpr);
      canvas.height = Math.round(height * (low ? 0.35 : 1) * dpr);
      canvas.style.left = low ? "27%" : "0";
      canvas.style.top = low ? "8%" : "0";
      canvas.style.width = low ? "26%" : "100%";
      canvas.style.height = low ? "35%" : "100%";
      panes = new Path2D();
      const path = (points: [number, number][]) => {
        panes.moveTo(points[0][0] * width, points[0][1] * height);
        for (const [a, b] of points.slice(1))
          panes.lineTo(a * width, b * height);
        panes.closePath();
      };
      path([
        [0.273, 0.269],
        [0.273, 0.211],
        [0.28, 0.17],
        [0.31, 0.12],
        [0.35, 0.09],
        [0.395, 0.077],
        [0.395, 0.269],
      ]);
      path([
        [0.408, 0.077],
        [0.46, 0.09],
        [0.5, 0.13],
        [0.525, 0.18],
        [0.531, 0.211],
        [0.531, 0.269],
        [0.408, 0.269],
      ]);
      path([
        [0.273, 0.287],
        [0.395, 0.287],
        [0.395, 0.423],
        [0.273, 0.423],
      ]);
      path([
        [0.408, 0.287],
        [0.531, 0.287],
        [0.531, 0.423],
        [0.408, 0.423],
      ]);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    const activity = () => {
      lastInput = performance.now();
      if (art.dataset.behavior === "sleepy") {
        art.dataset.behavior = "startle";
        behaviorUntil = lastInput + 650;
      }
    };
    const pointer = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      tx = Math.max(
        -1,
        Math.min(1, (px - bounds.left - width / 2) / (width / 2)),
      );
      ty = Math.max(
        -1,
        Math.min(1, (py - bounds.top - height / 2) / (height / 2)),
      );
      pointerSeen = true;
      activity();
    };
    const over = (e: PointerEvent) => {
      const target = e.target as Element;
      hover = Boolean(
        target.closest("button,a,input,textarea,select,[role=button],summary"),
      );
      art.dataset.windowHover = String(
        Boolean(target.closest(".cinema-window-hit")),
      );
      art.dataset.lightsHover = String(
        Boolean(target.closest(".cinema-lights-hit")),
      );
    };
    const click = (e: MouseEvent) => {
      activity();
      if (latest.current.reduced) return;
      clickX = e.clientX;
      clickY = e.clientY;
      clickAt = performance.now();
    };
    const effect = (event: Event) => {
      const kind = (event as CustomEvent<{ kind: string }>).detail.kind,
        now = performance.now();
      if (kind === "star" && !latest.current.focus) {
        starAt = now;
        starsClicked++;
        if (starsClicked % 5 === 0) {
          constellation = now;
        }
      }
      if (kind === "celebrate") {
        celebrationAt = now;
      }
      if (kind === "task" && !latest.current.focus) {
        art.dataset.behavior = "nod";
        behaviorUntil = now + 1100;
      }
      if (kind === "page" || kind === "copy" || kind === "task-done") {
        sparkleAt = now;
      }
    };
    const visibility = () => {
      element.dataset.tabHidden = String(document.hidden);
      last = 0;
    };
    visibility();
    element.addEventListener("pointermove", pointer, { passive: true });
    element.addEventListener("pointerover", over, { passive: true });
    element.addEventListener("click", click);
    element.addEventListener("keydown", activity);
    element.addEventListener("todo:room-effect", effect);
    document.addEventListener("visibilitychange", visibility);
    const tick = (seconds: number) => {
      if (disposed || document.hidden) return;
      const now = performance.now(),
        dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
      last = now;
      const s = latest.current,
        motion = !s.reduced,
        calm = s.focus,
        count = low ? C.particles.low : C.particles.full;
      setData(element, "quality", low ? "low" : "full");
      setData(element, "cinemaFocus", calm);
      setData(element, "pointerIdle", now - lastInput > 3000);
      setData(
        element,
        "customCursor",
        pointerMedia.matches && motion && pointerSeen,
      );
      // Coarse frame-time adaptation only decreases decorative work; it cannot affect timers.
      if (frame++ < 45 && dt > 0.028) slowFrames++;
      if (frame === 45 && slowFrames > 18 && !low) {
        low = true;
        resize();
      }
      // Keep the glass backdrop stable while using a dock panel. The room still follows
      // the cursor when tools are closed; this avoids repainting three frosted surfaces.
      const panelStill = element.dataset.dock === "true" && Boolean(s.panel);
      const targetX =
          motion && !calm && !low && !panelStill
            ? pointerMedia.matches
              ? tx
              : Math.sin(seconds * 0.13) * 0.25
            : 0,
        targetY =
          motion && !calm && !low && !panelStill
            ? pointerMedia.matches
              ? ty
              : Math.cos(seconds * 0.11) * 0.18
            : 0;
      const lerp = 1 - Math.pow(1 - C.parallax.lerp, dt * 60);
      x += (targetX - x) * lerp;
      y += (targetY - y) * lerp;
      const depthX = `${Math.round(x * 1000) / 1000}px`,
        depthY = `${Math.round(y * 1000) / 1000}px`;
      if (element.style.getPropertyValue("--depth-x") !== depthX)
        element.style.setProperty("--depth-x", depthX);
      if (element.style.getPropertyValue("--depth-y") !== depthY)
        element.style.setProperty("--depth-y", depthY);
      if (motion && pointerMedia.matches) {
        dot.style.transform = `translate3d(${px}px,${py}px,0) scale(${hover ? 1.2 : 1})`;
        trailPoints.forEach((point, i) => {
          const prev = i ? trailPoints[i - 1] : { x: px, y: py };
          point.x += (prev.x - point.x) * 0.25;
          point.y += (prev.y - point.y) * 0.25;
          trails[i].style.transform =
            `translate3d(${point.x}px,${point.y}px,0) scale(${1 - i * 0.13})`;
          trails[i].style.opacity = String(
            now - lastInput < 350 ? 0.3 * (1 - i / 5) : 0,
          );
        });
        ring.style.transform = `translate3d(${trailPoints[0].x}px,${trailPoints[0].y}px,0) scale(${hover ? 1 : 0.35})`;
        ring.style.opacity = hover ? ".6" : "0";
        const age = (now - clickAt) / 450;
        spark.style.transform = `translate3d(${clickX}px,${clickY}px,0) scale(${0.5 + age}) rotate(${age * 30}deg)`;
        spark.style.opacity = age >= 0 && age < 1 ? String(1 - age) : "0";
        ripple.style.transform = `translate3d(${clickX}px,${clickY}px,0) scale(${0.3 + age * 2})`;
        ripple.style.opacity =
          age >= 0 && age < 1 ? String((1 - age) * 0.3) : "0";
      }
      if (s.timerId !== lastTimer || s.remaining !== lastRemaining) {
        lastTimer = s.timerId;
        lastRemaining = s.remaining;
        snapshot = now;
      }
      const remainder = Math.max(
        0,
        s.remaining - (s.running ? (now - snapshot) / 1000 : 0),
      );
      if (!progressRing?.isConnected)
        progressRing = element.querySelector<SVGCircleElement>(
          ".round-timer-progress",
        );
      displayedRing +=
        ((100 * remainder) / Math.max(1, s.duration) - displayedRing) *
        (1 - Math.exp(-dt * 10));
      if (progressRing)
        progressRing.style.strokeDashoffset = String(displayedRing);
      setData(element, "lastMinute", calm && remainder <= 60);
      const faviconSecond = Math.floor(remainder);
      if (s.running && faviconSecond !== lastFavicon) {
        lastFavicon = faviconSecond;
        const fraction = 1 - remainder / Math.max(1, s.duration);
        icon.href = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="10" fill="#352a24"/><circle cx="16" cy="16" r="11" fill="none" stroke="#65513d" stroke-width="3"/><circle cx="16" cy="16" r="11" fill="none" stroke="#f0cf91" stroke-width="3" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${100 * (1 - fraction)}" transform="rotate(-90 16 16)"/></svg>`)}`;
      } else if (!s.running && lastFavicon !== -1) {
        lastFavicon = -1;
        if (oldIconHref) icon.href = oldIconHref;
      }
      if (
        calm &&
        s.remaining <= s.duration / 2 &&
        halfwayId !== s.timerId &&
        s.remaining > 0
      ) {
        halfwayId = s.timerId;
        element.dataset.halfway = "true";
        element
          .querySelector(".cinema-halfway")
          ?.setAttribute("aria-hidden", "false");
        setTimeout(() => {
          if (!disposed) {
            element.dataset.halfway = "false";
            element
              .querySelector(".cinema-halfway")
              ?.setAttribute("aria-hidden", "true");
          }
        }, 4000);
      }
      if (
        !calm &&
        motion &&
        !s.panel &&
        now > nextBehavior &&
        now > behaviorUntil
      ) {
        const options = [
          "window",
          "sip",
          "beanie",
          "page",
          "tilt",
          "cheek",
        ].filter((a) => a !== lastBehavior);
        lastBehavior = options[Math.floor(Math.random() * options.length)];
        art.dataset.behavior = lastBehavior;
        behaviorUntil = now + (lastBehavior === "sip" ? 7000 : 2600);
        nextBehavior = Math.max(
          behaviorUntil + 600,
          now + C.idle.min + Math.random() * (C.idle.max - C.idle.min),
        );
      }
      if (calm || (s.panel && art.dataset.behavior !== "nod")) {
        setData(art, "behavior", "idle");
      } else if (now - lastInput > C.idle.sleep && motion) {
        art.dataset.behavior = "sleepy";
      } else if (now > behaviorUntil && art.dataset.behavior !== "idle") {
        setData(art, "behavior", "idle");
      }
      if (s.celebrating && !lastCelebration) celebrationAt = now;
      lastCelebration = s.celebrating;
      if (s.weather !== lastScene) {
        lastScene = s.weather;
        art.dataset.sceneChanging = "false";
        void import("gsap").then(({ gsap }) => {
          if (disposed) return;
          gsap.to(art.querySelector(".cinema-scene-sweep"), {
            keyframes: [
              { opacity: 0.35, xPercent: -10, duration: 0.2 },
              { opacity: 0, xPercent: 20, duration: 1.3 },
            ],
            ease: "power2.out",
            overwrite: true,
          });
        });
      }
      if (low && now - lastPaint < 32) return;
      const paintDt = Math.min(0.05, lastPaint ? (now - lastPaint) / 1000 : dt);
      lastPaint = now;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        low ? -width * 0.27 * dpr : 0,
        low ? -height * 0.08 * dpr : 0,
      );
      if (!motion) return;
      if (now > nextStar && !calm && s.weather === "night") {
        starAt = now;
        nextStar = now + C.starInterval + Math.random() * 60000;
      }
      if (now > nextBird && s.weather === "morning") {
        birdAt = now;
        nextBird = now + 22000 + Math.random() * 15000;
      }
      ctx.save();
      ctx.clip(panes);
      for (let i = 0; i < count; i++) {
        const p = particles[i],
          weather = s.weather;
        p.y += p.speed * paintDt * (weather === "snow" ? 1.5 : 0.3);
        if (p.y > 1) p.y = 0;
        const twinkle =
          0.3 +
          0.7 *
            (Math.sin(
              seconds * (art.dataset.windowHover === "true" ? 2 : 0.5) +
                p.phase,
            ) *
              0.5 +
              0.5);
        if (weather === "night") {
          const a = 0.28 + p.x * 0.24,
            b = 0.085 + p.y * 0.34;
          ctx.globalAlpha = (i < 12 ? 0.45 : 0.18) * twinkle;
          ctx.drawImage(sprite, a * width, b * height, p.r * 2.8, p.r * 2.8);
          if (i < 8) {
            ctx.globalAlpha = 0.35 * twinkle;
            ctx.drawImage(
              sprite,
              (0.28 + p.x * 0.24 + Math.sin(seconds * 0.16 + p.phase) * 0.007) *
                width,
              (0.34 + p.y * 0.08) * height,
              3,
              3,
            );
          }
        } else if (weather === "snow" && i < (low ? 24 : 72)) {
          const xx =
              (0.26 + p.x * 0.29 + Math.sin(seconds * 0.3 + p.phase) * 0.008) *
              width,
            yy = (0.07 + p.y * 0.38) * height;
          ctx.globalAlpha = 0.3 + p.depth * 0.19;
          const size = p.r * (2 + p.depth);
          ctx.drawImage(sprite, xx, yy, size, size);
        }
      }
      if (s.weather === "rain")
        for (let i = 0; i < (low ? 16 : drops.length); i++) {
          const p = drops[i];
          p.y += p.speed * paintDt;
          if (p.y > 0.43) {
            p.y = 0.078;
            p.x = 0.275 + Math.random() * 0.25;
          }
          const wobble = Math.sin(p.phase + seconds * 0.7) * 0.0008,
            xx = (p.x + wobble) * width,
            yy = p.y * height;
          ctx.globalAlpha = 0.17;
          ctx.strokeStyle = "#d1e2e9";
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(xx, yy - 5 - p.size * 2);
          ctx.bezierCurveTo(xx - 1, yy - 1, xx + 2, yy + 3, xx, yy + 5);
          ctx.stroke();
          ctx.globalAlpha = 0.45;
          ctx.drawImage(sprite, xx - 1.5, yy, 3, 4.5);
        }
      const starAge = (now - starAt) / 1400;
      if (starAge >= 0 && starAge < 1) {
        const xx = (0.28 + starAge * 0.26) * width,
          yy = (0.09 + starAge * 0.12) * height;
        ctx.globalAlpha = Math.sin(starAge * Math.PI);
        ctx.strokeStyle = "#fff5d3";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(xx - 35, yy - 16);
        ctx.lineTo(xx, yy);
        ctx.stroke();
        ctx.drawImage(sprite, xx - 4, yy - 4, 8, 8);
      }
      const birdAge = (now - birdAt) / 8500;
      if (s.weather === "morning" && birdAge >= 0 && birdAge < 1) {
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = "#655c52";
        ctx.lineWidth = 1.1;
        for (let i = 0; i < 3; i++) {
          const xx = (0.26 + birdAge * 0.31 - i * 0.012) * width,
            yy = (0.18 + Math.sin(birdAge * 3) * 0.015 + i * 0.013) * height;
          const flap = Math.sin(seconds * 4 + i) * 3;
          ctx.beginPath();
          ctx.moveTo(xx - 4, yy + flap);
          ctx.quadraticCurveTo(xx - 2, yy - 2, xx, yy);
          ctx.quadraticCurveTo(xx + 2, yy - 2, xx + 4, yy + flap);
          ctx.stroke();
        }
      }
      if (constellation && now - constellation < 5000) {
        const points = [
          [0.33, 0.2],
          [0.35, 0.16],
          [0.39, 0.15],
          [0.43, 0.18],
          [0.44, 0.23],
          [0.42, 0.29],
          [0.36, 0.29],
          [0.33, 0.24],
          [0.33, 0.2],
          [0.38, 0.22],
          [0.4, 0.22],
        ];
        ctx.globalAlpha =
          Math.sin(Math.min(1, (now - constellation) / 5000) * Math.PI) * 0.6;
        ctx.strokeStyle = "#ffe6a8";
        ctx.lineWidth = 1;
        ctx.beginPath();
        points.forEach(([a, b], i) => {
          if (i === 0) ctx.moveTo(a * width, b * height);
          else ctx.lineTo(a * width, b * height);
          ctx.drawImage(sprite, a * width - 2, b * height - 2, 4, 4);
        });
        ctx.stroke();
      }
      if (s.weather === "rain" && s.thunder && !calm) {
        const cycle = Math.floor(now / 47000);
        const flash = now % 47000;
        if (cycle !== lastThunderCycle && flash < 160) {
          lastThunderCycle = cycle;
          setTimeout(() => {
            if (
              !disposed &&
              !document.hidden &&
              latest.current.thunder &&
              latest.current.weather === "rain" &&
              !latest.current.focus
            )
              element.dispatchEvent(
                new CustomEvent("todo:room-effect", {
                  detail: { kind: "thunder" },
                }),
              );
          }, 1800);
        }
        if (flash < 160) {
          ctx.globalAlpha = 0.07 * Math.sin((flash / 160) * Math.PI);
          ctx.fillStyle = "#fffaf5";
          ctx.fillRect(0, 0, width, height);
        }
      }
      ctx.restore();
      for (let i = 0; i < (low ? 7 : 20); i++) {
        const p = particles[i];
        const a = (p.x + Math.sin(seconds * 0.07 + p.phase) * 0.025) * width,
          b = (p.y + Math.cos(seconds * 0.045 + p.phase) * 0.015) * height;
        if (
          a > width * 0.36 &&
          a < width * 0.77 &&
          b > height * 0.18 &&
          b < height * 0.66
        )
          continue;
        ctx.globalAlpha =
          0.13 * (0.5 + 0.5 * Math.sin(seconds * 0.4 + p.phase));
        ctx.drawImage(sprite, a, b, 3, 3);
      }
      const rewardAge = (now - celebrationAt) / 5000,
        sparkAge = (now - sparkleAt) / 1600;
      if (
        !calm &&
        ((rewardAge >= 0 && rewardAge < 1) || (sparkAge >= 0 && sparkAge < 1))
      )
        for (const p of burst) {
          const age = rewardAge >= 0 && rewardAge < 1 ? rewardAge : sparkAge;
          ctx.globalAlpha = (1 - age) * 0.65;
          ctx.drawImage(
            sprite,
            (p.x + p.vx * age) * width,
            (p.y + p.vy * age * 4) * height,
            5,
            5,
          );
        }
      ctx.globalAlpha = 1;
    };
    void import("gsap").then(({ gsap }) => {
      if (disposed) return;
      gsap.ticker.add(tick);
      removeTick = () => gsap.ticker.remove(tick);
    });
    return () => {
      disposed = true;
      removeTick();
      observer.disconnect();
      element.removeEventListener("pointermove", pointer);
      element.removeEventListener("pointerover", over);
      element.removeEventListener("click", click);
      element.removeEventListener("keydown", activity);
      element.removeEventListener("todo:room-effect", effect);
      document.removeEventListener("visibilitychange", visibility);
      if (originalIcon && oldIconHref) originalIcon.href = oldIconHref;
      else icon.remove();
      element.dataset.customCursor = "false";
      element.style.removeProperty("--depth-x");
      element.style.removeProperty("--depth-y");
    };
  }, [state.active, root]);
}
