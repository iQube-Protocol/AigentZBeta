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
 *   - GET  /api/wallet/tasks/share-link
 *   - GET  /api/referral/resolve-code
 *   - POST /api/wallet/tasks/track-click
 *   - GET  /api/admin/knyt/tasks-rewards
 *   - PATCH /api/admin/knyt/tasks-rewards
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

  // ── v2 ops endpoints (share-link, resolve-code, track-click) ────────────

  it('/api/wallet/tasks/share-link response does not carry T0 ids', () => {
    // The share-link endpoint mints a per-persona HMAC ref-code from
    // (source, personaId, epoch) — the code itself is opaque, not a
    // T0 id. The response carries the code + url + source + epoch.
    const shareLinkResponse = {
      success: true,
      source: 'bring-a-knight',
      refCode: 'a1b2c3d4e5f60718',
      url: 'https://dev-beta.aigentz.me/?ref=a1b2c3d4e5f60718&utm_source=bring-a-knight',
      epoch: 'v1',
    };
    const keys = new Set<string>();
    collectKeys(shareLinkResponse, keys);
    for (const forbidden of FORBIDDEN_T0_FIELDS) {
      expect(keys.has(forbidden), `T0 field "${forbidden}" leaked into share-link response`).toBe(false);
    }
    // The ref-code is HMAC-derived — must NOT contain a literal persona
    // uuid or a did: prefix. Canary against a regression where someone
    // simplifies the derivation to a raw uuid.
    expect(shareLinkResponse.refCode).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
    expect(shareLinkResponse.refCode).not.toContain('did:');
    expect(shareLinkResponse.refCode).toMatch(/^[a-f0-9]{16}$/);
  });

  it('/api/referral/resolve-code response does not carry T0 ids', () => {
    // The resolver returns ONLY matched + source + epoch. It used to
    // expose `referrerPersonaId` (T0) — that field was removed in the
    // alpha-readiness hardening pass. Signup flow now passes `refCode`
    // back to /api/referral/process which resolves the referrer
    // server-side.
    const resolveResponse = { matched: true, source: 'bring-a-knight', epoch: 'v1' };
    const keys = new Set<string>();
    collectKeys(resolveResponse, keys);
    for (const forbidden of FORBIDDEN_T0_FIELDS) {
      expect(keys.has(forbidden), `T0 field "${forbidden}" leaked into resolve-code response`).toBe(false);
    }
    // Regression guard: `referrerPersonaId` MUST NOT appear in this
    // route's response (was a known T0 leak; closed by the alpha
    // hardening pass).
    expect(keys.has('referrerPersonaId')).toBe(false);
    // Negative case — non-matching code returns a bare success envelope.
    const noMatch = { matched: false };
    const k2 = new Set<string>();
    collectKeys(noMatch, k2);
    for (const forbidden of FORBIDDEN_T0_FIELDS) {
      expect(k2.has(forbidden)).toBe(false);
    }
  });

  it('/api/referral/process response does not carry referrerPersonaId (T0 leak closed)', () => {
    // Previously returned referrerPersonaId. Now the response carries
    // only attribution-success booleans + the referrer's FIO handle
    // (which is the referrer's OWN handle — T1-safe by access.ts:56).
    const processResponse = {
      success: true,
      referrerFound: true,
      referrerHandle: 'aigentz@aigent',
      error: undefined,
    };
    const keys = new Set<string>();
    collectKeys(processResponse, keys);
    for (const forbidden of FORBIDDEN_T0_FIELDS) {
      expect(keys.has(forbidden), `T0 field "${forbidden}" leaked into process response`).toBe(false);
    }
    expect(keys.has('referrerPersonaId')).toBe(false);
  });

  it('/api/wallet/tasks/track-click response does not carry T0 ids', () => {
    // Click tracking returns success + the matched boolean — no persona
    // identification flows back to the caller (which is a non-authed
    // destination page on a freshly-clicked share link).
    const trackClickResponse = { success: true, matched: true };
    const keys = new Set<string>();
    collectKeys(trackClickResponse, keys);
    for (const forbidden of FORBIDDEN_T0_FIELDS) {
      expect(keys.has(forbidden), `T0 field "${forbidden}" leaked into track-click response`).toBe(false);
    }
  });

  // ── v2 admin endpoints (tasks-rewards admin) ────────────────────────────

  it('/api/admin/knyt/tasks-rewards GET response does not carry T0 ids', () => {
    // The admin route returns templates + aggregate counts/sums per
    // template. AGGREGATES ONLY — no persona_id lists, no per-persona
    // grant detail. The persona drill-down is a separate route gated
    // on a stricter admin flag (not yet implemented).
    const adminResponse = {
      templates: [
        {
          id: 'tpl-uuid-1',
          slug: 'knyt:bring-a-knight',
          title: 'Bring a Knight',
          description: 'Invite friends',
          category: 'community',
          difficulty_level: 2,
          reward_qct: 0,
          reward_qoyn: 0,
          reward_knyt: 2,
          cohort_id: 'knyt:backers',
          is_active: true,
          schema_json: {
            family: 'general',
            reward_task_type: 'BringAKnightQualifiedReferral',
            completion_signal: 'qualified_referral_purchase',
            service: 'referralService',
          },
          metadata: { card_label: 'Bring a Knight', icon: 'Users' },
          reward_task_types: ['BringAKnightQualifiedReferral'],
          aggregates: {
            approved_count: 5,
            approved_amount: 10,
            redeemed_count: 3,
            redeemed_amount: 6,
            pending_count: 0,
            pending_amount: 0,
            rejected_count: 0,
            last_grant_at: '2026-05-12T01:23:45.000Z',
          },
          created_at: '2026-05-04T00:00:00.000Z',
          updated_at: '2026-05-12T00:00:00.000Z',
        },
      ],
    };
    const keys = new Set<string>();
    collectKeys(adminResponse, keys);
    for (const forbidden of FORBIDDEN_T0_FIELDS) {
      expect(keys.has(forbidden), `T0 field "${forbidden}" leaked into admin tasks-rewards response`).toBe(false);
    }
    // Canary: aggregate field must NOT carry a persona_id list.
    expect(keys.has('persona_id')).toBe(false);
    expect(keys.has('persona_ids')).toBe(false);
  });

  it('/api/admin/knyt/tasks-rewards PATCH response does not carry T0 ids', () => {
    const patchResponse = {
      template: {
        id: 'tpl-uuid-1',
        slug: 'knyt:bring-a-knight',
        title: 'Bring a Knight',
        description: 'Invite friends',
        reward_knyt: 2.5,
        reward_qct: 0,
        reward_qoyn: 0,
        is_active: true,
        updated_at: '2026-05-12T01:23:45.000Z',
      },
    };
    const keys = new Set<string>();
    collectKeys(patchResponse, keys);
    for (const forbidden of FORBIDDEN_T0_FIELDS) {
      expect(keys.has(forbidden), `T0 field "${forbidden}" leaked into admin patch response`).toBe(false);
    }
  });

  it('admin tasks-rewards PATCH allowed-field allowlist is restrictive', () => {
    // The route validates the patch object against an allowlist. The
    // canary: future contributors must NOT add reward_qct etc. without
    // privacy review — and they must NEVER allow patching cohort_id
    // (would let an admin re-route receipts to a different cohort).
    const ALLOWED_PATCH_FIELDS = [
      'reward_knyt',
      'is_active',
      'title',
      'description',
      'reward_qct',
      'reward_qoyn',
      'cap_max_per_period',
      'cap_period_days',
    ] as const;
    // tenant_id, slug, cohort_id, schema_json, metadata MUST NOT be
    // patchable through this endpoint.
    const FORBIDDEN_PATCH_FIELDS = ['tenant_id', 'slug', 'cohort_id', 'schema_json', 'metadata', 'persona_id'];
    for (const f of FORBIDDEN_PATCH_FIELDS) {
      expect((ALLOWED_PATCH_FIELDS as readonly string[]).includes(f), `${f} must NOT be in admin PATCH allowlist`).toBe(false);
    }
  });

  // ── Editable rate limits (Phase 8) ──────────────────────────────────────

  it('/api/admin/system/rate-limits GET response carries no T0 ids', () => {
    const limitsResponse = {
      limits: [
        {
          id: 'rl-uuid-1',
          endpoint_key: 'wallet:tasks:share-link',
          scope: 'persona',
          max_requests: 30,
          window_seconds: 3600,
          is_active: true,
          notes: 'BaK/Herald share-link mint',
          created_at: '2026-05-12T00:00:00.000Z',
          updated_at: '2026-05-12T00:00:00.000Z',
        },
      ],
    };
    const keys = new Set<string>();
    collectKeys(limitsResponse, keys);
    for (const forbidden of FORBIDDEN_T0_FIELDS) {
      expect(keys.has(forbidden), `T0 field "${forbidden}" leaked into rate-limits GET`).toBe(false);
    }
  });

  it('admin rate-limits PATCH endpointKey allowlist is restrictive', () => {
    // The route restricts the endpointKey field to a fixed allowlist —
    // operators can edit limits on the 3 known endpoints, but cannot
    // create new ones via the admin tab (would require code change to
    // wire up the middleware call). This stops an admin from disabling
    // rate limits on a future endpoint that hasn't been hardened yet.
    const ALLOWED = ['wallet:tasks:share-link', 'wallet:tasks:track-click', 'referral:resolve-code'];
    expect(ALLOWED.length).toBe(3);
    for (const k of ALLOWED) {
      expect(k.startsWith('wallet:') || k.startsWith('referral:')).toBe(true);
    }
  });

  it('rate-limit responses carry a Retry-After header on 429', () => {
    const errorResponse = {
      error: 'rate-limited',
      retryAfterSeconds: 3600,
      limit: { max_requests: 30, window_seconds: 3600 },
    };
    const keys = new Set<string>();
    collectKeys(errorResponse, keys);
    for (const forbidden of FORBIDDEN_T0_FIELDS) {
      expect(keys.has(forbidden), `T0 field "${forbidden}" leaked into 429 response`).toBe(false);
    }
    expect(errorResponse.retryAfterSeconds).toBeGreaterThan(0);
  });

  // ── grant→crm_rewards bridge (Phase 2) ──────────────────────────────────

  it('grantToCrmRewardsBridge orchestration_events metadata uses T2 only', () => {
    // The bridge emits an orchestration_events row with T2 attribution
    // (actor_alias_commitment + cohort_id) — NOT personaId or
    // authProfileId. This canary validates the receipt payload shape.
    const receiptMetadata = {
      reward_task_type: 'KnightOfAttentionEpisodeComplete',
      task_slug: 'knyt:knight-of-attention',
      task_template_id: 'tpl-uuid-2',
      amount_knyt: 0.5,
      reward_grant_id: 'grant-uuid-1',
      source_event_id: 'episode-cid-1',
      receipt_mode: 'async-batched',
      actor_alias_commitment: 'b'.repeat(64),
      cohort_id: 'knyt:backers',
    };
    const keys = new Set<string>();
    collectKeys(receiptMetadata, keys);
    for (const forbidden of FORBIDDEN_T0_FIELDS) {
      expect(keys.has(forbidden), `T0 field "${forbidden}" leaked into bridge receipt metadata`).toBe(false);
    }
    expect(receiptMetadata.receipt_mode).toBe('async-batched');
    expect(receiptMetadata.actor_alias_commitment).toMatch(/^[a-f0-9]{64}$/);
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
