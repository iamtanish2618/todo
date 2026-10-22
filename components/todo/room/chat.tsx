"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  FileDown,
  Loader2,
  Mic,
  MicOff,
  Plus,
  Square,
  X,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, type Connection, type Note } from "@/lib/todo/client";
import { SUPPORT } from "@/lib/todo/support";
import { makeRoomPDF } from "./pdf";
import { useMagneticSurface } from "../use-magnetic-surface";

type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult:
    ((event: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
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
  const composerMotion = useMagneticSurface(2.5, 0.7);
  const arrowMotion = useMagneticSurface(4, 3);
  const [draft, setDraft] = useState(""),
    [messages, setMessages] = useState<Message[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [canSpeak, setCanSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const live = useRef(true);
  const [attachment, setAttachment] = useState<{
    data: string;
    name: string;
  } | null>(null);
  const inputFile = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null),
    transcript = useRef<HTMLDivElement>(null);
  useEffect(() => {
    live.current = true;
    const browser = window as SpeechWindow;
    setCanSpeak(
      Boolean(browser.SpeechRecognition || browser.webkitSpeechRecognition),
    );
    return () => {
      live.current = false;
      controller.current?.abort();
      const speech = recognition.current;
      if (speech) {
        speech.onresult = speech.onerror = speech.onend = null;
        speech.abort();
      }
      onBusy(false);
    };
  }, [onBusy]);
  const dictate = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const browser = window as SpeechWindow;
    const Constructor =
      browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Constructor || busy) return;
    setError("");
    const speech = new Constructor();
    recognition.current = speech;
    speech.lang = navigator.language || "en-US";
    speech.interimResults = false;
    speech.onresult = (event) => {
      if (!live.current) return;
      setDraft((text) =>
        `${text}${text.trim() ? " " : ""}${event.results[0][0].transcript}`.slice(
          0,
          20000,
        ),
      );
    };
    speech.onend = () => {
      if (live.current) setListening(false);
    };
    speech.onerror = (event) => {
      if (!live.current) return;
      setListening(false);
      setError(
        event.error === "not-allowed"
          ? "Microphone access wasn't allowed. You can still type."
          : "Voice input couldn't finish. You can still type your message.",
      );
    };
    try {
      speech.start();
      setListening(true);
    } catch {
      setError("Voice input isn't available here. You can still type.");
    }
  };
  useEffect(() => {
    const log = transcript.current;
    if (!log) return;
    const last = log.lastElementChild as HTMLElement | null;
    // Start a long reply at its beginning, rather than dropping the reader at its end.
    log.scrollTop =
      messages.at(-1)?.role === "assistant" && last
        ? Math.max(0, last.offsetTop - 8)
        : log.scrollHeight;
  }, [messages, busy]);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    try {
      if (["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        if (file.size > 3 * 1024 * 1024)
          throw new Error("Choose an image smaller than 3 MB.");
        if (connection?.ai && !connection.vision)
          throw new Error("Image reading isn't enabled for this model yet.");
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
        setDraft((previous) =>
          `${previous.trim() ? previous + "\n\n" : ""}Here is ${file.name}:\n\n${text}`.slice(
            0,
            20000,
          ),
        );
      } else throw new Error("Choose a TXT, Markdown, PNG, JPEG or WebP file.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file.");
    } finally {
      if (inputFile.current) inputFile.current.value = "";
    }
  };
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || busy || listening || !connection?.ai) return;
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
          mode: "chat",
          messages: next.slice(-20),
          ...(attachment ? { image: attachment.data } : {}),
        },
        request.signal,
      );
      if (!live.current) return;
      setMessages([...next, { role: "assistant", content: result.text }]);
      setAttachment(null);
    } catch (error) {
      if (!live.current) return;
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
      if (live.current) {
        setBusy(false);
        onBusy(false);
      }
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
      <header className="room-agent-heading">
        <DialogPrimitive.Title id="room-panel-title">
          Todo
        </DialogPrimitive.Title>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Back to room"
          onClick={onClose}
        >
          <ArrowLeft size={14} /> Back to room
        </Button>
      </header>
      {!connection?.ai ? (
        <p className="room-soft-notice">
          Todo’s AI connection isn’t ready yet. You can prepare a message while
          it is being connected.
        </p>
      ) : null}
      {messages.length || busy ? (
        <div
          className="room-chat-transcript"
          ref={transcript}
          role="log"
          aria-label="Conversation with Todo"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {messages.map((m, i) => (
            <article
              key={i}
              className={`room-chat-message ${m.role}`}
              aria-label={m.role === "user" ? "Your message" : "Todo's reply"}
            >
              {m.role === "user" ? (
                <p>{m.content}</p>
              ) : (
                <div
                  className="room-chat-body"
                  tabIndex={SUPPORT.enabled ? 0 : undefined}
                  role={SUPPORT.enabled ? "region" : undefined}
                  aria-label={SUPPORT.enabled ? "Todo’s answer" : undefined}
                >
                  <Markdown
                    skipHtml
                    disallowedElements={["img"]}
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[
                      [
                        rehypeKatex,
                        {
                          trust: false,
                          maxSize: 12,
                          maxExpand: 500,
                          errorColor: "#6b4e38",
                        },
                      ],
                    ]}
                  >
                    {m.content}
                  </Markdown>
                </div>
              )}
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
          ))}
          {busy ? (
            <p className="room-pending">
              <Loader2 size={15} className="animate-spin" />
              Thinking it through…
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="status" className="room-error">
          {error}
        </p>
      ) : null}
      <form
        className="room-chat-compose magnetic-surface"
        onSubmit={send}
        {...composerMotion}
      >
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
          placeholder="Talk with Todo…"
          value={draft}
          disabled={busy}
          maxLength={20000}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              if (!listening) event.currentTarget.form?.requestSubmit();
            }
          }}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="room-agent-compose-tools">
          <div className="room-agent-input-tools">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="room-chat-tool"
              disabled={busy}
              aria-label="Attach notes or a photo"
              onClick={() => inputFile.current?.click()}
            >
              <Plus size={15} />
              <span className="room-chat-tool-label" aria-hidden="true">
                Attach
              </span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="room-chat-tool"
              disabled={busy || !canSpeak}
              aria-label={listening ? "Stop voice input" : "Speak to Todo"}
              aria-pressed={listening}
              title={
                canSpeak
                  ? "Dictate with your browser, then review before sending"
                  : "Voice input isn't supported by this browser"
              }
              onClick={dictate}
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
              <span className="room-chat-tool-label" aria-hidden="true">
                {listening ? "Stop" : "Speak"}
              </span>
            </Button>
          </div>
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
              className="room-chat-send magnetic-surface"
              {...arrowMotion}
              aria-label="Send to Todo"
              disabled={!draft.trim() || listening || !connection?.ai}
            >
              <ArrowRight size={19} />
            </Button>
          )}
        </div>
        {listening ? (
          <p className="room-voice-status" role="status">
            Listening… Your browser may use its speech service. Review the text
            before sending.
          </p>
        ) : null}
      </form>
    </>
  );
}
