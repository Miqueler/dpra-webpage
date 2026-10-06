import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations");

/**
 * The parts of a Supabase project the migrations rely on: the API roles,
 * `auth.users`, `auth.uid()` / `auth.role()`, and Supabase's default grants
 * (every role may touch every table; row-level security does the limiting).
 */
const SUPABASE_STANDIN = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}',
    email_confirmed_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create function auth.role() returns text language sql stable as $$
    select nullif(current_setting('request.jwt.claim.role', true), '')
  $$;

  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on sequences to anon, authenticated, service_role;
`;

type Row = Record<string, unknown>;

/**
 * An in-memory Postgres with every file in supabase/migrations applied, in
 * order, exactly as written.
 */
export async function createDatabase() {
  const pg = new PGlite({ extensions: { pgcrypto } });
  await pg.exec(SUPABASE_STANDIN);
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    await pg.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }

  let counter = 0;

  /** Runs a query with full privileges, like the Supabase dashboard. */
  async function admin<T extends Row = Row>(sql: string, params: unknown[] = []) {
    return (await pg.query<T>(sql, params)).rows;
  }

  /**
   * Runs a query the way the browser client does for a logged-in citizen:
   * as the `authenticated` role with their id in the JWT. Pass `null` for a
   * visitor who is not logged in (`anon`).
   */
  async function as<T extends Row = Row>(
    userId: string | null,
    sql: string,
    params: unknown[] = [],
  ) {
    return pg.transaction(async (tx) => {
      const role = userId ? "authenticated" : "anon";
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
      await tx.query("select set_config('request.jwt.claim.role', $1, true)", [role]);
      await tx.exec(`set local role ${role}`);
      return (await tx.query<T>(sql, params)).rows;
    });
  }

  /** Inserts an auth user, firing the sign-up trigger. Returns the new id. */
  async function signUp({
    email,
    confirmed = true,
    metadata = {},
  }: {
    email?: string | null;
    confirmed?: boolean;
    metadata?: Row;
  } = {}) {
    counter += 1;
    const [{ id }] = await admin<{ id: string }>(
      `insert into auth.users (email, raw_user_meta_data, email_confirmed_at)
       values ($1, $2, $3) returning id`,
      [
        email === undefined ? `citizen${counter}@upc.edu` : email,
        JSON.stringify(metadata),
        confirmed ? new Date().toISOString() : null,
      ],
    );
    return id;
  }

  /** Follows the confirmation link for an email sign-up. */
  async function confirmEmail(userId: string) {
    await admin("update auth.users set email_confirmed_at = now() where id = $1", [userId]);
  }

  async function profile(userId: string) {
    const [row] = await admin<{
      id: string;
      username: string;
      coins: number;
      rank: string;
      is_admin: boolean;
      machine_code: string;
      invited_by: string | null;
      last_daily_bonus_at: string | null;
    }>(
      `select id, username, coins, rank, is_admin, machine_code, invited_by,
              last_daily_bonus_at::text
       from public.profiles where id = $1`,
      [userId],
    );
    return row;
  }

  /** The citizen's coin ledger as `[amount, reason]` pairs, smallest first. */
  async function ledger(userId: string) {
    const rows = await admin<{ amount: number; reason: string }>(
      `select amount, reason from public.coin_transactions
       where user_id = $1 order by amount, reason`,
      [userId],
    );
    return rows.map((row) => [row.amount, row.reason]);
  }

  return { pg, admin, as, signUp, confirmEmail, profile, ledger, close: () => pg.close() };
}

export type TestDatabase = Awaited<ReturnType<typeof createDatabase>>;
