# DPRA Webpage — Setup Guide

This directory walks through everything needed to get the site running, from
an empty Supabase account to a working deployment. Read the files in order
the first time; after that, use them as reference.

1. [Supabase project setup](./01-supabase-setup.md) — create the project, run the schema migration.
2. [Google OAuth login](./02-google-oauth.md) — wire up "Continue with Google".
   - [Email + password login](./02b-email-login.md) — email sign-up with mandatory verification.
3. [Environment variables](./03-environment-variables.md) — what each `.env.local` value is and where to find it.
4. [Running locally](./04-running-locally.md) — install, dev server, typecheck/lint/build.
5. [Becoming an admin](./05-admin-promotion.md) — promote the first Commissariat account.
6. [ATZAR machine integration](./06-atzar-machine-integration.md) — how the physical slot machine talks to the website.
7. [Deploying](./07-deployment.md) — putting it on the internet (Vercel).

Nothing in the app will work — login, profile, ATZAR, admin — until step 1–3
are done. The app is fully built and typechecks/builds/lints clean with no
Supabase project connected, but every page that touches the database will
error at runtime against placeholder credentials.
