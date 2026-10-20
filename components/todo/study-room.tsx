"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  Coffee,
  CloudRain,
  Sun,
  FileDown,
  LampDesk,
  Layers,
  ListTodo,
  Loader2,
  Mic,
  Moon,
  Pause,
  Play,
  Plus,
  Send,
  Settings2,
  Share2,
  Sparkles,
  Timer as TimerIcon,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  api,
  type Task,
  type Note,
  type FocusSession,
  type Connection,
} from "@/lib/todo/client";
import type { Panel } from "./welcome";
import { ROOM_CONFIG as C, zoneStyle, type RoomPose } from "./room/config";
import { RoomScene } from "./room/scene";
import { RoomChat } from "./room/chat";
import { startSoundscape, type Soundscape } from "./room/ambience";
import { makeRoomPDF } from "./room/pdf";
import "./room/room.css";
import "./room/scene.css";
import "./room/calm.css";

type Pane =
  | "focus"
  | "ambience"
  | "tasks"
  | "notes"
  | "agent"
  | "settings"
  | "month"
  | "corner"
  | "friends"
  | "home"
  | "break"
  | "recap";
type Card = { id: string; question: string; answer: string };
type Summary = {
  minutes: number;
  sits: number;
  tasksDone: number;
  totalSits: number;
};
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
  remaining: number;
  duration: number;
  focusMinutes: number;
  startedAt?: number;
  focusCompletions: number;
  onBreak: () => void;
  userId: string;
  tasks: Task[];
  notes: Note[];
  sessions: FocusSession[];
  connection: Connection | null;
  sound: boolean;
  onTasks: (tasks: Task[]) => void;
  onNotes: (notes: Note[]) => void;
  onDuration: (minutes: number) => void;
  onReduced: (value: boolean) => void;
  onSound: (value: boolean) => void;
  onBusy: (value: boolean) => void;
  onAgentMode: (mode: boolean) => void;
  onTask: (task: string, begin?: boolean) => void;
  onStart: () => void;
  onFinish: () => Promise<boolean>;
  onExit: () => void;
  onPanel: (panel: Panel) => void;
};

