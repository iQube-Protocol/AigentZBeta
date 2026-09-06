/**
 * Item 4 behavioral tests (2026-09-07 closure round, REVISED after operator
 * review found the first pass's migration/index defect and governance
 * regressions) — exercises services/factor/tokenLaunchService.ts's
 * `createOrResumeDraft`/`claimDraftForPreflight` against a fake
 * Postgres-shaped Supabase client supporting insert/upsert/update/select
 * with eq/is filters, enforcing the SAME two constraints the real migration
 * now adds:
 *   - a FULL (non-partial) unique index on (tenant_id, draft_idempotency_key)
 *     — `.upsert(row, { onConflict, ignoreDuplicates: true })` behaves like
 *     `INSERT ... ON CONFLICT (tenant_id, draft_idempotency_key) DO NOTHING`;
 *   - `uq_token_launches_current` (tenant, beneficiary, provider,
 *     superseded_by IS NULL) is modeled via `findCurrentLaunchForBeneficiary`
 *     always reading through the SAME scope, never bypassed.
 *
 * Real cross-process concurrency is a Postgres-level guarantee a
 * single-threaded JS fake cannot fully replicate — see
 * tests/use-case-zero-token-launch-postgres.integration.test.ts for a REAL
 * Postgres test of the ON CONFLICT inference and concurrent-claim behavior.
 * What THIS file proves, faithfully: createOrResumeDraft's own resume/
 * supersede decision logic, and that changed specs go through
 * reviseWithNewVersion (a new immutable version superseding the old row),
 * never an independent duplicate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: vi.fn().mockResolvedValue(undefined),
}));

import {
  createOrResumeDraft,
  claimDraftForPreflight,
  computeDraftIdempotencyKey,
  findCurrentLaunchForBeneficiary,
  type CreateOrResumeDraftInput,
} from '@/services/factor/tokenLaunchService';

type Row = Record<string, unknown>;

/** A minimal fake `token_launches` table supporting exactly the operations
 *  tokenLaunchService.ts performs: insert / upsert(onConflict,
 *  ignoreDuplicates) / update, filtered by eq/is, terminated by
 *  single/maybeSingle or a bare await (thenable) for an unterminated
 *  select/update chain. Enforces the SAME uniqueness constraints as the
 *  real migration: a full unique index on (tenant_id,
 *  draft_idempotency_key) — multiple NULLs allowed — checked on EVERY
 *  insert/upsert, not just ones explicitly targeting it via onConflict
 *  (mirroring a real Postgres index, which does not care how the row got
 *  there). */
