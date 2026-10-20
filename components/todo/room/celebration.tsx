"use client";
import { useEffect } from "react";
import { Coffee, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ROOM_CONFIG as C } from "./config";
import { CountUp } from "./polish-controls";
import type { EndCue } from "./cinema-config";

/** A short, rounded two-note bell; no audio is created when sound effects are muted. */
export function playCompletionCue(volume = 1) {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0.035 * volume;
  master.connect(context.destination);
  let stopped = false;
  void context
    .resume()
    .then(() => {
      if (stopped) return;
      const now = context.currentTime;
      [783.99, 1046.5].forEach((frequency, index) => {
        [1, 2.001].forEach((partial, harmonic) => {
          const oscillator = context.createOscillator(),
            envelope = context.createGain();
          const start = now + index * 0.23;
          oscillator.type = "sine";
          oscillator.frequency.value = frequency * partial;
          envelope.gain.setValueAtTime(0, start);
          envelope.gain.linearRampToValueAtTime(
            harmonic ? 0.12 : 0.7,
            start + 0.018,
          );
          envelope.gain.exponentialRampToValueAtTime(0.0001, start + 1.1);
          oscillator.connect(envelope);
          envelope.connect(master);
          oscillator.start(start);
          oscillator.stop(start + 1.15);
        });
      });
    })
    .catch(() => {});
  const close = setTimeout(() => {
    if (context.state !== "closed") void context.close();
  }, 1800);
  return () => {
    stopped = true;
    clearTimeout(close);
    if (context.state !== "closed") {
      master.gain.setTargetAtTime(0, context.currentTime, 0.04);
      setTimeout(() => {
        if (context.state !== "closed") void context.close();
      }, 180);
    }
  };
}

export function CompletionCelebration({
  open,
  female,
  reduced,
  sound,
  cue = "chime",
  minutes = 0,
  tasksDone = 0,
  volume = 1,
  busy,
  onBreak,
  onContinue,
}: {
  open: boolean;
  female: boolean;
  reduced: boolean;
  sound: boolean;
  cue?: EndCue;
  minutes?: number;
  tasksDone?: number;
  volume?: number;
  busy: boolean;
  onBreak: () => void;
  onContinue: () => void;
}) {
  useEffect(() => {
    if (!open || !sound || cue === "silent" || volume === 0) return;
    if (cue === "voice") {
      if (!window.speechSynthesis) return;
      const speech = new SpeechSynthesisUtterance(
        "You did great. One little step at a time.",
      );
      speech.rate = 0.95;
      speech.pitch = 1.2;
      speech.volume = Math.min(0.8, volume);
      window.speechSynthesis.speak(speech);
      return () => window.speechSynthesis.cancel();
    }
    try {
      return playCompletionCue(volume);
    } catch {
      /* Device audio can be unavailable; the celebration remains usable. */
    }
  }, [open, sound, cue, volume]);
  return (
    <Dialog open={open}>
      <DialogContent
        className={`todo-celebration ${reduced ? "celebration-gentle" : ""}`}
        showCloseButton={false}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="celebration-stage" aria-hidden="true">
          <div className="celebration-halo" />
          <div className="celebration-confetti">
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} style={{ "--piece": i } as React.CSSProperties} />
            ))}
          </div>
          <div className="celebration-todo">
            <img
              src={
                female
                  ? C.poses.idle.replace(".png", "-pink.png")
                  : C.poses.idle
              }
              alt=""
              width={1254}
              height={1254}
            />
          </div>
          <span className="celebration-heart heart-left">♡</span>
          <span className="celebration-heart heart-right">♡</span>
        </div>
        <div className="celebration-message">
          <DialogTitle>You did it!</DialogTitle>
          <DialogDescription>
            You did great. Every little moment counts.
          </DialogDescription>
        </div>
        <div
          className="cinema-completion-stats"
          aria-label="Your focus this sit"
        >
          <span>
            <CountUp value={minutes} reduced={reduced} />
            minutes focused
          </span>
          <span>
            <CountUp value={tasksDone} reduced={reduced} />
            tasks finished
          </span>
        </div>
        <div className="celebration-choices">
          <Button
            className="celebration-break"
            disabled={busy}
            onClick={onBreak}
          >
            <Coffee size={17} />
            Take a break
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onContinue}>
            Continue focusing <ArrowRight size={16} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
