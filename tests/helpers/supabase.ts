import { vi } from "vitest";

export type QueryResult = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
};

const CHAIN_METHODS = [
  "select",
  "insert",
  "update",
  "upsert",
  "eq",
  "order",
  "single",
  "maybeSingle",
] as const;

/**
 * Stand-in for a Supabase query builder: every chain method returns the
 * builder and awaiting it yields `result`. The methods are spies, so tests
 * can assert on what was queried.
 */
export function fakeQuery(result: QueryResult = {}) {
  const resolved = { data: null, error: null, ...result };
  type Chain = Record<(typeof CHAIN_METHODS)[number], ReturnType<typeof vi.fn>>;

  const chain = Object.fromEntries(
    CHAIN_METHODS.map((method) => [method, vi.fn(() => builder)]),
  ) as Chain;
  const builder: Chain & PromiseLike<typeof resolved> = {
    ...chain,
    then: (onFulfilled, onRejected) =>
      Promise.resolve(resolved).then(onFulfilled, onRejected),
  };
  return builder;
}

export type FakeQuery = ReturnType<typeof fakeQuery>;

/** Stand-in for a Supabase client. Configure the spies per test. */
export function fakeSupabase() {
  const ok = { data: null, error: null };
  return {
    from: vi.fn((table: string): FakeQuery => {
      throw new Error(`Unexpected query on "${table}"`);
    }),
    rpc: vi.fn(async (): Promise<QueryResult> => ok),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      signInWithPassword: vi.fn(async (): Promise<QueryResult> => ok),
      signUp: vi.fn(async (): Promise<QueryResult> => ok),
      signInWithOAuth: vi.fn(async (): Promise<QueryResult> => ok),
      signOut: vi.fn(async (): Promise<QueryResult> => ok),
      resend: vi.fn(async (): Promise<QueryResult> => ok),
      resetPasswordForEmail: vi.fn(async (): Promise<QueryResult> => ok),
      updateUser: vi.fn(async (): Promise<QueryResult> => ok),
      exchangeCodeForSession: vi.fn(async (): Promise<QueryResult> => ok),
      verifyOtp: vi.fn(async (): Promise<QueryResult> => ok),
    },
  };
}

export type FakeSupabase = ReturnType<typeof fakeSupabase>;

/** Routes `supabase.from(table)` to the given per-table queries. */
export function routeTables(
  supabase: FakeSupabase,
  tables: Record<string, FakeQuery | FakeQuery[]>,
) {
  const queues = Object.fromEntries(
    Object.entries(tables).map(([table, q]) => [table, Array.isArray(q) ? [...q] : [q]]),
  );
  supabase.from.mockImplementation((table: string) => {
    const queue = queues[table];
    if (!queue) throw new Error(`Unexpected query on "${table}"`);
    // The last query for a table keeps answering once the queue is drained.
    return queue.length > 1 ? queue.shift()! : queue[0];
  });
}
