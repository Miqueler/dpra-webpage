import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { PosterCard, SectionHeading } from "@/components/ui/PosterCard";

export default async function AtzarLeaderboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("atzar.leaderboard");
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("leaderboard")
    .select("*")
    .order("best_score", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />
      <p className="mb-8 -mt-4 text-sm text-party-cream/60">{t("subtitle")}</p>

      <PosterCard className="border-atzar-gold/25 bg-atzar-black/60 p-0 sm:p-0">
        {!rows || rows.length === 0 ? (
          <p className="p-6 text-sm text-party-cream/50 sm:p-8">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-atzar-gold/20 text-left text-xs uppercase tracking-widest text-party-cream/50">
                <th className="px-4 py-3 sm:px-6">{t("rank")}</th>
                <th className="px-4 py-3 sm:px-6">{t("player")}</th>
                <th className="px-4 py-3 text-right sm:px-6">{t("bestScore")}</th>
                <th className="px-4 py-3 text-right sm:px-6">{t("plays")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.user_id}
                  className="border-b border-atzar-gold/10 last:border-0"
                >
                  <td className="font-display px-4 py-3 text-atzar-gold-bright sm:px-6">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-3">
                      {row.avatar_url && (
                        <Image
                          src={row.avatar_url}
                          alt={row.username}
                          width={28}
                          height={28}
                          className="h-7 w-7 border border-atzar-gold/30 object-cover"
                        />
                      )}
                      <div>
                        <p className="text-party-cream">{row.username}</p>
                        <p className="text-xs uppercase tracking-widest text-party-cream/40">
                          {row.rank}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="font-display px-4 py-3 text-right text-atzar-gold sm:px-6">
                    {row.best_score ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-party-cream/60 sm:px-6">
                    {row.plays}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </PosterCard>
    </div>
  );
}
