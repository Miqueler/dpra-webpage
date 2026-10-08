// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailLoginToggle } from "@/components/admin/EmailLoginToggle";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { text } from "../helpers/messages";
import { fakeRouter, renderWithIntl, type FakeRouter } from "../helpers/render";
import { fakeSupabase, type FakeSupabase } from "../helpers/supabase";

vi.mock("@/i18n/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

let supabase: FakeSupabase;
let router: FakeRouter;

beforeEach(() => {
  supabase = fakeSupabase();
  router = fakeRouter();
  vi.mocked(createClient).mockReturnValue(supabase as never);
  vi.mocked(useRouter).mockReturnValue(router as never);
});

const admin = (key: string) => text("en", `admin.emailLogin.${key}`);

describe("EmailLoginToggle", () => {
  it("switches email login on and refreshes the page", async () => {
    renderWithIntl(<EmailLoginToggle enabled={false} />);
    expect(screen.getByText(admin("off"))).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: admin("switchOn") }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(supabase.rpc).toHaveBeenCalledWith("set_email_login", { enabled: true });
  });

  it("switches email login off", async () => {
    renderWithIntl(<EmailLoginToggle enabled />);
    expect(screen.getByText(admin("on"))).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: admin("switchOff") }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(supabase.rpc).toHaveBeenCalledWith("set_email_login", { enabled: false });
  });

  it("shows the error and does not refresh when the switch is refused", async () => {
    supabase.rpc.mockResolvedValue({
      error: { message: "Only the Commissariat may operate the login form." },
    });
    renderWithIntl(<EmailLoginToggle enabled={false} />);
    await userEvent.click(screen.getByRole("button", { name: admin("switchOn") }));

    expect(
      await screen.findByText("Only the Commissariat may operate the login form."),
    ).toBeVisible();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
