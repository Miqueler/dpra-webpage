import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { PosterCard } from "@/components/ui/PosterCard";
import { WatchingEye } from "@/components/ui/WatchingEye";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    redirect({ href: "/profile", locale });
  }

  const t = await getTranslations("auth.login");

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center sm:px-8">
      <WatchingEye className="mb-6 h-10 w-16" />
      <PosterCard className="w-full">
        <h1 className="font-display mb-3 text-2xl uppercase tracking-wide">
          {t("title")}
        </h1>
        <p className="mb-6 text-sm text-party-cream/70">{t("subtitle")}</p>
        <GoogleLoginButton />
        {error && (
          <p className="mt-4 text-xs uppercase tracking-widest text-party-red">
            {t("error")}
          </p>
        )}
        <p className="mt-6 text-[11px] text-party-cream/40">{t("disclaimer")}</p>
      </PosterCard>
    </div>
  );
}
