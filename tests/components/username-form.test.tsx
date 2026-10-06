// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsernameForm } from "@/components/profile/UsernameForm";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { text } from "../helpers/messages";
import { fakeRouter, renderWithIntl, type FakeRouter } from "../helpers/render";
import {
  fakeQuery,
  fakeSupabase,
  routeTables,
  type FakeQuery,
  type FakeSupabase,
  type QueryResult,
} from "../helpers/supabase";

vi.mock("@/i18n/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

const msg = (key: string) => text("en", `auth.profile.username.${key}`);

let supabase: FakeSupabase;
let router: FakeRouter;
let profiles: FakeQuery;

function setup(result: QueryResult = {}) {
  profiles = fakeQuery(result);
  routeTables(supabase, { profiles });
  renderWithIntl(<UsernameForm userId="u1" currentUsername="old.name" />);
}

const input = () => screen.getByLabelText(msg("label"));
const save = () => screen.getByRole("button", { name: msg("save") });

async function rename(to: string) {
  await userEvent.clear(input());
  await userEvent.type(input(), to);
  await userEvent.click(save());
}

beforeEach(() => {
  supabase = fakeSupabase();
  router = fakeRouter();
  vi.mocked(createClient).mockReturnValue(supabase as never);
  vi.mocked(useRouter).mockReturnValue(router as never);
});

describe("UsernameForm", () => {
  it("starts with the current username and nothing to save", () => {
    setup();
    expect(input()).toHaveValue("old.name");
    expect(save()).toBeDisabled();
  });

  it("saves the new username on the citizen's own profile and refreshes", async () => {
    setup();
    await rename("  great_abril  ");

    expect(await screen.findByText(msg("saved"))).toBeVisible();
    expect(supabase.from).toHaveBeenCalledWith("profiles");
    expect(profiles.update).toHaveBeenCalledWith({ username: "great_abril" });
    expect(profiles.eq).toHaveBeenCalledWith("id", "u1");
    // The top bar shows the username too.
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(input()).toHaveValue("great_abril");
  });

  it.each(["ab", "great abril", "abril@upc", "abríl"])(
    "rejects %j without calling the server",
    async (name) => {
      setup();
      await rename(name);

      expect(screen.getByRole("alert")).toHaveTextContent(msg("errors.invalid"));
      expect(supabase.from).not.toHaveBeenCalled();
      expect(router.refresh).not.toHaveBeenCalled();
    },
  );

  it("cannot be longer than the limit", async () => {
    setup();
    await userEvent.clear(input());
    await userEvent.type(input(), "x".repeat(30));
    expect(input()).toHaveValue("x".repeat(20));
  });

  it("explains when the username belongs to someone else", async () => {
    setup({ error: { code: "23505", message: "duplicate key value" } });
    await rename("taken_name");

    expect(await screen.findByRole("alert")).toHaveTextContent(msg("errors.taken"));
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("shows a generic error for any other failure, not the database message", async () => {
    setup({ error: { code: "P0001", message: "internal detail" } });
    await rename("new_name");

    expect(await screen.findByRole("alert")).toHaveTextContent(msg("errors.generic"));
    expect(screen.queryByText(/internal detail/)).not.toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("clears the confirmation when the citizen types again", async () => {
    setup();
    await rename("great_abril");
    expect(await screen.findByText(msg("saved"))).toBeVisible();

    await userEvent.type(input(), "2");
    expect(screen.queryByText(msg("saved"))).not.toBeInTheDocument();
  });
});
