import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PosterCard, SectionHeading } from "@/components/ui/PosterCard";

const CONTACT_EMAIL = "dpra.cfis@gmail.com";

type Article = {
  title: string;
  paragraphs: string[];
  items?: string[];
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });
  return { title: `${t("title")} — DPRA` };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("privacy");
  const articles = t.raw("articles") as Article[];
  const plain = t.raw("plain.items") as string[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />
      <p className="mb-2 text-party-cream/80">{t("intro")}</p>
      <p className="mb-10 text-xs uppercase tracking-widest text-party-cream/40">
        {t("updated")}
      </p>

      <div className="space-y-6">
        {articles.map((article, index) => (
          <PosterCard key={index}>
            <p className="font-display mb-2 text-xs uppercase tracking-[0.3em] text-party-red">
              {t("article", { number: index + 1 })}
            </p>
            <h3 className="font-display mb-3 text-xl uppercase tracking-wide text-party-cream">
              {article.title}
            </h3>
            <div className="space-y-3 text-party-cream/80">
              {article.paragraphs.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
              {article.items && (
                <ul className="list-disc space-y-1 pl-5">
                  {article.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          </PosterCard>
        ))}

        <PosterCard className="border-party-cream/50">
          <p className="font-display mb-2 text-xs uppercase tracking-[0.3em] text-party-red">
            {t("plain.eyebrow")}
          </p>
          <h3 className="font-display mb-3 text-xl uppercase tracking-wide text-party-cream">
            {t("plain.title")}
          </h3>
          <p className="mb-3 text-party-cream/80">{t("plain.intro")}</p>
          <ul className="list-disc space-y-2 pl-5 text-party-cream/80">
            {plain.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          <p className="mt-4 text-party-cream/80">
            {t("plain.contact")}{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-party-cream underline underline-offset-4 hover:text-party-red"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </PosterCard>
      </div>
    </div>
  );
}
