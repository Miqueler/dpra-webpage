import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AtzarMark } from "@/components/atzar/AtzarMark";

export default async function AtzarLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("atzar.layout");

  return (
    <div className="min-h-full bg-atzar-black">
      <div className="propaganda-grain relative border-b border-atzar-gold/20 bg-atzar-black">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-10 text-center sm:px-8">
          <AtzarMark className="mb-2 h-10 w-10 text-atzar-gold-bright" />
          <h1 className="font-display text-4xl uppercase tracking-[0.3em] text-atzar-gold-bright sm:text-5xl">
            {t("wordmark")}
          </h1>
          <p className="max-w-xl text-[11px] uppercase tracking-[0.2em] text-atzar-gold/70">
            {t("tagline")}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
