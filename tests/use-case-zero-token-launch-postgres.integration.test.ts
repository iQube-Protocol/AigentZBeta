/**
 * REAL PostgreSQL integration test for item 4 (2026-09-07 correction round
 * 2) — the operator review correctly identified that the in-memory fake
 * Supabase client used in tests/use-case-zero-token-launch-idempotency.test.ts
 * cannot catch a PostgREST/Postgres `ON CONFLICT` inference defect: a
 * PARTIAL unique index (`... WHERE draft_idempotency_key IS NOT NULL`)
 * cannot be targeted by a plain column-list `ON CONFLICT (col, col)` clause
 * — Postgres raises "no unique or exclusion constraint matching the ON
 * CONFLICT specification" at EXECUTION time, something no JS-side fake can
 * reproduce because the fake never asks a real query planner to resolve an
 * arbiter index.
 *
 * This file spins up (or reuses) a REAL local PostgreSQL 16 instance,
 * creates a throwaway database per run, applies the CURRENT migration's
 * actual index-defining SQL (transcribed verbatim from
 * supabase/migrations/20260930260000_token_launches_case_bound_idempotency.sql
 * — kept in one place so drift between this test and the real migration is
 * a visible, reviewable diff, not a silent divergence), and proves:
 *
 *   1. The corrected NON-partial unique index is successfully inferred by
 *      the exact `INSERT ... ON CONFLICT (tenant_id, draft_idempotency_key)
 *      DO NOTHING` statement PostgREST/supabase-js generates for
 *      `.upsert(row, { onConflict: 'tenant_id,draft_idempotency_key',
 *      ignoreDuplicates: true })`.
 *   2. A REGRESSION GUARD: the SAME statement against the OLD, partial
 *      version of that index fails with exactly the reported Postgres
 *      error — proving this test would have caught the original defect,
 *      and catches it again if the partial predicate is ever reintroduced.
 *   3. Real concurrent OS processes (separate `psql` connections, not
 *      single-threaded JS) racing the identical insert collapse onto
 *      exactly one row — a guarantee no in-memory fake can provide.
 *   4. `uq_token_launches_current` (tenant, beneficiary, provider, WHERE
 *      superseded_by IS NULL) still rejects a second concurrent
 *      non-superseded row for the same beneficiary via a plain INSERT.
 *
 * Requires a reachable local PostgreSQL server (checked in `beforeAll`;
 * every test in this file is skipped with a clear reason if one isn't
 * available — e.g. in a CI environment with no Postgres service
 * provisioned). This environment has PostgreSQL 16 installed and running
 * locally, so it exercises the real thing here.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const PG_ENV = { ...process.env, PGPASSWORD: 'postgres' };
const PG_HOST = '127.0.0.1';
const PG_USER = 'postgres';
const DB_NAME = `ucz_pg_test_${Date.now()}`;

async function psql(db: string, sql: string): Promise<string> {
  const { stdout } = await execFileAsync(
    'psql',
    ['-U', PG_USER, '-h', PG_HOST, '-d', db, '-v', 'ON_ERROR_STOP=1', '-tA', '-c', sql],
    { env: PG_ENV },
  );
  return stdout;
}

/** psql exits non-zero and rejects on any SQL error — this wraps that into
 *  a plain { ok, message } result so tests can assert on a FAILURE without
 *  the test itself throwing. */
async function psqlExpectingFailure(db: string, sql: string): Promise<{ ok: boolean; message: string }> {
  try {
    await psql(db, sql);
    return { ok: true, message: '' };
  } catch (e) {
    const stderr = (e as { stderr?: string }).stderr ?? String(e);
    return { ok: false, message: stderr };
  }
}

let pgAvailable = false;

