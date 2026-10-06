// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { hardNavigate } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/client";
import { text } from "../helpers/messages";
import { renderWithIntl } from "../helpers/render";
import { fakeSupabase, type FakeSupabase } from "../helpers/supabase";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
// A real full-page load would tear down the test document.
vi.mock("@/lib/redirects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/redirects")>()),
  hardNavigate: vi.fn(),
}));

const msg = (key: string) => text("en", `auth.email.${key}`);
const ORIGIN = window.location.origin;
const EMAIL = "abril@upc.edu";
const PASSWORD = "integral-1917";

let supabase: FakeSupabase;

// Labels wrap their hint text, so match on how the label starts.
const field = (label: string) =>
  screen.getByLabelText((content) => content.startsWith(label));
const queryField = (label: string) =>
  screen.queryByLabelText((content) => content.startsWith(label));
const button = (name: string) => screen.getByRole("button", { name });

async function fill({ username }: { username?: string } = {}) {
  await userEvent.type(field(msg("emailLabel")), EMAIL);
  if (username !== undefined) {
    await userEvent.type(field(msg("usernameLabel")), username);
  }
  await userEvent.type(field(msg("passwordLabel")), PASSWORD);
}

async function signUp(username: string) {
  await userEvent.click(button(msg("toSignup")));
  await fill({ username });
  await userEvent.click(button(msg("submit.signup")));
}

beforeEach(() => {
  supabase = fakeSupabase();
  vi.mocked(createClient).mockReturnValue(supabase as never);
  vi.mocked(hardNavigate).mockReset();
});

describe("EmailAuthForm — log in", () => {
  it("asks only for email and password", () => {
    renderWithIntl(<EmailAuthForm />);
    expect(field(msg("emailLabel"))).toBeVisible();
    expect(field(msg("passwordLabel"))).toBeVisible();
    expect(queryField(msg("usernameLabel"))).not.toBeInTheDocument();
  });

  it("logs in and goes to the profile", async () => {
    renderWithIntl(<EmailAuthForm />);
    await fill();
    await userEvent.click(button(msg("submit.signin")));

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: EMAIL,
      password: PASSWORD,
    });
    // A full page load, so the top bar is re-rendered as logged in.
    expect(hardNavigate).toHaveBeenCalledWith("/en/profile");
  });

  it("explains wrong credentials and stays on the page", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials", message: "Invalid login credentials" },
    });
    renderWithIntl(<EmailAuthForm />);
    await fill();
    await userEvent.click(button(msg("submit.signin")));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      msg("errors.invalid_credentials"),
    );
    expect(hardNavigate).not.toHaveBeenCalled();
  });

  it("falls back to a generic message for unknown errors", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      error: { code: "something_new", message: "raw server text" },
    });
    renderWithIntl(<EmailAuthForm />);
    await fill();
    await userEvent.click(button(msg("submit.signin")));

    expect(await screen.findByRole("alert")).toHaveTextContent(msg("errors.generic"));
    expect(screen.queryByText(/raw server text/)).not.toBeInTheDocument();
  });

  it("offers to resend the confirmation email to an unconfirmed address", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    });
    renderWithIntl(<EmailAuthForm />);
    await fill();
    await userEvent.click(button(msg("submit.signin")));
    await userEvent.click(await screen.findByRole("button", { name: msg("resend") }));

    expect(supabase.auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: EMAIL,
      options: { emailRedirectTo: `${ORIGIN}/en/profile` },
    });
    expect(await screen.findByRole("status")).toHaveTextContent(EMAIL);
  });
});

