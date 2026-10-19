"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PocketTodo } from "./pocket-todo";
import { authMessage, type AuthController } from "@/lib/auth/use-todo-auth";

export function LoginForm({
  auth,
  mode,
  female,
  onClose,
}: {
  auth: AuthController;
  mode: "signup" | "login";
  female: boolean;
  onClose: () => void;
}) {
  const [view, setView] = useState<"signup" | "login" | "reset">(mode);
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [field, setField] = useState("email"),
    [showPassword, setShowPassword] = useState(false),
    [happy, setHappy] = useState(false);
  const disabled = busy || !auth.ready || !auth.configured;
  const run = async (action: () => Promise<void>, success?: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      if (success) {
        setNotice(success);
        setHappy(true);
      }
    } catch (error) {
      setError(authMessage(error));
    } finally {
      setBusy(false);
      setPassword("");
    }
  };
  const changeView = (view: "signup" | "login" | "reset") => {
    setView(view);
    setError("");
    setNotice("");
    setPassword("");
    setHappy(false);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    if (view === "reset")
      void run(
        () => auth.reset(email),
        "If an account uses that email, a reset link is on its way. Check your inbox and spam folder.",
      );
    else if (view === "signup")
      void run(
        () => auth.signup(name, email, password),
        "Your account is created. Open the verification email to finish setting up your corner.",
      );
    else void run(() => auth.email(email, password));
  };
  const verification = Boolean(auth.pendingEmail);
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {verification
            ? "One little check, then you’re in."
            : view === "signup"
              ? "Make a little room for you."
              : view === "reset"
                ? "Let’s find your way back."
                : "Your little corner awaits."}
        </DialogTitle>
        <DialogDescription>
          {verification
            ? `We need to verify ${auth.pendingEmail} before opening your private room.`
            : view === "signup"
              ? "Your penguin. Your progress. Your own Todo account."
              : view === "reset"
                ? "Enter your email and we’ll help you reset your password."
                : "Welcome back. Todo’s saved you a seat."}
        </DialogDescription>
      </DialogHeader>
      {!auth.configured ? (
        <p className="account-setup" role="status">
          Google and email sign-in are being connected. Account creation will
          open once setup is complete.
        </p>
      ) : null}
      {verification ? (
        <div className="account-verification">
          <PocketTodo female={female} happy={happy || Boolean(notice)} />
          <p>
            <Mail size={17} /> Open the link in your email, then come back here.
          </p>
          <Button
            className="account-submit"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await auth.verify();
                onClose();
              })
            }
          >
            {busy ? <Loader2 className="animate-spin" /> : <Check size={17} />}
            I’ve verified my email
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void run(auth.resend, "Another verification email is on its way.")
            }
          >
            Send verification email again
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void run(auth.logout)}
          >
            Use another account
          </Button>
        </div>
      ) : (
        <>
          {view !== "reset" ? (
            <>
              <Button
                variant="outline"
                className="account-google"
                disabled={disabled}
                onClick={() => void run(auth.google)}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                >
                  <path
                    fill="#4285F4"
                    d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.05v2.59A10 10 0 0 0 12 22Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.05a10 10 0 0 0 0 9.02l3.35-2.59Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.35 2.59A5.99 5.99 0 0 1 12 5.96Z"
                  />
                </svg>
                Continue with Google
              </Button>
              <div className="account-divider">
                <span />
                or use your email
                <span />
              </div>
            </>
          ) : null}
          <form className={`account-login-form at-${field}`} onSubmit={submit}>
            <div className="login-mascot" aria-hidden="true">
              <PocketTodo female={female} happy={happy} />
            </div>
            {view === "signup" ? (
              <div
                className="account-field"
                onPointerEnter={() => setField("name")}
              >
                <Label htmlFor="signup-name">Your name</Label>
                <Input
                  id="signup-name"
                  autoComplete="given-name"
                  value={name}
                  maxLength={50}
                  required
                  disabled={busy}
                  placeholder="What should Todo call you?"
                  onFocus={() => setField("name")}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            ) : null}
            <div
              className="account-field"
              onPointerEnter={() => setField("email")}
            >
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                maxLength={254}
                required
                disabled={busy}
                placeholder="you@example.com"
                onFocus={() => setField("email")}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            {view !== "reset" ? (
              <div
                className="account-field"
                onPointerEnter={() => setField("password")}
              >
                <Label htmlFor="login-password">Password</Label>
                <div className="account-password">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      view === "signup" ? "new-password" : "current-password"
                    }
                    value={password}
                    minLength={view === "signup" ? 8 : 1}
                    maxLength={4096}
                    required
                    disabled={busy}
                    onFocus={() => setField("password")}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={
                      view === "signup"
                        ? "At least 8 characters"
                        : "Your password"
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword((shown) => !shown)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
                {view === "login" ? (
                  <button
                    type="button"
                    className="account-reset"
                    onClick={() => changeView("reset")}
                  >
                    Forgot password?
                  </button>
                ) : null}
              </div>
            ) : null}
            <Button
              type="submit"
              className="account-submit"
              disabled={disabled || (view === "signup" && !name.trim())}
            >
              {busy ? <Loader2 className="animate-spin" size={17} /> : null}
              {view === "signup"
                ? "Create my Todo account"
                : view === "reset"
                  ? "Send reset email"
                  : "Log in"}
              <ArrowRight size={17} />
            </Button>
          </form>
          <div className="account-switch">
            {view === "reset" ? (
              <button onClick={() => changeView("login")}>
                <ArrowLeft size={13} />
                Back to log in
              </button>
            ) : (
              <>
                {view === "signup"
                  ? "Already have a corner?"
                  : "New around here?"}
                <button
                  onClick={() =>
                    changeView(view === "signup" ? "login" : "signup")
                  }
                >
                  {view === "signup" ? "Log in" : "Create an account"}
                </button>
              </>
            )}
          </div>
        </>
      )}
      {error ? (
        <p className="account-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="account-notice" role="status">
          {notice}
        </p>
      ) : null}
    </>
  );
}
