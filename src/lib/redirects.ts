import { routing } from "@/i18n/routing";

const localePrefix = new RegExp(`^/(${routing.locales.join("|")})(/|$)`);

/**
 * Resolves a caller-supplied redirect target (a path, or the full URL that
 * Supabase echoes back from an auth email) to a path on this origin. Anything
 * pointing elsewhere falls back, so the auth routes can't be used as an open
 * redirect.
 */
export function safeNextPath(
  next: string | null,
  origin: string,
  fallback = `/${routing.defaultLocale}/profile`
): string {
  if (!next) return fallback;
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

/** Locale a path belongs to, for sending errors back in the right language. */
export function localeOfPath(path: string): string {
  return path.match(localePrefix)?.[1] ?? routing.defaultLocale;
}

/**
 * Full page load. Used after the session changes in the browser: a soft
 * router navigation can replay a prefetched, logged-out copy of the target
 * page and leaves the server-rendered header stale.
 */
export function hardNavigate(path: string): void {
  window.location.assign(path);
}
