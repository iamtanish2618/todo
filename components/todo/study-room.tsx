"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type CSSProperties,
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
  Snowflake,
  Sunset,
  AudioLines,
  VolumeX,
  Sun,
  FileDown,
  LampDesk,
  Layers,
  ListTodo,
  Loader2,
  GripVertical,
  Mic,
  Moon,
  Pause,
  Play,
  Plus,
  Send,
  Settings2,
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
import { CompletionCelebration } from "./room/celebration";
import { RoomScene } from "./room/scene";
import { RoomChat } from "./room/chat";
import { SOUND_RECORDINGS, type Soundscape } from "./room/ambience";
import { RoomSoundPlayer } from "./room/sound-player";
import "./room/sound-player.css";
import { makeRoomPDF } from "./room/pdf";
import "./room/room.css";
import "./room/scene.css";
import "./room/calm.css";
import "./room/controls.css";
import "./room/celebration.css";
import "./room/agent.css";
import "./room/polish.css";
import { RoomDock, DOCK_CONFIG, type DockItem } from "./room/dock";
import {
  useDockPanelMotion,
  trapDockPanel,
  dockOrigin,
} from "./room/dock-panels";
import { RoomArrival } from "./room/arrival";
import { BreakReturn } from "./room/break-return";
import { RoomCursor, useRoomCinema } from "./room/cinematic";
import { WeatherMatch } from "./room/weather-match";
import { useRoomSound } from "./room/sound";
import {
  useRoomPolish,
  SoundMixControls,
  CountUp,
  ClockDigits,
  WordReveal,
} from "./room/polish-controls";
import { EMPTY_MIX, roomEffect, type RoomWeather } from "./room/cinema-config";
import "./room/cinematic.css";

