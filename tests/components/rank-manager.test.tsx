// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RankManager } from "@/components/admin/RankManager";
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

const ranks = (key: string) => text("en", `admin.ranks.${key}`);

const RANKS = [
  { id: "r1", name: "Citizen", is_default: true, holders: 3, created_at: "2026-01-01" },
  { id: "r2", name: "Comrade", is_default: false, holders: 1, created_at: "2026-01-02" },
  { id: "r3", name: "Hero of Labour", is_default: false, holders: 0, created_at: "2026-01-03" },
];

/** The row of the rank with this name, and the buttons in it. */
function row(name: string) {
  const item = screen.getByDisplayValue(name).closest("li")!;
  const button = (key: string) => within(item).queryByRole("button", { name: ranks(key) });
  return { item, button, name: within(item).getByRole("textbox") };
}

describe("RankManager", () => {
  it("lists every rank with how many citizens hold it, and marks the default", () => {
    renderWithIntl(<RankManager ranks={RANKS} />);
    expect(within(row("Citizen").item).getByText("3 citizens")).toBeVisible();
    expect(within(row("Comrade").item).getByText("1 citizen")).toBeVisible();
    expect(within(row("Citizen").item).getByText(ranks("default"))).toBeVisible();
    expect(row("Citizen").button("makeDefault")).not.toBeInTheDocument();
    expect(row("Comrade").button("makeDefault")).toBeEnabled();
  });

  it("only lets a rank be deleted when it is not the default and nobody holds it", async () => {
    renderWithIntl(<RankManager ranks={RANKS} />);
    expect(row("Citizen").button("delete")).toBeDisabled();
    expect(row("Citizen").button("delete")).toHaveAttribute("title", ranks("deleteDefault"));
    expect(row("Comrade").button("delete")).toBeDisabled();
    expect(row("Comrade").button("delete")).toHaveAttribute("title", ranks("deleteInUse"));

    await userEvent.click(row("Hero of Labour").button("delete")!);
    expect(supabase.rpc).toHaveBeenCalledWith("delete_rank", { rank_id: "r3" });
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  });

  it("renames a rank, once the name has changed", async () => {
    renderWithIntl(<RankManager ranks={RANKS} />);
    const comrade = row("Comrade");
    expect(comrade.button("rename")).toBeDisabled();

    await userEvent.clear(comrade.name);
    expect(comrade.button("rename")).toBeDisabled();
    await userEvent.type(comrade.name, " Tovarish ");
    await userEvent.click(comrade.button("rename")!);

    expect(supabase.rpc).toHaveBeenCalledWith("rename_rank", {
      rank_id: "r2",
      new_name: "Tovarish",
    });
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  });

  it("makes another rank the default", async () => {
    renderWithIntl(<RankManager ranks={RANKS} />);
    await userEvent.click(row("Comrade").button("makeDefault")!);
    expect(supabase.rpc).toHaveBeenCalledWith("set_default_rank", { rank_id: "r2" });
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  });

  it("creates a rank and empties the field", async () => {
    renderWithIntl(<RankManager ranks={RANKS} />);
    const field = screen.getByPlaceholderText(ranks("newPlaceholder"));
    const create = screen.getByRole("button", { name: ranks("create") });
    expect(create).toBeDisabled();

    await userEvent.type(field, "Militant");
    await userEvent.click(create);

    expect(supabase.rpc).toHaveBeenCalledWith("create_rank", { new_name: "Militant" });
    await waitFor(() => expect(field).toHaveValue(""));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows why a change was refused, and does not refresh", async () => {
    supabase.rpc.mockResolvedValue({ error: { message: "That rank already exists." } });
    renderWithIntl(<RankManager ranks={RANKS} />);
    await userEvent.type(screen.getByPlaceholderText(ranks("newPlaceholder")), "Comrade");
    await userEvent.click(screen.getByRole("button", { name: ranks("create") }));

    expect(await screen.findByText("That rank already exists.")).toBeVisible();
    expect(screen.getByPlaceholderText(ranks("newPlaceholder"))).toHaveValue("Comrade");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("says so when there are no ranks at all", () => {
    renderWithIntl(<RankManager ranks={[]} />);
    expect(screen.getByText(ranks("empty"))).toBeVisible();
  });
});
