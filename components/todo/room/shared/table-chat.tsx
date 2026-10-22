"use client";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type CSSProperties,
} from "react";
import { ROOM_CONFIG as C } from "../config";
import { createPortal } from "react-dom";
import { MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  TableSession,
  TableSnapshot,
  TableMessage,
} from "@/lib/todo/table/session";
import type { BreakGameSession } from "@/lib/todo/table/games";
import "./table-chat.css";
import { trapDockPanel } from "../dock-panels";

function MessagePreview({
  message,
  children,
}: {
  message: TableMessage;
  children: ReactNode;
}) {
  // A changing negative delay would accelerate the preview on each timer render.
  const [delay] = useState(() => -Math.max(0, Date.now() - message.at));
  return (
    <article
      className="table-message-preview"
      data-kind={message.kind}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </article>
  );
}

/** A quiet, session-only conversation. Messages are text, never interpreted HTML. */
export function TableChat({
  session,
  table,
  games,
  available,
  active,
  focusing = false,
  glass = 0,
  onOpenChange,
}: {
  session: TableSession;
  table: TableSnapshot;
  games: BreakGameSession;
  available: boolean;
  active: boolean;
  focusing?: boolean;
  glass?: number;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    onOpenChange?.(open);
    return () => onOpenChange?.(false);
  }, [open, onOpenChange]);
  const [now, setNow] = useState(() => Date.now());
  const end = useRef<HTMLDivElement>(null),
    scroller = useRef<HTMLDivElement>(null);
  const stayAtEnd = useRef(true),
    input = useRef<HTMLTextAreaElement>(null),
    launcher = useRef<HTMLButtonElement>(null);
  useSyncExternalStore(games.subscribe, games.getSnapshot, games.getSnapshot);
  const joined = table.state === "joined" || table.state === "reconnecting";
  const visible = table.conversation
    .filter((m) => m.from !== table.id && now - m.at < 10000 && !focusing)
    .slice(-3);
  useEffect(() => {
    setNow(Date.now());
    const newest = table.conversation.at(-1)?.at;
    if (!newest) return;
    // Expire each preview independently; the scrollable conversation remains.
    const timers = table.conversation
      .slice(-6)
      .map((m) =>
        setTimeout(
          () => setNow(Date.now()),
          Math.max(0, m.at + 10000 - Date.now()) + 30,
        ),
      );
    return () => timers.forEach(clearTimeout);
  }, [table.conversation]);
  useEffect(() => {
    if (!available || !joined) setOpen(false);
  }, [available, joined]);
  useEffect(() => {
    setDraft("");
    setError("");
  }, [table.id]);
  useEffect(() => {
    if (open) {
      stayAtEnd.current = true;
      input.current?.focus();
      end.current?.scrollIntoView({ block: "nearest" });
    }
  }, [open]);
  useEffect(() => {
    if (open && stayAtEnd.current)
      end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [table.conversation, open]);
  const close = () => {
    setOpen(false);
    launcher.current?.focus();
  };
  const entry = (m: TableMessage, preview = false) => (
    <>
      <div className="table-chat-byline">
        <strong>{m.from === table.id ? "You" : m.name}</strong>
        {!preview && (
          <time dateTime={new Date(m.at).toISOString()}>
            {new Date(m.at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        )}
      </div>
      <p>{m.text}</p>
      {m.kind === "game" && m.from !== table.id && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (games.joinInvitation(m)) setOpen(false);
          }}
        >
          {games.canJoin(m)
            ? "Join game"
            : !games.getSnapshot().active &&
                table.members.some(
                  (p) => p.id === m.from && p.playing === m.game,
                )
              ? "Available when you take a break."
              : "That game has ended."}
        </Button>
      )}
    </>
  );
  if (!active || !joined || typeof document === "undefined") return null;
  return createPortal(
    <aside
      className="table-conversation"
      aria-label="Table conversation"
      data-visible-polish={C.visiblePolish.enabled}
      data-many-seats={table.members.length > 2}
      style={{ "--glass-tint": glass } as CSSProperties}
    >
      {!open && (
        <div
          className="table-message-previews"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {visible.map((m) => (
            <MessagePreview key={m.id} message={m}>
              {entry(m, true)}
            </MessagePreview>
          ))}
        </div>
      )}
      {available && (
        <button
          ref={launcher}
          type="button"
          className="table-chat-launch"
          aria-label="Table chat"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <MessageCircle size={17} />
          <span>Chat</span>
        </button>
      )}
      {open && (
        <section
          className="table-chat-panel"
          role="dialog"
          aria-label="Table chat"
          onKeyDown={(e) => {
            trapDockPanel(e);
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            }
          }}
        >
          <header>
            <h2>At your table</h2>
            <button aria-label="Close table chat" onClick={close}>
              <X size={17} />
            </button>
          </header>
          <small>Messages disappear when the table closes.</small>
          {games.getSnapshot().notice && (
            <p role="status">{games.getSnapshot().notice}</p>
          )}
          <div
            ref={scroller}
            className="table-chat-history"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            data-lenis-prevent
            onScroll={() => {
              const el = scroller.current;
              if (el)
                stayAtEnd.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 50;
            }}
          >
            {table.conversation.map((m) => (
              <article
                key={m.id}
                data-self={m.from === table.id}
                data-kind={m.kind}
              >
                {entry(m)}
              </article>
            ))}
            <div ref={end} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (session.chat(draft)) {
                setDraft("");
                setError("");
                stayAtEnd.current = true;
              } else
                setError(
                  table.state !== "joined"
                    ? "Reconnecting to your table…"
                    : "Give the table a moment, then send again.",
                );
            }}
          >
            <Textarea
              ref={input}
              aria-label="Message your table"
              placeholder="Say something to your table…"
              value={draft}
              rows={2}
              maxLength={1000}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!draft.trim() || table.state !== "joined"}
              aria-label="Send table message"
            >
              <Send size={16} />
            </Button>
          </form>
          {error && <small role="status">{error}</small>}
        </section>
      )}
    </aside>,
    document.body,
  );
}
