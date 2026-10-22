"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { BUBBLE_COUNT, type BreakGameSession } from "@/lib/todo/table/games";

/** A bounded set of real buttons: keyboard friendly, with no frame-by-frame React renders. */
export function BubbleField({
  games,
  reduced,
  closing,
  onPop,
}: {
  games: BreakGameSession;
  reduced: boolean;
  closing: boolean;
  onPop: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const popped = useRef<number[]>(Array(BUBBLE_COUNT).fill(0));
  useEffect(() => {
    const element = root.current;
    if (!element || closing) return;
    const bubbles = Array.from(
      element.querySelectorAll<HTMLButtonElement>(".table-pop-bubble"),
    );
    // Seed each game, rather than rerolling during React renders. Shared players
    // start from the same field; each bubble has its own speed and wandering path.
    let seed = games.getSnapshot().startAt | 0;
    const random = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let n = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
      return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    };
    const bodies = bubbles.map(() => ({
      x: random(),
      y: random(),
      angle: random() * Math.PI * 2,
      targetAngle: random() * Math.PI * 2,
      speed: 14 + random() * 45,
      size: 0.65 + random() * 0.65,
      radius: 36,
      turnAt: games.now() + 1800 + random() * 4500,
    }));
    let width = 1,
      height = 1,
      measured = false;
    const resize = () => {
      const rect = element.getBoundingClientRect();
      const previousWidth = width,
        previousHeight = height;
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      bodies.forEach((body, i) => {
        const diameter = Math.max(46, Math.min(88, width * 0.055)) * body.size;
        body.radius = diameter / 2;
        body.x = measured
          ? (body.x / previousWidth) * width
          : 40 + body.x * Math.max(1, width - 80);
        body.y = measured
          ? (body.y / previousHeight) * height
          : 120 + body.y * Math.max(1, height - 200);
        body.x = Math.max(
          body.radius + 12,
          Math.min(width - body.radius - 12, body.x),
        );
        body.y = Math.max(
          body.radius + 100,
          Math.min(height - body.radius - 65, body.y),
        );
        bubbles[i].style.width = `${diameter}px`;
        bubbles[i].style.setProperty(
          "--bubble-hue",
          `${Math.floor(random() * 240)}deg`,
        );
      });
      measured = true;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    const off = games.listen((message) => {
      if (message.event !== "bubble_pop") return;
      const index = Number(message.data.index);
      // Controller validates the timestamp, game instance and sender before delivery.
      popped.current[index] = Math.max(
        popped.current[index],
        Number(message.data.at),
      );
      bubbles[index].dataset.popped = "true";
      bubbles[index].setAttribute("aria-disabled", "true");
    });
    let last = games.now();
    const tick = () => {
      const now = games.now(),
        dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (document.hidden) return;
      bubbles.forEach((bubble, i) => {
        const body = bodies[i];
        const age = (now - popped.current[i]) / 1000;
        const fading = age < 0.22,
          waiting = age >= 0.22 && age < 1.2,
          returning = age >= 1.2 && age < 1.65;
        const visible = !waiting,
          alpha = fading
            ? Math.max(0, 1 - age / 0.22)
            : returning
              ? (age - 1.2) / 0.45
              : 1;
        const size = fading
          ? 1 + age * 1.2
          : returning
            ? 0.75 + 0.25 * alpha
            : 1;
        // Focused buttons stay still for reliable keyboard targeting.
        const still =
          reduced ||
          document.activeElement === bubble ||
          bubble.dataset.hovering === "true";
        if (!still) {
          if (now > body.turnAt) {
            body.targetAngle = body.angle + (random() - 0.5) * 2.2;
            body.turnAt = now + 2400 + random() * 4300;
          }
          body.angle +=
            (body.targetAngle - body.angle) * Math.min(1, dt * 0.65);
          body.x += Math.cos(body.angle) * body.speed * dt;
          body.y += Math.sin(body.angle) * body.speed * dt;
          // Reflect gently at the playfield edges; never teleport on a wrap.
          const left = body.radius + 12,
            right = Math.max(left, width - left);
          const top = body.radius + 100,
            bottom = Math.max(top, height - body.radius - 65);
          if (
            (body.x <= left && Math.cos(body.angle) < 0) ||
            (body.x >= right && Math.cos(body.angle) > 0)
          ) {
            body.angle = Math.PI - body.angle;
            body.targetAngle = body.angle;
          }
          if (
            (body.y <= top && Math.sin(body.angle) < 0) ||
            (body.y >= bottom && Math.sin(body.angle) > 0)
          ) {
            body.angle = -body.angle;
            body.targetAngle = body.angle;
          }
          body.x = Math.max(left, Math.min(right, body.x));
          body.y = Math.max(top, Math.min(bottom, body.y));
        }
        bubble.style.transform = `translate3d(${body.x}px,${body.y}px,0) translate(-50%,-50%) scale(${reduced ? 1 : size})`;
        bubble.style.opacity = String(visible ? alpha : 0);
        if (age >= 1.65 && bubble.dataset.popped === "true") {
          bubble.dataset.popped = "false";
          bubble.setAttribute("aria-disabled", "false");
        }
      });
    };
    gsap.ticker.add(tick);
    return () => {
      off();
      observer.disconnect();
      gsap.ticker.remove(tick);
    };
  }, [games, reduced, closing]);
  return (
    <div
      ref={root}
      className="table-bubble-field"
      aria-label="Floating bubbles"
    >
      {Array.from({ length: BUBBLE_COUNT }, (_, i) => (
        <button
          type="button"
          key={i}
          className="table-pop-bubble"
          aria-label={`Pop bubble ${i + 1}`}
          aria-disabled={closing}
          disabled={closing}
          onPointerEnter={(event) => {
            event.currentTarget.dataset.hovering = "true";
          }}
          onPointerLeave={(event) => {
            event.currentTarget.dataset.hovering = "false";
          }}
          onClick={() => {
            if (
              !closing &&
              games.getSnapshot().active &&
              games.getSnapshot().game === "bubbles" &&
              games.now() - popped.current[i] > 1650
            ) {
              games.popBubble(i);
              onPop();
            }
          }}
        >
          <span aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