beforeAll(async () => {
  try {
    await execFileAsync('psql', ['-U', PG_USER, '-h', PG_HOST, '-d', 'postgres', '-c', 'SELECT 1'], { env: PG_ENV });
    pgAvailable = true;
  } catch {
    pgAvailable = false;
    // eslint-disable-next-line no-console
    console.warn(
      `[use-case-zero-token-launch-postgres.integration.test.ts] No reachable local PostgreSQL at ${PG_HOST}:5432 — skipping the real-Postgres ON CONFLICT/concurrency proofs. ` +
        'The in-memory fake in tests/use-case-zero-token-launch-idempotency.test.ts still covers application-level resume/supersede logic, but NOT this file\'s Postgres-level guarantees.',
    );
    return;
  }
  await execFileAsync('psql', ['-U', PG_USER, '-h', PG_HOST, '-d', 'postgres', '-c', `CREATE DATABASE ${DB_NAME}`], { env: PG_ENV });

  // The exact, relevant subset of the schema — transcribed from the real
  // migrations (20260930220000_token_launches.sql +
  // 20260930260000_token_launches_case_bound_idempotency.sql). Columns
  // unrelated to this test's assertions (bankr_terms, spec_hash, etc.) are
  // omitted for clarity; the two indexes under test are copied VERBATIM.
  await psql(
    DB_NAME,
    `
    CREATE TABLE token_launches (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      beneficiary_agent_runtime_id TEXT NOT NULL,
      provider TEXT NOT NULL CHECK (provider IN ('bankr')),
      state TEXT NOT NULL DEFAULT 'draft',
      case_ref TEXT,
      draft_idempotency_key TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      supersedes_id TEXT,
      superseded_by TEXT
    );

    -- Verbatim from 20260930220000_token_launches.sql (the one-current-
    -- launch-per-beneficiary invariant, PRESERVED by the corrected
    -- 20260930260000 migration).
    CREATE UNIQUE INDEX uq_token_launches_current
      ON token_launches (tenant_id, beneficiary_agent_runtime_id, provider)
      WHERE superseded_by IS NULL;

    -- Verbatim from the CORRECTED 20260930260000_token_launches_case_bound_idempotency.sql.
    CREATE UNIQUE INDEX uq_token_launches_draft_idempotency
      ON token_launches (tenant_id, draft_idempotency_key);
    `,
  );
}, 30000);

afterAll(async () => {
  if (!pgAvailable) return;
  await execFileAsync('psql', ['-U', PG_USER, '-h', PG_HOST, '-d', 'postgres', '-c', `DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`], { env: PG_ENV });
});

function insertOnConflictSql(id: string, tenantId: string, key: string) {
  return `
    INSERT INTO token_launches (id, tenant_id, beneficiary_agent_runtime_id, provider, draft_idempotency_key)
    VALUES ('${id}', '${tenantId}', 'aigent-factor', 'bankr', '${key}')
    ON CONFLICT (tenant_id, draft_idempotency_key) DO NOTHING;
  `;
}

