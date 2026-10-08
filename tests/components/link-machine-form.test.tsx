// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LinkMachineForm } from "@/components/atzar/LinkMachineForm";
import { createClient } from "@/lib/supabase/client";
import { text } from "../helpers/messages";
import { renderWithIntl } from "../helpers/render";
import { fakeSupabase, type FakeSupabase } from "../helpers/supabase";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

let supabase: FakeSupabase;

beforeEach(() => {
  supabase = fakeSupabase();
  vi.mocked(createClient).mockReturnValue(supabase as never);
});

describe("LinkMachineForm", () => {
  const code = () =>
    screen.getByRole("textbox", { name: text("en", "atzar.dashboard.link.label") });
  const link = () =>
    screen.getByRole("button", { name: text("en", "atzar.dashboard.link.button") });

  it("links the code the machine showed, upper-cased and without spaces", async () => {
    renderWithIntl(<LinkMachineForm />);
    await userEvent.type(code(), "xk4 2pm");
    expect(code()).toHaveValue("XK42PM");
    await userEvent.click(link());

    expect(await screen.findByText(text("en", "atzar.dashboard.link.success"))).toBeVisible();
    expect(supabase.rpc).toHaveBeenCalledWith("claim_machine_session", {
      session_code: "XK42PM",
    });
    expect(code()).toHaveValue("");
  });

  it("cannot be sent until the whole code is typed", async () => {
    renderWithIntl(<LinkMachineForm />);
    expect(link()).toBeDisabled();
    await userEvent.type(code(), "XK42P");
    expect(link()).toBeDisabled();
    await userEvent.type(code(), "M");
    expect(link()).toBeEnabled();
  });

  it("shows the error and keeps the code when the machine's code is refused", async () => {
    supabase.rpc.mockResolvedValue({
      error: { message: "That code is unknown or has expired, citizen." },
    });
    renderWithIntl(<LinkMachineForm />);
    await userEvent.type(code(), "XK42PM");
    await userEvent.click(link());

    expect(
      await screen.findByText("That code is unknown or has expired, citizen."),
    ).toBeVisible();
    expect(code()).toHaveValue("XK42PM");
  });
});
