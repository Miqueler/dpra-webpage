"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

type Mode = "signin" | "signup" | "forgot";
type Notice = { kind: "info" | "error"; text: string };

const inputClass =
  "w-full border border-party-cream/30 bg-party-black px-3 py-2 text-sm text-party-cream placeholder:text-party-cream/40 focus:border-party-red focus:outline-none";
const linkClass =
  "text-[11px] uppercase tracking-widest text-party-cream/60 underline underline-offset-4 hover:text-party-cream disabled:opacity-50";

export function EmailAuthForm() {
  const t = useTranslations("auth.email");
  const locale = useLocale();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  // Address with a confirmation email outstanding — enables "resend".
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function switchMode(next: Mode) {
    setMode(next);
    setNotice(null);
    setUnconfirmed(null);
  }

  function fail(code?: string) {
    const key = `errors.${code}`;
    setNotice({
      kind: "error",
      text: code && t.has(key) ? t(key) : t("errors.generic"),
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim();
    setNotice(null);
    setUnconfirmed(null);

    startTransition(async () => {
      const supabase = createClient();
      const origin = window.location.origin;

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: address,
          password,
        });
        if (error) {
          if (error.code === "email_not_confirmed") setUnconfirmed(address);
          fail(error.code);
          return;
        }
        router.replace("/profile");
        router.refresh();
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: address,
          password,
          options: { emailRedirectTo: `${origin}/${locale}/profile` },
        });
        if (error) {
          fail(error.code);
          return;
        }
        // Supabase answers a sign-up for an already-registered address with
        // an identity-less user instead of an error.
        if (data.user?.identities?.length === 0) {
          fail("user_already_exists");
          return;
        }
        if (data.session) {
          router.replace("/profile");
          router.refresh();
          return;
        }
        setPassword("");
        setUnconfirmed(address);
        setNotice({ kind: "info", text: t("checkInbox", { email: address }) });
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: `${origin}/${locale}/update-password`,
      });
      if (error) {
        fail(error.code);
        return;
      }
      setNotice({ kind: "info", text: t("resetSent", { email: address }) });
    });
  }

  function resend() {
    if (!unconfirmed) return;
    const address = unconfirmed;

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: address,
        options: {
          emailRedirectTo: `${window.location.origin}/${locale}/profile`,
        },
      });
      if (error) {
        fail(error.code);
        return;
      }
      setNotice({ kind: "info", text: t("checkInbox", { email: address }) });
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 text-left">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-widest text-party-cream/60">
          {t("emailLabel")}
        </span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </label>

      {mode !== "forgot" && (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-widest text-party-cream/60">
            {t("passwordLabel")}
          </span>
          <input
            type="password"
            required
            minLength={mode === "signup" ? 8 : undefined}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          {mode === "signup" && (
            <span className="text-[11px] text-party-cream/40">
              {t("passwordHint")}
            </span>
          )}
        </label>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {t(`submit.${mode}`)}
      </Button>

      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={
            notice.kind === "error"
              ? "text-xs text-party-red"
              : "text-xs text-party-cream/80"
          }
        >
          {notice.text}
        </p>
      )}

      {unconfirmed && (
        <button
          type="button"
          onClick={resend}
          disabled={pending}
          className={`${linkClass} self-start`}
        >
          {t("resend")}
        </button>
      )}

      <div className="flex flex-wrap justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
          className={linkClass}
        >
          {mode === "signin" ? t("toSignup") : t("toSignin")}
        </button>
        {mode === "signin" && (
          <button
            type="button"
            onClick={() => switchMode("forgot")}
            className={linkClass}
          >
            {t("toForgot")}
          </button>
        )}
      </div>
    </form>
  );
}
