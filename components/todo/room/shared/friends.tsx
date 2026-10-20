"use client";
import { useState } from "react";
import {
  Copy,
  Heart,
  Coffee,
  PartyPopper,
  Hand,
  LogOut,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COLORS, type Color } from "@/lib/todo/table/protocol";
import type { TableSession, TableSnapshot } from "@/lib/todo/table/session";
export function FriendsPanel({
  session,
  table,
  initialCode = "",
  onGesture,
  onSit,
  children,
}: {
  session: TableSession;
  table: TableSnapshot;
  initialCode?: string;
  onGesture?: () => void;
  onSit?: () => void;
  children?: React.ReactNode;
}) {
  const [name, setName] = useState(""),
    [code, setCode] = useState(initialCode),
    [color, setColor] = useState<Color>("blue"),
    [minutes, setMinutes] = useState("25"),
    [copied, setCopied] = useState("");
  const joined = table.state === "joined" || table.state === "reconnecting",
    host = table.id === table.host;
  async function copy(link: boolean) {
    try {
      const url = new URL(location.href);
      url.searchParams.set("room", table.code);
      await navigator.clipboard.writeText(link ? url.toString() : table.code);
      setCopied(link ? "Link copied" : "Code copied");
    } catch {
      setCopied("Select and copy the code above.");
    }
  }
  return (
    <div className="table-friends" aria-busy={table.state === "connecting"}>
      {table.message && (
        <p role="status" className="table-notice">
          {table.message}
        </p>
      )}
      {!joined ? (
        <>
          <label className="room-field">
            Nickname
            <Input
              autoComplete="off"
              maxLength={16}
              value={name}
              placeholder="What should we call you?"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <fieldset className="table-colors">
            <legend>Your beanie</legend>
            {Object.entries(COLORS).map(([c, hex]) => (
              <button
                type="button"
                key={c}
                title={c}
                aria-label={`${c} beanie`}
                aria-pressed={c === color}
                style={{ background: hex }}
                onClick={() => setColor(c as Color)}
              />
            ))}
          </fieldset>
          <Button
            className="room-dark-button"
            disabled={table.state === "connecting" || !table.config.configured}
            onClick={() => {
              onGesture?.();
              void session.join(true, "", name, color);
            }}
          >
            <Users size={16} />
            Create table
          </Button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onGesture?.();
              void session.join(false, code, name, color);
            }}
          >
            <label className="room-field">
              Join with a code
              <Input
                value={code}
                maxLength={20}
                placeholder="PENG-ABC234"
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <Button
              disabled={
                table.state === "connecting" || !table.config.configured
              }
              type="submit"
            >
              Join table
            </Button>
          </form>
          {!table.config.configured && (
            <p className="table-notice">
              Shared tables are being connected. You can focus solo in the
              meantime.
            </p>
          )}
        </>
      ) : (
        <>
          <small>YOUR TABLE CODE</small>
          <div className="table-code">
            <strong>{table.code}</strong>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Copy table code"
              onClick={() => void copy(false)}
            >
              <Copy size={15} />
            </Button>
          </div>
          <Button variant="ghost" onClick={() => void copy(true)}>
            Copy invite link
          </Button>
          {copied && <small role="status">{copied}</small>}
          <div className="table-seat-slots">
            {Array.from({ length: 4 }, (_, i) => {
              const m = table.members[i];
              return (
                <div key={m?.id || i} className={m ? "" : "empty"}>
                  {m ? (
                    <>
                      <span style={{ background: COLORS[m.color] }}>
                        {m.name.slice(0, 1)}
                      </span>
                      <small title={m.name}>
                        {m.id === table.id ? "You" : m.name}
                      </small>
                    </>
                  ) : (
                    <button type="button" onClick={() => void copy(true)}>
                      ＋<small>Invite</small>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="table-reactions" aria-label="Send a reaction">
            {(
              [
                ["wave", Hand],
                ["cheer", PartyPopper],
                ["heart", Heart],
                ["coffee", Coffee],
              ] as const
            ).map(([kind, Icon]) => (
              <Button
                key={kind}
                size="icon"
                variant="ghost"
                aria-label={`Send ${kind}`}
                onClick={() => session.reaction(kind)}
              >
                <Icon size={17} />
              </Button>
            ))}
          </div>
          {children}
          {host && (
            <>
              <label className="room-field">
                Sit together · minutes
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </label>
              <Button
                disabled={
                  !Number.isInteger(Number(minutes)) ||
                  Number(minutes) < 1 ||
                  Number(minutes) > 90
                }
                onClick={() => {
                  session.startSit(Number(minutes));
                  onSit?.();
                }}
              >
                Sit together
              </Button>
            </>
          )}
          <div className="table-leave">
            <Button
              variant="ghost"
              onClick={() => void session.leave("You left the table.")}
            >
              <LogOut size={15} />
              Leave table
            </Button>
            {host && (
              <Button
                variant="ghost"
                onClick={() => session.hostAction("close_room")}
              >
                Close table
              </Button>
            )}
          </div>
        </>
      )}
      <small>Up to 4 at the table.</small>
      <small>Voice is live only and never recorded.</small>
    </div>
  );
}
