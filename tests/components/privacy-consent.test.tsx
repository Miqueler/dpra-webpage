// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrivacyConsent } from "@/components/privacy/PrivacyConsent";
import { usePathname, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { text } from "../helpers/messages";
import { fakeRouter, renderWithIntl, type FakeRouter } from "../helpers/render";
import { fakeSupabase, type FakeSupabase } from "../helpers/supabase";

vi.mock("@/i18n/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

let supabase: FakeSupabase;
let router: FakeRouter;

beforeEach(() => {
  supabase = fakeSupabase();
  router = fakeRouter();
  vi.mocked(createClient).mockReturnValue(supabase as never);
  vi.mocked(useRouter).mockReturnValue(router as never);
  vi.mocked(usePathname).mockReturnValue("/atzar");
});

const consent = (key: string) => text("en", `privacy.consent.${key}`);

describe("PrivacyConsent", () => {
  it("blocks the page with a dialog that links to the policy", () => {
    renderWithIntl(<PrivacyConsent />);
    expect(screen.getByRole("dialog", { name: consent("title") })).toBeVisible();
    expect(screen.getByRole("link", { name: consent("read") })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("steps aside on the policy page so it can be read", () => {
    vi.mocked(usePathname).mockReturnValue("/privacy");
    renderWithIntl(<PrivacyConsent />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("records the acceptance and refreshes the page", async () => {
    renderWithIntl(<PrivacyConsent />);
    await userEvent.click(screen.getByRole("button", { name: consent("accept") }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(supabase.rpc).toHaveBeenCalledWith("accept_privacy_policy");
  });

  it("says so and stays up when the acceptance cannot be recorded", async () => {
    supabase.rpc.mockResolvedValue({ error: { message: "nope" } });
    renderWithIntl(<PrivacyConsent />);
    await userEvent.click(screen.getByRole("button", { name: consent("accept") }));

    expect(await screen.findByRole("alert")).toHaveTextContent(consent("error"));
    expect(router.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("lets a citizen who declines log out", () => {
    renderWithIntl(<PrivacyConsent />);
    const decline = screen.getByRole("button", { name: consent("decline") });
    expect(decline.closest("form")).toHaveAttribute("action", "/auth/signout");
    expect(decline.closest("form")).toHaveAttribute("method", "POST");
  });
});
