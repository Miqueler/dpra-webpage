import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { PosterCard, SectionHeading } from "@/components/ui/PosterCard";
import { GrantCoinsForm } from "@/components/admin/GrantCoinsForm";
import { RankForm } from "@/components/admin/RankForm";
import { OnlineMachineToggle } from "@/components/admin/OnlineMachineToggle";
import { EmailLoginToggle } from "@/components/admin/EmailLoginToggle";
import { CitizenRolls } from "@/components/admin/CitizenRolls";
import { DeleteCitizenButton } from "@/components/admin/DeleteCitizenButton";
import { RollsTable } from "@/components/admin/RollsTable";

const LEDGER_LIMIT = 25;
const ROLLS_LIMIT = 25;

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <PosterCard className="p-4 sm:p-5">
      <p className="text-xs uppercase tracking-widest text-party-cream/50">
        {label}
      </p>
      <p className="font-display mt-1 text-2xl text-party-cream">{value}</p>
    </PosterCard>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-widest text-party-cream/50">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-party-cream">{children}</dd>
    </div>
  );
}

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    redirect({ href: "/", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user!.id)
    .single();

  if (!profile || !profile.is_admin) {
    redirect({ href: "/", locale });
  }

  const [
    { data: citizenRows, error: citizensError },
    { data: ledgerRows },
    { data: rollRows },
    { data: settings },
    { data: authSettings },
  ] = await Promise.all([
      supabase.rpc("admin_citizens"),
      supabase
        .from("coin_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(LEDGER_LIMIT),
      supabase
        .from("rng_sessions")
        .select("*")
        .order("played_at", { ascending: false })
        .limit(ROLLS_LIMIT),
      supabase.from("atzar_settings").select("online_enabled").maybeSingle(),
      supabase.from("auth_settings").select("email_login_enabled").maybeSingle(),
    ]);

  const citizens = citizenRows ?? [];
  const ledger = ledgerRows ?? [];
  const rolls = rollRows ?? [];
  const usernames = new Map(citizens.map((c) => [c.id, c.username]));

  const t = await getTranslations("admin");
  const tRanks = await getTranslations("common.ranks");

  const day = (value: string | null) =>
    value ? new Date(value).toLocaleDateString(locale) : t("never");
  const moment = (value: string | null) =>
    value ? new Date(value).toLocaleString(locale) : t("never");

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-8">
      <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />
      <p className="mb-8 max-w-2xl text-sm text-party-cream/60">
        {t("description")}
      </p>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={t("stats.citizens")} value={citizens.length} />
        <Stat
          label={t("stats.admins")}
          value={citizens.filter((c) => c.is_admin).length}
        />
        <Stat
          label={t("stats.coins")}
          value={
            <span className="text-atzar-gold">
              {citizens.reduce((sum, c) => sum + c.coins, 0)}¤
            </span>
          }
        />
        <Stat
          label={t("stats.plays")}
          value={citizens.reduce((sum, c) => sum + c.plays, 0)}
        />
      </div>

      <PosterCard className="mb-8">
        <h3 className="font-display mb-3 text-xl uppercase tracking-wide text-party-cream">
          {t("onlineMachine.title")}
        </h3>
        <OnlineMachineToggle enabled={settings?.online_enabled ?? false} />
      </PosterCard>

      <PosterCard className="mb-8">
        <h3 className="font-display mb-3 text-xl uppercase tracking-wide text-party-cream">
          {t("emailLogin.title")}
        </h3>
        <EmailLoginToggle enabled={authSettings?.email_login_enabled ?? true} />
      </PosterCard>

      <PosterCard className="mb-8">
        <h3 className="font-display mb-1 text-xl uppercase tracking-wide text-party-cream">
          {t("register.title")}
        </h3>
        <p className="mb-4 text-xs text-party-cream/50">{t("register.hint")}</p>

        {citizensError && (
          <p className="py-4 text-sm text-party-red">
            {t("register.loadError")} {citizensError.message}
          </p>
        )}

        <ul>
          {citizens.map((citizen) => (
            <li key={citizen.id} className="border-t border-party-cream/10">
              <details className="group">
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 py-4 hover:bg-party-cream/5">
                  <span className="font-display min-w-0 flex-1 basis-40 truncate text-party-cream">
                    <span className="mr-2 inline-block text-party-cream/40 transition-transform group-open:rotate-90">
                      ▸
                    </span>
                    {citizen.username}
                    {citizen.is_admin && (
                      <span className="ml-2 border border-party-red px-1.5 py-0.5 align-middle text-[10px] uppercase tracking-widest text-party-red">
                        {t("adminBadge")}
                      </span>
                    )}
                  </span>
                  <span className="basis-32 text-xs uppercase tracking-widest text-party-red">
                    {tRanks(citizen.rank)}
                  </span>
                  <span className="font-display basis-20 text-atzar-gold sm:text-right">
                    {citizen.coins}¤
                  </span>
                  <span className="basis-28 text-xs text-party-cream/50 sm:text-right">
                    {t("playsCount", { count: citizen.plays })}
                  </span>
                </summary>

                <div className="pb-6 pl-5">
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label={t("fields.email")}>
                      {citizen.email ?? "—"}
                      {citizen.email && !citizen.email_confirmed && (
                        <span className="ml-2 text-xs uppercase tracking-widest text-party-red">
                          {t("unconfirmed")}
                        </span>
                      )}
                    </Field>
                    <Field label={t("fields.joined")}>
                      {day(citizen.created_at)}
                    </Field>
                    <Field label={t("fields.lastSignIn")}>
                      {moment(citizen.last_sign_in_at)}
                    </Field>
                    <Field label={t("fields.sponsor")}>
                      {citizen.invited_by_username ?? "—"}
                    </Field>
                    <Field label={t("fields.recruits")}>
                      {citizen.invited_count}
                    </Field>
                    <Field label={t("fields.friends")}>
                      {citizen.friend_count}
                    </Field>
                    <Field label={t("fields.lastDailyBonus")}>
                      {day(citizen.last_daily_bonus_at)}
                    </Field>
                    <Field label={t("fields.bestScore")}>
                      {citizen.best_score ?? "—"}
                    </Field>
                    <Field label={t("fields.lastPlayed")}>
                      {moment(citizen.last_played_at)}
                    </Field>
                  </dl>

                  <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-widest text-party-cream/50">
                        {t("actions.rank")}
                      </p>
                      <RankForm userId={citizen.id} currentRank={citizen.rank} />
                    </div>
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-widest text-party-cream/50">
                        {t("actions.coins")}
                      </p>
                      <GrantCoinsForm userId={citizen.id} />
                    </div>
                    <div className="min-w-0 lg:col-span-2">
                      <p className="mb-2 text-xs uppercase tracking-widest text-party-cream/50">
                        {t("actions.rolls")}
                      </p>
                      <CitizenRolls userId={citizen.id} />
                    </div>
                    <div className="lg:col-span-2">
                      <p className="mb-2 text-xs uppercase tracking-widest text-party-cream/50">
                        {t("actions.delete")}
                      </p>
                      {citizen.is_admin ? (
                        <p className="text-sm text-party-cream/50">
                          {t("deleteForm.protected")}
                        </p>
                      ) : (
                        <DeleteCitizenButton
                          userId={citizen.id}
                          username={citizen.username}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
        {!citizensError && citizens.length === 0 && (
          <p className="py-6 text-sm text-party-cream/50">{t("empty")}</p>
        )}
      </PosterCard>

      <PosterCard className="mb-8">
        <h3 className="font-display mb-4 text-xl uppercase tracking-wide text-party-cream">
          {t("rolls.title")}
        </h3>
        {rolls.length === 0 ? (
          <p className="py-6 text-sm text-party-cream/50">{t("rolls.empty")}</p>
        ) : (
          <RollsTable rolls={rolls} usernames={usernames} />
        )}
      </PosterCard>

      <PosterCard>
        <h3 className="font-display mb-4 text-xl uppercase tracking-wide text-party-cream">
          {t("ledger.title")}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-party-cream/20 text-left text-xs uppercase tracking-widest text-party-cream/50">
                <th className="py-3 pr-4 font-normal">{t("ledger.when")}</th>
                <th className="py-3 pr-4 font-normal">{t("ledger.citizen")}</th>
                <th className="py-3 pr-4 font-normal">{t("ledger.amount")}</th>
                <th className="py-3 pr-4 font-normal">{t("ledger.reason")}</th>
                <th className="py-3 pr-4 font-normal">{t("ledger.by")}</th>
                <th className="py-3 font-normal">{t("ledger.note")}</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-party-cream/10 align-top"
                >
                  <td className="whitespace-nowrap py-3 pr-4 text-xs text-party-cream/60">
                    {moment(entry.created_at)}
                  </td>
                  <td className="py-3 pr-4 font-display text-party-cream">
                    {usernames.get(entry.user_id) ?? "—"}
                  </td>
                  <td
                    className={
                      entry.amount < 0
                        ? "py-3 pr-4 font-display text-party-red"
                        : "py-3 pr-4 font-display text-atzar-gold"
                    }
                  >
                    {entry.amount > 0 ? "+" : ""}
                    {entry.amount}¤
                  </td>
                  <td className="py-3 pr-4 text-xs uppercase tracking-wide text-party-cream/70">
                    {t(`reasons.${entry.reason}`)}
                  </td>
                  <td className="py-3 pr-4 text-party-cream/70">
                    {entry.created_by
                      ? (usernames.get(entry.created_by) ?? "—")
                      : "—"}
                  </td>
                  <td className="py-3 text-party-cream/70">
                    {entry.note ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ledger.length === 0 && (
            <p className="py-6 text-sm text-party-cream/50">
              {t("ledger.empty")}
            </p>
          )}
        </div>
      </PosterCard>
    </div>
  );
}
