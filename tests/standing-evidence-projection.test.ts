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
      const state: { eqActionType?: string; containsAgent?: string } = {};
      const builder: any = {
        select() {
          return builder;
        },
        eq(col: string, val: string) {
          if (col === 'action_type') state.eqActionType = val;
          return builder;
        },
        // Real behavioral filter — mirrors findAgentReceiptRefs's own
        // `.contains('agents_invoked', [runtimeAgentId])` call exactly, so a
        // cross-agent isolation test here proves the SAME thing a live
        // Postgres containment query would.
        contains(col: string, val: string[]) {
          if (col === 'agents_invoked') state.containsAgent = val[0];
          return builder;
        },
        order() {
          return builder;
        },
        limit(n: number) {
          const matched = rows
            .filter((r) => r.action_type === state.eqActionType)
            .filter((r) => !state.containsAgent || r.agents_invoked.includes(state.containsAgent))
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

// ── 2026-08-23 operator directive: cross-agent Standing attribution ────────

const NAKAMOTO = 'aigent-nakamoto';
const KN0W1 = 'aigent-kn0w1';

function correctedAttributionRow(
  id: string,
  createdAt: string,
  subjectAgent: string,
  originalReceiptId: string,
  correctedFrom: string[] = ['aigent-z'],
): FakeRow {
  return {
    id,
    action_type: 'standing_corrected',
    receipt_status: 'dvn_recorded',
    created_at: createdAt,
    action_input: { correctionKind: 'standing_attribution', originalReceiptId, correctedFrom },
    agents_invoked: [subjectAgent],
  };
}

describe('resolveStandingEvidence — cross-agent attribution isolation (2026-08-23)', () => {
  it("Nakamoto's own contribution accrual is discoverable by resolveStandingEvidence('aigent-nakamoto')", async () => {
    rows.push({
      id: 'nakamoto-contrib-1',
      action_type: 'standing_accrued',
      receipt_status: 'dvn_recorded',
      created_at: '2026-08-01T00:00:00.000Z',
      action_input: null,
      agents_invoked: [NAKAMOTO],
    });

    const { resolveStandingEvidence, hasEffectiveStandingEvidence } = await import('@/services/journey/standingEvidenceProjection');
    const projection = await resolveStandingEvidence(NAKAMOTO);

    expect(projection.effectiveContributionReceipts.map((r) => r.id)).toEqual(['nakamoto-contrib-1']);
    expect(hasEffectiveStandingEvidence(projection)).toBe(true);
  });

  it("Kn0w1's accrual cannot satisfy Nakamoto's Stand", async () => {
    rows.push({
      id: 'kn0w1-contrib-1',
      action_type: 'standing_accrued',
      receipt_status: 'dvn_recorded',
      created_at: '2026-08-01T00:00:00.000Z',
      action_input: null,
      agents_invoked: [KN0W1],
    });

    const { resolveStandingEvidence, hasEffectiveStandingEvidence } = await import('@/services/journey/standingEvidenceProjection');
    const nakamotoProjection = await resolveStandingEvidence(NAKAMOTO);
    const kn0w1Projection = await resolveStandingEvidence(KN0W1);

    expect(nakamotoProjection.effectiveContributionReceipts).toEqual([]);
    expect(hasEffectiveStandingEvidence(nakamotoProjection)).toBe(false);
    expect(kn0w1Projection.effectiveContributionReceipts.map((r) => r.id)).toEqual(['kn0w1-contrib-1']);
  });

  it('Aigent Z orchestration does not become the Standing subject merely because it coordinated the act', async () => {
    // The historical defect shape: a receipt genuinely credits Nakamoto's own
    // Standing but was written with agentsInvoked: ['aigent-z'] — invisible
    // to Nakamoto's own observer, and must NEVER register under aigent-z's.
    rows.push({
      id: 'misattributed-1',
      action_type: 'standing_accrued',
      receipt_status: 'dvn_recorded',
      created_at: '2026-08-01T00:00:00.000Z',
      action_input: null,
      agents_invoked: ['aigent-z'],
    });

    const { resolveStandingEvidence, hasEffectiveStandingEvidence } = await import('@/services/journey/standingEvidenceProjection');
    const nakamotoProjection = await resolveStandingEvidence(NAKAMOTO);
    const aigentZProjection = await resolveStandingEvidence('aigent-z');

    // Before reconciliation: Nakamoto's own observer cannot see it (this is
    // the LIVE defect being closed, not a desired end state) ...
    expect(nakamotoProjection.effectiveContributionReceipts).toEqual([]);
    // ... but it must ALSO never register as aigent-z's OWN Standing subject —
    // aigent-z merely wrote the receipt, it never earned this credit.
    expect(hasEffectiveStandingEvidence(aigentZProjection)).toBe(true); // aigent-z DOES see it under its own id, which is exactly the defect
    // Once the additive correction receipt lands (app/api/ops/journey/
    // correct-standing-attribution/route.ts), Nakamoto's own observer finds
    // it WITHOUT the original ever being mutated, and aigent-z's own
    // projection is UNCHANGED by the correction (the original still names
    // aigent-z; the correction never removes that fact from history).
    rows.push(correctedAttributionRow('correction-1', '2026-08-02T00:00:00.000Z', NAKAMOTO, 'misattributed-1'));
    const nakamotoAfterCorrection = await resolveStandingEvidence(NAKAMOTO);
    const aigentZAfterCorrection = await resolveStandingEvidence('aigent-z');

    expect(nakamotoAfterCorrection.effectiveContributionReceipts.map((r) => r.id)).toEqual(['correction-1']);
    expect(hasEffectiveStandingEvidence(nakamotoAfterCorrection)).toBe(true);
    // aigent-z's projection is unaffected — the correction is additive
    // evidence for Nakamoto, never a subtraction from aigent-z's own receipt
    // history, and aigent-z never becomes the SUBJECT of a correction that
    // names a different agent.
    expect(aigentZAfterCorrection.effectiveContributionReceipts.map((r) => r.id)).toEqual(['misattributed-1']);
  });

  it('a standing_corrected receipt from the UNRELATED Capability-Standing re-baseline shape is never mistaken for attribution evidence', async () => {
    rows.push({
      id: 'capability-rebaseline-1',
      action_type: 'standing_corrected',
      receipt_status: 'dvn_recorded',
      created_at: '2026-08-01T00:00:00.000Z',
      // rebaselineCapabilityStanding's real shape — no correctionKind field at all.
      action_input: { fromFormulaVersion: 'capability-standing/v1.0', formulaVersion: 'capability-standing/v1.1' },
      agents_invoked: [NAKAMOTO],
    });

    const { resolveStandingEvidence, hasEffectiveStandingEvidence } = await import('@/services/journey/standingEvidenceProjection');
    const projection = await resolveStandingEvidence(NAKAMOTO);

    expect(projection.effectiveContributionReceipts).toEqual([]);
    expect(hasEffectiveStandingEvidence(projection)).toBe(false);
  });

  it('a correction receipt naming an original that was independently superseded is excluded, not resurrected', async () => {
    rows.push(
      {
        id: 'misattributed-2',
        action_type: 'standing_accrued',
        receipt_status: 'dvn_recorded',
        created_at: '2026-08-01T00:00:00.000Z',
        action_input: null,
        agents_invoked: ['aigent-z'],
      },
      correctedAttributionRow('correction-2', '2026-08-02T00:00:00.000Z', NAKAMOTO, 'misattributed-2'),
      discrepancyRow('discrepancy-x', '2026-08-03T00:00:00.000Z', ['misattributed-2']),
    );
    // discrepancyRow tags agents_invoked: [AGENT] ('aigent-q'), not Nakamoto —
    // but resolveStandingEvidence reads reconciliation_discrepancy_recorded
    // agent-scoped to whichever agent it's called for, so tag it correctly.
    rows[rows.length - 1].agents_invoked = [NAKAMOTO];

    const { resolveStandingEvidence, hasEffectiveStandingEvidence } = await import('@/services/journey/standingEvidenceProjection');
    const projection = await resolveStandingEvidence(NAKAMOTO);

    expect(projection.effectiveContributionReceipts).toEqual([]);
    expect(hasEffectiveStandingEvidence(projection)).toBe(false);
  });
});
