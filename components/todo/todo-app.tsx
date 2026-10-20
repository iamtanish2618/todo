"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Download,
  FileText,
  Headphones,
  History,
  ImagePlus,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Welcome, type WelcomeHandle, type Panel } from "./welcome";
import { StudyRoom } from "./study-room";
import { AccountPanel, type Identity, type Profile } from "./account-panel";
import type { AuthController } from "@/lib/auth/use-todo-auth";
import {
  api,
  exportPDF,
  type Task,
  type FocusSession,
  type Note,
  type Connection,
} from "@/lib/todo/client";

type Message = {
  role: "user" | "assistant";
  content: string;
  imageName?: string;
};
type Timer = {
  taskId?: string | null;
  remaining: number;
  duration: number;
  deadline: number | null;
  task: string;
  phase: "focus" | "break";
  started: boolean;
  id: string;
  startedAt?: number;
};
const freshTimer: Timer = {
  taskId: null,
  remaining: 25 * 60,
  duration: 25 * 60,
  deadline: null,
  task: "",
  phase: "focus",
  started: false,
  id: "",
};
export default function TodoApp({
  identity,
  signInPath,
  signOutPath,
  auth,
}: {
  identity: Identity;
  signInPath: string;
  signOutPath: string;
  auth: AuthController;
}) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMode, setAccountMode] = useState<
    "signup" | "login" | "account"
  >("account");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [returning, setReturning] = useState(false);
  const [profileError, setProfileError] = useState("");
  const timerStorageKey =
    auth.provider === "chatgpt"
      ? "todo.timer.v1"
      : `todo.timer.v2.${identity?.id || "guest"}`;
  const [panel, setPanel] = useState<Panel>(null),
    [female, setFemale] = useState(false);
  const [reduced, setReduced] = useState(false),
    [sound, setSound] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]),
    [sessions, setSessions] = useState<FocusSession[]>([]),
    [notes, setNotes] = useState<Note[]>([]),
    [connection, setConnection] = useState<Connection | null>(null),
    [loadError, setLoadError] = useState("");
  const [timer, setTimer] = useState<Timer>(freshTimer),
    [timerReady, setTimerReady] = useState(false),
    [minutes, setMinutes] = useState(25),
    [taskDraft, setTaskDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [focusCompletions, setFocusCompletions] = useState(0);
  const [inRoom, setInRoom] = useState(false),
    [agentMode, setAgentMode] = useState(false),
    [agentBusy, setAgentBusy] = useState(false);
  const introRef = useRef<WelcomeHandle>(null),
    timerRef = useRef(timer),
    audio = useRef<AudioContext | null>(null);
  const settling = useRef(false),
    completed = useRef(new Set<string>()),
    hydrated = useRef(false);
  const onError = (e: unknown) =>
    toast.error(
      e instanceof Error
        ? e.message
        : "Something went wrong. Please try again.",
    );
  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      api<Task[]>("/api/tasks"),
      api<FocusSession[]>("/api/sessions"),
      api<Note[]>("/api/notes"),
      api<Connection>("/api/status"),
    ]);
    if (results[0].status === "fulfilled") setTasks(results[0].value);
    if (results[1].status === "fulfilled") setSessions(results[1].value);
    if (results[2].status === "fulfilled") setNotes(results[2].value);
    if (results[3].status === "fulfilled") setConnection(results[3].value);
    const failed = results.find((r) => r.status === "rejected");
    setLoadError(failed?.status === "rejected" ? failed.reason.message : "");
  }, []);
  useEffect(() => {
    if (!identity || !auth.ready) return;
    load();
    let cancelled = false;
    api<Profile | null>("/api/profile")
      .then((result) => {
        if (!cancelled) {
          setProfile(result);
          setReturning(Boolean(result) && !auth.newAccount);
        }
      })
      .catch(() => {
        if (!cancelled)
          setProfileError(
            "Your saved name couldn’t load. You can update it in Your account.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [load, identity, auth.ready, auth.newAccount]);
  const [systemReduced, setSystemReduced] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    try {
      const settings = JSON.parse(
        localStorage.getItem("todo.settings.v1") || "{}",
      );
      setReduced(Boolean(settings.reduced || preference.matches));
      setSound(settings.sound ?? false);
      const saved = identity
        ? JSON.parse(localStorage.getItem(timerStorageKey) || "null")
        : null;
      if (
        saved &&
        typeof saved.remaining === "number" &&
        typeof saved.task === "string" &&
        saved.task.length <= 180 &&
        ["focus", "break"].includes(saved.phase) &&
        saved.duration > 0 &&
        saved.duration <= 7200 &&
        (!saved.deadline || Number.isFinite(saved.deadline))
      ) {
        setTimer(saved);
        if (saved.phase === "focus") setMinutes(saved.duration / 60);
      }
    } catch {}
    hydrated.current = true;
    setTimerReady(true);
    return () => {
      audio.current?.close();
    };
  }, [timerStorageKey, identity?.id]);
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(
        "todo.settings.v1",
        JSON.stringify({ reduced, sound }),
      );
    } catch {}
  }, [reduced, sound]);
  useEffect(() => {
    timerRef.current = timer;
    if (timerReady)
      try {
        if (identity)
          localStorage.setItem(timerStorageKey, JSON.stringify(timer));
      } catch {}
  }, [timer, timerReady, timerStorageKey, identity]);
  useEffect(() => {
    // Upgrade an in-progress legacy timer only when its task title is unambiguous.
    if (!timer.started || timer.phase !== "focus" || timer.taskId !== undefined)
      return;
    const matches = tasks.filter(
      (task) => !task.done && task.title === timer.task,
    );
    if (matches.length === 1)
      setTimer((current) =>
        current.taskId ? current : { ...current, taskId: matches[0].id },
      );
  }, [tasks, timer.started, timer.phase, timer.taskId, timer.task]);
  const chime = useCallback(() => {
    if (!sound) return;
    try {
      let volume = 0.5;
      try {
        const prefs = JSON.parse(
          localStorage.getItem("todo.room.polish.v1") || "{}",
        );
        if (prefs.muted) return;
        if (typeof prefs.volume === "number")
          volume = Math.max(0, Math.min(1, prefs.volume));
      } catch {}
      if (!volume) return;
      const context = audio.current ?? new AudioContext();
      audio.current = context;
      void context.resume();
      const osc = context.createOscillator(),
        gain = context.createGain();
      osc.connect(gain);
      gain.connect(context.destination);
      osc.frequency.setValueAtTime(660, context.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        880,
        context.currentTime + 0.12,
      );
      gain.gain.setValueAtTime(0.035 * volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3);
      osc.start();
      osc.stop(context.currentTime + 0.3);
    } catch {}
  }, [sound]);
  const saveSession = useCallback(async (value: Timer) => {
    if (completed.current.has(value.id)) return true;
    completed.current.add(value.id);
    const remaining = value.deadline
      ? Math.max(0, Math.ceil((value.deadline - Date.now()) / 1000))
      : value.remaining;
    const seconds = Math.max(1, value.duration - remaining);
    try {
      const result = await api<FocusSession>("/api/sessions", "POST", {
        task: value.task,
        ...(value.taskId ? { taskId: value.taskId } : {}),
        seconds,
        character: localStorage.getItem("todo.character.v1") || "male",
      });
      setSessions((s) => [result, ...s]);
      toast.success("A little progress, saved.");
      return true;
    } catch (e) {
      completed.current.delete(value.id);
      onError(e);
      return false;
    }
  }, []);
  useEffect(() => {
    if (!timerReady) return;
    const id = setInterval(async () => {
      const current = timerRef.current;
      if (!current.deadline || settling.current) return;
      const remaining = Math.max(
        0,
        Math.ceil((current.deadline - Date.now()) / 1000),
      );
      if (!remaining) {
        if (current.phase === "focus") {
          settling.current = true;
          setTimer({ ...current, remaining: 0, deadline: null });
          const saved =
            current.phase === "focus" ? await saveSession(current) : true;
          settling.current = false;
          if (!saved) return;
          setFocusCompletions((v) => v + 1);
          setTimer({ ...freshTimer, task: current.task });
        } else {
          // The room announces expiry and restores its tools under Todo’s wipe.
          setTimer({ ...current, remaining: 0, deadline: null });
        }
        setInRoom(true);
        setPanel(null);
      } else
        setTimer((t) =>
          t.remaining === remaining ? t : { ...current, remaining },
        );
    }, 250);
    return () => clearInterval(id);
  }, [timerReady, saveSession, chime]);
  useEffect(() => {
    if (!inRoom) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, [inRoom]);
  const choose = (id: Panel) => {
    if (!identity && id !== "settings") {
      setAccountMode("signup");
      setAccountOpen(true);
      return;
    }
    if (id === "solo" || id === "agent" || id === "friends") {
      setInRoom(true);
      if (id === "agent") setAgentMode(true);
      setPanel(id === "solo" ? null : id);
    } else setPanel(id);
    chime();
  };
  const switchCharacter = () =>
    introRef.current?.selectCharacter(female ? "male" : "female");
  const addTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!taskDraft.trim() || saving) return;
    setSaving(true);
    try {
      const result = await api<Task>("/api/tasks", "POST", {
        title: taskDraft,
      });
      setTasks((t) => [result, ...t]);
      if (!timer.task) setTimer((t) => ({ ...t, task: result.title }));
      setTaskDraft("");
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };
  const toggleTask = async (task: Task) => {
    try {
      const updated = await api<Task>("/api/tasks", "PATCH", {
        id: task.id,
        done: !task.done,
      });
      setTasks((ts) => ts.map((t) => (t.id === updated.id ? updated : t)));
      if (updated.done) chime();
    } catch (e) {
      onError(e);
    }
  };
  const removeTask = async (task: Task) => {
    try {
      await api("/api/tasks", "DELETE", { id: task.id });
      setTasks((ts) => ts.filter((t) => t.id !== task.id));
    } catch (e) {
      onError(e);
    }
  };
  const start = () => {
    if (timer.deadline) {
      setTimer((t) => ({
        ...t,
        remaining: Math.max(0, Math.ceil((t.deadline! - Date.now()) / 1000)),
        deadline: null,
      }));
      return;
    }
    const current = timerRef.current;
    if (current.phase === "focus" && !current.task.trim()) {
      toast("Give this session one small task first.");
      return;
    }
    setTimer((t) => ({
      ...t,
      deadline: Date.now() + t.remaining * 1000,
      started: true,
      startedAt: t.startedAt || Date.now(),
      id: t.id || crypto.randomUUID(),
    }));
    chime();
  };
  const finish = async () => {
    if (settling.current) return false;
    settling.current = true;
    const current = timerRef.current;
    setTimer({
      ...current,
      remaining: current.deadline
        ? Math.max(0, Math.ceil((current.deadline - Date.now()) / 1000))
        : current.remaining,
      deadline: null,
    });
    const saved = current.phase === "focus" ? await saveSession(current) : true;
    settling.current = false;
    if (saved) {
      setTimer({ ...freshTimer, task: current.task });
    }
    return saved;
  };
  const clock = `${Math.floor(timer.remaining / 60)
    .toString()
    .padStart(2, "0")}:${(timer.remaining % 60).toString().padStart(2, "0")}`;

  useEffect(() => {
    if (timer.deadline) document.title = `${clock} - Todo`;
    else document.title = "Todo — A little company, a little progress";
    return () => {
      document.title = "Todo — A little company, a little progress";
    };
  }, [clock, timer.deadline]);

  return (
    <main
      data-ready={timerReady}
      className={`todo-root ${(inRoom ? reduced || systemReduced : systemReduced) ? "reduce-motion" : ""} ${inRoom ? "room-active" : ""}`}
    >
      <Welcome
        ref={introRef}
        reduced={systemReduced}
        ready={timerReady && auth.ready}
        active={!inRoom}
        blocked={Boolean(panel) || accountOpen}
        greeting={
          identity
            ? `${returning ? "Welcome back" : "Hey"}${profile?.name || identity.name ? `, ${profile?.name || identity.name?.split(" ")[0]}` : ""}.`
            : "Hey, you."
        }
        signedIn={Boolean(identity)}
        onAccount={(mode) => {
          setAccountMode(mode);
          setAccountOpen(true);
        }}
        onChoose={choose}
        onCharacterChange={setFemale}
        timer={{
          started: timer.started,
          clock,
          running: Boolean(timer.deadline),
        }}
      />
      {accountOpen ? (
        <AccountPanel
          open={accountOpen}
          onOpenChange={setAccountOpen}
          mode={accountMode}
          identity={identity}
          profile={profile}
          female={female}
          signInPath={signInPath}
          signOutPath={signOutPath}
          reduced={systemReduced}
          auth={auth}
          onSaved={(next) => {
            setProfile(next);
            setReturning(false);
            setProfileError("");
          }}
        />
      ) : null}
      {auth.error ? (
        <p className="profile-load-error" role="alert">
          {auth.error}
        </p>
      ) : null}
      {profileError ? (
        <p className="profile-load-error" role="status">
          {profileError}
        </p>
      ) : null}
      <StudyRoom
        active={inRoom}
        userId={identity?.id || "guest"}
        tasks={tasks}
        notes={notes}
        sessions={sessions}
        connection={connection}
        onTasks={setTasks}
        onNotes={setNotes}
        remaining={timer.remaining}
        duration={timer.duration}
        focusMinutes={minutes}
        timerId={timer.id}
        startedAt={timer.startedAt}
        focusCompletions={focusCompletions}
        onBreak={(breakMinutes) => {
          const seconds = breakMinutes * 60;
          setTimer((t) => ({
            ...freshTimer,
            phase: "break",
            remaining: seconds,
            duration: seconds,
            task: t.task,
            started: true,
            deadline: Date.now() + seconds * 1000,
            startedAt: Date.now(),
            id: crypto.randomUUID(),
          }));
        }}
        sound={sound}
        onSound={setSound}
        onReduced={setReduced}
        onBusy={setAgentBusy}
        onDuration={(value) => {
          if (timer.started) return;
          setMinutes(value);
          setTimer((t) => ({
            ...t,
            remaining: value * 60,
            duration: value * 60,
          }));
        }}
        female={female}
        reduced={reduced}
        clock={clock}
        running={Boolean(timer.deadline)}
        started={timer.started}
        task={timer.task}
        taskId={timer.taskId}
        phase={timer.phase}
        agentBusy={agentBusy}
        agentMode={agentMode}
        onAgentMode={(mode) => {
          setAgentMode(mode);
          if (!mode) setPanel(null);
        }}
        onTask={(task, begin, taskId) => {
          setTimer((t) => ({
            ...t,
            task,
            taskId: taskId ?? null,
            ...(begin
              ? {
                  deadline: Date.now() + t.remaining * 1000,
                  started: true,
                  startedAt: t.startedAt || Date.now(),
                  id: t.id || crypto.randomUUID(),
                }
              : {}),
          }));
          if (begin) chime();
        }}
        onStart={start}
        onExtend={() =>
          setTimer((current) => {
            if (!current.started || current.phase !== "focus") return current;
            const extra = Math.max(0, Math.min(300, 7200 - current.duration));
            return {
              ...current,
              duration: current.duration + extra,
              remaining: current.remaining + extra,
              deadline: current.deadline
                ? current.deadline + extra * 1000
                : null,
            };
          })
        }
        onFinish={finish}
        onExit={() => {
          setPanel(null);
          setAgentMode(false);
          setInRoom(false);
        }}
        onRestoreRoom={() => {
          setPanel(null);
          setAgentMode(false);
          setInRoom(true);
        }}
        onPanel={(id) => {
          if (id === "agent") setAgentMode(true);
          setPanel(id);
        }}
      />

      <Dialog
        open={panel === "solo"}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className="todo-dialog focus-dialog">
          <DialogHeader>
            <div className="dialog-eyebrow">
              <Headphones size={16} /> A moment for you
            </div>
            <DialogTitle>
              {timer.phase === "break"
                ? "Take a little breather."
                : "Let’s do one small thing."}
            </DialogTitle>
            <DialogDescription>
              {timer.phase === "break"
                ? "Stretch, get some water, and rest for a moment."
                : "No perfect plan needed. Just a place to begin."}
            </DialogDescription>
          </DialogHeader>
          {loadError ? (
            <div className="inline-warning">
              {loadError}
              <button onClick={load}>Retry</button>
            </div>
          ) : null}
          <div className="focus-clock">
            <span>{clock}</span>
            <small>
              {timer.phase === "break"
                ? "break time"
                : timer.deadline
                  ? "one little step at a time"
                  : "your time, your pace"}
            </small>
          </div>
          {!timer.started && timer.phase === "focus" ? (
            <div className="duration-picker" aria-label="Focus duration">
              {[15, 25, 45].map((m) => (
                <Button
                  key={m}
                  variant={minutes === m ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setMinutes(m);
                    setTimer((t) => ({
                      ...t,
                      remaining: m * 60,
                      duration: m * 60,
                    }));
                  }}
                >
                  {m} min
                </Button>
              ))}
            </div>
          ) : null}
          {timer.phase === "focus" ? (
            <div className="space-y-2">
              <Label htmlFor="session-task">What are you working on?</Label>
              <Input
                id="session-task"
                placeholder="Something small is a good start…"
                maxLength={180}
                value={timer.task}
                disabled={timer.started}
                onChange={(e) =>
                  setTimer((t) => ({ ...t, task: e.target.value }))
                }
              />
            </div>
          ) : null}
          <div className="flex justify-center gap-2">
            <Button size="lg" className="warm-button" onClick={start}>
              {timer.deadline ? <Pause size={17} /> : <Play size={17} />}{" "}
              {timer.deadline
                ? "Pause"
                : timer.started
                  ? "Keep going"
                  : timer.phase === "break"
                    ? "Start break"
                    : "Start focusing"}
            </Button>
            {timer.started ? (
              <Button
                variant="outline"
                size="lg"
                onClick={
                  timer.phase === "focus"
                    ? finish
                    : () => {
                        setTimer({ ...freshTimer, task: timer.task });
                      }
                }
              >
                <CheckCheck size={17} />
                {timer.phase === "break" ? "Back to focus" : "Finish"}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="Reset timer"
              onClick={() => {
                setTimer({
                  ...freshTimer,
                  task: timer.task,
                  remaining: minutes * 60,
                  duration: minutes * 60,
                });
              }}
            >
              <RotateCcw size={17} />
            </Button>
          </div>
          {timer.phase === "break" ? (
            <div className="break-rest">
              <p>A little space to recharge.</p>
              <small>
                Stretch your flippers, get some water, and take your time.
              </small>
            </div>
          ) : (
            <div className="task-section">
              <div className="section-label">
                <span>Your little list</span>
                <button onClick={() => setPanel("history")}>
                  <History size={13} />
                  History
                </button>
              </div>
              <form onSubmit={addTask} className="task-form">
                <Input
                  value={taskDraft}
                  onChange={(e) => setTaskDraft(e.target.value)}
                  placeholder="Add a little thing to do"
                  maxLength={180}
                  aria-label="New task"
                />
                <Button
                  variant="outline"
                  size="icon"
                  disabled={saving || !taskDraft.trim()}
                  aria-label="Add task"
                >
                  {saving ? <Loader2 className="animate-spin" /> : <Plus />}
                </Button>
              </form>
              <div className="task-list">
                {tasks.length ? (
                  tasks.map((task) => (
                    <div className="task-row" key={task.id}>
                      <Checkbox
                        aria-label={`Complete ${task.title}`}
                        checked={task.done}
                        onCheckedChange={() => toggleTask(task)}
                      />
                      <button
                        className={task.done ? "task-done" : ""}
                        disabled={timer.started || task.done}
                        onClick={() =>
                          setTimer((t) => ({ ...t, task: task.title }))
                        }
                      >
                        {task.title}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Delete ${task.title}`}
                        onClick={() => removeTask(task)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="quiet-empty">
                    A clear little space. Add your first task above.
                  </p>
                )}
              </div>
            </div>
          )}
          <p className="dialog-footnote">
            Your timer and Todo stay in the room when you close this panel.
          </p>
        </DialogContent>
      </Dialog>

      <AgentPanel
        open={panel === "agent"}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
        connection={connection}
        onSave={(note) => setNotes((ns) => [note, ...ns])}
        onBusyChange={setAgentBusy}
      />
      <Dialog
        open={panel === "friends"}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className="todo-dialog">
          <DialogHeader>
            <div className="dialog-eyebrow">
              <Users size={16} /> Better together
            </div>
            <DialogTitle>A seat for your friends.</DialogTitle>
            <DialogDescription>
              One cozy room. Your own work. Real conversations.
            </DialogDescription>
          </DialogHeader>
          <div className="friends-preview" aria-hidden="true">
            <span>🐧</span>
            <span>🐧</span>
            <span className="empty-seat">+</span>
          </div>
          <div className="coming-note">
            <span className="tiny-tag">Next chapter</span>
            <h3>We’re getting the room ready.</h3>
            <p>
              Private invites, microphone chat, and shared breaks will live
              here. This first version is your solo space.
            </p>
          </div>
          <Button className="warm-button" onClick={() => choose("solo")}>
            Focus with Todo for now <ArrowRight size={16} />
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog
        open={panel === "settings"}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className="todo-dialog">
          <DialogHeader>
            <div className="dialog-eyebrow">
              <Settings2 size={16} /> Make yourself comfortable
            </div>
            <DialogTitle>Your little preferences.</DialogTitle>
            <DialogDescription>
              A few ways to make Todo feel like you.
            </DialogDescription>
          </DialogHeader>
          <div className="setting-row">
            <div>
              <Label htmlFor="motion">Gentler motion</Label>
              <p>Turn off cursor warping and extra movement.</p>
            </div>
            <Switch
              id="motion"
              checked={reduced}
              onCheckedChange={setReduced}
            />
          </div>
          <div className="setting-row">
            <div>
              <Label htmlFor="sounds">Little sound effects</Label>
              <p>A quiet chime for starts and small wins.</p>
            </div>
            <Switch id="sounds" checked={sound} onCheckedChange={setSound} />
          </div>
          <div className="setting-row">
            <div>
              <Label>Your companion</Label>
              <p>
                {female
                  ? "Her turn to keep you company."
                  : "His turn to keep you company."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPanel(null);
                setInRoom(false);
                switchCharacter();
              }}
            >
              Switch <ChevronDown size={14} />
            </Button>
          </div>
          <div className="connection-box">
            <div>
              <Sparkles size={16} />
              <strong>
                {connection?.ai
                  ? `${connection.provider} connected`
                  : "AI connection waiting"}
              </strong>
            </div>
            <p>
              {connection?.ai
                ? "Your API key is kept on the server, never in the browser."
                : "Focus, notes, and PDF export work now. AI needs a private server connection before it can answer."}
            </p>
          </div>
          <Button variant="ghost" onClick={() => setPanel("history")}>
            <History size={15} />
            View focus history
          </Button>
        </DialogContent>
      </Dialog>

      <NotesPanel
        open={panel === "notes"}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
        notes={notes}
        setNotes={setNotes}
      />
      <Dialog
        open={panel === "history"}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className="todo-dialog">
          <DialogHeader>
            <div className="dialog-eyebrow">
              <History size={16} /> Little proof of progress
            </div>
            <DialogTitle>You showed up.</DialogTitle>
            <DialogDescription>
              Every small session counts. No streaks to keep.
            </DialogDescription>
          </DialogHeader>
          <div className="history-summary">
            <strong>
              {Math.round(sessions.reduce((sum, s) => sum + s.seconds, 0) / 60)}
            </strong>
            <span>minutes of showing up</span>
          </div>
          <div className="history-list">
            {sessions.length ? (
              sessions.map((s) => (
                <div className="history-item" key={s.id}>
                  <Check size={17} />
                  <div>
                    <strong>{s.task}</strong>
                    <p>
                      {new Date(s.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · {Math.max(1, Math.round(s.seconds / 60))} min
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="quiet-empty">
                Your first little win will appear here after a focus session.
              </p>
            )}
          </div>
          <Button variant="outline" onClick={() => choose("solo")}>
            <ArrowLeft size={15} />
            Back to focus
          </Button>
        </DialogContent>
      </Dialog>
      <Toaster position="top-center" theme="light" richColors />
    </main>
  );
}

function AgentPanel({
  connection,
  onSave,
  open,
  onOpenChange,
  onBusyChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  connection: Connection | null;
  onSave: (note: Note) => void;
}) {
  const [mode, setMode] = useState("chat"),
    [draft, setDraft] = useState(""),
    [messages, setMessages] = useState<Message[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [image, setImage] = useState<{ data: string; name: string } | null>(
      null,
    ),
    [reading, setReading] = useState(false),
    [exporting, setExporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null),
    bottom = useRef<HTMLDivElement>(null),
    abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "instant", block: "nearest" });
  }, [messages, busy]);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setReading(true);
    try {
      if (["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        if (file.size > 3 * 1024 * 1024)
          throw new Error("Choose an image smaller than 3 MB.");
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Couldn’t read that image."));
          reader.readAsDataURL(file);
        });
        setImage({ data, name: file.name });
        if (!draft.trim()) setDraft("Help me understand this image.");
      } else if (/\.(txt|md)$/i.test(file.name)) {
        if (file.size > 70000)
          throw new Error("Choose a text file smaller than 70 KB.");
        const text = await file.text();
        if (text.length > 18000)
          throw new Error(
            "This file is a little long. Try a shorter section (under 18,000 characters).",
          );
        setDraft(`Here is ${file.name}:\n\n${text}`);
      } else throw new Error("Choose a PNG, JPG, WebP, TXT, or Markdown file.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t read that file.");
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setError("");
    const user: Message = {
      role: "user",
      content: draft,
      imageName: image?.name,
    };
    const next = [...messages, user];
    setMessages(next);
    setDraft("");
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          mode,
          messages: next
            .slice(-20)
            .map(({ role, content }) => ({ role, content })),
          image: image?.data,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        text: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Todo couldn’t answer this time.");
      setMessages((m) => [...m, { role: "assistant", content: result.text }]);
      setImage(null);
    } catch (e) {
      if (controller.signal.aborted)
        setError("Stopped. You can edit your message and try again.");
      else setError(e instanceof Error ? e.message : "Couldn’t connect.");
      setMessages(messages);
      setDraft(user.content);
    } finally {
      setBusy(false);
    }
  };
  const save = async (message: Message) => {
    try {
      const note = await api<Note>("/api/notes", "POST", {
        title:
          message.content
            .split("\n")[0]
            .replace(/^#+\s*/, "")
            .slice(0, 100) || "A note from Todo",
        content: message.content,
      });
      onSave(note);
      toast.success("Saved in your notes.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn’t save.");
    }
  };
  const download = async (message: Message) => {
    setExporting(true);
    try {
      await exportPDF("Notes from Todo", message.content);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn’t export.");
    } finally {
      setExporting(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="todo-dialog agent-dialog">
        <DialogHeader>
          <div className="dialog-eyebrow">
            <Sparkles size={16} /> A little help, whenever you need it
          </div>
          <DialogTitle>What’s on your mind?</DialogTitle>
          <DialogDescription>
            Make notes, find the main idea, or talk it through.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={mode} onValueChange={setMode}>
          <TabsList className="agent-tabs">
            {[
              ["chat", "Chat"],
              ["notes", "Make notes"],
              ["summarize", "Summarize"],
              ["explain", "Explain"],
            ].map(([id, label]) => (
              <TabsTrigger key={id} value={id} disabled={busy}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {!connection?.ai ? (
          <div className="ai-notice">
            <CircleHelp size={16} />
            <p>
              The AI connection isn’t set up yet. You can explore this
              workspace; answers will be available once a private API key is
              connected.
            </p>
          </div>
        ) : (
          <div className="connection-status">
            <span className="live-dot" />
            {connection.provider} · connected
          </div>
        )}
        <div className="conversation" aria-live="polite">
          {!messages.length ? (
            <div className="agent-empty">
              <div className="empty-spark">
                <Sparkles size={26} />
              </div>
              <h3>A second pair of flippers.</h3>
              <p>Bring your notes, a question, or something you’re stuck on.</p>
              <div className="prompt-chips">
                {[
                  "Help me plan a study session",
                  "Turn my text into clear notes",
                  "Explain something step by step",
                ].map((prompt) => (
                  <button key={prompt} onClick={() => setDraft(prompt)}>
                    {prompt}
                    <ArrowUp size={12} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div className={`chat-message ${m.role}`} key={i}>
                <span className="message-who">
                  {m.role === "user" ? "You" : "Todo"}
                </span>
                {m.imageName ? (
                  <small className="image-label">
                    <ImagePlus size={12} />
                    {m.imageName}
                  </small>
                ) : null}
                <p>{m.content}</p>
                {m.role === "assistant" ? (
                  <div className="message-actions">
                    <Button variant="ghost" size="xs" onClick={() => save(m)}>
                      <FileText size={12} />
                      Save note
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={exporting}
                      onClick={() => download(m)}
                    >
                      <Download size={12} />
                      PDF
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
          {busy ? (
            <div className="thinking">
              <Loader2 className="animate-spin" size={16} />
              Todo is thinking…
              <button onClick={() => abort.current?.abort()}>Stop</button>
            </div>
          ) : null}
          <div ref={bottom} />
        </div>
        {error ? (
          <div className="inline-warning" role="alert">
            {error}
          </div>
        ) : null}
        <form onSubmit={send} className="composer">
          {image ? (
            <div className="image-attachment">
              <ImagePlus size={13} />
              <span>{image.name}</span>
              <button
                type="button"
                onClick={() => setImage(null)}
                aria-label="Remove attached image"
              >
                <X size={13} />
              </button>
            </div>
          ) : null}
          <Textarea
            aria-label="Message Todo"
            placeholder={
              mode === "chat"
                ? "Tell Todo what you need a hand with…"
                : "Paste your text, or attach a file…"
            }
            value={draft}
            maxLength={20000}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className="composer-controls">
            <input
              ref={fileInput}
              type="file"
              accept=".txt,.md,image/png,image/jpeg,image/webp"
              className="sr-only"
              aria-label="Attach text or image"
              onChange={(e) => upload(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy || reading}
              onClick={() => fileInput.current?.click()}
            >
              <Plus size={16} />
              {reading ? "Reading…" : "Attach"}
            </Button>
            <span>⌘ / Ctrl + Enter</span>
            <Button
              className="warm-button"
              size="sm"
              disabled={!draft.trim() || busy || reading}
            >
              {busy ? (
                <Loader2 className="animate-spin" size={15} />
              ) : (
                <ArrowUp size={15} />
              )}
              Send
            </Button>
          </div>
        </form>
        <p className="dialog-footnote">
          Only what you send goes to the AI. Double-check important answers.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function NotesPanel({
  notes,
  setNotes,
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: Note[];
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
}) {
  const [title, setTitle] = useState(""),
    [content, setContent] = useState(""),
    [busy, setBusy] = useState(false),
    [exporting, setExporting] = useState(false);
  const save = async () => {
    if (!title.trim() || !content.trim()) return;
    setBusy(true);
    try {
      const note = await api<Note>("/api/notes", "POST", { title, content });
      setNotes((ns) => [note, ...ns]);
      toast.success("A little thought, safely kept.");
      setTitle("");
      setContent("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn’t save.");
    } finally {
      setBusy(false);
    }
  };
  const download = async () => {
    setExporting(true);
    try {
      await exportPDF(title || "My Todo notes", content);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn’t export.");
    } finally {
      setExporting(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="todo-dialog notes-dialog">
        <DialogHeader>
          <div className="dialog-eyebrow">
            <FileText size={16} /> A place for your thoughts
          </div>
          <DialogTitle>Your little notebook.</DialogTitle>
          <DialogDescription>
            Write something down, keep it, or take it with you as a PDF.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="write">
          <TabsList>
            <TabsTrigger value="write">Write a note</TabsTrigger>
            <TabsTrigger value="saved">
              Saved notes ({notes.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="write" className="note-editor">
            <Label htmlFor="note-title">Title</Label>
            <Input
              id="note-title"
              value={title}
              maxLength={160}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your thought a name"
            />
            <Label htmlFor="note-content">Your notes</Label>
            <Textarea
              id="note-content"
              value={content}
              maxLength={50000}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start anywhere…"
              className="note-textarea"
            />
            <div className="flex gap-2">
              <Button
                className="warm-button"
                disabled={busy || !title.trim() || !content.trim()}
                onClick={save}
              >
                {busy ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Check size={15} />
                )}
                Save note
              </Button>
              <Button
                variant="outline"
                disabled={exporting || !content.trim()}
                onClick={download}
              >
                <Download size={15} />
                {exporting ? "Making PDF…" : "Export PDF"}
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="saved">
            <div className="saved-notes">
              {notes.length ? (
                notes.map((note) => (
                  <div className="saved-note" key={note.id}>
                    <button
                      onClick={() => {
                        setTitle(note.title);
                        setContent(note.content);
                        toast("Loaded into the Write a note tab.");
                      }}
                    >
                      <strong>{note.title}</strong>
                      <p>{note.content.slice(0, 110)}</p>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete note ${note.title}`}
                      onClick={async () => {
                        try {
                          await api("/api/notes", "DELETE", { id: note.id });
                          setNotes((ns) => ns.filter((n) => n.id !== note.id));
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : "Couldn’t delete.",
                          );
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="quiet-empty">Your notes will find a home here.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
