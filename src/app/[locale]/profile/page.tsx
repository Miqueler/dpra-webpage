import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { PosterCard, SectionHeading } from "@/components/ui/PosterCard";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { DailyBonusButton } from "@/components/profile/DailyBonusButton";
import { InviteForm } from "@/components/profile/InviteForm";
import { UsernameForm } from "@/components/profile/UsernameForm";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    redirect({ href: "/login", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user!.id)
    .single();

  if (!profile) {
    redirect({ href: "/login", locale });
  }

  const t = await getTranslations("auth.profile");
  const tRanks = await getTranslations("common.ranks");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <SectionHeading eyebrow={t("rank")} title={t("title")} />

      <PosterCard className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {profile!.avatar_url && (
          <Image
            src={profile!.avatar_url}
            alt={profile!.username}
            width={64}
            height={64}
            className="h-16 w-16 border border-party-cream/30 object-cover"
          />
        )}
        <div className="flex-1">
          <p className="font-display text-2xl">{profile!.username}</p>
          <p className="text-sm uppercase tracking-widest text-party-red">
            {tRanks(profile!.rank)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl text-atzar-gold">{profile!.coins}¤</p>
          <p className="text-xs uppercase tracking-widest text-party-cream/50">
            {t("coins")}
          </p>
        </div>
      </PosterCard>

      <PosterCard className="mb-6">
        <UsernameForm userId={profile!.id} currentUsername={profile!.username} />
      </PosterCard>

      <PosterCard className="mb-6">
        <DailyBonusButton alreadyClaimed={profile!.last_daily_bonus_at === today} />
      </PosterCard>

      <PosterCard className="mb-6">
        <p className="mb-3 text-xs uppercase tracking-widest text-party-cream/50">
          {t("inviteHint")}
        </p>
        <InviteForm alreadyInvited={profile!.invited_by !== null} />
      </PosterCard>

      <LogoutButton />
    </div>
  );
}
