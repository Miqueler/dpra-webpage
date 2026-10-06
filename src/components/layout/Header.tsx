import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { UserMenu } from "./UserMenu";
import { WatchingEye } from "@/components/ui/WatchingEye";
import type { Profile } from "@/types/database";

export async function Header() {
  const t = await getTranslations("common");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (auth.user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", auth.user.id)
      .single();
    profile = data ?? null;
  }

  const navItems: { href: string; label: string }[] = [
    { href: "/", label: t("nav.home") },
    { href: "/projects", label: t("nav.projects") },
    { href: "/propaganda", label: t("nav.propaganda") },
    { href: "/recruitment", label: t("nav.recruitment") },
    { href: "/atzar", label: t("nav.atzar") },
  ];

  return (
    <header className="border-b border-party-cream/15 bg-party-black">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <WatchingEye className="h-7 w-12" />
          <span className="font-display text-xl uppercase tracking-[0.2em] text-party-cream">
            {t("brand")}
          </span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-display text-xs uppercase tracking-widest text-party-cream/80 hover:text-party-red"
            >
              {item.label}
            </Link>
          ))}
          {profile?.is_admin && (
            <Link
              href="/admin"
              className="font-display text-xs uppercase tracking-widest text-atzar-gold hover:text-atzar-gold-bright"
            >
              {t("nav.admin")}
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <UserMenu profile={profile} />
        </div>
      </div>

      <nav className="flex items-center gap-4 overflow-x-auto border-t border-party-cream/10 px-4 py-2 lg:hidden">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="font-display whitespace-nowrap text-xs uppercase tracking-widest text-party-cream/80 hover:text-party-red"
          >
            {item.label}
          </Link>
        ))}
        {profile?.is_admin && (
          <Link
            href="/admin"
            className="font-display whitespace-nowrap text-xs uppercase tracking-widest text-atzar-gold"
          >
            {t("nav.admin")}
          </Link>
        )}
      </nav>
    </header>
  );
}