describe("EmailAuthForm — enlist", () => {
  beforeEach(() => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { identities: [{}] }, session: null },
    });
  });

  it("asks for a username", async () => {
    renderWithIntl(<EmailAuthForm />);
    await userEvent.click(button(msg("toSignup")));
    expect(field(msg("usernameLabel"))).toBeRequired();
  });

  it("sends the chosen username along with the sign-up", async () => {
    renderWithIntl(<EmailAuthForm />);
    await signUp("  comrade_1  ");

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: EMAIL,
      password: PASSWORD,
      options: {
        emailRedirectTo: `${ORIGIN}/en/profile`,
        // The database trigger names the profile from this.
        data: { username: "comrade_1" },
      },
    });
  });

  it("tells the citizen to check their inbox and does not log them in", async () => {
    renderWithIntl(<EmailAuthForm />);
    await signUp("comrade_1");

    expect(await screen.findByRole("status")).toHaveTextContent(EMAIL);
    expect(field(msg("passwordLabel"))).toHaveValue("");
    expect(button(msg("resend"))).toBeVisible();
    expect(hardNavigate).not.toHaveBeenCalled();
  });

  it.each(["ab", "great abril", "abril@upc"])(
    "rejects the username %j before contacting the server",
    async (username) => {
      renderWithIntl(<EmailAuthForm />);
      await signUp(username);

      expect(screen.getByRole("alert")).toHaveTextContent(msg("errors.invalid_username"));
      expect(supabase.auth.signUp).not.toHaveBeenCalled();
    },
  );

  it("reports an address that is already registered", async () => {
    // Supabase answers these with an identity-less user instead of an error.
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { identities: [] }, session: null },
    });
    renderWithIntl(<EmailAuthForm />);
    await signUp("comrade_1");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      msg("errors.user_already_exists"),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("goes straight to the profile when no confirmation is required", async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { identities: [{}] }, session: { access_token: "t" } },
    });
    renderWithIntl(<EmailAuthForm />);
    await signUp("comrade_1");

    expect(hardNavigate).toHaveBeenCalledWith("/en/profile");
  });

  it("explains a weak password", async () => {
    supabase.auth.signUp.mockResolvedValue({
      error: { code: "weak_password", message: "Password is too weak" },
    });
    renderWithIntl(<EmailAuthForm />);
    await signUp("comrade_1");

    expect(await screen.findByRole("alert")).toHaveTextContent(msg("errors.weak_password"));
  });
});

describe("EmailAuthForm — forgot password", () => {
  it("sends a reset link that lands on the update-password page", async () => {
    renderWithIntl(<EmailAuthForm />);
    await userEvent.click(button(msg("toForgot")));
    expect(queryField(msg("passwordLabel"))).not.toBeInTheDocument();

    await userEvent.type(field(msg("emailLabel")), EMAIL);
    await userEvent.click(button(msg("submit.forgot")));

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(EMAIL, {
      redirectTo: `${ORIGIN}/en/update-password`,
    });
    expect(await screen.findByRole("status")).toHaveTextContent(EMAIL);
  });
});

describe("EmailAuthForm — language", () => {
  it("keeps the citizen's language in the confirmation link", async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { identities: [{}] }, session: null },
    });
    renderWithIntl(<EmailAuthForm />, "ca");
    await userEvent.click(button(text("ca", "auth.email.toSignup")));
    await userEvent.type(field(text("ca", "auth.email.emailLabel")), EMAIL);
    await userEvent.type(field(text("ca", "auth.email.usernameLabel")), "comrade_1");
    await userEvent.type(field(text("ca", "auth.email.passwordLabel")), PASSWORD);
    await userEvent.click(button(text("ca", "auth.email.submit.signup")));

    expect(supabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: `${ORIGIN}/ca/profile`,
        }),
      }),
    );
  });

  it("stays in the citizen's language after logging in", async () => {
    renderWithIntl(<EmailAuthForm />, "es");
    await userEvent.type(field(text("es", "auth.email.emailLabel")), EMAIL);
    await userEvent.type(field(text("es", "auth.email.passwordLabel")), PASSWORD);
    await userEvent.click(button(text("es", "auth.email.submit.signin")));

    expect(hardNavigate).toHaveBeenCalledWith("/es/profile");
  });
});
