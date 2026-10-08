import { getTranslations, setRequestLocale } from "next-intl/server";
import { PosterCard, SectionHeading } from "@/components/ui/PosterCard";
import { LinkButton } from "@/components/ui/LinkButton";

export default async function RecruitmentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("recruitment");

  const benefitItems = t.raw("benefits.items") as string[];
  const requirementItems = t.raw("requirements.items") as string[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <SectionHeading eyebrow={t("hero.eyebrow")} title={t("hero.title")} />
      <p className="mb-10 text-sm leading-relaxed text-party-cream/80 sm:text-base">
        {t("hero.lead")}
      </p>

      <PosterCard className="mb-6">
        <h2 className="font-display mb-4 text-lg uppercase tracking-wide text-party-cream">
          {t("benefits.title")}
        </h2>
        <ul className="space-y-3">
          {benefitItems.map((item, i) => (
            <li
              key={i}
              className="flex gap-3 text-sm leading-relaxed text-party-cream/80"
            >
              <span className="font-display text-party-red">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </PosterCard>

      <PosterCard className="mb-10">
        <h2 className="font-display mb-4 text-lg uppercase tracking-wide text-party-cream">
          {t("requirements.title")}
        </h2>
        <ul className="space-y-3">
          {requirementItems.map((item, i) => (
            <li
              key={i}
              className="flex gap-3 text-sm leading-relaxed text-party-cream/80"
            >
              <span className="font-display text-party-red">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </PosterCard>

      <div className="mb-12 flex flex-col items-center gap-3 text-center">
        <LinkButton href="/login" variant="primary">
          {t("cta.button")}
        </LinkButton>
        <p className="max-w-sm text-xs text-party-cream/50">{t("cta.note")}</p>
      </div>

      <div className="border-t border-party-cream/10 pt-8 text-center">
        <p className="mb-2 text-sm text-party-cream/70">{t("contact.lead")}</p>
        <a
          href="mailto:dpra.cfis@gmail.com"
          className="font-display text-sm uppercase tracking-widest text-party-cream underline underline-offset-4 hover:text-party-red"
        >
          {t("contact.emailLabel")}
        </a>
        <p className="mt-2 text-xs text-party-cream/40">{t("contact.hint")}</p>
      </div>
    </div>
  );
}
