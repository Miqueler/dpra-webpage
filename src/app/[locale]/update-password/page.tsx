import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { PosterCard } from "@/components/ui/PosterCard";
import { WatchingEye } from "@/components/ui/WatchingEye";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";

export default async function UpdatePasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Reached from a password-recovery email: /auth/confirm has already
  // exchanged the link for a session by the time we get here.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect({ href: "/login", locale });
  }

  const t = await getTranslations("auth.updatePassword");

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center sm:px-8">
      <WatchingEye className="mb-6 h-10 w-16" />
      <PosterCard className="w-full">
        <h1 className="font-display mb-3 text-2xl uppercase tracking-wide">
          {t("title")}
        </h1>
        <p className="mb-6 text-sm text-party-cream/70">{t("subtitle")}</p>
        <UpdatePasswordForm />
      </PosterCard>
    </div>
  );
}
