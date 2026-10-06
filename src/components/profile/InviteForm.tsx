"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function InviteForm({ alreadyInvited }: { alreadyInvited: boolean }) {
  const t = useTranslations("auth.profile");
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (alreadyInvited || status === "done") {
    return (
      <p className="text-xs uppercase tracking-widest text-atzar-gold">
        {t("inviteHint")}
      </p>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("redeem_invite", {
        inviter_username: username.trim(),
      });
      if (error) {
        setStatus("error");
        setMessage(error.message);
      } else {
        setStatus("done");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder={t("invite")}
        className="flex-1 border border-party-cream/30 bg-party-black px-3 py-2 text-sm text-party-cream placeholder:text-party-cream/40 focus:border-party-red focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending || !username.trim()}
        className="font-display border border-party-cream/40 px-4 py-2 text-xs uppercase tracking-widest hover:border-party-red disabled:opacity-50"
      >
        {t("invite")}
      </button>
      {status === "error" && message && (
        <p className="text-xs text-party-red sm:ml-2 sm:self-center">{message}</p>
      )}
    </form>
  );
}
