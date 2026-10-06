// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AcceptFriendButton } from "@/components/atzar/AcceptFriendButton";
import { AddFriendForm } from "@/components/atzar/AddFriendForm";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { usePathname, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { text } from "../helpers/messages";
import { fakeRouter, renderWithIntl, type FakeRouter } from "../helpers/render";
import {
  fakeQuery,
  fakeSupabase,
  routeTables,
  type FakeQuery,
  type FakeSupabase,
} from "../helpers/supabase";

vi.mock("@/i18n/navigation", () => ({ useRouter: vi.fn(), usePathname: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

let supabase: FakeSupabase;
let router: FakeRouter;

beforeEach(() => {
  supabase = fakeSupabase();
  router = fakeRouter();
  vi.mocked(createClient).mockReturnValue(supabase as never);
  vi.mocked(useRouter).mockReturnValue(router as never);
  vi.mocked(usePathname).mockReturnValue("/atzar/friends");
});

describe("AddFriendForm", () => {
  const msg = (key: string) => text("en", `atzar.friends.add.${key}`);
  let profiles: FakeQuery;
  let friendships: FakeQuery;

  function setup({
    found = { id: "u2", username: "comrade" } as object | null,
    insertError = null as { message: string } | null,
  } = {}) {
    profiles = fakeQuery({ data: found });
    friendships = fakeQuery({ error: insertError });
    routeTables(supabase, { profiles, friendships });
    renderWithIntl(<AddFriendForm meId="u1" />);
  }

  async function add(name: string) {
    await userEvent.type(screen.getByPlaceholderText(msg("placeholder")), name);
    await userEvent.click(screen.getByRole("button", { name: msg("button") }));
  }

  it("sends a pending request to the named citizen and refreshes the list", async () => {
    setup();
    await add("  comrade  ");

    expect(await screen.findByText(msg("success"))).toBeVisible();
    expect(profiles.eq).toHaveBeenCalledWith("username", "comrade");
    expect(friendships.insert).toHaveBeenCalledWith({
      user_id: "u1",
      friend_id: "u2",
      status: "pending",
    });
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByPlaceholderText(msg("placeholder"))).toHaveValue("");
  });

  it("reports an unknown username", async () => {
    setup({ found: null });
    await add("nobody");

    expect(await screen.findByText(msg("errorNotFound"))).toBeVisible();
    expect(friendships.insert).not.toHaveBeenCalled();
  });

  it("refuses a request to oneself", async () => {
    setup({ found: { id: "u1", username: "me" } });
    await add("me");

    expect(await screen.findByText(msg("errorSelf"))).toBeVisible();
    expect(friendships.insert).not.toHaveBeenCalled();
  });

  it("shows the error and does not refresh when the request fails", async () => {
    setup({ insertError: { message: "duplicate request" } });
    await add("comrade");

    expect(await screen.findByText("duplicate request")).toBeVisible();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe("AcceptFriendButton", () => {
  it("accepts that request and refreshes the list", async () => {
    const friendships = fakeQuery();
    routeTables(supabase, { friendships });
    renderWithIntl(<AcceptFriendButton requestId="r1" />);
    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(friendships.update).toHaveBeenCalledWith({ status: "accepted" });
    expect(friendships.eq).toHaveBeenCalledWith("id", "r1");
  });

  it("shows the error and does not refresh when accepting fails", async () => {
    routeTables(supabase, {
      friendships: fakeQuery({ error: { message: "not allowed" } }),
    });
    renderWithIntl(<AcceptFriendButton requestId="r1" />);
    await userEvent.click(screen.getByRole("button"));

    expect(await screen.findByText("not allowed")).toBeVisible();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe("UpdatePasswordForm", () => {
  const msg = (key: string) => text("en", `auth.updatePassword.${key}`);

  async function submit(password: string) {
    renderWithIntl(<UpdatePasswordForm />);
    await userEvent.type(
      screen.getByLabelText((content) => content.startsWith(msg("passwordLabel"))),
      password,
    );
    await userEvent.click(screen.getByRole("button", { name: msg("submit") }));
  }

  it("saves the new password and goes to the profile", async () => {
    await submit("integral-1917");

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "integral-1917" });
    expect(router.replace).toHaveBeenCalledWith("/profile");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it.each(["weak_password", "same_password"])("explains a %s error", async (code) => {
    supabase.auth.updateUser.mockResolvedValue({ error: { code, message: "raw" } });
    await submit("integral-1917");

    expect(await screen.findByRole("alert")).toHaveTextContent(msg(`errors.${code}`));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("falls back to a generic message for other errors", async () => {
    supabase.auth.updateUser.mockResolvedValue({
      error: { code: "session_missing", message: "raw" },
    });
    await submit("integral-1917");

    expect(await screen.findByRole("alert")).toHaveTextContent(msg("errors.generic"));
  });
});

describe("GoogleLoginButton", () => {
  it.each(["ca", "es", "en"])(
    "starts the Google flow and comes back to the %s profile",
    async (locale) => {
      renderWithIntl(<GoogleLoginButton />, locale);
      await userEvent.click(screen.getByRole("button"));

      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=%2F${locale}%2Fprofile`,
        },
      });
    },
  );
});

describe("LanguageSwitcher", () => {
  it("offers every language and shows the current one", () => {
    renderWithIntl(<LanguageSwitcher />, "es");
    expect(screen.getByRole("combobox")).toHaveValue("es");
    expect(screen.getAllByRole("option").map((o) => o.getAttribute("value"))).toEqual([
      "ca",
      "es",
      "en",
    ]);
  });

  it("switches language while staying on the same page", async () => {
    renderWithIntl(<LanguageSwitcher />, "ca");
    await userEvent.selectOptions(screen.getByRole("combobox"), "en");

    expect(router.replace).toHaveBeenCalledWith("/atzar/friends", { locale: "en" });
  });
});
