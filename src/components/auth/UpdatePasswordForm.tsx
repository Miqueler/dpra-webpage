"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { hardNavigate } from "@/lib/redirects";
import { Button } from "@/components/ui/Button";

export function UpdatePasswordForm() {
  const t = useTranslations("auth.updatePassword");
  const locale = useLocale();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(
          error.code === "weak_password" || error.code === "same_password"
            ? t(`errors.${error.code}`)
            : t("errors.generic")
        );
        return;
      }
      hardNavigate(`/${locale}/profile`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 text-left">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-widest text-party-cream/60">
          {t("passwordLabel")}
        </span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-party-cream/30 bg-party-black px-3 py-2 text-sm text-party-cream placeholder:text-party-cream/40 focus:border-party-red focus:outline-none"
        />
        <span className="text-[11px] text-party-cream/40">
          {t("passwordHint")}
        </span>
      </label>

      <Button type="submit" disabled={pending} className="w-full">
        {t("submit")}
      </Button>

      {error && (
        <p role="alert" className="text-xs text-party-red">
          {error}
        </p>
      )}
    </form>
  );
}
