// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CitizenRolls } from "@/components/admin/CitizenRolls";
import { DeleteCitizenButton } from "@/components/admin/DeleteCitizenButton";
import { RollsTable } from "@/components/admin/RollsTable";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RngSession } from "@/types/database";
import { text } from "../helpers/messages";
import { fakeRouter, renderWithIntl, type FakeRouter } from "../helpers/render";
import { fakeQuery, fakeSupabase, routeTables, type FakeSupabase } from "../helpers/supabase";

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

const admin = (key: string) => text("en", `admin.${key}`);

const online: RngSession = {
  id: "r1",
  user_id: "u1",
  score: 120,
  payload: { number: 777777, badges: [] },
  source: "online",
  played_at: "2026-05-01T10:00:00Z",
};
// The physical machine decides its own payload, and may still be scoring.
const physical: RngSession = {
  id: "r2",
  user_id: "u2",
  score: null,
  payload: null,
  source: "machine",
  played_at: "2026-05-02T10:00:00Z",
};

describe("RollsTable", () => {
  it("shows each roll's number, score and machine", () => {
    renderWithIntl(<RollsTable rolls={[online, physical]} />);
    const [, first, second] = screen.getAllByRole("row");

    expect(within(first).getByText("777777")).toBeVisible();
    expect(within(first).getByText("120")).toBeVisible();
    expect(within(first).getByText(admin("rolls.sources.online"))).toBeVisible();
    expect(within(second).getByText(admin("rolls.sources.machine"))).toBeVisible();
    expect(within(second).getAllByText("—")).toHaveLength(2);
  });

  it("says whose roll it is only when given the usernames", () => {
    const { unmount } = renderWithIntl(<RollsTable rolls={[online]} />);
    expect(screen.queryByText(admin("rolls.citizen"))).toBeNull();
    unmount();

    renderWithIntl(<RollsTable rolls={[online]} usernames={new Map([["u1", "great_abril"]])} />);
    expect(screen.getByText(admin("rolls.citizen"))).toBeVisible();
    expect(screen.getByText("great_abril")).toBeVisible();
  });
});

describe("CitizenRolls", () => {
  const show = () => screen.getByRole("button", { name: admin("rolls.show") });

  it("fetches nothing until asked", () => {
    renderWithIntl(<CitizenRolls userId="u1" />);
    expect(show()).toBeEnabled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("loads that citizen's latest rolls", async () => {
    const query = fakeQuery({ data: [online] });
    routeTables(supabase, { rng_sessions: query });
    renderWithIntl(<CitizenRolls userId="u1" />);
    await userEvent.click(show());

    expect(await screen.findByText("777777")).toBeVisible();
    expect(query.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(query.order).toHaveBeenCalledWith("played_at", { ascending: false });
  });

  it("says so when the citizen has never rolled", async () => {
    routeTables(supabase, { rng_sessions: fakeQuery({ data: [] }) });
    renderWithIntl(<CitizenRolls userId="u1" />);
    await userEvent.click(show());

    expect(await screen.findByText(admin("rolls.citizenEmpty"))).toBeVisible();
  });

  it("reports a failed load and lets the admin try again", async () => {
    routeTables(supabase, { rng_sessions: fakeQuery({ error: { message: "boom" } }) });
    renderWithIntl(<CitizenRolls userId="u1" />);
    await userEvent.click(show());

    expect(await screen.findByText(admin("rolls.loadError"))).toBeVisible();
    expect(show()).toBeEnabled();
  });
});

describe("DeleteCitizenButton", () => {
  const start = () => screen.getByRole("button", { name: admin("deleteForm.button") });
  const confirm = () =>
    screen.getByRole("button", { name: admin("deleteForm.confirmButton") });

  it("asks before deleting anyone", async () => {
    renderWithIntl(<DeleteCitizenButton userId="u1" username="great_abril" />);
    await userEvent.click(start());

    expect(screen.getByText(/great_abril/)).toBeVisible();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("deletes nobody when cancelled", async () => {
    renderWithIntl(<DeleteCitizenButton userId="u1" username="great_abril" />);
    await userEvent.click(start());
    await userEvent.click(screen.getByRole("button", { name: admin("deleteForm.cancel") }));

    expect(start()).toBeVisible();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("deletes the citizen once confirmed and refreshes the register", async () => {
    renderWithIntl(<DeleteCitizenButton userId="u1" username="great_abril" />);
    await userEvent.click(start());
    await userEvent.click(confirm());

    expect(supabase.rpc).toHaveBeenCalledWith("delete_citizen", { target_user: "u1" });
    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  });

  it("shows the error and does not refresh when the deletion is refused", async () => {
    supabase.rpc.mockResolvedValue({ error: { message: "A commissar cannot be deleted." } });
    renderWithIntl(<DeleteCitizenButton userId="u1" username="great_abril" />);
    await userEvent.click(start());
    await userEvent.click(confirm());

    expect(await screen.findByText("A commissar cannot be deleted.")).toBeVisible();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
