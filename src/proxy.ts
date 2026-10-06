import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);

  // Refresh the Supabase session cookie on every navigation so Server
  // Components always see an up-to-date auth.uid().
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}

// `auth` is excluded along with `api`: the /auth/* route handlers live outside
// the [locale] segment, and the locale middleware would otherwise redirect
// them to /<locale>/auth/*, which does not exist.
export const config = {
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
