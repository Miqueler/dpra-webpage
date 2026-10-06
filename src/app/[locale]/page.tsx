import { getTranslations, setRequestLocale } from "next-intl/server";
import { PosterCard, SectionHeading } from "@/components/ui/PosterCard";
import { LinkButton } from "@/components/ui/LinkButton";
import { WatchingEye } from "@/components/ui/WatchingEye";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <>
      {/* Hero */}
      <section className="propaganda-grain relative overflow-hidden border-b border-party-cream/15 bg-party-black">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-8 sm:py-28">
          <WatchingEye className="h-16 w-28 sm:h-20 sm:w-36" />
          <p className="font-display text-xs uppercase tracking-[0.3em] text-party-red">
            {t("hero.eyebrow")}
          </p>
          <h1 className="font-display text-4xl uppercase leading-tight tracking-wide text-party-cream sm:text-6xl">
            {t("hero.title")}
          </h1>
          <p className="font-display text-sm uppercase tracking-widest text-party-cream/70 sm:text-base">
            {t("hero.subtitle")}
          </p>
          <p className="max-w-2xl text-base text-party-cream/80 sm:text-lg">
            {t("hero.tagline")}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
            <LinkButton href="/recruitment" variant="primary">
              {t("hero.ctaPrimary")}
            </LinkButton>
            <LinkButton href="/propaganda" variant="secondary">
              {t("hero.ctaSecondary")}
            </LinkButton>
          </div>
        </div>
      </section>

      {/* Lore */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-8 sm:py-24">
        <SectionHeading eyebrow={t("lore.eyebrow")} title={t("hero.title")} />
        <div className="space-y-5 text-party-cream/85">
          <p>{t("lore.paragraph1")}</p>
          <p>{t("lore.paragraph2")}</p>
          <p>{t("lore.paragraph3")}</p>
        </div>
      </section>

      {/* Teasers */}
      <section className="border-t border-party-cream/15 bg-party-black-soft">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
          <SectionHeading
            eyebrow={t("teasers.eyebrow")}
            title={t("teasers.title")}
          />
          <div className="grid gap-6 sm:grid-cols-3">
            <PosterCard className="flex flex-col gap-4">
              <h3 className="font-display text-xl uppercase tracking-wide text-party-cream">
                {t("teasers.projects.title")}
              </h3>
              <p className="flex-1 text-sm text-party-cream/75">
                {t("teasers.projects.body")}
              </p>
              <LinkButton href="/projects" variant="ghost" className="self-start">
                {t("teasers.projects.cta")}
              </LinkButton>
            </PosterCard>

            <PosterCard className="flex flex-col gap-4">
              <h3 className="font-display text-xl uppercase tracking-wide text-party-cream">
                {t("teasers.propaganda.title")}
              </h3>
              <p className="flex-1 text-sm text-party-cream/75">
                {t("teasers.propaganda.body")}
              </p>
              <LinkButton
                href="/propaganda"
                variant="ghost"
                className="self-start"
              >
                {t("teasers.propaganda.cta")}
              </LinkButton>
            </PosterCard>

            <PosterCard className="flex flex-col gap-4">
              <h3 className="font-display text-xl uppercase tracking-wide text-party-cream">
                {t("teasers.atzar.title")}
              </h3>
              <p className="flex-1 text-sm text-party-cream/75">
                {t("teasers.atzar.body")}
              </p>
              <LinkButton href="/atzar" variant="ghost" className="self-start">
                {t("teasers.atzar.cta")}
              </LinkButton>
            </PosterCard>
          </div>
        </div>
      </section>

      {/* Closing banner */}
      <section className="border-t border-party-cream/15 bg-party-red">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-8 sm:py-20">
          <WatchingEye className="h-14 w-24 text-party-black! sm:h-20 sm:w-36" />
          <p className="font-display text-2xl uppercase tracking-[0.2em] text-party-cream sm:text-4xl">
            {t("closing.slogan")}
          </p>
        </div>
      </section>
    </>
  );
}