function makeFakeSupabase() {
  const rows: Row[] = [];

  function matches(row: Row, filters: [string, 'eq' | 'is', unknown][]) {
    return filters.every(([k, op, v]) => (op === 'is' ? row[k] === v : row[k] === v));
  }

  function assertUniqueKey(candidate: Row, excludeId?: unknown) {
    if (candidate.draft_idempotency_key == null) return;
    const clash = rows.find(
      (r) => r.id !== excludeId && r.tenant_id === candidate.tenant_id && r.draft_idempotency_key === candidate.draft_idempotency_key,
    );
    if (clash) {
      throw new Object({ message: `duplicate key value violates unique constraint "uq_token_launches_draft_idempotency"`, code: '23505' });
    }
  }

  function from(_table: string) {
    const filters: [string, 'eq' | 'is', unknown][] = [];
    let op: { kind: 'insert' | 'upsert' | 'update'; payload: Row; opts?: { onConflict?: string; ignoreDuplicates?: boolean } } | null = null;

    function runOp(): Row[] {
      if (!op) return rows.filter((r) => matches(r, filters));
      if (op.kind === 'insert') {
        assertUniqueKey(op.payload);
        rows.push({ ...op.payload });
        return [op.payload];
      }
      if (op.kind === 'upsert') {
        const conflictKeys = (op.opts?.onConflict ?? '').split(',').filter(Boolean);
        const existing =
          conflictKeys.length > 0 &&
          rows.find((r) => conflictKeys.every((k) => r[k] != null && op!.payload[k] != null && r[k] === op!.payload[k]));
        if (existing) return [existing]; // ON CONFLICT DO NOTHING (ignoreDuplicates)
        assertUniqueKey(op.payload);
        rows.push({ ...op.payload });
        return [op.payload];
      }
      // update
      const matched = rows.filter((r) => matches(r, filters));
      for (const r of matched) {
        const next = { ...r, ...op.payload };
        assertUniqueKey(next, r.id);
        Object.assign(r, op.payload);
      }
      return matched;
    }

    const builder = {
      insert(row: Row) {
        op = { kind: 'insert', payload: row };
        return builder;
      },
      upsert(row: Row, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
        op = { kind: 'upsert', payload: row, opts };
        return builder;
      },
      update(patch: Row) {
        op = { kind: 'update', payload: patch };
        return builder;
      },
      select() {
        return builder;
      },
      eq(key: string, value: unknown) {
        filters.push([key, 'eq', value]);
        return builder;
      },
      is(key: string, value: unknown) {
        filters.push([key, 'is', value]);
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      single() {
        try {
          const matched = runOp();
          if (matched.length !== 1) return Promise.resolve({ data: null, error: { message: `expected exactly 1 row, found ${matched.length}` } });
          return Promise.resolve({ data: matched[0], error: null });
        } catch (e) {
          return Promise.resolve({ data: null, error: e });
        }
      },
      maybeSingle() {
        try {
          const matched = runOp();
          return Promise.resolve({ data: matched[0] ?? null, error: null });
        } catch (e) {
          return Promise.resolve({ data: null, error: e });
        }
      },
      then(onFulfilled: (v: { data: Row[] | null; error: unknown }) => unknown, onRejected?: (e: unknown) => unknown) {
        try {
          const matched = runOp();
          return Promise.resolve(onFulfilled({ data: matched, error: null }));
        } catch (e) {
          return onRejected ? Promise.resolve(onRejected(e)) : Promise.reject(e);
        }
      },
    };
    return builder;
  }

  return { from, _rows: rows } as unknown as import('@supabase/supabase-js').SupabaseClient & { _rows: Row[] };
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
    expect(computeDraftIdempotencyKey(BASE)).toBe(computeDraftIdempotencyKey({ ...BASE }));
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

describe('createOrResumeDraft — atomic create-or-resume, exact-spec + case-bound, PRESERVING one-current-launch-per-beneficiary', () => {
  let admin: ReturnType<typeof makeFakeSupabase>;
  beforeEach(() => {
    admin = makeFakeSupabase();
  });

  it('a single call creates exactly one row: created true, superseded false', async () => {
    const { launch, created, superseded } = await createOrResumeDraft(admin, BASE);
    expect(created).toBe(true);
    expect(superseded).toBe(false);
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
    expect(second.superseded).toBe(false);
    expect(admin._rows.length).toBe(1);
  });

  it('two "concurrent" identical first-time requests (fired via Promise.all) still yield exactly ONE launch row', async () => {
    const [a, b] = await Promise.all([createOrResumeDraft(admin, BASE), createOrResumeDraft(admin, { ...BASE })]);
    expect(a.launch.id).toBe(b.launch.id);
    expect(admin._rows.length).toBe(1);
    expect([a.created, b.created].filter(Boolean).length).toBe(1);
  });

  it('a DIFFERENT specification SUPERSEDES the current row with a new immutable version — never an independent duplicate', async () => {
    const first = await createOrResumeDraft(admin, BASE);
    const second = await createOrResumeDraft(admin, { ...BASE, tokenName: 'A Completely Different Token' });

    expect(second.launch.id).not.toBe(first.launch.id);
    expect(second.created).toBe(true);
    expect(second.superseded).toBe(true);
    expect(second.launch.supersedes_id).toBe(first.launch.id);
    expect(second.launch.version).toBe(2);

    // The OLD row still exists on disk (nothing is ever deleted) but is
    // now explicitly superseded — never left looking like a second,
    // independent current launch.
    const oldRow = admin._rows.find((r) => r.id === first.launch.id)!;
    expect(oldRow.state).toBe('superseded');
    expect(oldRow.superseded_by).toBe(second.launch.id);
    expect(oldRow.draft_idempotency_key).toBeNull();

    // uq_token_launches_current's own scope: exactly ONE current
    // (non-superseded) row for this beneficiary — the invariant item 4's
    // governance correction requires preserved.
    const current = await findCurrentLaunchForBeneficiary(admin, 'tenant-1', 'aigent-factor');
    expect(current?.id).toBe(second.launch.id);
    const allCurrentRows = admin._rows.filter((r) => r.beneficiary_agent_runtime_id === 'aigent-factor' && r.superseded_by == null);
    expect(allCurrentRows.length).toBe(1);
  });

  it('a different caseRef for the SAME beneficiary ALSO supersedes (never a second concurrent current launch) — the invariant is beneficiary-scoped, not case-scoped', async () => {
    const first = await createOrResumeDraft(admin, BASE);
    const second = await createOrResumeDraft(admin, { ...BASE, caseRef: 'case-2' });
    expect(second.launch.id).not.toBe(first.launch.id);
    expect(second.superseded).toBe(true);
    expect(second.launch.case_ref).toBe('case-2');

    const allCurrentRows = admin._rows.filter((r) => r.beneficiary_agent_runtime_id === 'aigent-factor' && r.superseded_by == null);
    expect(allCurrentRows.length).toBe(1);
  });

  it('reverting to an EARLIER (now-superseded) exact spec does not collide with that old row\'s freed key — a fresh version is created', async () => {
    const v1 = await createOrResumeDraft(admin, BASE);
    await createOrResumeDraft(admin, { ...BASE, tokenName: 'Different' });
    // Revert back to the ORIGINAL spec — v1's own key was nulled out when
    // it was superseded, so this must succeed (a third version), never
    // throw a unique-constraint error against v1's stale key.
    const v3 = await createOrResumeDraft(admin, BASE);
    expect(v3.launch.id).not.toBe(v1.launch.id);
    expect(v3.superseded).toBe(true);
    expect(v3.launch.version).toBe(3);
  });
});

describe('claimDraftForPreflight — atomic claim, at most one winner', () => {
  let admin: ReturnType<typeof makeFakeSupabase>;
  beforeEach(() => {
    admin = makeFakeSupabase();
  });

  it('a single caller claims a draft row successfully', async () => {
    const { launch } = await createOrResumeDraft(admin, BASE);
    const { claimed, launch: claimedLaunch } = await claimDraftForPreflight(admin, launch.id as string, 'tenant-1');
    expect(claimed).toBe(true);
    expect(claimedLaunch.state).toBe('preparing');
  });

  it('a second claim on the SAME already-claimed row loses — never a second winner', async () => {
    const { launch } = await createOrResumeDraft(admin, BASE);
    const firstClaim = await claimDraftForPreflight(admin, launch.id as string, 'tenant-1');
    const secondClaim = await claimDraftForPreflight(admin, launch.id as string, 'tenant-1');
    expect(firstClaim.claimed).toBe(true);
    expect(secondClaim.claimed).toBe(false);
    expect(secondClaim.launch.state).toBe('preparing');
  });

  it('two "concurrent" claims (Promise.all) on the same row — exactly one wins', async () => {
    const { launch } = await createOrResumeDraft(admin, BASE);
    const [a, b] = await Promise.all([
      claimDraftForPreflight(admin, launch.id as string, 'tenant-1'),
      claimDraftForPreflight(admin, launch.id as string, 'tenant-1'),
    ]);
    expect([a.claimed, b.claimed].filter(Boolean).length).toBe(1);
  });
});
