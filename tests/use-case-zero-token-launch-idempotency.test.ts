/**
 * Item 4 behavioral tests (2026-09-07 closure round) — exercises
 * services/factor/tokenLaunchService.ts's `createOrResumeDraft` directly
 * against a fake Postgres-shaped Supabase client that enforces the SAME
 * unique constraint the real migration adds
 * (uq_token_launches_draft_idempotency on (tenant_id, draft_idempotency_key)):
 * an `upsert(..., { onConflict, ignoreDuplicates: true })` no-ops when a row
 * with that key already exists, exactly like `INSERT ... ON CONFLICT DO
 * NOTHING`. Real cross-process concurrency is a Postgres-level guarantee
 * (a single-threaded JS unit test cannot simulate two OS processes racing
 * a real transaction) — what this DOES prove, faithfully, is that
 * createOrResumeDraft's own logic never creates a second row for an
 * identical spec (whether called twice sequentially or "concurrently" via
 * Promise.all, which in JS still serializes through the same fake table),
 * and that a genuinely different spec always computes a different key and
 * therefore always inserts a new, independent row — never reusing or
 * mutating the older draft.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: vi.fn().mockResolvedValue(undefined),
}));

import { createOrResumeDraft, computeDraftIdempotencyKey, type CreateOrResumeDraftInput } from '@/services/factor/tokenLaunchService';

/** A minimal fake `token_launches` table enforcing the SAME unique index
 *  the real migration adds: (tenant_id, draft_idempotency_key), NULLs
 *  excluded. `.upsert(row, { onConflict, ignoreDuplicates: true })` mirrors
 *  Postgres's `INSERT ... ON CONFLICT (...) DO NOTHING` — if a row with the
 *  same (tenant_id, draft_idempotency_key) already exists, the upsert is a
 *  silent no-op; otherwise the row is inserted. The subsequent `.select()`
 *  read-back always resolves to whichever row actually holds that key. */
