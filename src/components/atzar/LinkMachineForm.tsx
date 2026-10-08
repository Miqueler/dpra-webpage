"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

// Keep in sync with create_machine_session() in
// supabase/migrations/0006_machine_sessions.sql.
const CODE_LENGTH = 6;

export function LinkMachineForm() {
  const t = useTranslations("atzar.dashboard.link");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("claim_machine_session", {
        session_code: code,
      });

      if (error) {
        setStatus("error");
        setMessage(error.message || t("genericError"));
      } else {
        setStatus("done");
        setCode("");
      }
    });
  }

  return (
    <form onSubmit={submit}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\s/g, "").toUpperCase());
            setStatus("idle");
          }}
          maxLength={CODE_LENGTH}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-label={t("label")}
          placeholder={t("placeholder")}
          className="font-display w-full border border-atzar-gold/40 bg-atzar-black px-3 py-2 text-2xl tracking-[0.3em] text-atzar-gold-bright placeholder:text-atzar-gold/25 focus:border-atzar-gold focus:outline-none sm:w-52"
        />
        <button
          type="submit"
          disabled={pending || code.length < CODE_LENGTH}
          className="font-display border border-atzar-gold px-5 py-2 text-xs uppercase tracking-widest text-atzar-gold hover:bg-atzar-gold hover:text-atzar-black disabled:opacity-50"
        >
          {pending ? t("pending") : t("button")}
        </button>
      </div>
      {status === "done" && (
        <p className="mt-2 text-xs uppercase tracking-widest text-atzar-gold-bright">
          {t("success")}
        </p>
      )}
      {status === "error" && message && (
        <p className="mt-2 text-xs text-atzar-red">{message}</p>
      )}
    </form>
  );
}
