import { getTranslations, setRequestLocale } from "next-intl/server";
import { PosterCard, SectionHeading } from "@/components/ui/PosterCard";

type Plank = {
  title: string;
  body: string;
};

export default async function PropagandaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("propaganda");
  const paragraphs = t.raw("praise.paragraphs") as string[];
  const planks = t.raw("program.planks") as Plank[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <SectionHeading eyebrow={t("praise.eyebrow")} title={t("praise.title")} />
      <PosterCard className="mb-16 space-y-4 text-party-cream/90">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </PosterCard>

      <SectionHeading eyebrow={t("program.eyebrow")} title={t("program.title")} />
      <p className="mb-8 text-party-cream/70">{t("program.intro")}</p>

      <div className="space-y-6">
        {planks.map((plank, index) => (
          <PosterCard key={index}>
            <p className="font-display mb-2 text-xs uppercase tracking-[0.3em] text-party-red">
              {String(index + 1).padStart(2, "0")}
            </p>
            <h3 className="font-display mb-2 text-xl uppercase tracking-wide text-party-cream">
              {plank.title}
            </h3>
            <p className="text-party-cream/80">{plank.body}</p>
          </PosterCard>
        ))}
      </div>
    </div>
  );
}
