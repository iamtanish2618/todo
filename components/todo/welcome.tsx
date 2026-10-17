"use client";
import type { CSSProperties, RefObject } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  FileText,
  Headphones,
  Settings2,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Face, type MotionPoint } from "./face";

export const ease = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export type Panel =
  "solo" | "friends" | "agent" | "settings" | "notes" | "history" | null;
const options = [
  {
    id: "solo",
    label: "Focus solo",
    description: "One thing at a time.",
    icon: Headphones,
  },
  {
    id: "friends",
    label: "Join friends",
    description: "Good company. Same room.",
    icon: Users,
  },
  {
    id: "agent",
    label: "Ask Todo",
    description: "A little help goes a long way.",
    icon: Sparkles,
  },
] as const;

type Props = {
  progress: number;
  female: boolean;
  reduced: boolean;
  ready: boolean;
  pointer: RefObject<MotionPoint>;
  reaction: string | null;
  blink: boolean;
  greeting: boolean;
  active: boolean;
  cards: RefObject<(HTMLButtonElement | null)[]>;
  onChoose: (panel: Panel) => void;
  onSwitch: () => void;
  onReaction: (reaction: string | null) => void;
  onBoop: () => void;
  timer: { started: boolean; clock: string; running: boolean };
};

function Bloom() {
  return (
    <g>
      <path
        d="M0 15 Q-8 65 0 115"
        fill="none"
        stroke="#829575"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path d="M-3 83Q-42 50 -33 83Q-18 100 -3 91" fill="#9caa86" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse
          key={a}
          cx="0"
          cy="-18"
          rx="14"
          ry="26"
          transform={`rotate(${a})`}
          fill="#efb5a1"
          stroke="#f8d6bb"
          strokeWidth="2"
        />
      ))}
      <circle r="15" fill="#eccb85" />
    </g>
  );
}

export function Handoff({ progress: p }: { progress: number }) {
  const take = ease(0.4, 0.64, p),
    reach = ease(0.12, 0.36, p),
    retract = ease(0.62, 0.88, p);
  const x = 730 - take * 210,
    y = 330 + take * 200;
  const giverX = x + retract * 450,
    giverY = y - retract * 550;
  const receiverX = x - (1 - reach) * 500,
    receiverY = y + (1 - reach) * 500;
  const opacity = ease(0.09, 0.23, p) * (1 - ease(0.78, 0.94, p));
  return (
    <div
      className="story-handoff"
      style={{ opacity }}
      aria-hidden="true"
      data-transfer={take.toFixed(2)}
    >
      <svg viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern
            id="paw-fur"
            width="128"
            height="128"
            patternUnits="userSpaceOnUse"
          >
            <image
              href="/art/todo-face.png"
              x="-660"
              y="0"
              width="1536"
              height="1024"
            />
          </pattern>
          <linearGradient id="story-flipper" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#635950" />
            <stop offset=".5" stopColor="#393331" />
            <stop offset="1" stopColor="#252323" />
          </linearGradient>
          <filter id="soft-paw">
            <feDropShadow dx="0" dy="8" stdDeviation="9" floodOpacity=".16" />
          </filter>
        </defs>
        <g filter="url(#soft-paw)">
          <path
            className="receiving-hand"
            d={`M-100 1000 Q160 670 ${receiverX - 80} ${receiverY + 140} Q${receiverX - 20} ${receiverY + 70} ${receiverX + 12} ${receiverY + 85} Q${receiverX + 55} ${receiverY + 110} ${receiverX - 3} ${receiverY + 157} Q230 900 80 1000Z`}
            fill="url(#paw-fur)"
          />
          <path
            className="giving-hand"
            d={`M1300 -100 Q1100 180 ${giverX + 95} ${giverY + 55} Q${giverX + 15} ${giverY + 30} ${giverX + 4} ${giverY + 87} Q${giverX - 9} ${giverY + 136} ${giverX + 66} ${giverY + 125} Q1160 380 1390 0Z`}
            fill="url(#paw-fur)"
          />
          <path
            d={`M${giverX + 75} ${giverY + 75}Q${giverX + 40} ${giverY + 60} ${giverX + 28} ${giverY + 89}`}
            stroke="#94857b"
            strokeOpacity=".4"
            strokeWidth="3"
            fill="none"
          />
          <g transform={`translate(${x} ${y}) rotate(${12 - take * 20})`}>
            <Bloom />
          </g>
        </g>
      </svg>
    </div>
  );
}