type SpeechResult = {
  results: { [index: number]: { [index: number]: { transcript: string } } };
};
type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechResult) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function StudyRoom(p: Props) {
  const [focusTime, setFocusTime] = useState("25");
  const quietFocus = p.running && p.phase === "focus";
  const [pane, setPane] = useState<Pane | null>(null),
    [loaded, setLoaded] = useState(false),
    [loadError, setLoadError] = useState(""),
    [retry, setRetry] = useState(0),
    [debug, setDebug] = useState(false);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState(""),
    [filter, setFilter] = useState("all"),
    [chosen, setChosen] = useState<string[]>([]);
  const [noteTitle, setNoteTitle] = useState(""),
    [noteText, setNoteText] = useState(""),
    [noteView, setNoteView] = useState<"write" | "saved" | "cards">("write");
  const [cards, setCards] = useState<Card[]>([]),
    [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState(""),
    [flipped, setFlipped] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null),
    [recap, setRecap] = useState({ minutes: 0, tasks: 0 }),
    [tone, setTone] = useState(() =>
      new Date().getHours() >= 18 || new Date().getHours() < 7
        ? "night"
        : "morning",
    ),
    [rain, setRain] = useState(false),
    [soundscape, setSoundscape] = useState<Soundscape>("off"),
    [volume, setVolume] = useState(0.25),
    [sleeping, setSleeping] = useState(false);
  const [joining, setJoining] = useState("todo"),
    [friendCode, setFriendCode] = useState(""),
    [friendNotice, setFriendNotice] = useState("");
  const [connection, setConnection] = useState(p.connection),
    [resting, setResting] = useState(false),
    [speechAvailable, setSpeechAvailable] = useState(false),
    [listening, setListening] = useState(false);
  const ambienceAudio =
    useRef<Awaited<ReturnType<typeof startSoundscape>>>(null);
  const audioGeneration = useRef(0);
  const soundLoad = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!p.active) {
      soundLoad.current?.abort();
      audioGeneration.current++;
      ambienceAudio.current?.stop();
      ambienceAudio.current = null;
      setSoundscape("off");
    }
    return () => {
      soundLoad.current?.abort();
      audioGeneration.current++;
      ambienceAudio.current?.stop();
      ambienceAudio.current = null;
    };
  }, [p.active]);
  const changeSoundscape = async (kind: Soundscape) => {
    soundLoad.current?.abort();
    const controller = new AbortController();
    soundLoad.current = controller;
    const generation = ++audioGeneration.current;
    ambienceAudio.current?.stop();
    ambienceAudio.current = null;
    setSoundscape(kind);
    try {
      const audio = await startSoundscape(kind, volume, controller.signal);
      if (generation !== audioGeneration.current) {
        audio?.stop();
        return;
      }
      ambienceAudio.current = audio;
      soundLoad.current = null;
    } catch {
      if (controller.signal.aborted) return;
      setSoundscape("off");
      setError("Sound could not start. Please try again.");
    }
  };
  const recognizer = useRef<Recognition | null>(null),
    baseline = useRef(0),
    roomRoot = useRef<HTMLElement>(null),
    latest = useRef(p);
  latest.current = p;
  const storageKey = `todo.room.focus.${p.userId}`;
  useEffect(() => {
    setDebug(new URLSearchParams(location.search).get("debug") === "1");
    setSpeechAvailable(
      Boolean(
        (
          window as unknown as {
            SpeechRecognition?: unknown;
            webkitSpeechRecognition?: unknown;
          }
        ).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: unknown })
          .webkitSpeechRecognition,
      ),
    );
    return () => recognizer.current?.stop();
  }, []);
  useEffect(() => {
    let stopped = false;
    const room = new Image(),
      idle = new Image(),
      day = new Image();
    room.src = C.image;
    day.src = C.dayImage;
    idle.src = p.female
      ? C.poses.idle.replace(".png", "-pink.png")
      : C.poses.idle;
    Promise.all([room.decode(), idle.decode(), day.decode()])
      .then(() => {
        if (!stopped) setLoaded(true);
      })
      .catch(() => {
        if (!stopped) setLoadError("Your room could not load. Try again?");
      });
    return () => {
      stopped = true;
    };
  }, [retry, p.female]);
  useEffect(() => {
    setConnection(p.connection);
    setResting(Boolean(p.connection?.quota?.resting));
  }, [p.connection]);
  const refresh = useCallback(async () => {
    const [stats, status, flashcards] = await Promise.allSettled([
      api<Summary>("/api/room-summary"),
      api<Connection>("/api/status"),
      api<Card[]>("/api/flashcards"),
    ]);
    if (stats.status === "fulfilled") setSummary(stats.value);
    if (status.status === "fulfilled") {
      setConnection(status.value);
      setResting(Boolean(status.value.quota?.resting));
    }
    if (flashcards.status === "fulfilled") setCards(flashcards.value);
  }, []);
  useEffect(() => {
    if (!p.active) return;
    void refresh();
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    let timeout: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const midnight = new Date();
      midnight.setUTCHours(24, 0, 0, 50);
      timeout = setTimeout(
        () => {
          void refresh();
          scheduleMidnight();
        },
        Math.max(1, midnight.getTime() - Date.now()),
      );
    };
    scheduleMidnight();
    return () => {
      window.removeEventListener("focus", focus);
      clearTimeout(timeout);
    };
  }, [p.active, refresh]);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (Array.isArray(stored))
        setChosen(stored.filter((x) => typeof x === "string").slice(0, 3));
    } catch {}
  }, [storageKey]);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(chosen));
    } catch {}
  }, [chosen, storageKey]);
  useEffect(() => {
    if (resting) {
      p.onAgentMode(false);
      setPane((v) => (v === "agent" ? null : v));
    }
  }, [resting, p.onAgentMode]);
  useEffect(() => {
    if (p.focusCompletions > 0) {
      setRecap({
        minutes: p.focusMinutes,
        tasks: p.tasks.filter(
          (t) =>
            t.done &&
            t.completedAt &&
            t.completedAt >= (p.startedAt || Date.now()),
        ).length,
      });
      setPane("recap");
      void refresh();
    }
  }, [p.focusCompletions, refresh]);
  useEffect(() => {
    if (!p.active) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (latest.current.running && latest.current.phase === "focus") {
          latest.current.onStart();
        }
        setPane(null);
        setError("");
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [p.active]);
  useEffect(() => {
    if (!quietFocus) return;
    roomRoot.current
      ?.querySelector<HTMLButtonElement>(".round-timer-face")
      ?.focus({ preventScroll: true });
    // Keep the setup mounted just long enough to dissolve with the other tools.
    const dismiss = setTimeout(() => setPane(null), p.reduced ? 0 : 650);
    return () => clearTimeout(dismiss);
  }, [quietFocus, p.reduced]);
  const show = (next: Pane) => {
    setError("");
    setPane((current) => (current === next ? null : next));
  };
  const work = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "That did not save. Your words are still here.",
      );
    } finally {
      setBusy(false);
    }
  };
  const addTask = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    void work(async () => {
      const task = await api<Task>("/api/tasks", "POST", { title: draft });
      p.onTasks([task, ...p.tasks]);
      if (!p.started && !p.task) p.onTask(task.title);
      setDraft("");
    });
  };
  const toggle = async (task: Task) => {
    await work(async () => {
      const next = await api<Task>("/api/tasks", "PATCH", {
        id: task.id,
        done: !task.done,
      });
      p.onTasks(p.tasks.map((t) => (t.id === next.id ? next : t)));
      if (next.done) setChosen((v) => v.filter((id) => id !== next.id));
      void refresh();
      if (
        next.done &&
        chosen.includes(next.id) &&
        p.started &&
        p.phase === "focus"
      ) {
        const minutes = Math.max(
          0,
          Math.round((p.duration - p.remaining) / 60),
        );
        if (await p.onFinish()) {
          setRecap({ minutes, tasks: 1 });
          setPane("recap");
        }
      }
    });
  };
  const focusTask = (task: Task) => {
    if (chosen.includes(task.id))
      setChosen((v) => v.filter((id) => id !== task.id));
    else if (chosen.length < 3) {
      setChosen((v) => [...v, task.id]);
      if (!p.started && !p.task) p.onTask(task.title);
    } else
      setError(
        "Three is a good little handful. Put one back to choose another.",
      );
  };
  const dictate = () => {
    const w = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const Constructor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Constructor) return;
    if (listening) {
      recognizer.current?.stop();
      return;
    }
    const recognition = new Constructor();
    recognizer.current = recognition;
    recognition.lang = navigator.language;
    recognition.interimResults = false;
    recognition.onresult = (e) =>
      setDraft((v) =>
        (v + " " + e.results[0][0].transcript).trim().slice(0, 180),
      );
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setError("Dictation could not start. You can still type your task.");
    };
    try {
      recognition.start();
      setListening(true);
    } catch {
      setError("Dictation is unavailable here. Try typing instead.");
    }
  };
  const saveNote = () =>
    void work(async () => {
      const note = await api<Note>("/api/notes", "POST", {
        title: noteTitle || "A little note",
        content: noteText,
      });
      p.onNotes([note, ...p.notes]);
      setNoteTitle("");
      setNoteText("");
      setNoteView("saved");
    });
  const exportNote = () =>
    void work(() => makeRoomPDF(noteTitle || "A little note", noteText));
  const beginFocus = () => {
    const tasks = chosen
      .map((id) => p.tasks.find((t) => t.id === id && !t.done))
      .filter((t): t is Task => Boolean(t));
    if (!tasks.length) {
      setError("Add your tasks and choose up to three before starting.");
      setPane("tasks");
      return;
    }
    setFocusTime(String(p.duration / 60));
    setError("");
    setPane("focus");
  };
  // Duration is queued before the start updater, so the deadline uses the new time.
  const launchFocus = (event: FormEvent) => {
    event.preventDefault();
    const minutes = Number(focusTime);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) {
      setError("Choose a whole number from 1 to 120 minutes.");
      return;
    }
    const task = chosen
      .map((id) => p.tasks.find((t) => t.id === id && !t.done))
      .find(Boolean);
    if (!task) {
      setError("Choose at least one task first.");
      setPane("tasks");
      return;
    }
    p.onDuration(minutes);
    p.onTask(task.title, true);
    baseline.current = p.tasks.filter((t) => t.done).length;
  };
  const sit = (e: FormEvent) => {
    e.preventDefault();
    setPane("tasks");
  };
  const done = () =>
    void work(async () => {
      if (p.phase === "break") {
        if (await p.onFinish()) setPane(null);
        return;
      }
      const minutes = Math.max(0, Math.round((p.duration - p.remaining) / 60)),
        count = p.startedAt
          ? p.tasks.filter(
              (t) => t.done && t.completedAt && t.completedAt >= p.startedAt!,
            ).length
          : Math.max(
              0,
              p.tasks.filter((t) => t.done).length - baseline.current,
            );
      if (await p.onFinish()) {
        setRecap({ minutes, tasks: count });
        setPane("recap");
        await refresh();
      }
    });
  const mode = (agent: boolean) => {
    if (agent && resting) return;
    p.onAgentMode(agent);
    setSleeping(false);
    setPane(agent ? "agent" : null);
  };
  const rest = useCallback(() => {
    setResting(true);
    latest.current.onAgentMode(false);
    setPane(null);
    setConnection((c) =>
      c
        ? { ...c, quota: c.quota ? { ...c.quota, resting: true } : undefined }
        : c,
    );
  }, []);
  const pose: RoomPose = p.agentBusy
    ? "typing"
    : p.running
      ? p.phase === "break"
        ? "tea"
        : "writing"
      : p.phase === "break"
        ? "tea"
        : sleeping
          ? "sleeping"
          : "idle";
  const visibleTasks = p.tasks.filter(
    (t) => filter === "all" || (filter === "done" ? t.done : !t.done),
  );
  const selected = chosen
    .map((id) => p.tasks.find((t) => t.id === id && !t.done))
    .filter((t): t is Task => Boolean(t));
  const totalSits = summary?.totalSits || p.sessions.length;
  const keepsakes = [
    {
      at: 1,
      name: "The Little Lamp",
      Icon: LampDesk,
      detail: "For the first time you made a little room for yourself.",
    },
    {
      at: 3,
      name: "The Full Table",
      Icon: Coffee,
      detail: "A few quiet sits, a familiar place to return to.",
    },
    {
      at: 5,
      name: "The Open Book",
      Icon: BookOpen,
      detail: "For all the little pages you have turned.",
    },
  ].filter((k) => totalSits >= k.at);
  const share = async () => {
    const text = `A little sit with Todo. ${recap.minutes} minutes of company, ${recap.tasks} ${recap.tasks === 1 ? "task" : "tasks"} finished. One small step was enough.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "My Todo keepsake", text });
      } catch {}
      return;
    }
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "a-little-sit-with-todo.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const close = () => {
    setPane(null);
    setError("");
  };
  const panelTitle: Record<Pane, string> = {
    focus: "A little time for you.",
    ambience: "Set the mood.",
    tasks: "Things waiting",
    notes: "Your little notebook.",
    agent: "A little help.",
    settings: "Make yourself comfortable.",
    month: "This month",
    corner: "Your corner",
    friends: "Bring friends to the table.",
    home: "Who is joining?",
    break: "A little breather.",
    recap: "Session complete",
  };
  const panelContent = () => {
    switch (pane) {
      case "focus":
        return (
          <form className="room-focus-form" onSubmit={launchFocus}>
            <p className="room-helper">
              {selected.length} {selected.length === 1 ? "task" : "tasks"}{" "}
              chosen. Todo will work beside you.
            </p>
            <label className="room-field" htmlFor="focus-minutes">
              How long shall we focus?
            </label>
            <div className="room-minute-field">
              <Input
                id="focus-minutes"
                aria-label="Focus minutes"
                type="number"
                min={1}
                max={120}
                step={1}
                required
                value={focusTime}
                onChange={(e) => {
                  setFocusTime(e.target.value);
                  setError("");
                }}
              />
              <span>minutes</span>
            </div>
            <div
              className="room-time-presets"
              role="group"
              aria-label="Suggested focus times"
            >
              {[15, 25, 45].map((minutes) => (
                <Button
                  key={minutes}
                  type="button"
                  variant="ghost"
                  aria-pressed={Number(focusTime) === minutes}
                  onClick={() => setFocusTime(String(minutes))}
                >
                  {minutes} min
                </Button>
              ))}
            </div>
            <p className="room-focus-intention">
              {selected.map((task) => task.title).join(" · ")}
            </p>
            <p className="room-helper">
              The room will settle into quiet. Click the clock or press Escape
              to pause.
            </p>
            <Button
              type="submit"
              className="room-dark-button room-focus-launch"
            >
              Focus <ArrowRight size={16} />
            </Button>
          </form>
        );
      case "ambience":
        return (
          <>
            <p className="room-helper">A little atmosphere, at your pace.</p>
            <div
              className="room-mini-tabs"
              role="group"
              aria-label="Time of day"
            >
              <Button
                variant="ghost"
                aria-pressed={tone === "morning"}
                onClick={() => setTone("morning")}
              >
                <Sun size={16} />
                Day
              </Button>
              <Button
                variant="ghost"
                aria-pressed={tone === "night"}
                onClick={() => setTone("night")}
              >
                <Moon size={16} />
                Night
              </Button>
            </div>
            <label className="room-setting">
              <span>Rain outside</span>
              <Switch checked={rain} onCheckedChange={setRain} />
            </label>
            <label className="room-field">
              Soft sounds
              <select
                aria-label="Soft sounds"
                value={soundscape}
                onChange={(e) =>
                  void changeSoundscape(e.target.value as Soundscape)
                }
              >
                <option value="off">Quiet · sound off</option>
                <option value="day">Morning · soft ambient</option>
                <option value="night">Night · warm hush</option>
                <option value="rain">Soft rain</option>
              </select>
            </label>
            <label className="room-field">
              Volume
              <input
                aria-label="Ambience volume"
                type="range"
                min="0"
                max="1"
                step=".01"
                value={volume}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setVolume(value);
                  ambienceAudio.current?.setVolume(value);
                }}
              />
            </label>
            <p className="room-helper">
              Sounds play only when you choose them. You can keep the room
              completely quiet.
            </p>
          </>
        );

      case "tasks":
        return (
          <>
            <label className="room-field">
              <span className="sr-only">Task filter</span>
              <select
                aria-label="Task filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All tasks</option>
                <option value="waiting">Waiting</option>
                <option value="done">Finished</option>
              </select>
            </label>
            <p className="room-helper">Pick up to three to keep you company.</p>
            <div className="room-task-list">
              {visibleTasks.length ? (
                visibleTasks.map((task) => (
                  <div
                    className={`room-task-row ${task.done ? "task-finished" : ""} ${chosen.includes(task.id) ? "task-selected" : ""}`}
                    key={task.id}
                  >
                    <button
                      className="room-task-select"
                      aria-label={
                        task.done
                          ? `Reopen ${task.title}`
                          : `Focus on ${task.title}`
                      }
                      aria-pressed={task.done || chosen.includes(task.id)}
                      disabled={busy}
                      onClick={() =>
                        task.done ? void toggle(task) : focusTask(task)
                      }
                    >
                      <span className="room-task-number">
                        {task.done ? (
                          <Check size={13} />
                        ) : chosen.includes(task.id) ? (
                          chosen.indexOf(task.id) + 1
                        ) : (
                          "+"
                        )}
                      </span>
                      <span>{task.title}</span>
                      {task.done ? <small>Finished</small> : null}
                    </button>
                    {!task.done ? (
                      <button
                        className="room-task-check"
                        aria-label={`Complete ${task.title}`}
                        title="Mark finished"
                        disabled={busy}
                        onClick={() => void toggle(task)}
                      >
                        <Check size={13} />
                      </button>
                    ) : null}
                    <button
                      className="room-task-delete"
                      aria-label={`Delete ${task.title}`}
                      disabled={busy}
                      onClick={() =>
                        void work(async () => {
                          await api("/api/tasks", "DELETE", { id: task.id });
                          p.onTasks(p.tasks.filter((t) => t.id !== task.id));
                          setChosen((v) => v.filter((id) => id !== task.id));
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="room-empty">
                  Nothing here yet. Leave a thought below.
                </p>
              )}
            </div>
            {p.tasks.filter((t) => !t.done).length > 3 ? (
              <p className="room-helper">
                +{p.tasks.filter((t) => !t.done).length - 3} more in your list
              </p>
            ) : null}
            <form className="room-task-input" onSubmit={addTask}>
              <Input
                aria-label="New task"
                placeholder="Drop it here…"
                value={draft}
                maxLength={180}
                onChange={(e) => setDraft(e.target.value)}
              />
              {speechAvailable ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={listening ? "Stop dictation" : "Dictate a task"}
                  onClick={dictate}
                >
                  <Mic size={16} />
                </Button>
              ) : null}
              <Button
                size="icon"
                className="room-dark-button"
                disabled={!draft.trim() || busy}
                aria-label="Add task"
              >
                <Send size={16} />
              </Button>
            </form>
            <Button
              className="room-dark-button"
              disabled={!selected.length}
              onClick={
                p.started
                  ? () => {
                      close();
                    }
                  : beginFocus
              }
            >
              {p.started ? "Back to the table" : "Choose timer"}
              <ArrowRight size={16} />
            </Button>
          </>
        );
      case "notes":
        return (
          <>
            <div
              className="room-mini-tabs"
              role="group"
              aria-label="Notebook sections"
            >
              {(["write", "saved", "cards"] as const).map((view) => (
                <Button
                  variant="ghost"
                  key={view}
                  aria-pressed={noteView === view}
                  onClick={() => setNoteView(view)}
                >
                  {view === "write"
                    ? "Write"
                    : view === "saved"
                      ? "Saved"
                      : "Flashcards"}
                </Button>
              ))}
            </div>
            {noteView === "write" ? (
              <>
                <label className="room-field">
                  Upload study notes (.txt or .md)
                  <input
                    type="file"
                    aria-label="Upload study notes"
                    accept=".txt,.md,text/plain,text/markdown"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      e.target.value = "";
                      if (
                        file.size > 150000 ||
                        !/\.(txt|md)$/i.test(file.name)
                      ) {
                        setError(
                          "Choose a text or Markdown file up to 150 KB.",
                        );
                        return;
                      }
                      void file
                        .text()
                        .then((text) => {
                          if (text.length > 50000) {
                            setError(
                              "Keep uploaded notes under 50,000 characters.",
                            );
                            return;
                          }
                          setNoteTitle(file.name.replace(/\.[^.]+$/, ""));
                          setNoteText(text);
                        })
                        .catch(() => setError("That file could not be read."));
                    }}
                  />
                </label>
                <label className="room-field">
                  Title
                  <Input
                    aria-label="Note title"
                    value={noteTitle}
                    maxLength={160}
                    placeholder="A thought to keep"
                    onChange={(e) => setNoteTitle(e.target.value)}
                  />
                </label>
                <label className="room-field">
                  Your notes
                  <Textarea
                    aria-label="Your notes"
                    value={noteText}
                    maxLength={50000}
                    placeholder="Start anywhere…"
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                </label>
                <div className="room-button-row">
                  <Button
                    className="room-dark-button"
                    disabled={!noteText.trim() || busy}
                    onClick={saveNote}
                  >
                    Save note
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!noteText.trim() || busy}
                    onClick={exportNote}
                  >
                    <FileDown size={16} />
                    Make a PDF
                  </Button>
                </div>
              </>
            ) : noteView === "saved" ? (
              <div className="room-saved-notes">
                {p.notes.length ? (
                  p.notes.map((note) => (
                    <article key={note.id}>
                      <h3>{note.title}</h3>
                      <p>{note.content.slice(0, 180)}</p>
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setNoteTitle(note.title);
                            setNoteText(note.content);
                            setNoteView("write");
                          }}
                        >
                          Open
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            void work(() =>
                              makeRoomPDF(note.title, note.content),
                            )
                          }
                        >
                          PDF
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete note ${note.title}`}
                          onClick={() =>
                            void work(async () => {
                              await api("/api/notes", "DELETE", {
                                id: note.id,
                              });
                              p.onNotes(
                                p.notes.filter((n) => n.id !== note.id),
                              );
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="room-empty">
                    A small place for the thoughts you want to keep.
                  </p>
                )}
              </div>
            ) : (
              <>
                <p className="room-helper">
                  Cards you write yourself. No AI needed.
                </p>
                {cards.map((card) => (
                  <article className="room-flashcard" key={card.id}>
                    <button
                      onClick={() =>
                        setFlipped(flipped === card.id ? null : card.id)
                      }
                      aria-label={`Flip card: ${card.question}`}
                    >
                      {flipped === card.id ? card.answer : card.question}
                      <small>
                        {flipped === card.id
                          ? "ANSWER"
                          : "QUESTION · TAP TO TURN"}
                      </small>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete flashcard ${card.question}`}
                      onClick={() =>
                        void work(async () => {
                          await api("/api/flashcards", "DELETE", {
                            id: card.id,
                          });
                          setCards((v) => v.filter((c) => c.id !== card.id));
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
                  </article>
                ))}
                <label className="room-field">
                  Question
                  <Input
                    value={question}
                    maxLength={500}
                    onChange={(e) => setQuestion(e.target.value)}
                  />
                </label>
                <label className="room-field">
                  Answer
                  <Textarea
                    value={answer}
                    maxLength={2000}
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                </label>
                <Button
                  className="room-dark-button"
                  disabled={!question.trim() || !answer.trim() || busy}
                  onClick={() =>
                    void work(async () => {
                      const card = await api<Card>("/api/flashcards", "POST", {
                        question,
                        answer,
                      });
                      setCards((v) => [card, ...v]);
                      setQuestion("");
                      setAnswer("");
                    })
                  }
                >
                  <Plus size={16} />
                  Keep this card
                </Button>
              </>
            )}
          </>
        );
      case "settings":
        return (
          <>
            <label className="room-setting">
              <span>Gentler motion</span>
              <Switch checked={p.reduced} onCheckedChange={p.onReduced} />
            </label>
            <label className="room-setting">
              <span>Little sound effects</span>
              <Switch checked={p.sound} onCheckedChange={p.onSound} />
            </label>
            <label className="room-field">
              Room light
              <select value={tone} onChange={(e) => setTone(e.target.value)}>
                <option value="evening">Warm evening</option>
                <option value="night">Quiet night</option>
                <option value="morning">Soft morning</option>
              </select>
            </label>
            <Button variant="outline" onClick={() => setSleeping((v) => !v)}>
              <Moon size={16} />
              {sleeping ? "Wake Todo gently" : "Let Todo rest"}
            </Button>
            <div className="room-settings-links">
              {[
                ["home", Users, "Who is joining?"],
                ["month,", TimerIcon, "This month"],
                ["corner", LampDesk, "Your corner"],
                ["friends", Users, "Bring friends"],
              ].map(([id, Icon, label]) => {
                const I = Icon as typeof Users;
                return (
                  <Button
                    variant="ghost"
                    key={String(id)}
                    onClick={() => setPane(String(id).replace(",", "") as Pane)}
                  >
                    <I size={17} />
                    {String(label)}
                    <ArrowRight size={15} />
                  </Button>
                );
              })}
            </div>
          </>
        );
      case "month":
        return (
          <>
            <p className="room-helper">Little moments, quietly adding up.</p>
            <div className="room-month-counters">
              {[
                ["minutes", summary?.minutes || 0],
                ["sits", summary?.sits || 0],
                ["tasks done", summary?.tasksDone || 0],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <p className="room-empty">
              There’s no pace to keep up with. Just your own.
            </p>
          </>
        );
      case "corner":
        return (
          <>
            <p className="room-helper">
              Small reminders of time you made for yourself.
            </p>
            {keepsakes.length ? (
              keepsakes.map((k) => (
                <article className="room-collectible" key={k.name}>
                  <k.Icon size={32} />
                  <h3>{k.name}</h3>
                  <p>{k.detail}</p>
                </article>
              ))
            ) : (
              <p className="room-empty">
                After your first sit, a little lamp will find its way onto your
                shelf.
              </p>
            )}
          </>
        );
      case "friends":
        return (
          <>
            <p className="room-helper">A place for good company.</p>
            <div
              className="room-friend-table"
              aria-label="Preview of a table for you and your friends"
            >
              <span>you</span>
              <i />
              <span>friend</span>
              <span>friend</span>
            </div>
            <label className="room-field">
              Join with a code
              <Input
                aria-label="Friend room code"
                value={friendCode}
                placeholder="Your room code"
                onChange={(e) => setFriendCode(e.target.value)}
              />
            </label>
            <Button
              className="room-dark-button"
              disabled={!friendCode.trim()}
              onClick={() =>
                setFriendNotice(
                  "Shared rooms and microphones are still being built. This table is a preview; no room has been joined.",
                )
              }
            >
              Join room
            </Button>
            <p className="room-soft-notice">
              {friendNotice ||
                "A preview for now. Shared rooms and voice are coming later."}
            </p>
            <Button variant="ghost" onClick={() => setPane("home")}>
              Sit with Todo for now <ArrowRight size={15} />
            </Button>
          </>
        );
      case "home":
        return (
          <>
            <div
              className="room-mini-tabs"
              role="group"
              aria-label="Who is joining?"
            >
              {["todo", "friends"].map((v) => (
                <Button
                  key={v}
                  variant="ghost"
                  aria-pressed={joining === v}
                  onClick={() => setJoining(v)}
                >
                  {v === "todo" ? "Todo" : "Friends"}
                </Button>
              ))}
            </div>
            <label className="room-field">
              What are we working on?
              <Input
                value={p.task}
                maxLength={180}
                onChange={(e) => p.onTask(e.target.value)}
              />
            </label>
            <Button
              className="room-dark-button"
              onClick={() =>
                joining === "friends"
                  ? setPane("friends")
                  : p.task.trim()
                    ? beginFocus()
                    : setError("Give this sit one small intention first.")
              }
            >
              {joining === "friends" ? "Bring friends" : "Sit with Todo"}
              <ArrowRight size={16} />
            </Button>
          </>
        );
      case "break":
        return (
          <>
            <Coffee size={42} className="room-break-cup" />
            <p className="room-empty">
              Stretch a little. Sip something warm. Todo will be right here.
            </p>
            {p.phase === "break" ? (
              <Button
                className="room-dark-button"
                onClick={() => {
                  p.onStart();
                  close();
                }}
              >
                {p.running ? "Pause break" : "Take five minutes"}
              </Button>
            ) : (
              <p className="room-helper">
                Your break is ready after a full focus session.
              </p>
            )}
            <Button variant="ghost" onClick={close}>
              Stay in the room
            </Button>
          </>
        );
      case "recap":
        return (
          <>
            <span className="room-recap-check">
              <Check size={28} />
            </span>
            <h3 className="room-recap-kind">You did great.</h3>
            <div className="room-recap-stats">
              <span>
                <strong>{recap.minutes}</strong>minutes
              </span>
              <span>
                <strong>{recap.tasks}</strong>tasks done
              </span>
            </div>
            <p className="room-helper">Your time together is saved.</p>
            <Button
              className="room-dark-button"
              onClick={() => {
                p.onBreak();
                setPane("break");
              }}
            >
              Todo, take a break <Coffee size={16} />
            </Button>
            <Button variant="ghost" onClick={() => void share()}>
              <Share2 size={16} />
              Share keepsake
            </Button>
          </>
        );
      default:
        return null;
    }
  };
  if (!p.active) return null;
  return (
    <section
      ref={roomRoot}
      className={`cozy-room ${p.active ? "cozy-room-active" : ""} ${p.reduced ? "cozy-room-reduced" : ""}`}
      aria-label="Your shared Todo workspace"
      aria-hidden={!p.active}
      inert={!p.active}
      data-character={p.female ? "female" : "male"}
      data-mode={p.agentMode ? "agent" : "companion"}
      data-loaded={loaded}
      data-tone={tone}
      data-rain={rain}
      data-working={quietFocus}
      data-quiet={quietFocus}
    >
      <link rel="preload" href={C.image} as="image" />
      <div
        className="cozy-room-backdrop"
        style={{ backgroundImage: `url(${C.image})` }}
        aria-hidden="true"
      />
      <div className="cozy-room-stage">
        <div className="room-scene-world">
          <RoomScene
            pose={pose}
            female={p.female}
            reduced={p.reduced}
            active={p.active && loaded}
            day={tone === "morning"}
            focusing={quietFocus}
          />
          <div
            className="room-table-clock round-timer"
            aria-label={`Table timer ${p.clock}`}
          >
            <span className="round-timer-shadow" aria-hidden="true" />
            <span className="round-timer-feet" aria-hidden="true" />
            <span className="round-timer-case" aria-hidden="true" />
            <button
              className="round-timer-face"
              aria-label={
                p.running
                  ? "Pause table timer"
                  : p.started
                    ? "Resume table timer"
                    : "Start table timer"
              }
              onClick={() => {
                if (p.started || p.phase === "break") {
                  close();
                  p.onStart();
                } else beginFocus();
              }}
            >
              <svg
                viewBox="0 0 120 120"
                className="round-timer-dial"
                aria-hidden="true"
              >
                <circle cx="60" cy="60" r="53" />
                <circle
                  cx="60"
                  cy="60"
                  r="47"
                  pathLength="60"
                  strokeDasharray=".25 .75"
                />
                <circle
                  className="round-timer-progress"
                  cx="60"
                  cy="60"
                  r="53"
                  pathLength="100"
                  strokeDasharray="100"
                  strokeDashoffset={100 * (1 - p.remaining / p.duration)}
                />
              </svg>
              <span className="round-timer-label">
                {p.phase === "break" ? "BREATHE" : "QUIET FOCUS"}
              </span>
              <strong>{p.clock}</strong>
              <span className="round-timer-action">
                {p.running ? <Pause size={12} /> : <Play size={12} />}
              </span>
            </button>
            {p.started && !quietFocus ? (
              <button
                className="round-timer-done"
                aria-label={
                  p.phase === "break" ? "Finish break" : "Finish focus session"
                }
                onClick={done}
                disabled={busy}
              >
                <Check size={14} />
              </button>
            ) : null}
          </div>
        </div>
        <p className="sr-only" role="status">
          {quietFocus
            ? "Focus has started. Click the clock or press Escape to pause and show the room controls."
            : ""}
        </p>
        <Button
          data-room-ui="back"
          inert={quietFocus}
          variant="ghost"
          size="icon"
          className="room-nav-back"
          aria-label="Choose companion"
          onClick={() => {
            close();
            p.onExit();
          }}
        >
          <ArrowLeft size={18} />
        </Button>
        <div
          className="room-mode-toggle"
          data-room-ui="mode"
          inert={quietFocus}
          role="group"
          aria-label="Todo mode"
        >
          <Button
            variant="ghost"
            aria-pressed={!p.agentMode}
            onClick={() => mode(false)}
          >
            Companion
          </Button>
          <Button
            variant="ghost"
            aria-pressed={p.agentMode}
            disabled={resting}
            onClick={() => mode(true)}
          >
            <Sparkles size={14} />
            Agent
          </Button>
        </div>
        <Button
          data-room-ui="settings"
          inert={quietFocus}
          variant="ghost"
          size="icon"
          className="room-nav-settings"
          aria-label="Open room settings"
          onClick={() => show("settings")}
        >
          <Settings2 size={18} />
        </Button>
        <nav
          className="room-edge-tabs"
          data-room-ui="tools"
          inert={quietFocus}
          aria-label="Room tools"
        >
          {[
            ["ambience", CloudRain, "Ambience"],
            ["tasks", ListTodo, "Tasks"],
            ["notes", BookOpen, "Notes"],
            ["friends", Users, "Invite friends"],
          ].map(([id, Icon, label]) => {
            const I = Icon as typeof TimerIcon;
            return (
              <button
                key={String(id)}
                className={`room-edge-tab room-edge-${id}`}
                aria-expanded={pane === id}
                onClick={() => show(id as Pane)}
              >
                <I size={17} />
                <span>{String(label)}</span>
              </button>
            );
          })}
        </nav>
        <div
          className="room-home-card"
          data-room-ui="home"
          inert={quietFocus}
          style={zoneStyle(C.home)}
        >
          {!p.started && p.phase === "focus" ? (
            <form onSubmit={sit}>
              <span className="room-eyebrow">TODAY</span>
              <h1>What are we working on?</h1>
              <div className="room-intention-form">
                <p className="room-helper">
                  {selected.length
                    ? `${selected.length} ${selected.length === 1 ? "task" : "tasks"} chosen. Your table is ready.`
                    : "Write your tasks. Choose up to three."}
                </p>
                <Button className="room-dark-button">
                  {selected.length ? "Edit your tasks" : "Sit with Todo"}
                  <ArrowRight size={15} />
                </Button>
                {selected.length && !pane ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="room-choose-time"
                    onClick={beginFocus}
                  >
                    Choose timer <TimerIcon size={15} />
                  </Button>
                ) : null}
              </div>
            </form>
          ) : (
            <div className="room-sit-status">
              <div>
                <span className="room-eyebrow">
                  {p.phase === "break"
                    ? "A LITTLE BREATHER"
                    : "YOUR LITTLE SIT"}
                </span>
                <h2>{p.task || "A moment just for you."}</h2>
              </div>
              <Button
                variant="ghost"
                onClick={done}
                disabled={busy}
                aria-label={p.phase === "break" ? "End break" : "Done for now"}
              >
                {p.phase === "break" ? "End break" : "Done for now"}
                <Check size={16} />
              </Button>
            </div>
          )}
        </div>
        {p.agentBusy || resting ? (
          <p
            className={`room-speech-pill ${resting ? "room-rest-message" : ""}`}
            style={zoneStyle(C.bubble)}
            role="status"
          >
            {p.agentBusy ? (
              <>
                Todo is working
                <span className="room-thinking-dots">
                  <i />
                  <i />
                  <i />
                </span>
              </>
            ) : (
              C.restMessage
            )}
          </p>
        ) : null}
        {keepsakes.length ? (
          <div
            className="room-shelf-keepsakes"
            inert={quietFocus}
            aria-label="Keepsakes on your shelf"
          >
            {keepsakes.map((k) => (
              <button
                key={k.name}
                aria-label={k.name}
                title={k.name}
                onClick={() => setPane("corner")}
              >
                <k.Icon size={18} />
              </button>
            ))}
          </div>
        ) : null}
        {debug ? (
          <div className="room-debug" aria-hidden="true">
            {Object.entries(C.zones).map(([name, z]) => (
              <div key={name} style={zoneStyle(z)}>
                <span>{name}</span>
              </div>
            ))}
            <div style={zoneStyle(C.penguin)}>
              <span>penguin</span>
            </div>
            <div style={zoneStyle(C.panel)}>
              <span>panel safe area</span>
            </div>
          </div>
        ) : null}
        <DialogPrimitive.Root
          open={Boolean(pane)}
          onOpenChange={(open) => {
            if (!open) close();
          }}
          modal={false}
        >
          {pane ? (
            <DialogPrimitive.Content
              className={`room-tool-panel ${pane === "agent" ? "room-chat-panel" : ""} ${pane === "focus" ? "room-focus-panel" : ""}`}
              style={
                pane === "focus"
                  ? undefined
                  : zoneStyle(pane === "agent" ? C.chat : C.panel)
              }
              aria-labelledby="room-panel-title"
              aria-describedby="room-panel-description"
              onInteractOutside={(e) => e.preventDefault()}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                roomRoot.current
                  ?.querySelector<HTMLButtonElement>(".round-timer-face")
                  ?.focus({ preventScroll: true });
              }}
              inert={quietFocus}
              data-lenis-prevent
            >
              <DialogPrimitive.Description
                id="room-panel-description"
                className="sr-only"
              >
                A quiet tool for your sit. Close it to return to the full room.
              </DialogPrimitive.Description>
              {pane === "agent" ? (
                <RoomChat
                  connection={connection}
                  onBusy={p.onBusy}
                  onRest={rest}
                  onNote={(note) => p.onNotes([note, ...p.notes])}
                  onClose={close}
                />
              ) : (
                <>
                  <header className="room-panel-heading">
                    <div>
                      <span className="room-eyebrow">YOUR LITTLE CORNER</span>
                      <DialogPrimitive.Title id="room-panel-title" asChild>
                        <h2>{panelTitle[pane]}</h2>
                      </DialogPrimitive.Title>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Close panel"
                      onClick={close}
                    >
                      <X size={18} />
                    </Button>
                  </header>
                  <div className="room-panel-body">{panelContent()}</div>
                </>
              )}
              {error ? (
                <p className="room-error" role="alert">
                  {error}
                </p>
              ) : null}
            </DialogPrimitive.Content>
          ) : null}
        </DialogPrimitive.Root>
      </div>
      {!loaded ? (
        <div className="room-loading" role="status">
          {loadError ? (
            <>
              <p>{loadError}</p>
              <Button
                onClick={() => {
                  setLoadError("");
                  setRetry((v) => v + 1);
                }}
              >
                Try again
              </Button>
            </>
          ) : (
            <>
              <Loader2 size={22} className="animate-spin" />
              <span>Warming your little corner…</span>
            </>
          )}
        </div>
      ) : null}
      {error && !pane ? (
        <p className="room-page-notice" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
