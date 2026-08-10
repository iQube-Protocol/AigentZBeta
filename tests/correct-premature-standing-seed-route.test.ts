/**
 * POST /api/ops/journey/correct-premature-standing-seed — covers the
 * tombstone catch-up path added 2026-08-10 alongside the durability fix in
 * services/journey/stageResolution.ts.
 *
 * The catch-up gap: `resolveStandingEvidence` moves a receipt into
 * `supersededReceiptIds` once a `reconciliation_discrepancy_recorded`
 * receipt already names it — which is exactly what happens on the SECOND
 * call to this route after a full correction. That means a correction that
 * ran BEFORE the stage-invalidation tombstone existed (evidence-layer steps
 * 1-2 applied, step 3's tombstone never written because step 3 didn't exist
 * yet) makes every subsequent call report NOT_PREMATURE forever, even
 * though `canonicalStages` still self-resurrects the stage via
 * ratchet-synthesis. Live MoneyPenny hit exactly this on 2026-08-10.
 *
 * Generic fixture ("Aigent Q") per this session's convention
 * (tests/agent-n-genericity*.test.ts, tests/journey-ingest-route.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.CRON_TRIGGER_TOKEN = 'test-cron-token';

const AGENT_Q = {
  runtimeAgentId: 'aigent-agent-q',
  aigentQubeId: 'aigentqube-agent-q',
  journeyId: 'horizen-moneypenny-admission',
};

let registryMetadata: Record<string, any> = {};
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { metadata: registryMetadata }, error: null }),
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: async () => {
          registryMetadata = { ...registryMetadata, ...(patch.metadata as Record<string, unknown>) };
          return { error: null };
        },
      }),
    }),
  }),
}));

let standingSeededFactStatus: 'settled' | 'invalidated' | null = null;
const mockInvalidateSettledFact = vi.fn(async () => ({ ok: true }));
vi.mock('@/services/journey/settledFacts', () => ({
  readSettledFact: async () => (standingSeededFactStatus ? { status: standingSeededFactStatus } : null),
  invalidateSettledFact: (...args: any[]) => mockInvalidateSettledFact(...args),
}));

let standingEvidence = {
  effectiveInitialReceipts: [] as Array<{ id: string }>,
  effectiveContributionReceipts: [] as Array<{ id: string }>,
  supersededReceiptIds: [] as string[],
  sequencingViolationReceiptIds: [] as string[],
};
vi.mock('@/services/journey/standingEvidenceProjection', () => ({
  resolveStandingEvidence: async () => standingEvidence,
}));

let ingestReceipts: Array<{ id: string }> = [];
const mockCreateActivityReceipt = vi.fn(async (input: any) => ({ id: 'discrepancy-receipt-fresh', ...input }));
const mockFindAgentReceiptRefs = vi.fn(async (_id: string, actionTypes: string[]) => {
  if (actionTypes[0] === 'capability_registered') return ingestReceipts;
  if (actionTypes[0] === 'reconciliation_discrepancy_recorded') return [{ id: 'discrepancy-receipt-prior' }];
  return [];
});
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => mockCreateActivityReceipt(...args),
  findAgentReceiptRefs: (...args: any[]) => mockFindAgentReceiptRefs(...args),
}));

function makeRequest(body: Record<string, unknown>) {
  return new (require('next/server').NextRequest)('https://dev-beta.aigentz.me/api/ops/journey/correct-premature-standing-seed', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cron-token': 'test-cron-token' },
    body: JSON.stringify(body),
  } as any);
}

const REQUEST_BODY = {
  agentRuntimeId: AGENT_Q.runtimeAgentId,
  aigentQubeId: AGENT_Q.aigentQubeId,
  journeyId: AGENT_Q.journeyId,
  correctingPersonaId: 'persona-correcting-op',
};

beforeEach(() => {
  registryMetadata = {};
  standingSeededFactStatus = null;
  standingEvidence = {
    effectiveInitialReceipts: [],
    effectiveContributionReceipts: [],
    supersededReceiptIds: [],
    sequencingViolationReceiptIds: [],
  };
  ingestReceipts = [];
  mockCreateActivityReceipt.mockClear();
  mockInvalidateSettledFact.mockClear();
});

describe('correct-premature-standing-seed — regression: unchanged behavior for the original two cases', () => {
  it('NOT_PREMATURE when nothing was ever wrong (no violation, not invalidated)', async () => {
    const { POST } = await import('@/app/api/ops/journey/correct-premature-standing-seed/route');
    const res = await POST(makeRequest(REQUEST_BODY));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json).toMatchObject({ ok: false, refusalCode: 'NOT_PREMATURE' });
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('performs a fresh correction end-to-end when a live sequencing violation exists', async () => {
    standingEvidence.sequencingViolationReceiptIds = ['seed-receipt-1'];
    standingSeededFactStatus = 'settled';
    registryMetadata = {
      journey_resolutions: {
        [AGENT_Q.journeyId]: { canonicalStages: ['register', 'standing'], invalidatedStages: {} },
      },
    };
    const { POST } = await import('@/app/api/ops/journey/correct-premature-standing-seed/route');
    const res = await POST(makeRequest(REQUEST_BODY));
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.isTombstoneCatchUp).toBe(false);
    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1);
    expect(mockInvalidateSettledFact).toHaveBeenCalledTimes(1);
    const persisted = registryMetadata.journey_resolutions[AGENT_Q.journeyId];
    expect(persisted.canonicalStages).toEqual(['register']);
    expect(Object.keys(persisted.invalidatedStages)).toEqual(expect.arrayContaining(['standing', 'deploy']));
  });
});

describe('correct-premature-standing-seed — tombstone catch-up (the live MoneyPenny gap)', () => {
  it('proceeds to write the missing tombstone when evidence is already invalidated but canonicalStages still self-resurrects', async () => {
    // The exact live shape: no live violation left (already superseded from
    // a prior, pre-tombstone-fix correction), settled fact invalidated, but
    // 'standing' is still sitting in canonicalStages with no tombstone.
    standingEvidence.supersededReceiptIds = ['seed-receipt-1'];
    standingSeededFactStatus = 'invalidated';
    registryMetadata = {
      journey_resolutions: {
        [AGENT_Q.journeyId]: { canonicalStages: ['register', 'deploy', 'standing'], invalidatedStages: {} },
      },
    };

    const { POST } = await import('@/app/api/ops/journey/correct-premature-standing-seed/route');
    const res = await POST(makeRequest(REQUEST_BODY));
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.isTombstoneCatchUp).toBe(true);
    // No new discrepancy receipt — one already exists from the original correction.
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
    expect(json.discrepancyReceiptId).toBe('discrepancy-receipt-prior');
    // Settled fact already invalidated — step 2 is a no-op, not re-applied.
    expect(mockInvalidateSettledFact).not.toHaveBeenCalled();

    const persisted = registryMetadata.journey_resolutions[AGENT_Q.journeyId];
    expect(persisted.canonicalStages).toEqual(['register']);
    expect(Object.keys(persisted.invalidatedStages)).toEqual(expect.arrayContaining(['standing', 'deploy']));
    expect(persisted.invalidatedStages.standing.supersededEvidenceIds).toContain('seed-receipt-1');
  });

  it('does NOT tombstone deploy when Ingest is independently established, even during catch-up', async () => {
    standingEvidence.supersededReceiptIds = ['seed-receipt-1'];
    standingSeededFactStatus = 'invalidated';
    ingestReceipts = [{ id: 'genuine-ingest-receipt' }];
    registryMetadata = {
      journey_resolutions: {
        [AGENT_Q.journeyId]: { canonicalStages: ['register', 'deploy', 'standing'], invalidatedStages: {} },
      },
    };

    const { POST } = await import('@/app/api/ops/journey/correct-premature-standing-seed/route');
    const res = await POST(makeRequest(REQUEST_BODY));
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.ingestGenuinelyEstablished).toBe(true);
    expect(json.stagesToInvalidate).toEqual(['standing']);
    const persisted = registryMetadata.journey_resolutions[AGENT_Q.journeyId];
    expect(persisted.canonicalStages).toEqual(expect.arrayContaining(['register', 'deploy']));
    expect(Object.keys(persisted.invalidatedStages)).toEqual(['standing']);
  });

  it('is idempotent once caught up: a second call reports NOT_PREMATURE and touches nothing further', async () => {
    standingEvidence.supersededReceiptIds = ['seed-receipt-1'];
    standingSeededFactStatus = 'invalidated';
    registryMetadata = {
      journey_resolutions: {
        [AGENT_Q.journeyId]: {
          canonicalStages: ['register'],
          invalidatedStages: {
            standing: { invalidatedAt: '2026-08-10T00:00:00.000Z', reason: 'x', correctionReceiptId: null, supersededEvidenceIds: [] },
            deploy: { invalidatedAt: '2026-08-10T00:00:00.000Z', reason: 'x', correctionReceiptId: null, supersededEvidenceIds: [] },
          },
        },
      },
    };

    const { POST } = await import('@/app/api/ops/journey/correct-premature-standing-seed/route');
    const res = await POST(makeRequest(REQUEST_BODY));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toMatchObject({ ok: false, refusalCode: 'NOT_PREMATURE' });
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
    expect(mockInvalidateSettledFact).not.toHaveBeenCalled();
  });
});
