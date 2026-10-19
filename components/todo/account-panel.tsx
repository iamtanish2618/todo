"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Heart, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/todo/client";
import "./account-panel.css";

export type Identity = { name: string | null; email: string } | null;
export type Profile = { name: string };

function PocketTodo({ female, happy }: { female: boolean; happy: boolean }) {
  return (
    <div
      className={`pocket-todo ${happy ? "pocket-happy" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 112" fill="none">
        <ellipse cx="50" cy="105" rx="28" ry="4" fill="#654f34" opacity=".09" />
        <path
          d="M20 65C8 62 7 81 15 87L26 80M80 65C92 62 93 81 85 87L74 80"
          fill="#42474a"
        />
        <ellipse cx="50" cy="66" rx="33" ry="38" fill="#353b3e" />
        <path
          d="M25 59C25 39 43 39 50 49C57 39 75 39 75 59V79C75 101 25 101 25 79Z"
          fill="#fff8ec"
        />
        <ellipse cx="38" cy="61" rx="4" ry={happy ? 1.6 : 5} fill="#263238" />
        <ellipse cx="62" cy="61" rx="4" ry={happy ? 1.6 : 5} fill="#263238" />
        <path
          d={happy ? "M44 72Q50 83 56 72Z" : "M44 72Q50 66 56 72Q50 79 44 72Z"}
          fill="#e3a15d"
        />
        <ellipse
          cx="29"
          cy="72"
          rx="6"
          ry="3"
          fill="#e9a8a9"
          opacity={happy ? 0.9 : 0.5}
        />
        <ellipse
          cx="71"
          cy="72"
          rx="6"
          ry="3"
          fill="#e9a8a9"
          opacity={happy ? 0.9 : 0.5}
        />
        <path
          d="M21 42Q21 12 50 12Q79 12 79 42"
          fill={female ? "#d9a4b8" : "#a4bccd"}
        />
        <rect
          x="18"
          y="34"
          width="64"
          height="12"
          rx="6"
          fill={female ? "#e9bdcc" : "#c2d6e1"}
        />
        <circle cx="50" cy="12" r="9" fill="#fffaf3" />
        <path
          d="M22 85Q50 96 78 85"
          stroke={female ? "#d9a4b8" : "#a4bccd"}
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M65 89L67 104"
          stroke={female ? "#d9a4b8" : "#a4bccd"}
          strokeWidth="11"
          strokeLinecap="round"
        />
      </svg>
      {happy ? (
        <Heart className="pocket-heart" size={17} fill="currentColor" />
      ) : null}
    </div>
  );
}

/** Hosted identity is established by a top-level platform redirect. The form only
 * edits the authenticated user's Todo profile; it never collects unused passwords. */
export function AccountPanel({
  open,
  onOpenChange,
  mode,
  identity,
  profile,
  female,
  signInPath,
  signOutPath,
  onSaved,
  reduced,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "signup" | "login" | "account";
  identity: Identity;
  profile: Profile | null;
  female: boolean;
  signInPath: string;
  signOutPath: string;
  onSaved: (profile: Profile) => void;
  reduced: boolean;
}) {
  const [name, setName] = useState(
    profile?.name || identity?.name?.split(" ")[0] || "",
  );
  const [field, setField] = useState("name");
  const [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await api<Profile>("/api/profile", "PUT", { name });
      onSaved(result);
      setSaved(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Couldn’t save your name. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`account-panel ${reduced ? "account-gentle" : ""}`}
        data-lenis-prevent
      >
        <div className="account-kicker">
          <span /> a small place of your own
        </div>
        <DialogHeader>
          <DialogTitle>
            {saved
              ? `Lovely to meet you, ${name.trim()}.`
              : identity
                ? "Make yourself at home."
                : mode === "login"
                  ? "Your little corner awaits."
                  : "Good company starts here."}
          </DialogTitle>
          <DialogDescription>
            {saved
              ? "Todo will remember your name. Your room is ready whenever you are."
              : identity
                ? "What would you like Todo to call you?"
                : "Sign in securely, then make Todo yours. Your work stays with your account."}
          </DialogDescription>
        </DialogHeader>
        {identity ? (
          <form
            onSubmit={save}
            className={`account-form ${saved ? "account-celebrating" : ""}`}
          >
            <div className={`account-mascot-rail at-${field}`}>
              <PocketTodo female={female} happy={saved} />
            </div>
            <div
              className="account-field"
              onPointerEnter={() => setField("name")}
            >
              <Label htmlFor="todo-profile-name">Your name</Label>
              <Input
                id="todo-profile-name"
                autoComplete="given-name"
                required
                maxLength={50}
                value={name}
                placeholder="What should Todo call you?"
                onFocus={() => setField("name")}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                aria-describedby={error ? "profile-error" : undefined}
              />
            </div>
            <div
              className="account-field"
              onPointerEnter={() => setField("email")}
            >
              <Label htmlFor="todo-account-email">Your signed-in email</Label>
              <Input
                id="todo-account-email"
                value={identity.email}
                readOnly
                onFocus={() => setField("email")}
              />
              <p>Managed securely by your ChatGPT account.</p>
            </div>
            {error ? (
              <p id="profile-error" role="alert" className="account-error">
                {error}
              </p>
            ) : null}
            {saved ? (
              <Button
                type="button"
                className="account-submit"
                onClick={() => onOpenChange(false)}
              >
                Back to Todo <Check size={17} />
              </Button>
            ) : (
              <Button
                type="submit"
                className="account-submit"
                disabled={saving || !name.trim()}
              >
                {saving ? <Loader2 className="animate-spin" size={17} /> : null}
                {saving
                  ? "Saving your corner…"
                  : profile
                    ? "Save changes"
                    : "Make it mine"}
                <ArrowRight size={17} />
              </Button>
            )}
            <a className="account-signout" href={signOutPath} target="_top">
              Log out
            </a>
          </form>
        ) : (
          <div className="account-connect">
            <PocketTodo female={female} happy={false} />
            <Button asChild className="account-submit">
              <a href={signInPath} target="_top">
                Continue with ChatGPT <ArrowRight size={17} />
              </a>
            </Button>
            <p>
              <ShieldCheck size={15} /> No extra Todo password to remember.
            </p>
            <small>
              Google, Apple, Facebook and phone sign-in aren’t connected to Todo
              yet.
            </small>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
