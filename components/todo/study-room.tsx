"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCheck,
  FileText,
  Headphones,
  Pause,
  Play,
  Settings2,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Panel } from "./welcome";

type Props = {
  active: boolean;
  female: boolean;
  reduced: boolean;
  clock: string;
  running: boolean;
  started: boolean;
  task: string;
  phase: "focus" | "break";
  agentBusy: boolean;
  agentMode: boolean;
  onAgentMode: (mode: boolean) => void;
  onTask: (task: string) => void;
  onStart: () => void;
  onFinish: () => void;
  onExit: () => void;
  onPanel: (panel: Panel) => void;
};

export function StudyRoom(p: Props) {
  const [wink, setWink] = useState(false),
    [peace, setPeace] = useState(false);
  useEffect(() => {
    if (!p.active || p.reduced) return;
    let reset: ReturnType<typeof setTimeout>;
    const id = setInterval(() => {
      setWink(true);
      reset = setTimeout(() => setWink(false), 160);
    }, 6200);
    return () => {
      clearInterval(id);
      clearTimeout(reset);
    };
  }, [p.active, p.reduced]);
  const working = p.running || p.agentBusy;
  const boop = () => {
    if (p.reduced) return;
    setWink(true);
    setPeace(true);
    setTimeout(() => {
      setWink(false);
      setPeace(false);
    }, 1300);
  };
  return (
    <section
      className={`study-room ${p.active ? "room-entered" : "room-hidden"} ${p.reduced ? "room-reduced" : ""} ${working ? "is-working" : ""}`}
      aria-label="Your shared Todo workspace"
      aria-hidden={!p.active}
      inert={!p.active}
      data-character={p.female ? "female" : "male"}
      data-mode={p.agentMode ? "agent" : "companion"}
    >
      <div className="room-backdrop" />
      <div className="room-vignette" />
      <header className="room-header">
        <Button variant="ghost" className="room-back" onClick={p.onExit}>
          <ArrowLeft size={15} />
          Choose companion
        </Button>
        <div className="room-heading">
          <strong>Your little corner</strong>
          <span>
            {p.phase === "break"
              ? "A moment to recharge"
              : p.agentBusy
                ? "Todo is working on your request"
                : p.running
                  ? "A little progress, together"
                  : "Make yourself comfortable"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="room-settings"
          aria-label="Open room settings"
          onClick={() => p.onPanel("settings")}
        >
          <Settings2 size={18} />
        </Button>
      </header>
      <div
        className={`room-companion ${p.female ? "room-female" : "room-male"} ${wink ? "room-winking" : ""}`}
      >
        <img
          src="/art/todo-seated.png"
          alt={
            p.female
              ? "Your pink-band penguin companion sitting at her desk"
              : "Your blue-band penguin companion sitting at his desk"
          }
          className="seated-penguin"
          draggable={false}
        />
        <div className="room-character-band">
          <i />
        </div>
        {p.female ? (
          <>
            <div className="room-bow">
              <i />
              <b />
              <i />
            </div>
            <span className="room-lashes left-lash" />
            <span className="room-lashes right-lash" />
          </>
        ) : null}
        <div className="room-eye-lid" />
        <button
          className="room-beak-hit"
          aria-label="Boop your penguin"
          onClick={boop}
        />
        {peace ? (
          <div className="room-peace">
            <svg viewBox="0 0 120 150">
              <path
                d="M25 145 Q4 100 25 78 L16 24 Q15 4 31 12 L51 63 L58 10 Q62 -4 74 10 L73 76 Q108 66 111 99 Q115 130 85 150Z"
                fill="#383332"
              />
              <path
                d="M31 91 Q62 113 86 90"
                stroke="#68605a"
                strokeWidth="3"
                fill="none"
              />
            </svg>
          </div>
        ) : null}
        <div className="typing-flipper left-typing" />
        <div className="typing-flipper right-typing" />
      </div>
      <div className="desk-surface">
        <div className="desk-grain" />
      </div>
      <div className="room-laptop" aria-hidden="true">
        <div className="laptop-back">
          <span className="laptop-mark">
            t<span>•</span>
          </span>
        </div>
        <div className="laptop-base" />
      </div>
      <div className="desk-paw left-paw" aria-hidden="true" />
      <div className="desk-paw right-paw" aria-hidden="true" />
      <button
        className="coffee-cup"
        onClick={() => p.onPanel("solo")}
        aria-label="Open focus tools"
      >
        <i className="steam steam-one" />
        <i className="steam steam-two" />
        <i className="steam steam-three" />
        <span className="cup-top" />
        <span className="cup-body" />
        <span className="cup-handle" />
        <span className="cup-saucer" />
      </button>
      <div className="desk-notebook" aria-hidden="true">
        <span />
        <i />
      </div>
      <div className="desk-clock" aria-label={`Focus timer ${p.clock}`}>
        <span>
          {p.phase === "break" ? "TAKE A BREATHER" : "A LITTLE FOCUS"}
        </span>
        <strong>{p.clock}</strong>
        <div>
          <button
            aria-label={
              p.running
                ? "Pause timer"
                : p.started
                  ? "Resume timer"
                  : "Set up focus timer"
            }
            onClick={p.started ? p.onStart : () => p.onPanel("solo")}
          >
            {p.running ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <button
            aria-label="Adjust focus timer"
            onClick={() => p.onPanel("solo")}
          >
            <Settings2 size={13} />
          </button>
        </div>
      </div>
      <div className="room-focus-strip">
        <div className="room-task-copy">
          <span>
            {p.phase === "break" ? "Your break" : "Your little intention"}
          </span>
          {p.started ? (
            <strong>{p.task || "Rest for a moment."}</strong>
          ) : (
            <Input
              aria-label="Room focus task"
              maxLength={180}
              placeholder="What are we working on?"
              value={p.task}
              onChange={(e) => p.onTask(e.target.value)}
            />
          )}
        </div>
        <Button className="warm-button" size="sm" onClick={p.onStart}>
          {p.running ? <Pause size={14} /> : <Play size={14} />}{" "}
          {p.running
            ? "Pause"
            : p.started
              ? "Keep going"
              : p.phase === "break"
                ? "Start break"
                : "Start focusing"}
        </Button>
        {p.started && p.phase === "focus" ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Finish focus session"
            onClick={p.onFinish}
          >
            <CheckCheck size={18} />
          </Button>
        ) : null}
      </div>
      <div className="room-dock" aria-label="Room tools">
        <div className="room-mode-toggle">
          <Button
            variant={!p.agentMode ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={!p.agentMode}
            onClick={() => p.onAgentMode(false)}
          >
            <Headphones size={15} />
            Companion
          </Button>
          <Button
            variant={p.agentMode ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={p.agentMode}
            onClick={() => {
              p.onAgentMode(true);
              p.onPanel("agent");
            }}
          >
            <Sparkles size={15} />
            Agent
          </Button>
        </div>
        <span className="dock-divider" />
        <Button variant="ghost" size="sm" onClick={() => p.onPanel("solo")}>
          <Headphones size={15} />
          Focus & tasks
        </Button>
        <Button variant="ghost" size="sm" onClick={() => p.onPanel("notes")}>
          <FileText size={15} />
          Notes
        </Button>
        <Button variant="ghost" size="sm" onClick={() => p.onPanel("friends")}>
          <Users size={15} />
          Friends
        </Button>
      </div>
      <p className="room-presence">
        <span className={working ? "live-dot" : ""} />
        {p.agentBusy
          ? "Working on your request."
          : p.running
            ? "You do your thing. I’ll do mine."
            : "Your penguin is right here."}
      </p>
    </section>
  );
}
