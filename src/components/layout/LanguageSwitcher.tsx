"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { clsx } from "clsx";

export function LanguageSwitcher() {
  const t = useTranslations("common.language");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-xs uppercase tracking-widest">
      <span className="sr-only">{t("label")}</span>
      <select
        aria-label={t("label")}
        value={locale}
        onChange={(e) =>
          router.replace(pathname, { locale: e.target.value as (typeof routing.locales)[number] })
        }
        className={clsx(
          "cursor-pointer border border-party-cream/40 bg-party-black-soft px-2 py-1 text-party-cream",
          "focus:border-party-red focus:outline-none"
        )}
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc} className="bg-party-black-soft">
            {t(loc)}
          </option>
        ))}
      </select>
    </label>
  );
}
