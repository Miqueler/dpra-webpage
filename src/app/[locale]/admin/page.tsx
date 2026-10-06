import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { PosterCard, SectionHeading } from "@/components/ui/PosterCard";
import { GrantCoinsForm } from "@/components/admin/GrantCoinsForm";

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

  const { data: citizens } = await supabase
    .from("profiles")
    .select("*")
    .order("username")
    .limit(200);

  const t = await getTranslations("admin");

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-8">
      <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />
      <p className="mb-8 max-w-2xl text-sm text-party-cream/60">
        {t("description")}
      </p>

      <PosterCard>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-party-cream/20 text-left text-xs uppercase tracking-widest text-party-cream/50">
                <th className="py-3 pr-4 font-normal">
                  {t("tableHeaders.username")}
                </th>
                <th className="py-3 pr-4 font-normal">
                  {t("tableHeaders.rank")}
                </th>
                <th className="py-3 pr-4 font-normal">
                  {t("tableHeaders.coins")}
                </th>
                <th className="py-3 font-normal">
                  {t("tableHeaders.action")}
                </th>
              </tr>
            </thead>
            <tbody>
              {(citizens ?? []).map((citizen) => (
                <tr
                  key={citizen.id}
                  className="border-b border-party-cream/10 align-middle"
                >
                  <td className="py-4 pr-4 font-display text-party-cream">
                    {citizen.username}
                  </td>
                  <td className="py-4 pr-4 text-xs uppercase tracking-widest text-party-red">
                    {citizen.rank}
                  </td>
                  <td className="py-4 pr-4 font-display text-atzar-gold">
                    {citizen.coins}¤
                  </td>
                  <td className="py-4">
                    <GrantCoinsForm userId={citizen.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(citizens?.length ?? 0) === 0 && (
            <p className="py-6 text-sm text-party-cream/50">{t("empty")}</p>
          )}
        </div>
      </PosterCard>
    </div>
  );
}
