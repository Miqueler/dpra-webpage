// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnlineMachineToggle } from "@/components/admin/OnlineMachineToggle";
import { OnlineMachine } from "@/components/atzar/OnlineMachine";
import { useRouter } from "@/i18n/navigation";
import type { RollResult } from "@/lib/atzar/machine";
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

afterEach(() => {
  vi.unstubAllGlobals();
});

const play = (key: string) => text("en", `atzar.play.${key}`);

const ROLL: RollResult & { roll_type: string } = {
  number: 4096,
  badges: [
    {
      id: "EVEN",
      emoji: "⚖️",
      name: "Even",
      description: "Divisible by 2.",
      points: 2,
      rarity: "common",
      counts: true,
    },
    {
      id: "ROUND_10",
      emoji: "🧹",
      name: "Round",
      description: "Ends in a zero.",
      points: 10,
      rarity: "uncommon",
      counts: false,
    },
    {
      id: "SQUARE",
      emoji: "🟥",
      name: "Perfect square",
      description: "A whole number multiplied by itself.",
      points: 999,
      rarity: "rare",
      counts: true,
    },
  ],
  score: 1001,
  percentile: 97.4,
  tier: "epic",
  roll_type: "free",
};

/** Answers the roll request. jsdom has no matchMedia, so the reveal is instant. */
function server(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("OnlineMachine", () => {
  const rollButton = () => screen.getByRole("button", { name: play("roll") });

  it("asks the server for a roll and shows the number, badges and score", async () => {
    const fetchMock = server(200, ROLL);
    renderWithIntl(<OnlineMachine freeRollAvailable extraRolls={0} personalBest={null} />);
    expect(screen.getByText(play("freeRoll"))).toBeVisible();
    await userEvent.click(rollButton());

    expect(await screen.findByText("1,001")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/atzar/roll",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ locale: "en" }) }),
    );
    for (const badge of ROLL.badges) {
      expect(screen.getByText(badge.name)).toBeVisible();
      expect(screen.getByText(`+${badge.points}`)).toBeVisible();
    }
    expect(screen.getByText(play("tiers.epic"))).toBeVisible();
    expect(screen.getByText("Better than 97% of all possible rolls")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("You rolled 4096. Score: 1001.");
    expect(screen.getByText(play("outranked"))).toBeVisible();
    // The roll counts are rendered on the server.
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: play("rollAgain") })).toBeEnabled();
  });

  it("says so when a roll earns no badges", async () => {
    server(200, { ...ROLL, badges: [], score: 0, percentile: 0, tier: "trash" });
    renderWithIntl(<OnlineMachine freeRollAvailable extraRolls={0} personalBest={null} />);
    await userEvent.click(rollButton());
    expect(await screen.findByText(play("noBadges"))).toBeVisible();
  });

  it.each([
    [403, "disabled"],
    [409, "no_rolls"],
    [401, "unauthorized"],
    [500, "failed"],
    [500, "something new"],
  ])("explains a refused roll (%i %s)", async (status, error) => {
    server(status, { error });
    renderWithIntl(<OnlineMachine freeRollAvailable extraRolls={0} personalBest={null} />);
    await userEvent.click(rollButton());

    const known = ["disabled", "no_rolls", "unauthorized"].includes(error) ? error : "failed";
    expect(await screen.findByRole("alert")).toHaveTextContent(play(`errors.${known}`));
    expect(router.refresh).not.toHaveBeenCalled();
    expect(rollButton()).toBeEnabled();
  });

  it("explains a roll that never reached the server", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    renderWithIntl(<OnlineMachine freeRollAvailable extraRolls={0} personalBest={null} />);
    await userEvent.click(rollButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(play("errors.failed"));
  });

  it("counts the purchased rolls when the free one is gone", () => {
    renderWithIntl(<OnlineMachine freeRollAvailable={false} extraRolls={2} personalBest={null} />);
    expect(screen.getByText("2 purchased rolls left")).toBeVisible();
    expect(rollButton()).toBeEnabled();
  });

  it("tells the browser not to restore the button's old state after a reload", () => {
    renderWithIntl(<OnlineMachine freeRollAvailable={false} extraRolls={0} personalBest={null} />);
    expect(rollButton()).toHaveAttribute("autocomplete", "off");
  });

  it("cannot roll without rolls", () => {
    renderWithIntl(<OnlineMachine freeRollAvailable={false} extraRolls={0} personalBest={null} />);
    expect(screen.getByText(play("noRolls"))).toBeVisible();
    expect(rollButton()).toBeDisabled();
  });

  it("shows no personal best banner for a citizen who has never played", () => {
    renderWithIntl(<OnlineMachine freeRollAvailable extraRolls={0} personalBest={null} />);
    expect(screen.queryByText(/Personal best/)).not.toBeInTheDocument();
  });

  it("shows the personal best brought from the server", () => {
    renderWithIntl(<OnlineMachine freeRollAvailable extraRolls={0} personalBest={500} />);
    expect(screen.getByText("Personal best: 500")).toBeVisible();
  });

  it("does not announce a record on a score below the personal best", async () => {
    server(200, ROLL); // score 1001
    renderWithIntl(<OnlineMachine freeRollAvailable extraRolls={0} personalBest={5000} />);
    await userEvent.click(rollButton());

    expect(await screen.findByText("1,001")).toBeVisible();
    expect(screen.queryByText(play("newRecord"))).not.toBeInTheDocument();
  });

  it("announces and keeps a new record for the rest of the session", async () => {
    server(200, ROLL); // score 1001
    renderWithIntl(<OnlineMachine freeRollAvailable extraRolls={2} personalBest={500} />);
    await userEvent.click(rollButton());

    expect(await screen.findByText(play("newRecord"))).toBeVisible();
    expect(screen.getByText("Personal best: 1,001")).toBeVisible();

    // Beating the (locally tracked) new best again still reads as a record...
    server(200, { ...ROLL, score: 2000 });
    await userEvent.click(screen.getByRole("button", { name: play("rollAgain") }));
    expect(await screen.findByText("2,000")).toBeVisible();
    expect(screen.getByText(play("newRecord"))).toBeVisible();

    // ...but a lower roll after that is not.
    server(200, { ...ROLL, score: 100 });
    await userEvent.click(screen.getByRole("button", { name: play("rollAgain") }));
    expect(await screen.findByText("100")).toBeVisible();
    expect(screen.queryByText(play("newRecord"))).not.toBeInTheDocument();
    expect(screen.getByText("Personal best: 2,000")).toBeVisible();
  });

  it("copies a summary of the result to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    server(200, ROLL);
    renderWithIntl(<OnlineMachine freeRollAvailable extraRolls={0} personalBest={null} />);
    await userEvent.click(rollButton());
    await screen.findByText("1,001");

    await userEvent.click(screen.getByRole("button", { name: play("share.button") }));

    expect(writeText).toHaveBeenCalledWith(
      [
        "ATZAR #4096",
        "1,001 pts — Epic roll",
        "⚖️🟥",
        `${window.location.origin}/en/atzar`,
      ].join("\n"),
    );
    expect(await screen.findByText(play("share.copied"))).toBeVisible();
  });

  it("says so when the clipboard refuses", async () => {
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    server(200, ROLL);
    renderWithIntl(<OnlineMachine freeRollAvailable extraRolls={0} personalBest={null} />);
    await userEvent.click(rollButton());
    await screen.findByText("1,001");

    await userEvent.click(screen.getByRole("button", { name: play("share.button") }));
    expect(await screen.findByText(play("share.error"))).toBeVisible();
  });
});

describe("OnlineMachineToggle", () => {
  const admin = (key: string) => text("en", `admin.onlineMachine.${key}`);

  it("switches the machine on and refreshes the page", async () => {
    renderWithIntl(<OnlineMachineToggle enabled={false} />);
    expect(screen.getByText(admin("off"))).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: admin("switchOn") }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(supabase.rpc).toHaveBeenCalledWith("set_online_machine", { enabled: true });
  });

  it("switches the machine off", async () => {
    renderWithIntl(<OnlineMachineToggle enabled />);
    expect(screen.getByText(admin("on"))).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: admin("switchOff") }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(supabase.rpc).toHaveBeenCalledWith("set_online_machine", { enabled: false });
  });

  it("shows the error and does not refresh when the switch is refused", async () => {
    supabase.rpc.mockResolvedValue({
      error: { message: "Only the Commissariat may operate the machine." },
    });
    renderWithIntl(<OnlineMachineToggle enabled={false} />);
    await userEvent.click(screen.getByRole("button", { name: admin("switchOn") }));

    expect(
      await screen.findByText("Only the Commissariat may operate the machine."),
    ).toBeVisible();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
