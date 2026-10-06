"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function AddFriendForm({ meId }: { meId: string }) {
  const t = useTranslations("atzar.friends.add");
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const target = username.trim();
    if (!target) return;

    startTransition(async () => {
      const supabase = createClient();
      const { data: targetProfile, error: lookupError } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("username", target)
        .maybeSingle();

      if (lookupError || !targetProfile) {
        setStatus("error");
        setMessage(t("errorNotFound"));
        return;
      }

      if (targetProfile.id === meId) {
        setStatus("error");
        setMessage(t("errorSelf"));
        return;
      }

      const { error } = await supabase
        .from("friendships")
        .insert({ user_id: meId, friend_id: targetProfile.id, status: "pending" });

      if (error) {
        setStatus("error");
        setMessage(error.message);
      } else {
        setStatus("done");
        setUsername("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <input
        value={username}
        onChange={(e) => {
          setUsername(e.target.value);
          setStatus("idle");
        }}
        placeholder={t("placeholder")}
        className="flex-1 border border-party-cream/30 bg-atzar-black px-3 py-2 text-sm text-party-cream placeholder:text-party-cream/40 focus:border-atzar-red focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending || !username.trim()}
        className="font-display border border-atzar-gold/50 px-4 py-2 text-xs uppercase tracking-widest text-atzar-gold hover:border-atzar-gold hover:bg-atzar-gold hover:text-atzar-black disabled:opacity-50"
      >
        {t("button")}
      </button>
      {status === "done" && (
        <p className="text-xs text-atzar-gold-bright sm:ml-2 sm:self-center">
          {t("success")}
        </p>
      )}
      {status === "error" && message && (
        <p className="text-xs text-atzar-red sm:ml-2 sm:self-center">{message}</p>
      )}
    </form>
  );
}