function makeFakeSupabase() {
  const rows: Record<string, unknown>[] = [];

  function applyFilters(base: Record<string, unknown>[], filters: [string, unknown][]) {
    return base.filter((r) => filters.every(([k, v]) => r[k] === v));
  }

  function from(_table: string) {
    const filters: [string, unknown][] = [];
    const builder = {
      upsert(row: Record<string, unknown>, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
        const conflictKeys = (opts?.onConflict ?? '').split(',').filter(Boolean);
        const conflict = conflictKeys.length > 0 && rows.find((r) => conflictKeys.every((k) => r[k] != null && r[k] === row[k]));
        if (!conflict) rows.push({ ...row });
        // ignoreDuplicates: true => never surface the conflict as an error.
        return Promise.resolve({ error: null });
      },
      insert(row: Record<string, unknown> | Record<string, unknown>[]) {
        const toInsert = Array.isArray(row) ? row : [row];
        rows.push(...toInsert.map((r) => ({ ...r })));
        return builder;
      },
      select() {
        return builder;
      },
      eq(key: string, value: unknown) {
        filters.push([key, value]);
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      single() {
        const matches = applyFilters(rows, filters);
        if (matches.length !== 1) return Promise.resolve({ data: null, error: { message: `expected exactly 1 row, found ${matches.length}` } });
        return Promise.resolve({ data: matches[0], error: null });
      },
      maybeSingle() {
        const matches = applyFilters(rows, filters);
        return Promise.resolve({ data: matches[0] ?? null, error: null });
      },
    };
    return builder;
  }

  return { from, _rows: rows } as unknown as import('@supabase/supabase-js').SupabaseClient & { _rows: Record<string, unknown>[] };
}

const BASE: CreateOrResumeDraftInput = {
  tenantId: 'tenant-1',
  caseRef: 'case-1',
  beneficiaryAgentRuntimeId: 'aigent-factor',
  requestingPrincipalPersonaId: 'persona-1',
  preparingAgentRuntimeId: 'aigent-factor-prep',
  chain: 'base-sepolia',
  tokenName: 'Test Token',
  tokenSymbol: 'TST',
};

describe('computeDraftIdempotencyKey — deterministic over the exact spec', () => {
  it('is identical for two calls with the exact same inputs', () => {
    const a = computeDraftIdempotencyKey(BASE);
    const b = computeDraftIdempotencyKey({ ...BASE });
    expect(a).toBe(b);
  });

  it('changes when ANY spec field changes (chain/tokenName/tokenSymbol/description/caseRef/beneficiary/tenant)', () => {
    const base = computeDraftIdempotencyKey(BASE);
    expect(computeDraftIdempotencyKey({ ...BASE, tokenName: 'Different Token' })).not.toBe(base);
    expect(computeDraftIdempotencyKey({ ...BASE, tokenSymbol: 'DIFF' })).not.toBe(base);
    expect(computeDraftIdempotencyKey({ ...BASE, chain: 'base-mainnet' })).not.toBe(base);
    expect(computeDraftIdempotencyKey({ ...BASE, description: 'now has a description' })).not.toBe(base);
    expect(computeDraftIdempotencyKey({ ...BASE, caseRef: 'case-2' })).not.toBe(base);
    expect(computeDraftIdempotencyKey({ ...BASE, beneficiaryAgentRuntimeId: 'aigent-other' })).not.toBe(base);
    expect(computeDraftIdempotencyKey({ ...BASE, tenantId: 'tenant-2' })).not.toBe(base);
  });
});

describe('createOrResumeDraft — atomic create-or-resume, exact-spec + case-bound', () => {
  let admin: ReturnType<typeof makeFakeSupabase>;
  beforeEach(() => {
    admin = makeFakeSupabase();
  });

  it('a single call creates exactly one row, created: true', async () => {
    const { launch, created } = await createOrResumeDraft(admin, BASE);
    expect(created).toBe(true);
    expect(admin._rows.length).toBe(1);
    expect(admin._rows[0].id).toBe(launch.id);
    expect(launch.case_ref).toBe('case-1');
  });

  it('IDENTICAL requests (same tenant/case/beneficiary/spec) — called twice — resolve to the SAME launch id; only ONE row ever exists', async () => {
    const first = await createOrResumeDraft(admin, BASE);
    const second = await createOrResumeDraft(admin, { ...BASE });
    expect(second.launch.id).toBe(first.launch.id);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(admin._rows.length).toBe(1);
  });

  it('two "concurrent" identical requests (fired via Promise.all) still yield exactly ONE launch row — the unique index, not application ordering, is what enforces this', async () => {
    const [a, b] = await Promise.all([createOrResumeDraft(admin, BASE), createOrResumeDraft(admin, { ...BASE })]);
    expect(a.launch.id).toBe(b.launch.id);
    expect(admin._rows.length).toBe(1);
    // Exactly one of the two calls "won" the insert — never both, never neither.
    expect([a.created, b.created].filter(Boolean).length).toBe(1);
  });

  it('a DIFFERENT specification (changed tokenName) NEVER reuses or preflights the earlier draft — it creates a genuinely separate row', async () => {
    const first = await createOrResumeDraft(admin, BASE);
    const second = await createOrResumeDraft(admin, { ...BASE, tokenName: 'A Completely Different Token' });
    expect(second.launch.id).not.toBe(first.launch.id);
    expect(second.created).toBe(true);
    expect(admin._rows.length).toBe(2);
  });

  it('a different caseRef for the SAME beneficiary also creates a separate row — case-bound, not beneficiary-bound', async () => {
    const first = await createOrResumeDraft(admin, BASE);
    const second = await createOrResumeDraft(admin, { ...BASE, caseRef: 'case-2' });
    expect(second.launch.id).not.toBe(first.launch.id);
    expect(admin._rows.length).toBe(2);
  });
});
