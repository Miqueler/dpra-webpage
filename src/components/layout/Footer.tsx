import { getTranslations } from "next-intl/server";
import { DpraLogo } from "@/components/ui/DpraLogo";

export async function Footer() {
  const t = await getTranslations("common.footer");

  return (
    <footer className="border-t border-party-cream/15 bg-party-black">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-10 text-center sm:px-8">
        <DpraLogo size={56} />
        <p className="font-display text-sm uppercase tracking-widest text-party-cream/80">
          {t("tagline")}
        </p>
        <p className="max-w-xl text-xs text-party-cream/50">{t("rights")}</p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-party-red/70">
          {t("casaNotice")}
        </p>
      </div>
    </footer>
  );
}
