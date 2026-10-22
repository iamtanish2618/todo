"use client";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import "./presentation.css";
export function AboutContent() {
  return (
    <div className="todo-help-copy">
      <p>
        A little company for the work in front of you.
        <br />
        Todo sits beside you while you focus.
        <br />
        Invite friends, keep notes, or ask for one small next step.
      </p>
      <h3>Your first sit</h3>
      <ol>
        <li>Choose your companion and enter your room.</li>
        <li>Pick a task, click the clock, and choose your time.</li>
        <li>Focus together, then take a break when you&#39;re ready.</li>
      </ol>
      <h3>Your space</h3>
      <p>
        Quiet mode rests the room&#39;s motion and sounds. “I&#39;m stuck”
        offers a gentle starting point. Todo is a focus companion, not a medical
        tool.
      </p>
      <h3>Your privacy</h3>
      <p>
        Voice is live only and never recorded by Todo. Messages disappear when
        the table closes. Notes and tasks are saved to your Todo account.
        Material you send to the AI is processed by the configured AI provider.
      </p>
      <details>
        <summary>Credits &amp; licenses</summary>
        <p>
          Created by Tanish. Penguin and room artwork were created for Todo with
          AI image tools; no Creative Commons license is claimed for project
          artwork.
        </p>
        <p>
          White, brown, and rainy noise: recordings supplied by the project
          owner. Source licenses were not provided; redistribution permission is
          unverified. Completion and break voices use the macOS Samantha voice;
          no separate recording license is supplied. Chimes and interaction
          sounds are synthesized by Todo&#39;s code.
        </p>
        <p>
          <a href="/fonts/Nunito-OFL.txt">Nunito — SIL Open Font License 1.1</a>
          <br />
          <a href="/fonts/OFL.txt">Noto Sans — SIL Open Font License 1.1</a>
          <br />
          <a href="/fonts/katex/LICENSE.txt">KaTeX fonts — MIT</a>
        </p>
        <p>
          <a href="/audio/CREDITS.txt">Additional audio attribution</a> ·{" "}
          <a href="https://github.com/iamtanish2618/todo">Project repository</a>
        </p>
      </details>
    </div>
  );
}
export function AboutHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="todo-help-launch"
          aria-label="About and help"
        >
          <CircleHelp size={17} />
          <span>About Todo</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="todo-help-sheet">
        <DialogHeader>
          <DialogTitle>A little help, whenever you need it.</DialogTitle>
          <DialogDescription>
            Welcome to Todo, made by Tanish.
          </DialogDescription>
        </DialogHeader>
        <AboutContent />
      </DialogContent>
    </Dialog>
  );
}
