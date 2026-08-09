/**
 * `resolveStandingEvidence` — the one canonical, correction-aware Standing
 * projection (Horizen Pilot Closure — Final Standing + DVN Closure, operator
 * directive, 2026-08-09).
 *
 * Three defects pinned here:
 *   1. Double-counting the nominal seed as BOTH initial and contribution.
 *   2. A receipt superseded by a governed correction still counting as
 *      current evidence.
 *   3. An accrual receipt that predates any genuine `capability_registered`
 *      receipt establishing Stand anyway.
 *
 * Agent-generic fixtures (a synthetic "aigent-q") throughout, per the
 * operator's own "test Agent N, not agent-specific branches" convention
 * elsewhere in this session's work.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface FakeRow {
  id: string;
  action_type: string;
  receipt_status: string;
  created_at: string;
  action_input: Record<string, unknown> | null;
  agents_invoked: string[];
}

let rows: FakeRow[] = [];

function makeFakeSupabase() {
  return {
    from(table: string) {
      if (table !== 'activity_receipts') throw new Error(`unexpected table ${table}`);
      const state: { eqActionType?: string } = {};
      const builder: any = {
        select() {
          return builder;
        },
        eq(col: string, val: string) {
          if (col === 'action_type') state.eqActionType = val;
          return builder;
        },
        contains() {
          return builder;
        },
        order() {
          return builder;
        },
        limit(n: number) {
          const matched = rows
            .filter((r) => r.action_type === state.eqActionType)
            .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
            .slice(0, n);
          return Promise.resolve({ data: matched, error: null });
        },
      };
      return builder;
    },
  };
}

const mockGetSupabaseServer = vi.fn();
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => mockGetSupabaseServer(),
}));

beforeEach(() => {
  rows = [];
  mockGetSupabaseServer.mockReturnValue(makeFakeSupabase());
});

const AGENT = 'aigent-q';

function seedRow(id: string, createdAt: string, receiptStatus = 'dvn_recorded'): FakeRow {
  return {
    id,
    action_type: 'standing_accrued',
    receipt_status: receiptStatus,
    created_at: createdAt,
    action_input: { basis: 'iqube_registry_registration', tier: 'initial', amount: 1 },
    agents_invoked: [AGENT],
  };
}

function contributionRow(id: string, createdAt: string): FakeRow {
  return {
    id,
    action_type: 'standing_accrued',
    receipt_status: 'dvn_recorded',
    created_at: createdAt,
    action_input: null, // genuine contribution accruals in this codebase carry no basis/tier field at all
    agents_invoked: [AGENT],
  };
}

function ingestRow(id: string, createdAt: string): FakeRow {
  return { id, action_type: 'capability_registered', receipt_status: 'dvn_recorded', created_at: createdAt, action_input: null, agents_invoked: [AGENT] };
}

function discrepancyRow(id: string, createdAt: string, supersededIds: string[]): FakeRow {
  return {
    id,
    action_type: 'reconciliation_discrepancy_recorded',
    receipt_status: 'local',
    created_at: createdAt,
    action_input: { discrepancyKind: 'PREMATURE_STANDING_SEED', standingAccruedReceiptIds: supersededIds },
    agents_invoked: [AGENT],
  };
}

describe('resolveStandingEvidence — a nominal seed is never double-counted', () => {
  it('one seed receipt, genuine ingestion before it: exactly one effective initial receipt, zero contribution', async () => {
    rows.push(ingestRow('ingest-1', '2026-01-01T00:00:00.000Z'), seedRow('seed-1', '2026-01-02T00:00:00.000Z'));

    const { resolveStandingEvidence, hasEffectiveStandingEvidence } = await import('@/services/journey/standingEvidenceProjection');
    const projection = await resolveStandingEvidence(AGENT);

    expect(projection.effectiveInitialReceipts.map((r) => r.id)).toEqual(['seed-1']);
    expect(projection.effectiveContributionReceipts).toEqual([]);
    expect(projection.sequencingViolationReceiptIds).toEqual([]);
    expect(projection.supersededReceiptIds).toEqual([]);
    expect(hasEffectiveStandingEvidence(projection)).toBe(true);

    // The actual double-count regression: `initialAccrued=1, contributionAccrued=0`
    // must hold when this feeds resolveAgentStateAxes, never `initialAccrued=1,
    // contributionAccrued=1` from the same receipt appearing in both sets.
    const initialCount = projection.effectiveInitialReceipts.length;
    const contributionCount = projection.effectiveContributionReceipts.length;
    expect(initialCount + contributionCount).toBe(1);
  });

  it('a genuine contribution receipt (no basis/tier) is classified as contribution, never initial', async () => {
    rows.push(ingestRow('ingest-1', '2026-01-01T00:00:00.000Z'), seedRow('seed-1', '2026-01-02T00:00:00.000Z'), contributionRow('contrib-1', '2026-02-01T00:00:00.000Z'));

    const { resolveStandingEvidence } = await import('@/services/journey/standingEvidenceProjection');
    const projection = await resolveStandingEvidence(AGENT);

    expect(projection.effectiveInitialReceipts.map((r) => r.id)).toEqual(['seed-1']);
    expect(projection.effectiveContributionReceipts.map((r) => r.id)).toEqual(['contrib-1']);
  });
});

describe('resolveStandingEvidence — a governed correction removes present consequence, never history', () => {
  it('a superseded seed receipt is excluded from BOTH effective sets, and named in supersededReceiptIds', async () => {
    // No genuine ingestion at all — the classic premature-seed shape.
    rows.push(seedRow('premature-seed', '2026-01-01T00:00:00.000Z'), discrepancyRow('discrepancy-1', '2026-01-05T00:00:00.000Z', ['premature-seed']));

    const { resolveStandingEvidence, hasEffectiveStandingEvidence } = await import('@/services/journey/standingEvidenceProjection');
    const projection = await resolveStandingEvidence(AGENT);

    expect(projection.effectiveInitialReceipts).toEqual([]);
    expect(projection.effectiveContributionReceipts).toEqual([]);
    expect(projection.supersededReceiptIds).toEqual(['premature-seed']);
    expect(hasEffectiveStandingEvidence(projection)).toBe(false);
  });
});

describe('resolveStandingEvidence — sequencing: a seed predating genuine ingestion cannot establish Stand', () => {
  it('a seed receipt with NO capability_registered receipt at all is a sequencing violation', async () => {
    rows.push(seedRow('early-seed', '2026-01-01T00:00:00.000Z'));

    const { resolveStandingEvidence, hasEffectiveStandingEvidence } = await import('@/services/journey/standingEvidenceProjection');
    const projection = await resolveStandingEvidence(AGENT);

    expect(projection.effectiveInitialReceipts).toEqual([]);
    expect(projection.sequencingViolationReceiptIds).toEqual(['early-seed']);
    expect(hasEffectiveStandingEvidence(projection)).toBe(false);
  });

  it('a seed receipt CREATED BEFORE the earliest capability_registered receipt is a sequencing violation even though ingestion exists', async () => {
    rows.push(seedRow('early-seed', '2026-01-01T00:00:00.000Z'), ingestRow('late-ingest', '2026-06-01T00:00:00.000Z'));

    const { resolveStandingEvidence } = await import('@/services/journey/standingEvidenceProjection');
    const projection = await resolveStandingEvidence(AGENT);

    expect(projection.effectiveInitialReceipts).toEqual([]);
    expect(projection.sequencingViolationReceiptIds).toEqual(['early-seed']);
  });

  it('a genuine contribution receipt is NEVER subject to the ingestion-ordering check (contribution Standing is not ingestion-gated)', async () => {
    // No capability_registered receipt at all — a contribution receipt must
    // still count, per agentStateAxes.ts's own FactoryAxis doctrine: ingestion
    // confers Standing ELIGIBILITY, but earning Standing is a separate axis.
    rows.push(contributionRow('contrib-1', '2026-01-01T00:00:00.000Z'));

    const { resolveStandingEvidence } = await import('@/services/journey/standingEvidenceProjection');
    const projection = await resolveStandingEvidence(AGENT);

    expect(projection.effectiveContributionReceipts.map((r) => r.id)).toEqual(['contrib-1']);
    expect(projection.sequencingViolationReceiptIds).toEqual([]);
  });
});