export function Welcome(p: Props) {
  const progress = p.reduced ? (p.progress < 0.5 ? 0 : 1) : p.progress;
  const outgoing = ease(0.08, 0.9, progress),
    incoming = ease(0.12, 0.94, progress);
  const transferring = progress > 0.035 && progress < 0.965;
  const feather = Math.sin(Math.PI * progress) * 18;
  const mask = `linear-gradient(transparent,black ${feather}%,black ${100 - feather}%,transparent)`;
  const maleOpacity = 1 - ease(0.035, 0.19, progress),
    femaleOpacity = ease(0.81, 0.965, progress);
  return (
    <div
      data-scroll-progress={progress.toFixed(3)}
      className={`viewport welcome-viewport ${p.active ? "welcome-visible" : "welcome-away"} ${transferring ? "is-transferring" : ""}`}
      inert={!p.active}
      aria-hidden={!p.active}
    >
      <div className="character-stage" onClick={p.onBoop}>
        <div
          className="character-layer male-layer"
          inert={progress > 0.035}
          aria-hidden={progress > 0.035}
          style={{
            maskImage: mask,
            transform: p.reduced ? "none" : `translateY(${-outgoing * 92}vh)`,
            opacity: p.reduced ? 1 - progress : 1 - ease(0.74, 1, progress),
          }}
        >
          <Face
            active={p.active && progress < 0.995}
            pointer={p.pointer}
            reduced={p.reduced}
            reaction={transferring ? null : p.reaction}
            blinking={transferring ? false : p.blink}
          />
          <button
            className="beak-hit"
            aria-label="Give him a little boop"
            tabIndex={maleOpacity > 0.5 ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              p.onBoop();
            }}
          />
        </div>
        <div
          className="character-layer female-layer"
          inert={progress < 0.965}
          aria-hidden={progress < 0.965}
          style={{
            maskImage: mask,
            transform: p.reduced
              ? "none"
              : `translateY(${(1 - incoming) * 92}vh)`,
            opacity: p.reduced ? progress : ease(0, 0.26, progress),
          }}
        >
          <Face
            active={p.active && progress > 0.005}
            pointer={p.pointer}
            reduced={p.reduced}
            reaction={transferring ? null : p.reaction}
            blinking={transferring ? false : p.blink}
            female
          />
          <button
            className="beak-hit"
            aria-label="Give her a little boop"
            tabIndex={femaleOpacity > 0.5 ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              p.onBoop();
            }}
          />
        </div>
      </div>
      {!p.reduced ? <Handoff progress={progress} /> : null}
      {transferring && !p.reduced ? (
        <div
          className="story-caption"
          style={{
            opacity:
              ease(0.18, 0.32, progress) * (1 - ease(0.68, 0.82, progress)),
          }}
        >
          <span>A little kindness, passed along.</span>
          <small>Keep scrolling to meet your other companion.</small>
        </div>
      ) : null}
      <header className="home-header">
        <a className="wordmark" href="/" aria-label="Todo home">
          todo<span>•</span>
        </a>
        <div className="header-actions">
          <span className="character-caption">your penguin, your pace</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open settings"
            disabled={!p.ready}
            className="settings-trigger"
            onClick={() => p.onChoose("settings")}
          >
            <Settings2 size={19} />
          </Button>
        </div>
      </header>
      {p.greeting && !transferring ? (
        <div className="greeting" role="status">
          Ready when you are.
        </div>
      ) : null}
      {p.timer.started && !transferring ? (
        <button className="session-chip" onClick={() => p.onChoose("solo")}>
          <Headphones size={15} />
          <strong>{p.timer.clock}</strong>
          <span>
            {p.timer.running ? "Your room is waiting" : "Paused, no rush"}
          </span>
          <ArrowRight size={14} />
        </button>
      ) : null}
      {(["male", "female"] as const).map((character, index) => {
        const opacity = index ? femaleOpacity : maleOpacity,
          enabled = opacity > 0.8 && p.active;
        return (
          <section
            key={character}
            className={`choice-section character-choices ${character}-choices`}
            data-character={character}
            aria-label={`Choose ${character} companion`}
            aria-hidden={!enabled}
            inert={!enabled}
            style={
              {
                opacity,
                transform: `translate(-50%,${(1 - opacity) * 20}px)`,
                pointerEvents: enabled ? "auto" : "none",
              } as CSSProperties
            }
          >
            <div className="companion-name">
              <span className={`identity-dot ${character}`} />
              {index
                ? "Her corner. Your company."
                : "His corner. Your company."}
            </div>
            <div className="choice-row">
              {options.map(({ id, label, description, icon: Icon }, i) => (
                <button
                  key={id}
                  ref={(node) => {
                    p.cards.current[index * 3 + i] = node;
                  }}
                  disabled={!p.ready || !enabled}
                  className={`choice-card ${id === "solo" ? "primary-choice" : ""}`}
                  onPointerEnter={() => p.onReaction(id)}
                  onPointerLeave={() => p.onReaction(null)}
                  onFocus={() => p.onReaction(id)}
                  onBlur={() => p.onReaction(null)}
                  onClick={() => p.onChoose(id)}
                >
                  <div className="choice-top">
                    <Icon size={25} strokeWidth={1.55} />
                    <ArrowRight className="choice-arrow" size={18} />
                  </div>
                  <h1>
                    {label}
                    {id === "solo" ? <span className="orange-dot" /> : null}
                  </h1>
                  <p>{description}</p>
                </button>
              ))}
            </div>
            <button className="character-switch" onClick={p.onSwitch}>
              {index ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              <span>
                {index ? "Scroll up to meet him" : "Scroll to meet her"}
              </span>
              <span className="switch-divider">·</span>
              <span className="switch-caption">or click to switch</span>
            </button>
          </section>
        );
      })}
      <footer className="home-footer">
        <span>A little company. A little progress.</span>
        <button
          disabled={!p.ready || transferring}
          onClick={() => p.onChoose("notes")}
        >
          <FileText size={13} />
          Your notes
        </button>
      </footer>
    </div>
  );
}
