# 2b. Email + password login

Besides Google, citizens can enlist with an email address and password (see
`src/components/auth/EmailAuthForm.tsx`). The account is unusable until they
follow the confirmation link Supabase emails them. This needs a few dashboard
settings — the code alone is not enough.

## A. Run the second migration

Run `supabase/migrations/0002_email_signup.sql` the same way as the first
(SQL Editor → paste → Run, or `supabase db push`). It moves the 50-coin signup
bonus from "account created" to "email confirmed", so unverified addresses
earn nothing.

## B. Enable the Email provider

Supabase dashboard → **Authentication → Providers → Email**:

- **Enable Email provider**: on.
- **Confirm email**: **on**. This is what enforces verification — with it off,
  sign-ups are logged in immediately without proving they own the address.
- Minimum password length: 8, to match the form.

## C. Point the email templates at the app

**Authentication → Emails → Templates**. The default links only work in the
browser that requested them; replace them so they go through the app's
`/auth/confirm` route (`src/app/auth/confirm/route.ts`) instead.

**Confirm signup** — set the link to:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}">Confirm your email</a>
```

**Reset password** — set the link to:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next={{ .RedirectTo }}">Reset your password</a>
```

`{{ .RedirectTo }}` carries the citizen's language (`/ca/…`, `/es/…`,
`/en/…`) so they land on the right locale. The email text itself is one
template for every language.

## D. Allow the redirect URLs

**Authentication → URL Configuration → Redirect URLs** — besides the
`/auth/callback` entries from the Google guide, allow the pages the emails
send people to:

```
http://localhost:3000/**
https://dpra.example.com/**
```

**Site URL** must be the origin the emails should link to — it is what
`{{ .SiteURL }}` expands to. While it is `http://localhost:3000`, emails only
work on your own machine.

## E. Set up real email sending (before going public)

Supabase's built-in mailer is for testing only: about 2 emails per hour, best
effort. For real use, configure **Authentication → Emails → SMTP Settings**
with a provider such as Resend, Brevo, or Amazon SES (this requires a sending
domain you control).

## How the flow works in this codebase

1. **Sign up** — `EmailAuthForm` calls `supabase.auth.signUp()`. Supabase
   creates the user unconfirmed and sends the email; no session is issued.
   The `on_auth_user_created` trigger creates the `profiles` row, without
   the bonus.
2. **Confirm** — the link hits `/auth/confirm`, which calls
   `supabase.auth.verifyOtp()`, sets the session cookies, and redirects to the
   profile. The `on_auth_user_confirmed` trigger pays the signup bonus.
3. **Log in** — `supabase.auth.signInWithPassword()`. An unconfirmed address
   is refused, with an option to resend the email.
4. **Forgot password** — `supabase.auth.resetPasswordForEmail()` sends a link
   through `/auth/confirm` to `/[locale]/update-password`, which calls
   `supabase.auth.updateUser({ password })`.

Next: [Environment variables](./03-environment-variables.md).
