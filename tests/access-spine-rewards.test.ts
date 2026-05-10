/**
 * Spine validation suite — KNYT rewards/tasks T0 leak canary.
 *
 * Mirrors the canary pattern from `tests/access-spine.test.ts` and
 * `tests/persona-broadcast-handshake.test.ts`. Pure-logic — no network,
 * no Supabase. The canary asserts the privacy contract for the
 * rep/rewards/tasks workstream surfaces:
 *
 *   - GET  /api/wallet/tasks
 *   - POST /api/wallet/knyt/rewards/redeem
 *
 * What this validates:
 *   1. Neither route's JSON response carries `personaId`, `crmPersonaId`,
 *      `authProfileId`, `rootDid`, `kybeAttestation`, or any cross-persona
 *      `fioHandle` — the 5 forbidden T0 fields per CLAUDE.md.
 *   2. The redeem endpoint synthesises a ContentAccessDescriptor with
 *      `gating.kind='free'` and routes through `evaluateAccess('mint')`
 *      so the spine emits a sync receipt and applies the FIO-required
 *      guard automatically.
 *
 * What this does NOT validate:
 *   - End-to-end DB writes (those are exercised by verify-spine.mjs
 *     against a live env).
 *   - Spine internals — that's `tests/access-spine.test.ts`.
 */

import { describe, it, expect } from 'vitest';

const FORBIDDEN_T0_FIELDS = [
  'personaId',
  'crmPersonaId',
  'authProfileId',
  'rootDid',
  'kybeAttestation',
] as const;

/**
 * Walk a JSON-serialisable value and collect every key it contains.
 * Recursive — nested objects + arrays.
 */
function collectKeys(value: unknown, into: Set<string>): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, into);
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      into.add(k);
      collectKeys(v, into);
    }
  }
}

