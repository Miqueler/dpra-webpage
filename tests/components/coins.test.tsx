// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GrantCoinsForm } from "@/components/admin/GrantCoinsForm";
import { BuyRollButton } from "@/components/atzar/BuyRollButton";
import { DailyBonusButton } from "@/components/profile/DailyBonusButton";
import { InviteForm } from "@/components/profile/InviteForm";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { text } from "../helpers/messages";
import { fakeRouter, renderWithIntl, type FakeRouter } from "../helpers/render";
import { fakeSupabase, type FakeSupabase } from "../helpers/supabase";

vi.mock("@/i18n/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

// The coin balance in the top bar is rendered on the server, so it only
// updates when a component asks the router to refresh after moving coins.

let supabase: FakeSupabase;
let router: FakeRouter;

beforeEach(() => {
  supabase = fakeSupabase();
  router = fakeRouter();
  vi.mocked(createClient).mockReturnValue(supabase as never);
  vi.mocked(useRouter).mockReturnValue(router as never);
});

describe("DailyBonusButton", () => {
  const claim = () =>
    screen.getByRole("button", { name: text("en", "auth.profile.dailyBonusButton") });

  it("claims the bonus and refreshes the coin balance", async () => {
    renderWithIntl(<DailyBonusButton alreadyClaimed={false} />);
    await userEvent.click(claim());

    expect(await screen.findByText(text("en", "auth.profile.dailyBonusClaimed"))).toBeVisible();
    expect(supabase.rpc).toHaveBeenCalledWith("claim_daily_bonus");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the error and does not refresh when the claim is refused", async () => {
    supabase.rpc.mockResolvedValue({ error: { message: "Already distributed today." } });
    renderWithIntl(<DailyBonusButton alreadyClaimed={false} />);
    await userEvent.click(claim());

    expect(await screen.findByText("Already distributed today.")).toBeVisible();
    expect(claim()).toBeEnabled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("offers no button once the bonus was claimed today", () => {
    renderWithIntl(<DailyBonusButton alreadyClaimed />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(text("en", "auth.profile.dailyBonusClaimed"))).toBeVisible();
  });
});

describe("InviteForm", () => {
  const label = text("en", "auth.profile.invite");
  const input = () => screen.getByPlaceholderText(label);
  const send = () => screen.getByRole("button", { name: label });

  it("redeems the invite and refreshes the coin balance", async () => {
    renderWithIntl(<InviteForm alreadyInvited={false} />);
    await userEvent.type(input(), "  abril  ");
    await userEvent.click(send());

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(supabase.rpc).toHaveBeenCalledWith("redeem_invite", {
      inviter_username: "abril",
    });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows the error and does not refresh when the invite is refused", async () => {
    supabase.rpc.mockResolvedValue({ error: { message: "Unknown sponsor." } });
    renderWithIntl(<InviteForm alreadyInvited={false} />);
    await userEvent.type(input(), "nobody");
    await userEvent.click(send());

    expect(await screen.findByText("Unknown sponsor.")).toBeVisible();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("cannot be sent empty", () => {
    renderWithIntl(<InviteForm alreadyInvited={false} />);
    expect(send()).toBeDisabled();
  });

  it("offers no form to a citizen who already redeemed an invite", () => {
    renderWithIntl(<InviteForm alreadyInvited />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("BuyRollButton", () => {
  it("buys a roll and refreshes the coin balance", async () => {
    renderWithIntl(<BuyRollButton coins={20} />);
    await userEvent.click(screen.getByRole("button"));

    expect(await screen.findByText(text("en", "atzar.dashboard.buy.success"))).toBeVisible();
    expect(supabase.rpc).toHaveBeenCalledWith("buy_roll");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the error and does not refresh when the purchase fails", async () => {
    supabase.rpc.mockResolvedValue({ error: { message: "Insufficient coins, citizen." } });
    renderWithIntl(<BuyRollButton coins={20} />);
    await userEvent.click(screen.getByRole("button"));

    expect(await screen.findByText("Insufficient coins, citizen.")).toBeVisible();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("is disabled when the citizen cannot afford a roll", () => {
    renderWithIntl(<BuyRollButton coins={19} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

describe("GrantCoinsForm", () => {
  const amount = () =>
    screen.getByPlaceholderText(text("en", "admin.grantForm.amountPlaceholder"));
  const note = () =>
    screen.getByPlaceholderText(text("en", "admin.grantForm.notePlaceholder"));
  const grant = () =>
    screen.getByRole("button", { name: text("en", "admin.grantForm.submit") });

  it("grants coins and refreshes the balances", async () => {
    renderWithIntl(<GrantCoinsForm userId="u1" />);
    await userEvent.type(amount(), "25");
    await userEvent.click(grant());

    expect(await screen.findByText(text("en", "admin.grantForm.success"))).toBeVisible();
    expect(supabase.rpc).toHaveBeenCalledWith("grant_coins", {
      target_user: "u1",
      amount: 25,
      grant_reason: "admin_grant",
      grant_note: null,
    });
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("sends the chosen reason and note, and allows deductions", async () => {
    renderWithIntl(<GrantCoinsForm userId="u1" />);
    await userEvent.type(amount(), "-10");
    await userEvent.selectOptions(screen.getByRole("combobox"), "event_grant");
    await userEvent.type(note(), " May Day parade ");
    await userEvent.click(grant());

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(supabase.rpc).toHaveBeenCalledWith("grant_coins", {
      target_user: "u1",
      amount: -10,
      grant_reason: "event_grant",
      grant_note: "May Day parade",
    });
  });

  it.each(["", "0"])("rejects the amount %j without calling the server", async (value) => {
    renderWithIntl(<GrantCoinsForm userId="u1" />);
    if (value) await userEvent.type(amount(), value);
    await userEvent.click(grant());

    expect(screen.getByText(text("en", "admin.grantForm.invalidAmount"))).toBeVisible();
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("shows the error and does not refresh when the grant is refused", async () => {
    supabase.rpc.mockResolvedValue({
      error: { message: "Only the Commissariat may grant coins." },
    });
    renderWithIntl(<GrantCoinsForm userId="u1" />);
    await userEvent.type(amount(), "25");
    await userEvent.click(grant());

    expect(await screen.findByText("Only the Commissariat may grant coins.")).toBeVisible();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
