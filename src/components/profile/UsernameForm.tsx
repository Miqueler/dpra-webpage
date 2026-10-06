"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { USERNAME_MAX_LENGTH, isValidUsername } from "@/lib/username";

// Postgres unique_violation — the name belongs to another citizen.
const UNIQUE_VIOLATION = "23505";

export function UsernameForm({
  userId,
  currentUsername,
}: {
  userId: string;
  currentUsername: string;
}) {
  const t = useTranslations("auth.profile.username");
  const router = useRouter();
  const [username, setUsername] = useState(currentUsername);
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const next = username.trim();

  function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!isValidUsername(next)) {
      setStatus("error");
      setMessage(t("errors.invalid"));
      return;
    }

    setStatus("idle");
    setMessage(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ username: next })
        .eq("id", userId);
      if (error) {
        setStatus("error");
        setMessage(
          error.code === UNIQUE_VIOLATION ? t("errors.taken") : t("errors.generic"),
        );
      } else {
        setStatus("done");
        setMessage(t("saved"));
        setUsername(next);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit}>
      <label
        htmlFor="username"
        className="mb-3 block text-xs uppercase tracking-widest text-party-cream/50"
      >
        {t("label")}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setStatus("idle");
          }}
          maxLength={USERNAME_MAX_LENGTH}
          autoComplete="username"
          className="flex-1 border border-party-cream/30 bg-party-black px-3 py-2 text-sm text-party-cream placeholder:text-party-cream/40 focus:border-party-red focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !next || next === currentUsername}
          className="font-display border border-party-cream/40 px-4 py-2 text-xs uppercase tracking-widest hover:border-party-red disabled:opacity-50"
        >
          {t("save")}
        </button>
      </div>
      <p className="mt-2 text-xs text-party-cream/40">{t("hint")}</p>
      {status === "done" && message && (
        <p className="mt-2 text-xs uppercase tracking-widest text-atzar-gold">
          {message}
        </p>
      )}
      {status === "error" && message && (
        <p role="alert" className="mt-2 text-xs text-party-red">
          {message}
        </p>
      )}
    </form>
  );
}
