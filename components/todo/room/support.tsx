"use client";
import { useEffect, useRef, useState } from "react";
import { trapDockPanel } from "./dock-panels";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/todo/client";
import { SUPPORT, fallbackSteps, nudgeDelay } from "@/lib/todo/support";

export type StepTask = { title: string; id?: string };
type Idea = { task: StepTask; text: string; fallback: boolean; index: number };
/** Uses the existing authenticated/quota-limited chat endpoint, never a new AI key. */
export function useTinyStep(available: boolean, onQuota: () => void) {
  const [idea, setIdea] = useState<Idea | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current++;
      request.current?.abort();
    },
    [],
  );
  const dismiss = () => {
    sequence.current++;
    request.current?.abort();
    setBusy(false);
    setIdea(null);
  };
  const ask = async (task: StepTask, another = false) => {
    request.current?.abort();
    const generation = ++sequence.current;
    const index = another ? (idea?.index ?? 0) + 1 : 0;
    const canAsk =
      available && task.title.trim().length > 0 && !(another && idea?.fallback);
    setIdea({ task, text: "", fallback: !canAsk, index });
    if (!canAsk) {
      setBusy(false);
      return;
    }
    setBusy(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await api<{ text: string }>(
        "/api/chat",
        "POST",
        {
          mode: "tiny-step",
          messages: [
            {
              role: "user",
              content: `Current task: ${task.title.slice(0, 180)}${another ? `\nSuggest a different first step from this one: ${idea?.text || ""}` : ""}`,
            },
          ],
        },
        AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]),
      );
      if (generation !== sequence.current) return;
      const text = result.text.trim();
      if (!text) throw new Error("empty");
      setIdea({ task, text: text.slice(0, 700), fallback: false, index });
    } catch (error) {
      if (generation !== sequence.current) return;
      if ((error as { status?: number }).status === 429) onQuota();
      setIdea({ task, text: "", fallback: true, index });
    } finally {
      if (generation === sequence.current) setBusy(false);
    }
  };
  return { idea, busy, ask, dismiss };
}
export function TinyStepBubble({
  helper,
  canStart,
  onStart,
}: {
  helper: ReturnType<typeof useTinyStep>;
  canStart: boolean;
  onStart: (task: StepTask) => void;
}) {
  const idea = helper.idea;
  const root = useRef<HTMLElement>(null);
  const open = Boolean(idea);
  useEffect(() => {
    if (!open) return;
    const before =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    root.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      if (before?.isConnected && !before.closest("[inert]")) before.focus();
      else
        document
          .querySelector<HTMLButtonElement>(
            ".cozy-room-active .round-timer-face",
          )
          ?.focus();
    };
  }, [open]);
  if (!idea) return null;
  return (
    <aside
      ref={root}
      className="room-tiny-step dock-panel room-tool-panel"
      data-dock-pane="tiny-step"
      aria-label="One small step"
      aria-busy={helper.busy}
      onKeyDown={(event) => {
        trapDockPanel(event);
        if (event.key === "Escape") {
          event.stopPropagation();
          helper.dismiss();
        }
      }}
    >
      <header className="room-panel-heading">
        <h2>One small step</h2>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Close small step"
          onClick={helper.dismiss}
        >
          <X size={18} />
        </Button>
      </header>
      <div className="room-panel-body">
        <div role="status" aria-live="polite">
          {helper.busy ? (
            <p>Thinking of a tiny first step…</p>
          ) : idea.fallback ? (
            <ul>
              {fallbackSteps(idea.index).map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          ) : (
            <p>{idea.text}</p>
          )}
        </div>
        <div className="room-tiny-actions">
          <Button
            variant="outline"
            disabled={helper.busy}
            onClick={() => void helper.ask(idea.task, true)}
          >
            Another idea
          </Button>
          <Button
            className="room-dark-button"
            disabled={!canStart}
            title={
              canStart
                ? undefined
                : "Finish your current sit before starting a new one."
            }
            onClick={() => onStart(idea.task)}
          >
            Start 5 minutes
          </Button>
        </div>
      </div>
    </aside>
  );
}
/** One optional, silent nudge per uninterrupted run. Pause/break resets the clock. */
export function FocusNudge({
  enabled,
  running,
  timerId,
}: {
  enabled: boolean;
  running: boolean;
  timerId: string;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const started = Date.now();
    const reset = setTimeout(() => setVisible(false), 0);
    if (!enabled || !running || !timerId) return () => clearTimeout(reset);
    let shown = false;
    const check = () => {
      if (!shown && nudgeDelay(started) === 0) {
        shown = true;
        setVisible(true);
      }
    };
    const timer = setTimeout(check, SUPPORT.nudgeAfterMs);
    const wake = () => {
      if (!document.hidden) check();
    };
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearTimeout(reset);
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [enabled, running, timerId]);
  if (!enabled || !running || !visible) return null;
  return (
    <aside className="room-water-nudge" aria-label="A gentle reminder">
      <p role="status">
        A sip of water or a gentle stretch? Your focus can wait a moment.
      </p>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Dismiss reminder"
        onClick={() => setVisible(false)}
      >
        <X size={16} />
      </Button>
    </aside>
  );
}
