"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type GrantReason = "admin_grant" | "event_grant";

export function GrantCoinsForm({ userId }: { userId: string }) {
  const t = useTranslations("admin");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<GrantReason>("admin_grant");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = Number(amount);
    if (!amount.trim() || Number.isNaN(parsed) || parsed === 0) {
      setStatus("error");
      setMessage(t("grantForm.invalidAmount"));
      return;
    }

    setStatus("idle");
    setMessage(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("grant_coins", {
        target_user: userId,
        amount: parsed,
        grant_reason: reason,
        grant_note: note.trim() ? note.trim() : null,
      });

      if (error) {
        setStatus("error");
        setMessage(error.message);
      } else {
        setStatus("done");
        setMessage(t("grantForm.success"));
        setAmount("");
        setNote("");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
    >
      <input
        type="number"
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={t("grantForm.amountPlaceholder")}
        className="w-24 border border-party-cream/30 bg-party-black px-2 py-1.5 text-sm text-party-cream placeholder:text-party-cream/40 focus:border-party-red focus:outline-none"
      />
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value as GrantReason)}
        className="border border-party-cream/30 bg-party-black px-2 py-1.5 text-xs uppercase tracking-wide text-party-cream focus:border-party-red focus:outline-none"
      >
        <option value="admin_grant">{t("grantForm.reasonAdminGrant")}</option>
        <option value="event_grant">{t("grantForm.reasonEventGrant")}</option>
      </select>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("grantForm.notePlaceholder")}
        className="min-w-0 border border-party-cream/30 bg-party-black px-2 py-1.5 text-sm text-party-cream placeholder:text-party-cream/40 focus:border-party-red focus:outline-none sm:w-36"
      />
      <button
        type="submit"
        disabled={pending}
        className="font-display whitespace-nowrap border border-atzar-gold px-3 py-1.5 text-xs uppercase tracking-widest text-atzar-gold hover:bg-atzar-gold hover:text-party-black disabled:opacity-50"
      >
        {pending ? t("grantForm.pending") : t("grantForm.submit")}
      </button>
      {status === "done" && message && (
        <p className="text-xs text-atzar-gold">{message}</p>
      )}
      {status === "error" && message && (
        <p className="text-xs text-party-red">{message}</p>
      )}
    </form>
  );
}
