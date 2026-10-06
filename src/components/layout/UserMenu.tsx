import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Profile } from "@/types/database";

export async function UserMenu({ profile }: { profile: Profile | null }) {
  const t = await getTranslations("common.nav");

  if (!profile) {
    return (
      <Link
        href="/login"
        className="font-display border border-party-red bg-party-red px-4 py-2 text-xs uppercase tracking-widest text-party-cream hover:bg-party-red-dark"
      >
        {t("login")}
      </Link>
    );
  }

  return (
    <Link
      href="/profile"
      className="flex items-center gap-2 border border-party-cream/30 px-3 py-2 text-xs uppercase tracking-widest hover:border-party-cream"
    >
      <span className="text-atzar-gold">{profile.coins}¤</span>
      <span className="text-party-cream/90">{profile.username}</span>
    </Link>
  );
}
