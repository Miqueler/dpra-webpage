import { useLocale, useTranslations } from "next-intl";
import type { RngSession } from "@/types/database";

/**
 * A list of rolls, newest first as given. Pass `usernames` to add a column
 * saying whose roll each one is.
 */
export function RollsTable({
  rolls,
  usernames,
}: {
  rolls: RngSession[];
  usernames?: Map<string, string>;
}) {
  const t = useTranslations("admin.rolls");
  const locale = useLocale();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-party-cream/20 text-left text-xs uppercase tracking-widest text-party-cream/50">
            <th className="py-3 pr-4 font-normal">{t("when")}</th>
            {usernames && <th className="py-3 pr-4 font-normal">{t("citizen")}</th>}
            <th className="py-3 pr-4 font-normal">{t("number")}</th>
            <th className="py-3 pr-4 font-normal">{t("score")}</th>
            <th className="py-3 font-normal">{t("source")}</th>
          </tr>
        </thead>
        <tbody>
          {rolls.map((roll) => (
            <tr key={roll.id} className="border-b border-party-cream/10 align-top">
              <td className="whitespace-nowrap py-3 pr-4 text-xs text-party-cream/60">
                {new Date(roll.played_at).toLocaleString(locale)}
              </td>
              {usernames && (
                <td className="py-3 pr-4 font-display text-party-cream">
                  {usernames.get(roll.user_id) ?? "—"}
                </td>
              )}
              <td className="py-3 pr-4 font-display tracking-widest text-party-cream/80">
                {typeof roll.payload?.number === "number" ? roll.payload.number : "—"}
              </td>
              <td className="py-3 pr-4 font-display text-atzar-gold">
                {roll.score ?? "—"}
              </td>
              <td className="py-3 text-xs uppercase tracking-wide text-party-cream/70">
                {roll.source === "online" ? t("sources.online") : t("sources.machine")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
