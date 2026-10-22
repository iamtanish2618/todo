"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { gsap } from "gsap";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { COLORS, type Member } from "@/lib/todo/table/protocol";
import type { TableSnapshot, TableSession } from "@/lib/todo/table/session";
import type { TableVoice, VoiceSnapshot } from "@/lib/todo/table/voice";
import { RoomPenguin } from "../penguin";
import { DeskNotebook } from "../notebook";
import { WorkingFlippers } from "../flippers";
const SEATS: Record<number, { x: number[]; scale: number }> = {
  1: { x: [50], scale: 1.3 },
  2: { x: [42, 58], scale: 1.1 },
  3: { x: [33, 48, 63], scale: 0.9 },
  4: { x: [28, 40.5, 53, 65.5], scale: 0.78 },
};
const EMOJI = { wave: "👋", cheer: "✦", heart: "♡", coffee: "☕" };
export function TableSeats({
  table,
  voice,
  voiceState,
  session,
  reduced,
}: {
  table: TableSnapshot;
  voice: TableVoice;
  voiceState: VoiceSnapshot;
  session: TableSession;
  reduced: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState<Member[]>(table.members),
    [open, setOpen] = useState("");
  // Retain departed seats for their exit fade, then remove them; never invent people.
  useEffect(() => {
    const update = setTimeout(
      () =>
        setRendered((previous) => [
          ...table.members,
          ...previous.filter((m) => !table.members.some((n) => n.id === m.id)),
        ]),
      0,
    );
    const prune = setTimeout(
      () => setRendered(table.members),
      reduced ? 20 : 450,
    );
    return () => {
      clearTimeout(update);
      clearTimeout(prune);
    };
  }, [table.members, reduced]);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const layout = SEATS[Math.max(1, Math.min(4, table.members.length))];
    const ctx = gsap.context(() => {
      for (const node of el.querySelectorAll<HTMLElement>(".table-seat")) {
        const index = table.members.findIndex(
            (m) => m.id === node.dataset.peer,
          ),
          entering = node.dataset.seated !== "true";
        if (index < 0) {
          gsap.to(node, { opacity: 0, y: reduced ? 0 : 8, duration: 0.3 });
          continue;
        }
        const x = layout.x[index];
        if (entering)
          gsap.set(node, {
            xPercent: (x - 50) / 0.22,
            y: reduced ? 0 : 12,
            scale: layout.scale * (reduced ? 1 : 0.97),
            opacity: 0,
          });
        gsap.to(node, {
          xPercent: (x - 50) / 0.22,
          y: 0,
          scale: layout.scale,
          opacity: 1,
          duration: reduced ? 0.18 : 0.4,
          ease: "power3.out",
        });
        if (entering) node.dataset.seated = "true";
      }
    }, el);
    return () => ctx.kill(false);
  }, [rendered, table.members, reduced]);
  const layout = SEATS[Math.max(1, table.members.length)];
  return (
    <div
      ref={root}
      className="table-ensemble"
      data-count={table.members.length}
    >
      {rendered.map((m) => {
        const index = table.members.findIndex((n) => n.id === m.id),
          self = m.id === table.id,
          speaking = !!voiceState.speaking[m.id],
          pose =
            m.status === "focusing"
              ? "writing"
              : m.status === "break"
                ? "tea"
                : "idle";
        return (
          <div
            key={m.id}
            className="table-seat"
            data-peer={m.id}
            data-self={self}
            data-speaking={speaking}
            data-status={m.status}
            data-playing={m.playing || ""}
            style={{ "--beanie": COLORS[m.color] } as CSSProperties}
          >
            <div className="table-arrival-name" aria-live="polite">
              {m.name}
              <span> 👋</span>
            </div>
            <div className="table-character">
              <RoomPenguin
                pose={pose}
                female={m.companion === "female"}
                reduced={reduced}
                active={index >= 0}
                calm={m.status === "focusing"}
                beanie={m.color}
              />
              {m.status === "arriving" && (
                <img
                  className="table-join-wave"
                  src={
                    m.companion === "female"
                      ? "/art/room-todo-idle-pink.png"
                      : "/art/room-todo-idle.png"
                  }
                  alt=""
                  aria-hidden="true"
                />
              )}
              <span className="table-speaking-beak" aria-hidden="true" />
            </div>
            <div className="table-floating-reactions" aria-hidden="true">
              {table.reactions
                .filter((r) => r.id === m.id)
                .map((r) => (
                  <span key={r.at}>{EMOJI[r.kind]}</span>
                ))}
            </div>
          </div>
        );
      })}
      <div className="table-tools-layer">
        {table.members.map((m, i) => (
          <div
            className="table-member-tools"
            key={m.id}
            data-pose={
              m.status === "focusing"
                ? "writing"
                : m.status === "break"
                  ? "tea"
                  : "idle"
            }
            style={{
              transform: `translate3d(${layout.x[i] - 49.5}%,0,0) scale(${layout.scale * 0.82})`,
            }}
          >
            <DeskNotebook />
            <WorkingFlippers
              pose={
                m.status === "focusing"
                  ? "writing"
                  : m.status === "break"
                    ? "tea"
                    : "idle"
              }
              female={m.companion === "female"}
            />
          </div>
        ))}
      </div>
      <div className="table-tags-layer">
        {table.members.map((m, i) => (
          <div
            key={m.id}
            className="table-tag-position"
            style={{ transform: `translate3d(${layout.x[i] - 50}%,0,0)` }}
          >
            <div className="table-tag-anchor">
              <button
                className="table-name-tag"
                data-status={m.status}
                data-self={m.id === table.id}
                data-speaking={!!voiceState.speaking[m.id]}
                title={m.name}
                onClick={() => {
                  if (m.id !== table.id) setOpen(open === m.id ? "" : m.id);
                }}
                aria-expanded={m.id === table.id ? undefined : open === m.id}
              >
                <i />
                <span>{m.id === table.id ? `${m.name} · you` : m.name}</span>
                {m.playing === "bubbles" && (
                  <em className="table-mini-bubble" />
                )}
                {m.mic === "live" ? <Mic size={12} /> : <MicOff size={12} />}
              </button>
              {open === m.id && (
                <div
                  className="table-peer-popover"
                  role="group"
                  aria-label={`${m.name} audio controls`}
                >
                  <button
                    className="table-popover-close"
                    onClick={() => setOpen("")}
                    aria-label="Close friend controls"
                  >
                    ×
                  </button>
                  <label>
                    <Volume2 size={13} />
                    Volume
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={voiceState.volumes[m.id] ?? 1}
                      onChange={(e) =>
                        voice.setPeerVolume(m.id, Number(e.target.value))
                      }
                    />
                  </label>
                  <button
                    onClick={() =>
                      voice.setPeerVolume(
                        m.id,
                        (voiceState.volumes[m.id] ?? 1) > 0 ? 0 : 1,
                      )
                    }
                  >
                    {voiceState.volumes[m.id] === 0
                      ? "Hear again"
                      : "Mute for me"}
                  </button>
                  {table.host === table.id && (
                    <>
                      <button
                        onClick={() =>
                          session.hostAction("host_mute_request", m.id)
                        }
                      >
                        Ask to mute
                      </button>
                      <button
                        onClick={() => {
                          session.hostAction("kick", m.id);
                          setOpen("");
                        }}
                      >
                        Remove from table
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
