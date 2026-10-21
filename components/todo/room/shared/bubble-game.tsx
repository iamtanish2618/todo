"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { BUBBLE_COUNT, type BreakGameSession } from "@/lib/todo/table/games";

/** A bounded set of real buttons: keyboard friendly, with no frame-by-frame React renders. */
export function BubbleField({
  games,
  reduced,
  closing,
}: {
  games: BreakGameSession;
  reduced: boolean;
  closing: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const popped = useRef<number[]>(Array(BUBBLE_COUNT).fill(0));
  useEffect(() => {
    const element = root.current;
    if (!element || closing) return;
    const bubbles = Array.from(
      element.querySelectorAll<HTMLButtonElement>(".table-pop-bubble"),
    );
    const offsets = bubbles.map(() => ({ x: 0, y: 0 }));
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
    const tick = () => {
      if (document.hidden) return;
      const now = games.now(),
        elapsed = (now - games.getSnapshot().startAt) / 1000;
      bubbles.forEach((bubble, i) => {
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
          offsets[i].x = Math.sin(elapsed * 0.32 + i * 1.9) * 16;
          offsets[i].y = Math.cos(elapsed * 0.26 + i * 0.87) * 19;
        }
        const { x, y } = offsets[i];
        bubble.style.transform = `translate3d(${x}px,${y}px,0) scale(${reduced ? 1 : size})`;
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
          style={
            {
              left: `${8 + (i % 6) * 16.8}%`,
              top: `${19 + Math.floor(i / 6) * 21}%`,
              width: `clamp(48px, ${4.5 + (i % 4) * 1.1}vw, ${70 + (i % 4) * 12}px)`,
              aspectRatio: "1",
              "--bubble-hue": `${(i * 31) % 240}deg`,
            } as React.CSSProperties
          }
          onPointerEnter={(event) => {
            event.currentTarget.dataset.hovering = "true";
          }}
          onPointerLeave={(event) => {
            event.currentTarget.dataset.hovering = "false";
          }}
          onClick={() => {
            if (!closing && games.now() - popped.current[i] > 1650)
              games.popBubble(i);
          }}
        >
          <span aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
