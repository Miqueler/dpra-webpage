import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { vi } from "vitest";
import { messages } from "./messages";

/** Renders a Client Component with the real messages for `locale`. */
export function renderWithIntl(ui: ReactElement, locale = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      {ui}
    </NextIntlClientProvider>,
  );
}

/** Stand-in for the next-intl router returned by `useRouter()`. */
export function fakeRouter() {
  return {
    refresh: vi.fn(),
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  };
}

export type FakeRouter = ReturnType<typeof fakeRouter>;
