# 2. Google OAuth login

"Continue with Google" via Supabase Auth (see
`src/components/auth/GoogleLoginButton.tsx`) is one of the site's two
sign-up/login methods; the other is [email + password](./02b-email-login.md).
This needs a Google Cloud OAuth client, registered in Supabase.

## A. Create a Google OAuth client

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or reuse one) — e.g. "DPRA Webpage".
3. **APIs & Services → OAuth consent screen**:
   - User type: **External** (unless everyone logging in has a Google
     Workspace account under one organization, then Internal works too).
   - Fill in app name ("DPRA"), support email, developer contact.
   - **Application privacy policy link**: `https://<your-domain>/en/privacy`.
     Google asks for one before an app can be published "In production";
     the page is `src/app/[locale]/privacy/page.tsx`, with its text in
     `src/messages/*/privacy.json`.
   - Scopes: the defaults (`email`, `profile`, `openid`) are enough — Supabase
     requests these automatically.
   - You can leave the app in "Testing" mode while developing, but then only
     test users you explicitly add can log in. Submit for verification (or
     just publish to "In production" without verification if you're okay
     with the "unverified app" warning screen) once you want anyone to log in.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Name: anything.
   - **Authorized redirect URIs** — add your Supabase callback URL. Find the
     exact value in Supabase: **Authentication → Providers → Google** shows
     it, in the form:
     ```
     https://<your-project-ref>.supabase.co/auth/v1/callback
     ```
   - Create. You'll get a **Client ID** and **Client Secret**.

## B. Enable the provider in Supabase

1. Supabase dashboard → **Authentication → Providers → Google**.
2. Toggle it on.
3. Paste the **Client ID** and **Client Secret** from step A.
4. Save.

## C. Configure redirect/site URLs in Supabase

Still under **Authentication**:

- **URL Configuration → Site URL**: your production URL (e.g.
  `https://dpra.example.com`), or `http://localhost:3000` while only
  developing locally.
- **Redirect URLs**: add every origin you'll actually use the app from, e.g.
  ```
  http://localhost:3000/auth/callback
  https://dpra.example.com/auth/callback
  ```
  The app's callback route is fixed at `/auth/callback` (see
  `src/app/auth/callback/route.ts`) — it's outside the `[locale]` segment
  since OAuth providers redirect to one fixed URL, and the route then
  redirects into the right locale afterward.

## How the flow works in this codebase

1. User clicks "Continue with Google" (`GoogleLoginButton.tsx`) → calls
   `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: ".../auth/callback?next=/<locale>/profile" } })`.
2. Google redirects back to Supabase, Supabase redirects to
   `/auth/callback?code=...`.
3. `src/app/auth/callback/route.ts` exchanges the code for a session, then
   redirects to the `next` param (the citizen's profile page).
4. On first login, the `on_auth_user_created` Postgres trigger (from the
   migration) fires and creates their `profiles` row — username derived from
   their email (they can change it from their profile page) and a 50-coin
   signup bonus.

Next: [Email + password login](./02b-email-login.md).
