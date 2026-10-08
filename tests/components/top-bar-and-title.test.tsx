// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { generateMetadata } from "@/app/[locale]/layout";
import { UserMenu } from "@/components/layout/UserMenu";
import type { Profile } from "@/types/database";
import { text } from "../helpers/messages";

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { messages } = await import("../helpers/messages");
  return {
    setRequestLocale: vi.fn(),
    getTranslations: async (arg?: string | { locale?: string; namespace?: string }) => {
      const locale = (typeof arg === "object" && arg.locale) || "en";
      const namespace = typeof arg === "string" ? arg : arg?.namespace;
      return createTranslator({
        locale,
        messages: messages[locale],
        namespace,
      } as never);
    },
  };
});
vi.mock("next/font/google", () => ({
  Oswald: () => ({ variable: "font-oswald" }),
  Inter: () => ({ variable: "font-inter" }),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));

const profile: Profile = {
  id: "u1",
  username: "great_abril",
  avatar_url: null,
  rank: "Citizen",
  coins: 135,
  is_admin: false,
  machine_code: "ABC123",
  invited_by: null,
  last_daily_bonus_at: null,
  created_at: "2026-01-01T00:00:00Z",
};

describe("page title", () => {
  it.each(["ca", "es", "en"])("is DPRA in %s", async (locale) => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });
    expect(metadata.title).toBe("DPRA");
  });

  it.each(["ca", "es", "en"])("has the translated tagline as description in %s", async (locale) => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });
    expect(metadata.description).toBe(text(locale, "common.footer.tagline"));
  });
});

describe("tab icon", () => {
  it("is the DPRA seal, from a file that exists", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(metadata.icons).toMatchObject({
      icon: { url: "/dpra-logo.svg" },
      apple: "/icon.png",
    });
    for (const file of ["public/dpra-logo.svg", "public/icon.png"]) {
      expect(existsSync(join(process.cwd(), file))).toBe(true);
    }
  });
});

describe("UserMenu (top bar)", () => {
  it("shows the citizen's coin balance and username, linking to the profile", async () => {
    render(await UserMenu({ profile }));

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/profile");
    expect(link).toHaveTextContent("135¤");
    expect(link).toHaveTextContent("great_abril");
  });

  it("shows whatever balance the server rendered last", async () => {
    render(await UserMenu({ profile: { ...profile, coins: 0 } }));
    expect(screen.getByRole("link")).toHaveTextContent("0¤");
  });

  it("offers a login link to visitors", async () => {
    render(await UserMenu({ profile: null }));

    const link = screen.getByRole("link", { name: text("en", "common.nav.login") });
    expect(link).toHaveAttribute("href", "/login");
  });
});
