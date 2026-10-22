"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Loader2, ShieldCheck } from "lucide-react";
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
import { PocketTodo } from "./pocket-todo";
import { LoginForm } from "./login-form";
import { authMessage, type AuthController } from "@/lib/auth/use-todo-auth";
import type { TodoIdentity } from "@/lib/auth/types";

export type Identity = TodoIdentity;
export type Profile = { name: string };

/** Profile editing and the configured identity provider share the same shadcn shell. */
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
  auth,
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
  auth: AuthController;
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
        {auth.provider === "firebase" && !identity ? (
          <LoginForm
            auth={auth}
            mode={mode === "login" ? "login" : "signup"}
            female={female}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <>
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
                  <Label htmlFor="todo-account-email">
                    Your signed-in email
                  </Label>
                  <Input
                    id="todo-account-email"
                    value={identity.email}
                    readOnly
                    onFocus={() => setField("email")}
                  />
                  <p>
                    {auth.provider === "firebase"
                      ? "Verified for your Todo account."
                      : "Managed securely by your ChatGPT account."}
                  </p>
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
                    {saving ? (
                      <Loader2 className="animate-spin" size={17} />
                    ) : null}
                    {saving
                      ? "Saving your corner…"
                      : profile
                        ? "Save changes"
                        : "Make it mine"}
                    <ArrowRight size={17} />
                  </Button>
                )}
                {auth.provider === "firebase" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="account-signout"
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await auth.logout();
                      } catch (error) {
                        setError(authMessage(error));
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    Log out
                  </Button>
                ) : (
                  <a
                    className="account-signout"
                    href={signOutPath}
                    target="_top"
                  >
                    Log out
                  </a>
                )}
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
                  Google, Apple, Facebook and phone sign-in aren’t connected to
                  Todo yet.
                </small>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