type Pane =
  | "focus"
  | "finished"
  | "ambience"
  | "tasks"
  | "notes"
  | "agent"
  | "settings"
  | "month"
  | "corner"
  | "friends"
  | "home"
  | "break";
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
  taskId?: string | null;
  phase: "focus" | "break";
  agentBusy: boolean;
  agentMode: boolean;
  remaining: number;
  duration: number;
  focusMinutes: number;
  startedAt?: number;
  timerId: string;
  focusCompletions: number;
  onBreak: (minutes: number) => void;
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
  onTask: (task: string, begin?: boolean, taskId?: string) => void;
  onStart: () => void;
  onExtend: () => void;
  onFinish: () => Promise<boolean>;
  onExit: () => void;
  onRestoreRoom: () => void;
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
  const [dockEnabled, setDockEnabled] = useState(DOCK_CONFIG.enabled);
  useEffect(() => {
    setDockEnabled(
      new URLSearchParams(location.search).get("dock") !== "0" &&
        DOCK_CONFIG.enabled,
    );
  }, []);
  const [focusTime, setFocusTime] = useState("25");
  const [breakTime, setBreakTime] = useState("5");
  const [celebrating, setCelebrating] = useState(false);
  const handledCompletions = useRef(0);
  const [breakReturn, setBreakReturn] = useState<string | null>(null);
  const handledBreak = useRef<string | null>(null);
  const celebrationOpen = useRef(celebrating);
  celebrationOpen.current = celebrating;
  const quietFocus = p.running && p.phase === "focus";
  const quietBreak = p.started && p.phase === "break";
  const [pane, setPane] = useState<Pane | null>(null),
    [loaded, setLoaded] = useState(false),
    [loadProgress, setLoadProgress] = useState(0),
    [arrived, setArrived] = useState(false),
    [loadError, setLoadError] = useState(""),
    [retry, setRetry] = useState(0),
    [debug, setDebug] = useState(false);
  const agentView = p.active && p.agentMode && pane === "agent";
  const quietRoom = quietFocus || quietBreak || celebrating || agentView;
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState(""),
    [chosen, setChosen] = useState<string[]>([]);
  const [noteTitle, setNoteTitle] = useState(""),
    [noteText, setNoteText] = useState(""),
    [noteView, setNoteView] = useState<"write" | "saved" | "cards">("write");
  const [cards, setCards] = useState<Card[]>([]),
    [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState(""),
    [flipped, setFlipped] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null),
    [tone, setTone] = useState<RoomWeather>("night"),
    [soundscape, setSoundscape] = useState<Soundscape>("off"),
    [sleeping, setSleeping] = useState(false);
  useEffect(() => {
    const hour = new Date().getHours();
    setTone(
      hour >= 7 && hour < 17
        ? "morning"
        : hour >= 17 && hour < 20
          ? "sunset"
          : "night",
    );
  }, []);
  const rain = tone === "rain";
  const [weatherChoice, setWeatherChoice] = useState(0);
  const [dragOver, setDragOver] = useState(false),
    [printing, setPrinting] = useState(false),
    [taskOrder, setTaskOrder] = useState<string[]>([]);
  const draggedTask = useRef<string | null>(null);
  const taskRects = useRef<Map<string, DOMRect> | null>(null);
  const taskTweens = useRef(new Set<GSAPTween>());
  useEffect(
    () => () => {
      taskTweens.current.forEach((t) => t.kill());
      taskTweens.current.clear();
    },
    [],
  );
  useLayoutEffect(() => {
    const before = taskRects.current;
    taskRects.current = null;
    if (!before || p.reduced) return;
    const moves = Array.from(
      roomRoot.current?.querySelectorAll<HTMLElement>("[data-task-id]") || [],
    ).map((node) => ({
      node,
      y:
        (before.get(node.dataset.taskId!)?.top ??
          node.getBoundingClientRect().top) - node.getBoundingClientRect().top,
    }));
    let disposed = false;
    void import("gsap").then(({ gsap }) => {
      if (disposed) return;
      for (const { node, y } of moves)
        if (Math.abs(y) > 1) {
          const tween = gsap.fromTo(
            node,
            { y },
            {
              y: 0,
              duration: 0.34,
              ease: "power2.out",
              overwrite: true,
              onComplete: () => taskTweens.current.delete(tween),
            },
          );
          taskTweens.current.add(tween);
        }
    });
    return () => {
      disposed = true;
    };
  }, [taskOrder, p.reduced]);
  const rememberTaskOrder = (ids: string[]) => {
    taskRects.current = new Map(
      Array.from(
        roomRoot.current?.querySelectorAll<HTMLElement>("[data-task-id]") || [],
      ).map((node) => [node.dataset.taskId!, node.getBoundingClientRect()]),
    );
    setTaskOrder(ids);
    try {
      localStorage.setItem(`todo.room.order.${p.userId}`, JSON.stringify(ids));
    } catch {}
  };

  const dragDepth = useRef(0);
  const printTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [joining, setJoining] = useState("todo"),
    [friendCode, setFriendCode] = useState(""),
    [friendNotice, setFriendNotice] = useState("");
  const [connection, setConnection] = useState(p.connection),
    [resting, setResting] = useState(false),
    [speechAvailable, setSpeechAvailable] = useState(false),
    [listening, setListening] = useState(false);
  useEffect(() => {
    if (!p.active || p.agentMode) setSoundscape("off");
  }, [p.active, p.agentMode]);
  const recognizer = useRef<Recognition | null>(null),
    baseline = useRef(0),
    roomRoot = useRef<HTMLElement>(null),
    latest = useRef(p);
  const closePanel = useRef<() => void>(() => {});
  const closingTween = useRef<GSAPTween | null>(null);
  useEffect(
    () => () => {
      closingTween.current?.kill();
    },
    [],
  );
  const currentPane = useRef(pane);
  currentPane.current = pane;
  latest.current = p;
  const polish = useRoomPolish(setTone);
  const panelReturn = useDockPanelMotion(
    roomRoot,
    pane,
    dockEnabled,
    p.reduced,
  );
  const [completionStats, setCompletionStats] = useState({
    minutes: 0,
    tasks: 0,
  });
  useRoomCinema(roomRoot, {
    active: p.active && arrived,
    reduced: p.reduced,
    focus: quietFocus,
    running: p.running,
    remaining: p.remaining,
    duration: p.duration,
    timerId: p.timerId,
    weather: tone,
    panel: pane,
    celebrating,
    thunder: polish.settings.thunder,
  });
  useRoomSound(
    roomRoot,
    p.active && arrived,
    p.sound && !polish.settings.muted && !celebrating && !breakReturn,
    polish.settings.muted ? 0 : polish.settings.volume,
    celebrating || breakReturn || polish.settings.muted
      ? EMPTY_MIX
      : polish.settings.mix,
  );
  useEffect(
    () => () => {
      if (printTimer.current) clearTimeout(printTimer.current);
    },
    [],
  );
  const printNote = async (title: string, text: string) => {
    await makeRoomPDF(title, text);
    setPrinting(true);
    roomEffect(roomRoot.current, "print");
    if (printTimer.current) clearTimeout(printTimer.current);
    printTimer.current = setTimeout(() => setPrinting(false), 1500);
  };
  const importNote = async (file: File) => {
    if (file.size > 150000 || !/\.(txt|md)$/i.test(file.name)) {
      setError("Choose a text or Markdown file up to 150 KB.");
      return;
    }
    try {
      const text = await file.text();
      if (text.length > 50000) {
        setError("Keep uploaded notes under 50,000 characters.");
        return;
      }
      setNoteTitle(file.name.replace(/\.[^.]+$/, ""));
      setNoteText(text);
      setNoteView("write");
      roomEffect(roomRoot.current, "page");
    } catch {
      setError("That file could not be read.");
    }
  };
  useEffect(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem(`todo.room.order.${p.userId}`) || "[]",
      );
      if (Array.isArray(value))
        setTaskOrder(value.filter((id) => typeof id === "string"));
    } catch {}
  }, [p.userId]);

  const finishArrival = useCallback(() => setArrived(true), []);
  useEffect(() => {
    if (!p.active) setArrived(false);
  }, [p.active]);
  useEffect(() => {
    if (!p.active) {
      setBreakReturn(null);
      return;
    }
    if (
      arrived &&
      p.started &&
      p.phase === "break" &&
      p.remaining === 0 &&
      handledBreak.current !== p.timerId
    ) {
      handledBreak.current = p.timerId;
      setPane(null);
      setBreakReturn(p.timerId);
    }
  }, [p.active, p.started, p.phase, p.remaining, p.timerId, arrived]);
  const restoreAfterBreak = useCallback(async () => {
    const current = latest.current;
    if (
      current.phase === "break" &&
      current.started &&
      !(await current.onFinish())
    )
      return false;
    setPane(null);
    setSleeping(false);
    setCelebrating(false);
    current.onAgentMode(false);
    current.onRestoreRoom();
    return true;
  }, []);
  const finishBreakReturn = useCallback(() => {
    setBreakReturn(null);
    requestAnimationFrame(() =>
      roomRoot.current
        ?.querySelector<HTMLButtonElement>(
          "[data-dock-item=focus],.room-home-card button",
        )
        ?.focus({ preventScroll: true }),
    );
  }, []);
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
    setLoaded(false);
    setLoadProgress(0);
    const room = new Image(),
      idle = new Image(),
      day = new Image(),
      evening = new Image(),
      focused = new Image();
    room.src = C.image;
    day.src = C.dayImage;
    evening.src = C.eveningImage;
    idle.src = p.female
      ? C.poses.idle.replace(".png", "-pink.png")
      : C.poses.idle;
    focused.src = p.female
      ? C.focusedPose.replace(".png", "-pink.png")
      : C.focusedPose;
    let decoded = 0;
    const assets = [room, idle, day, evening, focused];
    Promise.all(
      assets.map(async (image) => {
        await image.decode();
        decoded++;
        if (!stopped) setLoadProgress(decoded / assets.length);
      }),
    )
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
    if (p.focusCompletions <= handledCompletions.current) return;
    handledCompletions.current = p.focusCompletions;
    setPane(null);
    setCompletionStats({
      minutes: Math.max(0, Math.round((p.sessions[0]?.seconds || 0) / 60)),
      tasks: p.tasks.filter((t) => t.done).length - baseline.current,
    });
    setCelebrating(true);
    roomEffect(roomRoot.current, "celebrate");
    void refresh();
  }, [p.focusCompletions, refresh]);
  useEffect(() => {
    if (!p.active) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (latest.current.running) {
          latest.current.onStart();
        }
        closePanel.current();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [p.active]);
  useEffect(() => {
    if (!quietFocus && !quietBreak) return;
    roomRoot.current
      ?.querySelector<HTMLButtonElement>(".round-timer-face")
      ?.focus({ preventScroll: true });
    // Keep the setup mounted just long enough to dissolve with the other tools.
    const dismiss = setTimeout(() => setPane(null), p.reduced ? 0 : 650);
    return () => clearTimeout(dismiss);
  }, [quietFocus, quietBreak, p.reduced]);
  const show = (next: Pane) => {
    setError("");
    if (currentPane.current === next) closePanel.current();
    else {
      closingTween.current?.kill();
      const node = roomRoot.current?.querySelector(".dock-panel");
      if (dockEnabled && node && !p.reduced) {
        const previous = currentPane.current;
        void import("gsap").then(({ gsap }) => {
          if (currentPane.current !== previous || !node.isConnected) return;
          closingTween.current = gsap.to(node, {
            opacity: 0,
            scale: 0.85,
            y: 10,
            duration: 0.1,
            overwrite: true,
            onComplete: () => {
              if (currentPane.current === previous) setPane(next);
            },
          });
        });
      } else setPane(next);
    }
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
      if (!p.started && !p.task) p.onTask(task.title, false, task.id);
      setDraft("");
      roomEffect(roomRoot.current, "task");
    });
  };
  const toggle = async (task: Task) => {
    await work(async () => {
      // Save the active sit before completing its task, so the finished record includes it.
      const finishSit =
        !task.done && p.started && p.phase === "focus" && p.taskId === task.id;
      if (finishSit && !(await p.onFinish())) return;
      const next = await api<Task>("/api/tasks", "PATCH", {
        id: task.id,
        done: !task.done,
      });
      p.onTasks(p.tasks.map((t) => (t.id === next.id ? next : t)));
      if (next.done) {
        setChosen((v) => v.filter((id) => id !== next.id));
        if (!finishSit && p.running) p.onStart();
        setPane(null);
        setCompletionStats({
          minutes: Math.round(
            (p.started ? p.duration - p.remaining : task.focusedSeconds || 0) /
              60,
          ),
          tasks: 1,
        });
        setCelebrating(true);
        roomEffect(roomRoot.current, "celebrate");
      }
      void refresh();
    });
  };
  const focusTask = (task: Task) => {
    if (chosen.includes(task.id))
      setChosen((v) => v.filter((id) => id !== task.id));
    else if (chosen.length < 3) {
      setChosen((v) => [...v, task.id]);
      if (!p.started && !p.task) p.onTask(task.title, false, task.id);
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
    void work(() => printNote(noteTitle || "A little note", noteText));
  const beginFocus = () => {
    closingTween.current?.kill();
    setFocusTime(String(p.duration / 60));
    setError("");
    setPane("focus");
  };
  const chooseWeather = (next: RoomWeather) => {
    setWeatherChoice((v) => v + 1);
    polish.update({ matchTime: false });
    setTone(next);
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
    p.onDuration(minutes);
    p.onTask(task?.title || "Quiet focus", true, task?.id);
    baseline.current = p.tasks.filter((t) => t.done).length;
  };
  const sit = (e: FormEvent) => {
    e.preventDefault();
    setPane("tasks");
  };
  const done = () =>
    void work(async () => {
      if (await p.onFinish()) {
        setPane(null);
        if (p.phase === "focus") {
          setCompletionStats({
            minutes: Math.round((p.duration - p.remaining) / 60),
            tasks: 0,
          });
          setCelebrating(true);
          roomEffect(roomRoot.current, "celebrate");
        }
        await refresh();
      }
    });
  const takeBreak = () =>
    void work(async () => {
      // A different paused task may still have an unsaved sit. Keep its work before resting.
      if (p.started && p.phase === "focus" && !(await p.onFinish())) return;
      setCelebrating(false);
      setBreakTime("5");
      setPane("break");
    });
  const continueFocusing = () => {
    setCelebrating(false);
    setError("");
    if (p.started && p.phase === "focus") {
      setPane(null);
      if (!p.running) p.onStart();
    } else {
      setFocusTime(String(p.focusMinutes));
      setPane(
        chosen.some((id) =>
          p.tasks.some((task) => task.id === id && !task.done),
        )
          ? "focus"
          : "tasks",
      );
    }
  };
  const launchBreak = (event: FormEvent) => {
    event.preventDefault();
    const minutes = Number(breakTime);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) {
      setError("Choose 1 to 120 whole minutes.");
      return;
    }
    p.onAgentMode(false);
    setSleeping(false);
    p.onBreak(minutes);
  };
  const endBreak = (goHome: boolean) =>
    void work(async () => {
      if (!(await p.onFinish())) return;
      setPane(null);
      if (goHome) p.onExit();
      else {
        p.onAgentMode(false);
        p.onRestoreRoom();
      }
    });
  const mode = (agent: boolean) => {
    closingTween.current?.kill();
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
  const visibleTasks = p.tasks
    .filter((task) => !task.done)
    .sort((a, b) => {
      const aa = taskOrder.indexOf(a.id),
        bb = taskOrder.indexOf(b.id);
      return (aa < 0 ? 999 : aa) - (bb < 0 ? 999 : bb);
    });
  const finishedTasks = p.tasks
    .filter((task) => task.done)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  const focusTimeLabel = (seconds = 0) =>
    seconds > 0
      ? `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s of focus`
      : "Not timed";
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
  const close = () => {
    if (pane === "agent") p.onAgentMode(false);
    setError("");
    const node = roomRoot.current?.querySelector(
      ".room-tool-panel,.room-agent-panel",
    );
    const closing = pane;
    if (!node || (p.reduced && !dockEnabled)) {
      setPane(null);
      return;
    }
    void import("gsap").then(({ gsap }) => {
      if (!node.isConnected || currentPane.current !== closing) return;
      closingTween.current = gsap.to(node, {
        opacity: 0,
        x: dockEnabled ? 0 : -14,
        y: dockEnabled && !p.reduced ? 16 : 0,
        scale: dockEnabled ? (p.reduced ? 1 : 0.6) : 0.985,
        duration: dockEnabled ? (p.reduced ? 0.15 : 0.2) : 0.18,
        ease: "power2.in",
        overwrite: true,
        onComplete: () => {
          if (currentPane.current === closing) setPane(null);
        },
      });
    });
  };
  closePanel.current = close;
  const panelTitle: Record<Pane, string> = {
    focus: dockEnabled ? "Start focusing" : "Todo.",
    finished: "Finished tasks.",
    ambience: dockEnabled ? "Ambience" : "Set the mood.",
    tasks: "Your tasks.",
    notes: dockEnabled ? "Notes" : "Your little notebook.",
    agent: "Talk with Todo",
    settings: "Make yourself comfortable.",
    month: "This month",
    corner: "Your corner",
    friends: dockEnabled ? "Friends" : "Bring friends to the table.",
    home: "Who is joining?",
    break: "Take a break.",
  };
  const panelContent = () => {
    switch (pane) {
      case "focus":
        if (dockEnabled)
          return (
            <form
              id="dock-focus-form"
              className="dock-focus-setup"
              onSubmit={launchFocus}
            >
              <div className="dock-focus-row">
                <strong>TASK</strong>
                <div className="dock-task-chips">
                  {[
                    ...selected,
                    ...visibleTasks.filter((t) => !chosen.includes(t.id)),
                  ]
                    .slice(0, 3)
                    .map((task) => (
                      <button
                        type="button"
                        key={task.id}
                        aria-pressed={chosen.includes(task.id)}
                        onClick={() => focusTask(task)}
                      >
                        {task.title}
                      </button>
                    ))}
                  <button
                    type="button"
                    aria-label="Add or edit tasks"
                    onClick={() => show("tasks")}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div className="dock-focus-row">
                <strong>TIME</strong>
                <div className="dock-time-chips">
                  {[15, 25, 45, 60, 90].map((minutes) => (
                    <button
                      type="button"
                      key={minutes}
                      aria-pressed={Number(focusTime) === minutes}
                      onClick={() => setFocusTime(String(minutes))}
                    >
                      {minutes}
                    </button>
                  ))}
                  <label className="dock-custom-time">
                    Custom{" "}
                    <Input
                      id="focus-minutes"
                      aria-label="Focus minutes"
                      type="number"
                      required
                      min={1}
                      max={120}
                      step={1}
                      value={focusTime}
                      onChange={(e) => setFocusTime(e.target.value)}
                    />{" "}
                    min
                  </label>
                </div>
              </div>
              <button
                type="button"
                className="dock-focus-manage"
                onClick={() => show("tasks")}
              >
                Edit tasks &amp; finished tasks
              </button>
              <button type="submit" className="room-focus-launch sr-only">
                Focus
              </button>
            </form>
          );
        return (
          <form className="room-focus-form" onSubmit={launchFocus}>
            <p className="room-helper">Todo will work beside you.</p>
            <label className="sr-only" htmlFor="focus-minutes">
              Focus minutes
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
              {[15, 25, 30, 45, 60, 90].map((minutes) => (
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
            <div
              className="room-weather-choices"
              role="group"
              aria-label="Ambience"
            >
              {(
                [
                  ["morning", "Day", Sun],
                  ["night", "Night", Moon],
                  ["rain", "Rain", CloudRain],
                  ["snow", "Snow", Snowflake],
                  ["sunset", "Sunset", Sunset],
                ] as const
              ).map(([value, label, Icon]) => (
                <Button
                  key={value}
                  variant="ghost"
                  aria-pressed={tone === value}
                  onClick={() => chooseWeather(value)}
                >
                  <i
                    className="cinema-weather-preview"
                    data-scene={value}
                    aria-hidden="true"
                  />
                  <Icon size={21} />
                  <span>{label}</span>
                </Button>
              ))}
            </div>
            <label className="cinema-time-match">
              <span>Match my time of day</span>
              <Switch
                aria-label="Match my time of day"
                checked={polish.settings.matchTime}
                onCheckedChange={(matchTime) => {
                  setWeatherChoice((v) => v + 1);
                  polish.update({ matchTime });
                }}
              />
            </label>
            <div
              className="room-sound-choices"
              role="group"
              aria-label="Sound effects"
            >
              {(
                [
                  ["off", "Sound off", VolumeX],
                  ["white", SOUND_RECORDINGS.white.label, AudioLines],
                  ["brown", SOUND_RECORDINGS.brown.label, AudioLines],
                  ["rain", SOUND_RECORDINGS.rain.label, CloudRain],
                ] as const
              ).map(([value, label, Icon]) => (
                <Button
                  key={value}
                  variant="ghost"
                  aria-pressed={soundscape === value}
                  onClick={() => setSoundscape(value)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </Button>
              ))}
            </div>
            <WeatherMatch
              scene={tone}
              sceneVersion={weatherChoice}
              onChoose={(value) => {
                polish.update({ matchTime: false });
                setTone(value);
              }}
            />
            {dockEnabled ? (
              <div className="dock-mix" role="group" aria-label="Room textures">
                {(
                  [
                    ["rain", "Rain"],
                    ["fire", "Fire"],
                    ["cafe", "Café"],
                    ["pad", "Lo-fi hush"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    <span>{label}</span>
                    <input
                      aria-label={label}
                      type="range"
                      min="0"
                      max="1"
                      step=".01"
                      value={polish.settings.mix[key]}
                      onChange={(e) =>
                        polish.update({
                          mix: {
                            ...polish.settings.mix,
                            [key]: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            ) : null}
            <SoundMixControls
              settings={polish.settings}
              update={polish.update}
              onQuiet={() => {
                polish.update({ muted: true });
                p.onReduced(true);
                p.onSound(false);
                setSoundscape("off");
              }}
            />
          </>
        );
      case "finished":
        return (
          <>
            <div className="room-finished-list">
              {finishedTasks.length ? (
                finishedTasks.map((task) => (
                  <article className="room-finished-task" key={task.id}>
                    <CheckCheck size={16} />
                    <div>
                      <h3>{task.title}</h3>
                      <p>{focusTimeLabel(task.focusedSeconds)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Reopen ${task.title}`}
                      disabled={busy}
                      onClick={() => void toggle(task)}
                    >
                      Reopen
                    </Button>
                  </article>
                ))
              ) : (
                <p className="room-empty">No finished tasks yet.</p>
              )}
            </div>
            <Button variant="ghost" onClick={() => setPane("tasks")}>
              Back to tasks <ArrowLeft size={14} />
            </Button>
          </>
        );
      case "tasks":
        return (
          <>
            <Button
              variant="ghost"
              className="room-finished-link"
              onClick={() => setPane("finished")}
            >
              Finished tasks <CheckCheck size={15} />
            </Button>
            <div className="room-task-list">
              {visibleTasks.length ? (
                visibleTasks.map((task) => (
                  <div
                    className={`room-task-row ${task.done ? "task-finished" : ""} ${chosen.includes(task.id) ? "task-selected" : ""}`}
                    key={task.id}
                    data-task-id={task.id}
                    draggable={!busy}
                    onDragStart={(e) => {
                      draggedTask.current = task.id;
                      e.currentTarget.dataset.dragging = "true";
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", task.id);
                    }}
                    onDragEnd={(e) => {
                      draggedTask.current = null;
                      e.currentTarget.dataset.dragging = "false";
                    }}
                    onDragOver={(e) => {
                      if (draggedTask.current) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = draggedTask.current;
                      if (!id || id === task.id) return;
                      const ids = visibleTasks
                        .map((t) => t.id)
                        .filter((x) => x !== id);
                      ids.splice(ids.indexOf(task.id), 0, id);
                      rememberTaskOrder(ids);
                    }}
                  >
                    <span
                      className="cinema-drag-handle"
                      role="button"
                      tabIndex={busy ? -1 : 0}
                      aria-disabled={busy}
                      aria-label={`Reorder ${task.title}`}
                      draggable={!busy}
                      onKeyDown={(e) => {
                        if (busy || !["ArrowUp", "ArrowDown"].includes(e.key))
                          return;
                        e.preventDefault();
                        const ids = visibleTasks.map((t) => t.id),
                          index = ids.indexOf(task.id),
                          target = Math.max(
                            0,
                            Math.min(
                              ids.length - 1,
                              index + (e.key === "ArrowUp" ? -1 : 1),
                            ),
                          );
                        if (target !== index) {
                          [ids[index], ids[target]] = [ids[target], ids[index]];
                          rememberTaskOrder(ids);
                        }
                      }}
                    >
                      <GripVertical size={13} />
                    </span>
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
                      void importNote(file);
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
                            void work(() => printNote(note.title, note.content))
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
                  <article
                    className="room-flashcard"
                    key={card.id}
                    data-flipped={flipped === card.id}
                  >
                    <button
                      onClick={() =>
                        setFlipped(flipped === card.id ? null : card.id)
                      }
                      aria-label={`Flip card: ${card.question}`}
                    >
                      <span className="cinema-flash-inner">
                        <span
                          className="cinema-flash-face"
                          aria-hidden={flipped === card.id}
                        >
                          {card.question}
                          <small>QUESTION · TAP TO TURN</small>
                        </span>
                        <span
                          className="cinema-flash-face cinema-flash-back"
                          aria-hidden={flipped !== card.id}
                        >
                          {card.answer}
                          <small>ANSWER</small>
                        </span>
                      </span>
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
            {dockEnabled ? (
              <label className="dock-glass-setting">
                <span>
                  Glass <small>Clear → Tinted</small>
                </span>
                <input
                  aria-label="Glass tint"
                  type="range"
                  min="0"
                  max="1"
                  step=".01"
                  value={polish.settings.glass}
                  onChange={(e) =>
                    polish.update({ glass: Number(e.target.value) })
                  }
                />
              </label>
            ) : null}
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
              <select
                value={tone}
                onChange={(e) => chooseWeather(e.target.value as RoomWeather)}
              >
                <option value="rain">Rain</option>
                <option value="night">Quiet night</option>
                <option value="morning">Soft morning</option>
                <option value="snow">Snow</option>
                <option value="sunset">Sunset</option>
              </select>
            </label>
            <Button variant="outline" onClick={() => setSleeping((v) => !v)}>
              <Moon size={16} />
              {sleeping ? "Wake Todo gently" : "Let Todo rest"}
            </Button>
            <SoundMixControls
              settings={polish.settings}
              update={polish.update}
              onQuiet={() => {
                polish.update({ muted: true });
                p.onReduced(true);
                p.onSound(false);
                setSoundscape("off");
              }}
            />
            <div
              className="cinema-outfit-choices"
              role="group"
              aria-label="Todo’s keepsake outfits"
            >
              {[
                ["original", "Original", 0],
                ["star", "Little star", 1],
                ["glasses", "Round glasses", 3],
              ].map(([value, label, at]) => (
                <Button
                  key={String(value)}
                  variant="ghost"
                  disabled={totalSits < Number(at)}
                  aria-pressed={polish.settings.outfit === value}
                  onClick={() => {
                    polish.update({ outfit: String(value) });
                    roomEffect(roomRoot.current, "outfit");
                  }}
                >
                  {String(label)}
                  {totalSits < Number(at) ? (
                    <small>{String(at)} sits</small>
                  ) : null}
                </Button>
              ))}
            </div>
            <div className="room-settings-links">
              {[
                ["home", Users, "Who is joining?"],
                ["month", TimerIcon, "This month"],
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
              <span>
                <img
                  className="cinema-friend-preview"
                  src={
                    p.female
                      ? C.poses.idle.replace(".png", "-pink.png")
                      : C.poses.idle
                  }
                  alt="You"
                />
              </span>
              <i />
              <span aria-label="Empty chair">♡</span>
              <span aria-label="Empty chair">♡</span>
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
          <form
            className="room-focus-form room-break-setup"
            onSubmit={launchBreak}
          >
            <label className="sr-only" htmlFor="break-minutes">
              Break minutes
            </label>
            <div className="room-minute-field">
              <Input
                id="break-minutes"
                aria-label="Break minutes"
                type="number"
                min={1}
                max={120}
                step={1}
                required
                value={breakTime}
                onChange={(e) => {
                  setBreakTime(e.target.value);
                  setError("");
                }}
              />
              <span>minutes</span>
            </div>
            <div
              className="room-time-presets"
              role="group"
              aria-label="Suggested break times"
            >
              {[3, 5, 10, 15, 20, 30].map((minutes) => (
                <Button
                  key={minutes}
                  type="button"
                  variant="ghost"
                  aria-pressed={Number(breakTime) === minutes}
                  onClick={() => setBreakTime(String(minutes))}
                >
                  {minutes} min
                </Button>
              ))}
            </div>
            <Button
              type="submit"
              className="room-dark-button room-focus-launch"
            >
              Start break <Coffee size={16} />
            </Button>
          </form>
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
      data-dock={dockEnabled}
      style={{ "--glass-tint": polish.settings.glass } as CSSProperties}
      data-character={p.female ? "female" : "male"}
      data-mode={p.agentMode ? "agent" : "companion"}
      data-agent={agentView}
      data-loaded={loaded}
      data-arriving={p.active && !arrived}
      data-tone={tone}
      data-rain={rain}
      data-working={quietFocus}
      data-quiet={quietRoom}
      data-resting={quietBreak}
      data-panel-open={Boolean(pane) && !quietRoom}
      data-season={
        new Date().getMonth() < 2 || new Date().getMonth() === 11
          ? "winter"
          : new Date().getMonth() < 5
            ? "spring"
            : "summer"
      }
      data-outfit={polish.settings.outfit}
    >
      <link rel="preload" href={C.image} as="image" />
      <div
        className="cozy-room-backdrop"
        style={{ backgroundImage: `url(${C.image})` }}
        aria-hidden="true"
      />
      <div
        className="cozy-room-stage"
        inert={!arrived || Boolean(breakReturn)}
        aria-hidden={!arrived || Boolean(breakReturn)}
      >
        <div className="room-scene-world">
          <RoomScene
            pose={pose}
            female={p.female}
            reduced={p.reduced}
            active={p.active && loaded}
            sky={
              tone === "morning" ? "day" : tone === "rain" ? "evening" : "night"
            }
            weather={tone}
            arrived={arrived}
            focusing={quietFocus}
            interactive={!agentView}
            clock={p.started ? p.clock : null}
          />
          <div
            className="room-table-clock round-timer"
            aria-label={`Table timer ${p.clock}`}
            inert={agentView}
            aria-hidden={agentView}
          >
            <span className="round-timer-shadow" aria-hidden="true" />
            <span className="round-timer-feet" aria-hidden="true" />
            <span className="round-timer-case" aria-hidden="true" />
            <button
              className="round-timer-face"
              aria-label={
                p.phase === "break" && p.remaining === 0
                  ? "Break complete"
                  : p.running
                    ? "Pause table timer"
                    : p.started
                      ? "Resume table timer"
                      : "Start table timer"
              }
              disabled={p.phase === "break" && p.remaining === 0}
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
                  strokeDashoffset={(100 * p.remaining) / p.duration}
                />
              </svg>
              <span className="round-timer-label">
                {p.phase === "break" ? "BREATHE" : "QUIET FOCUS"}
              </span>
              <strong>
                <ClockDigits clock={p.clock} />
              </strong>
              <span className="cinema-clock-scene" aria-hidden="true">
                {tone === "morning" || tone === "sunset" ? (
                  <Sun size={7} />
                ) : (
                  <Moon size={7} />
                )}
              </span>
              {!p.started ? (
                <span className="cinema-clock-hint" aria-hidden="true">
                  Start
                </span>
              ) : null}
              <span className="round-timer-action">
                {p.running ? <Pause size={12} /> : <Play size={12} />}
              </span>
            </button>
            {p.started && !quietRoom ? (
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
        <div className="cinema-panel-shade" aria-hidden="true" />
        {quietFocus ? (
          <div
            className="cinema-focus-pill"
            role="group"
            aria-label="Focus controls"
          >
            <span>{p.task}</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Pause focus"
              onClick={p.onStart}
            >
              <Pause size={13} />
            </Button>
            <Button
              variant="ghost"
              onClick={p.onExtend}
              aria-label="Add five minutes"
            >
              +5 min
            </Button>
            <Button variant="ghost" onClick={done} disabled={busy}>
              Done <Check size={13} />
            </Button>
          </div>
        ) : null}
        <p className="sr-only" role="status">
          {quietFocus
            ? "Focus has started. Click the clock or press Escape to pause and show the room controls."
            : ""}
        </p>
        <Button
          data-room-ui="back"
          inert={quietRoom}
          aria-hidden={quietRoom}
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
        {!dockEnabled ? (
          <div
            className="room-mode-toggle"
            data-room-ui="mode"
            inert={quietRoom}
            aria-hidden={quietRoom}
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
        ) : null}
        <Button
          data-room-ui="settings"
          inert={quietRoom}
          aria-hidden={quietRoom}
          variant="ghost"
          size="icon"
          className="room-nav-settings"
          aria-label="Open room settings"
          onClick={() => show("settings")}
        >
          <Settings2 size={18} />
        </Button>
        {!dockEnabled ? (
          <nav
            className="room-edge-tabs"
            data-room-ui="tools"
            inert={quietRoom}
            aria-hidden={quietRoom}
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
        ) : null}
        {!dockEnabled ? (
          <div
            className="room-home-card"
            data-room-ui="home"
            inert={quietRoom}
            aria-hidden={quietRoom}
            style={zoneStyle(C.home)}
          >
            {quietBreak ? null : !p.started && p.phase === "focus" ? (
              <form onSubmit={sit}>
                <h1>What are we doing?</h1>
                <div className="room-intention-form">
                  <Button className="room-dark-button">
                    {selected.length ? "Edit your tasks" : "Sit with Todo"}
                    <ArrowRight size={15} />
                  </Button>
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
                  onClick={() => {
                    const activeTask = p.tasks.find(
                      (task) => task.id === p.taskId && !task.done,
                    );
                    if (p.phase === "focus" && activeTask)
                      void toggle(activeTask);
                    else done();
                  }}
                  disabled={busy}
                  aria-label={
                    p.phase === "break"
                      ? "End break"
                      : p.taskId
                        ? "Finish task"
                        : "Done for now"
                  }
                >
                  {p.phase === "break"
                    ? "End break"
                    : p.taskId
                      ? "Finish task"
                      : "Done for now"}
                  <Check size={16} />
                </Button>
              </div>
            )}
          </div>
        ) : null}
        {dockEnabled ? (
          <RoomDock
            active={pane === "tasks" || pane === "finished" ? "focus" : pane}
            reduced={p.reduced}
            focus={quietFocus}
            hidden={quietBreak || celebrating}
            agent={p.agentMode}
            resting={resting}
            onChoose={(item: DockItem) => {
              if (item === "agent") mode(!p.agentMode);
              else if (item === "focus") {
                if (p.started && p.phase === "focus") {
                  close();
                  p.onStart();
                } else if (pane === "focus")
                  roomRoot.current
                    ?.querySelector<HTMLFormElement>("#dock-focus-form")
                    ?.requestSubmit();
                else {
                  if (p.agentMode) p.onAgentMode(false);
                  beginFocus();
                }
              } else {
                if (p.agentMode) p.onAgentMode(false);
                show(item);
              }
            }}
            onPause={p.onStart}
            onEnd={done}
          />
        ) : null}
        {p.active && !agentView && soundscape !== "off" ? (
          <RoomSoundPlayer
            key={soundscape}
            recording={soundscape}
            paused={
              celebrating || Boolean(breakReturn) || polish.settings.muted
            }
            volume={polish.settings.volume}
            onStop={() => setSoundscape("off")}
          />
        ) : null}
        {quietBreak ? (
          <div
            className="room-break-actions"
            role="group"
            aria-label="Break controls"
          >
            <Button onClick={() => endBreak(true)} disabled={busy}>
              Focus again <ArrowRight size={15} />
            </Button>
            <Button
              variant="ghost"
              onClick={() => endBreak(false)}
              disabled={busy}
            >
              End break
            </Button>
          </div>
        ) : null}
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
            inert={quietRoom}
            aria-hidden={quietRoom}
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
              key={pane}
              data-dock-pane={dockEnabled ? pane : undefined}
              onKeyDown={dockEnabled ? trapDockPanel : undefined}
              className={
                (dockEnabled ? "dock-panel " : "") +
                (pane === "agent"
                  ? "room-agent-panel"
                  : `room-tool-panel ${pane === "focus" || pane === "break" ? "room-focus-panel" : ""}`)
              }
              style={
                dockEnabled ||
                pane === "focus" ||
                pane === "break" ||
                pane === "agent"
                  ? undefined
                  : {
                      ...zoneStyle(C.panel),
                      ...(pane === "ambience"
                        ? { height: "auto", maxHeight: "64%" }
                        : {}),
                    }
              }
              aria-labelledby="room-panel-title"
              aria-describedby="room-panel-description"
              onInteractOutside={(e) => {
                e.preventDefault();
                if (
                  dockEnabled &&
                  !(e.target as Element)?.closest?.(
                    ".todo-dock,.room-nav-settings",
                  )
                )
                  close();
              }}
              onFocusOutside={(e) => e.preventDefault()}
              onOpenAutoFocus={(event) => {
                if (dockEnabled) {
                  event.preventDefault();
                  roomRoot.current
                    ?.querySelector<HTMLElement>(
                      ".dock-panel button,.dock-panel input,.dock-panel textarea",
                    )
                    ?.focus({ preventScroll: true });
                  return;
                }
                if (pane !== "agent" && pane !== "focus") return;
                event.preventDefault();
                roomRoot.current
                  ?.querySelector<HTMLTextAreaElement>(
                    pane === "agent"
                      ? ".room-agent-panel textarea"
                      : "#focus-minutes",
                  )
                  ?.focus({ preventScroll: true });
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                if (celebrationOpen.current) return;
                if (currentPane.current && currentPane.current !== pane) return;
                const anchor = panelReturn.current;
                roomRoot.current
                  ?.querySelector<HTMLButtonElement>(
                    dockEnabled
                      ? anchor === "settings"
                        ? ".room-nav-settings"
                        : `[data-dock-item="${anchor}"]`
                      : ".round-timer-face",
                  )
                  ?.focus({ preventScroll: true });
              }}
              inert={pane !== "agent" && quietRoom}
              aria-hidden={pane !== "agent" && quietRoom}
              data-lenis-prevent
              data-drag-over={dragOver}
              onDragEnter={(e) => {
                if (pane !== "notes" || !e.dataTransfer.types.includes("Files"))
                  return;
                e.preventDefault();
                dragDepth.current++;
                setDragOver(true);
              }}
              onDragOver={(e) => {
                if (pane === "notes" && e.dataTransfer.types.includes("Files"))
                  e.preventDefault();
              }}
              onDragLeave={() => {
                dragDepth.current = Math.max(0, dragDepth.current - 1);
                if (!dragDepth.current) setDragOver(false);
              }}
              onDrop={(e) => {
                if (pane !== "notes") return;
                e.preventDefault();
                dragDepth.current = 0;
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) void importNote(file);
              }}
            >
              {pane === "notes" && dragOver ? (
                <div className="cinema-note-drop" aria-hidden="true">
                  Drop into your notebook
                </div>
              ) : null}
              {pane === "notes" && printing ? (
                <div className="cinema-pdf-receipt" aria-hidden="true">
                  <i />
                  PDF
                </div>
              ) : null}
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
                      <DialogPrimitive.Title id="room-panel-title" asChild>
                        <h2>
                          <WordReveal text={panelTitle[pane]} />
                        </h2>
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
      <RoomCursor />
      {p.active && breakReturn ? (
        <BreakReturn
          key={breakReturn}
          silent={polish.settings.muted || polish.settings.volume === 0}
          female={p.female}
          reduced={p.reduced}
          onCovered={restoreAfterBreak}
          onComplete={finishBreakReturn}
        />
      ) : null}
      <CompletionCelebration
        open={celebrating}
        female={p.female}
        reduced={p.reduced}
        sound={p.sound && !polish.settings.muted}
        cue={polish.settings.cue}
        volume={polish.settings.volume}
        minutes={completionStats.minutes}
        tasksDone={Math.max(0, completionStats.tasks)}
        busy={busy}
        onBreak={takeBreak}
        onContinue={continueFocusing}
      />
      {p.active ? (
        <RoomArrival
          ready={loaded}
          progress={loadProgress}
          female={p.female}
          reduced={p.reduced}
          complete={arrived}
          error={loadError}
          onComplete={finishArrival}
          onRetry={() => {
            setLoadError("");
            setRetry((value) => value + 1);
          }}
        />
      ) : null}
      {error && !pane ? (
        <p className="room-page-notice" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