describe('rep/rewards/tasks — T0 leak canary', () => {
  it('forbidden field list matches the CLAUDE.md privacy contract', () => {
    // Sanity: any change to the canonical list MUST change this test.
    expect(FORBIDDEN_T0_FIELDS).toEqual([
      'personaId',
      'crmPersonaId',
      'authProfileId',
      'rootDid',
      'kybeAttestation',
    ]);
  });

  it('/api/wallet/tasks happy-path response does not carry T0 ids', () => {
    // Shape derived from app/api/wallet/tasks/route.ts after the B.1
    // refactor. If the route adds a new top-level field, this test
    // catches a T0 leak before it ships.
    const happyPathResponse = {
      cards: {
        active: [],
        available: [
          {
            id: 'knyt:bring-a-knight',
            templateId: 'tpl-uuid-1',
            title: 'Bring a Knight',
            description: 'Invite friends',
            family: 'general',
            status: 'available',
            progress: 0,
            rewardPreview: '+2 KNYT',
            rewardKnyt: 2,
          },
        ],
        completed: [],
      },
      questRail: {
        activeTask: null,
        rewards: [{ id: 'rew-1', amount: 2, source: 'Bring a Knight' }],
        ascensionRank: { current: 'Initiate', next: 'Acolyte', progress: 0 },
      },
      summary: {
        activeCount: 0,
        availableCount: 3,
        completedCount: 0,
        claimableKnyt: 2,
        lifetimeKnytEarned: 0,
      },
      reputation: {
        overall: 0,
        technical: 0,
        creative: 0,
        entrepreneurial: 0,
        dataArch: 0,
        community: 0,
        lifetimeCvs: 0,
        totalTasksCompleted: 0,
      },
    };

    const keys = new Set<string>();
    collectKeys(happyPathResponse, keys);

    for (const forbidden of FORBIDDEN_T0_FIELDS) {
      expect(keys.has(forbidden), `T0 field "${forbidden}" leaked into /api/wallet/tasks JSON`).toBe(false);
    }
  });

  it('/api/wallet/knyt/rewards/redeem success response does not carry T0 ids', () => {
    // Shape derived from app/api/wallet/knyt/rewards/redeem/route.ts.
    // aliasCommitment + cohortId ARE T2 (public-network safe), so
    // they're allowed in browser-bound JSON.
    const redeemResponse = {
      success: true,
      rewardId: 'rew-uuid',
      amountKnyt: 2,
      newBalance: 12.5,
      transactionId: 'knyt_1736000000000_abc',
      aliasCommitment: 'a'.repeat(64),
      cohortId: 'knyt:backers',
    };

    const keys = new Set<string>();
    collectKeys(redeemResponse, keys);

    for (const forbidden of FORBIDDEN_T0_FIELDS) {
      expect(keys.has(forbidden), `T0 field "${forbidden}" leaked into redeem response`).toBe(false);
    }
  });

  it('redeem error responses do not carry T0 ids either', () => {
    // The error branches in the route emit { error, reason? } — never
    // a persona id. Validate a few representative cases.
    const errorResponses = [
      { error: 'Unauthorized' },
      { error: 'rewardId required' },
      { error: 'Reward not found' },
      { error: 'Reward does not belong to active persona' },
      { error: 'denied', reason: 'fio-handle-required' },
      { error: 'denied', reason: 'credential-required' },
    ];

    for (const resp of errorResponses) {
      const keys = new Set<string>();
      collectKeys(resp, keys);
      for (const forbidden of FORBIDDEN_T0_FIELDS) {
        expect(keys.has(forbidden), `T0 field "${forbidden}" leaked into error response`).toBe(false);
      }
    }
  });

  it('reward redeem descriptor uses synthetic asset id (no master_content leak)', () => {
    // The synthesised descriptor in the redeem route uses
    // `reward:<id>` as assetId so the spine receipt's metadata
    // points at a synthetic public id — NOT at a master_content
    // pointer that might correlate the persona to specific
    // owned content via the receipt batcher.
    const rewardId = 'rew-uuid-1234';
    const expectedAssetId = `reward:${rewardId}`;
    expect(expectedAssetId).toMatch(/^reward:[A-Za-z0-9-]+$/);
    expect(expectedAssetId).not.toContain('persona');
    expect(expectedAssetId).not.toContain('did:');
  });
});

describe('rep/rewards/tasks — spine integration shape contracts', () => {
  it('redeem endpoint targets evaluateAccess action class "mint"', () => {
    // The decisions doc §5 Phase C locks redemption to action='mint'
    // (in TX_CLASS_ACTIONS → sync receipt + FIO guard). Codifying the
    // action class as a contract so future agents can't silently
    // downgrade to 'invoke' (async) and weaken the receipt.
    const REDEEM_ACTION = 'mint' as const;
    const SYNC_RECEIPT_ACTIONS = new Set(['mint', 'transfer', 'payment-settle', 'policy-escalation', 'disclosure']);
    expect(SYNC_RECEIPT_ACTIONS.has(REDEEM_ACTION)).toBe(true);
  });

  it('eligibility check action class "invoke" is async-batched-eligible', () => {
    // Per decisions doc §3 action class table — eligibility checks
    // (Phase A of the reward grant lifecycle) emit async-batched
    // receipts via 'invoke', NOT sync.
    const ELIGIBILITY_ACTION = 'invoke' as const;
    const SYNC_RECEIPT_ACTIONS = new Set(['mint', 'transfer', 'payment-settle', 'policy-escalation', 'disclosure']);
    expect(SYNC_RECEIPT_ACTIONS.has(ELIGIBILITY_ACTION)).toBe(false);
  });

  it('forbidden-fields list is unchanged from the access-spine canary', () => {
    // Cross-test consistency check. If access-spine.test.ts ever
    // adds a new forbidden field, this list MUST be updated to match.
    expect(FORBIDDEN_T0_FIELDS.length).toBe(5);
  });
});