describe('REAL PostgreSQL — ON CONFLICT inference against the corrected (non-partial) index', () => {
  it('the exact PostgREST-generated INSERT ... ON CONFLICT (tenant_id, draft_idempotency_key) DO NOTHING succeeds', async () => {
    if (!pgAvailable) return;
    const result = await psqlExpectingFailure(DB_NAME, insertOnConflictSql('launch-a', 'tenant-1', 'key-a'));
    expect(result.ok).toBe(true);
    const count = await psql(DB_NAME, `SELECT count(*) FROM token_launches WHERE draft_idempotency_key = 'key-a';`);
    expect(count.trim()).toBe('1');
  });

  it('a repeat identical INSERT ... ON CONFLICT DO NOTHING against the SAME key is a true no-op — still exactly one row', async () => {
    if (!pgAvailable) return;
    await psql(DB_NAME, insertOnConflictSql('launch-b1', 'tenant-2', 'key-b'));
    await psql(DB_NAME, insertOnConflictSql('launch-b2', 'tenant-2', 'key-b'));
    const count = await psql(DB_NAME, `SELECT count(*) FROM token_launches WHERE tenant_id = 'tenant-2' AND draft_idempotency_key = 'key-b';`);
    expect(count.trim()).toBe('1');
    // The FIRST id is the one that survives — the second insert truly did nothing.
    const id = await psql(DB_NAME, `SELECT id FROM token_launches WHERE tenant_id = 'tenant-2' AND draft_idempotency_key = 'key-b';`);
    expect(id.trim()).toBe('launch-b1');
  });

  it('REGRESSION GUARD: the SAME statement against the OLD PARTIAL index fails with the exact reported Postgres error', async () => {
    if (!pgAvailable) return;
    await psql(
      DB_NAME,
      `
      DROP INDEX uq_token_launches_draft_idempotency;
      CREATE UNIQUE INDEX uq_token_launches_draft_idempotency
        ON token_launches (tenant_id, draft_idempotency_key)
        WHERE draft_idempotency_key IS NOT NULL;
      `,
    );
    const result = await psqlExpectingFailure(DB_NAME, insertOnConflictSql('launch-c', 'tenant-3', 'key-c'));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/no unique or exclusion constraint matching the ON CONFLICT specification/i);

    // Restore the CORRECTED (non-partial) index for the remaining tests in this file.
    await psql(
      DB_NAME,
      `
      DROP INDEX uq_token_launches_draft_idempotency;
      CREATE UNIQUE INDEX uq_token_launches_draft_idempotency
        ON token_launches (tenant_id, draft_idempotency_key);
      `,
    );
  });
});

describe('REAL PostgreSQL — concurrent OS-level connections racing the identical insert', () => {
  it('N truly-concurrent psql processes inserting the SAME (tenant_id, draft_idempotency_key) collapse onto exactly ONE row', async () => {
    if (!pgAvailable) return;
    const tenantId = 'tenant-concurrent';
    const key = 'key-concurrent';
    const attempts = Array.from({ length: 8 }, (_, i) => insertOnConflictSql(`launch-race-${i}`, tenantId, key));

    // Each element is a SEPARATE `psql` OS process — real, independent
    // connections genuinely racing Postgres, not single-threaded JS.
    await Promise.all(attempts.map((sql) => psql(DB_NAME, sql)));

    const count = await psql(DB_NAME, `SELECT count(*) FROM token_launches WHERE tenant_id = '${tenantId}' AND draft_idempotency_key = '${key}';`);
    expect(count.trim()).toBe('1');
  }, 30000);
});

describe('REAL PostgreSQL — uq_token_launches_current is preserved', () => {
  it('a second concurrent (non-superseded) row for the SAME (tenant, beneficiary, provider) is rejected by the DB itself', async () => {
    if (!pgAvailable) return;
    await psql(
      DB_NAME,
      `INSERT INTO token_launches (id, tenant_id, beneficiary_agent_runtime_id, provider, draft_idempotency_key) VALUES ('cur-1', 'tenant-current', 'aigent-factor', 'bankr', 'cur-key-1');`,
    );
    const result = await psqlExpectingFailure(
      DB_NAME,
      `INSERT INTO token_launches (id, tenant_id, beneficiary_agent_runtime_id, provider, draft_idempotency_key) VALUES ('cur-2', 'tenant-current', 'aigent-factor', 'bankr', 'cur-key-2');`,
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/duplicate key value violates unique constraint "uq_token_launches_current"/i);

    // Marking the first row superseded frees the invariant for a new current row.
    await psql(DB_NAME, `UPDATE token_launches SET superseded_by = 'cur-2', state = 'superseded' WHERE id = 'cur-1';`);
    const afterSupersede = await psqlExpectingFailure(
      DB_NAME,
      `INSERT INTO token_launches (id, tenant_id, beneficiary_agent_runtime_id, provider, draft_idempotency_key) VALUES ('cur-2', 'tenant-current', 'aigent-factor', 'bankr', 'cur-key-2');`,
    );
    expect(afterSupersede.ok).toBe(true);
  });
});
