/**
 * Resolves a caller-supplied redirect target to a path on our own origin.
 * Anything that would leave the site (another host, `//host`, `@host`, …) or
 * cannot be parsed yields `fallback` instead.
 */
export function sameOriginPath(
  requested: string | null,
  origin: string,
  fallback: string,
) {
  if (!requested) return fallback;
  // A target that is not a path could only be an absolute URL; resolving it
  // against the origin would silently turn `@host` into a path.
  if (!requested.startsWith("/") && !/^https?:\/\//i.test(requested)) {
    return fallback;
  }

  try {
    const url = new URL(requested, origin);
    if (url.origin === origin) return `${url.pathname}${url.search}`;
  } catch {
    // Malformed target — fall back to the default.
  }
  return fallback;
}
