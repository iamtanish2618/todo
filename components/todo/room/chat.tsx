"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, FileDown, Loader2, Plus, Square, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, type Connection, type Note } from "@/lib/todo/client";
import { makeRoomPDF } from "./pdf";

type Message = { role: "user" | "assistant"; content: string };
export function RoomChat({
  connection,
  onBusy,
  onRest,
  onNote,
  onClose,
}: {
  connection: Connection | null;
  onBusy: (busy: boolean) => void;
  onRest: () => void;
  onNote: (note: Note) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState("chat"),
    [draft, setDraft] = useState(""),
    [messages, setMessages] = useState<Message[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [attachment, setAttachment] = useState<{
    data: string;
    name: string;
  } | null>(null);
  const inputFile = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null),
    transcript = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      onBusy(false);
    },
    [onBusy],
  );
  useEffect(() => {
    if (transcript.current)
      transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [messages, busy]);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    try {
      if (["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        if (file.size > 3 * 1024 * 1024)
          throw new Error("Choose an image smaller than 3 MB.");
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () =>
            reject(new Error("Could not read that image."));
          reader.readAsDataURL(file);
        });
        setAttachment({ data, name: file.name });
        if (!draft.trim()) setDraft("Help me understand this image.");
      } else if (/\.(txt|md)$/i.test(file.name)) {
        if (file.size > 70000)
          throw new Error("Choose a text file smaller than 70 KB.");
        const text = await file.text();
        if (text.length > 18000)
          throw new Error("Try a shorter section of these notes.");
        setDraft(`Here is ${file.name}:\n\n${text}`);
      } else throw new Error("Choose a TXT, Markdown, PNG, JPEG or WebP file.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file.");
    } finally {
      if (inputFile.current) inputFile.current.value = "";
    }
  };
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || busy || !connection?.ai) return;
    const user: Message = { role: "user", content: draft.trim() },
      next = [...messages, user];
    setError("");
    setMessages(next);
    setDraft("");
    setBusy(true);
    onBusy(true);
    const request = new AbortController();
    controller.current = request;
    try {
      const result = await api<{ text: string }>(
        "/api/chat",
        "POST",
        {
          mode,
          messages: next.slice(-20),
          ...(attachment ? { image: attachment.data } : {}),
        },
        request.signal,
      );
      setMessages([...next, { role: "assistant", content: result.text }]);
      setAttachment(null);
    } catch (error) {
      if ((error as { status?: number }).status === 429) {
        onRest();
        return;
      }
      setMessages(messages);
      setDraft(user.content);
      setError(
        request.signal.aborted
          ? "Stopped. Your words are still here."
          : error instanceof Error
            ? error.message
            : "Could not reach Todo. Please try again.",
      );
    } finally {
      setBusy(false);
      onBusy(false);
    }
  };
  const save = async (content: string) => {
    try {
      onNote(
        await api<Note>("/api/notes", "POST", {
          title:
            content
              .split("\n")[0]
              .replace(/^#+\s*/, "")
              .slice(0, 100) || "A note from Todo",
          content,
        }),
      );
      setError("Saved in your notebook.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    }
  };
  return (
    <>
      <header className="room-panel-heading">
        <div>
          <span className="room-eyebrow">A SECOND PAIR OF FLIPPERS</span>
          <DialogPrimitive.Title id="room-panel-title" asChild>
            <h2>A little help.</h2>
          </DialogPrimitive.Title>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close panel"
          onClick={onClose}
        >
          <X size={18} />
        </Button>
      </header>
      <label className="room-field">
        What would help?
        <select
          value={mode}
          disabled={busy}
          onChange={(e) => setMode(e.target.value)}
        >
          {[
            ["chat", "Chat"],
            ["summarize", "Summarize text"],
            ["notes", "Make study notes"],
            ["quiz", "Quiz questions"],
            ["flashcards", "Flashcards from notes"],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {!connection?.ai ? (
        <p className="room-soft-notice">
          Todo’s AI connection isn’t ready yet. Your timer, tasks, notes and PDF
          tools are here whenever you need them.
        </p>
      ) : null}
      <div className="room-chat-transcript" ref={transcript} aria-live="polite">
        {!messages.length ? (
          <p className="room-chat-welcome">
            Bring a question, a page of notes, or a thought you’d like to
            untangle.
          </p>
        ) : (
          messages.map((m, i) => (
            <article key={i} className={`room-chat-message ${m.role}`}>
              <span>{m.role === "user" ? "You" : "Todo"}</span>
              <p>{m.content}</p>
              {m.role === "assistant" ? (
                <div className="room-message-actions">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void save(m.content)}
                  >
                    <Plus size={14} />
                    Save note
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void makeRoomPDF("Notes from Todo", m.content).catch(
                        (e) => setError(e.message),
                      )
                    }
                  >
                    <FileDown size={14} />
                    PDF
                  </Button>
                </div>
              ) : null}
            </article>
          ))
        )}
        {busy ? (
          <p className="room-pending">
            <Loader2 size={15} className="animate-spin" />
            Thinking it through…
          </p>
        ) : null}
      </div>
      {error ? (
        <p role="status" className="room-error">
          {error}
        </p>
      ) : null}
      <form className="room-chat-compose" onSubmit={send}>
        <input
          type="file"
          ref={inputFile}
          className="sr-only"
          aria-label="Attach text or image"
          accept=".txt,.md,image/png,image/jpeg,image/webp"
          onChange={(e) => void upload(e.target.files?.[0])}
        />
        {attachment ? (
          <p className="room-attachment">
            {attachment.name}
            <button
              type="button"
              aria-label="Remove attached image"
              onClick={() => setAttachment(null)}
            >
              <X size={13} />
            </button>
          </p>
        ) : null}
        <Textarea
          aria-label="Message Todo"
          placeholder="Tell Todo, or paste your notes…"
          value={draft}
          disabled={busy}
          maxLength={20000}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            aria-label="Attach notes or a photo"
            onClick={() => inputFile.current?.click()}
          >
            <Plus size={15} />
            Attach
          </Button>
          {busy ? (
            <Button
              type="button"
              size="icon"
              aria-label="Stop reply"
              onClick={() => controller.current?.abort()}
            >
              <Square size={15} />
            </Button>
          ) : (
            <Button
              size="icon"
              aria-label="Send to Todo"
              disabled={!draft.trim() || !connection?.ai}
            >
              <ArrowUp size={18} />
            </Button>
          )}
        </div>
      </form>
    </>
  );
}
