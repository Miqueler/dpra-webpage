import { getTranslations, setRequestLocale } from "next-intl/server";
import { PosterCard, SectionHeading } from "@/components/ui/PosterCard";
import { LinkButton } from "@/components/ui/LinkButton";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("projects");

  const projects = [
    { key: "stickers" as const },
    { key: "expansion" as const },
    { key: "atzar" as const, href: "/atzar" },
    { key: "ministry" as const, href: "/propaganda" },
    { key: "opposition" as const },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-8">
      <SectionHeading eyebrow={t("page.eyebrow")} title={t("page.title")} />

      <div className="grid gap-6 sm:grid-cols-2">
        {projects.map(({ key, href }) => (
          <PosterCard key={key} className="flex flex-col">
            <p className="font-display mb-3 inline-block self-start border border-party-red px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-party-red">
              {t(`items.${key}.status`)}
            </p>
            <h3 className="font-display mb-3 text-xl uppercase tracking-wide text-party-cream">
              {t(`items.${key}.title`)}
            </h3>
            <p className="mb-6 flex-1 text-sm leading-relaxed text-party-cream/70">
              {t(`items.${key}.body`)}
            </p>
            {href && (
              <LinkButton href={href} locale={locale} variant="primary" className="self-start">
                {t(`items.${key}.cta`)}
              </LinkButton>
            )}
          </PosterCard>
        ))}
      </div>
    </div>
  );
}
