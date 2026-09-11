/**
 * Access Steward — shared decision-explanation facade (ACCESS-STEWARD-001, S1).
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * A thin, additive translation layer over EXISTING, already-authoritative
 * resolvers. It makes NO access decisions of its own — every branch below is a
 * direct, traceable re-statement of what the underlying resolver already
 * returned. This matches ACCESS-STEWARD-001 §4's operating principle exactly:
 * "Deterministic server-side policy mechanisms make and enforce access
 * decisions [...] the language model cannot grant itself authority,
 * reinterpret contractual prose into a new grant, or bypass an enforcement
 * boundary." This module is the EXPLAIN layer, never the ENFORCE layer — the
 * enforcement already happened, correctly, fail-closed, inside the resolver
 * this module calls.
 *
 * ── SCOPE OF THIS SLICE (S1) ─────────────────────────────────────────────────
 *
 * ACCESS-STEWARD-001 S0 (codexes/packs/agentiq/updates/
 * 2026-09-03_access-steward-001-s0-reconciliation.md) inventoried the existing
 * mechanisms for all four acceptance families (Ian's reciprocal exchange,
 * Austin's research/agent access, Horizen/Marketa partner publication, Lehigh
 * cohorts). Only ONE — Ian's family, via
 * `services/research/reciprocalExchange.ts`'s `getExchangeView` — has a single,
 * complete, already-tested resolver whose output this module can safely
 * translate without inventing anything. The other three families' mechanisms
 * are real but span multiple services not yet composed into one call (S0 §1.2,
 * §1.4) — wiring those is explicitly follow-on work (S2+), not this slice.
 *
 * ── THE DECISION CONTRACT (spec §5) ──────────────────────────────────────────
 *
 * `decision` is ALLOW only on affirmative evidence (never inferred from an
 * absence of a denial). An explicit restriction (revocation, locked
 * disclosure) is DENY. A resolver-level failure (exchange not found, service
 * unavailable) is UNRESOLVED — distinct from DENY, per spec §5: "Unavailable
 * or contradictory authority evidence is UNRESOLVED and private retrieval
 * fails closed" — UNRESOLVED still fails closed for the caller (no content is
 * returned), it is only the REASON code that is more honest than a blanket
 * "denied".
 *
 * `evidence[]` NEVER carries document/artifact content, titles beyond what the
 * requester is already entitled to, or T0 identifiers (personaId,
 * authProfileId) — only policy/state facts (exchange status, disclosure
 * policy name, receipt id). This satisfies spec §4's "reports [...] must not
 * disclose restricted content to a requester who cannot access it" and AS-25.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getExchangeView } from '@/services/research/reciprocalExchange';

// ─── The shared decision contract ──────────────────────────────────────────

export type AccessStewardOutcome = 'ALLOW' | 'DENY' | 'UNRESOLVED';

export type AccessStewardReasonCode =
  | 'not-a-party'
  | 'exchange-not-found-or-unavailable'
  | 'counterparty-not-yet-deposited'
  | 'reciprocal-disclosure-not-yet-crossed'
  | 'access-revoked-post-exchange'
  | 'artifact-disclosed';

export interface AccessStewardReason {
  code: AccessStewardReasonCode;
  /** Requester-facing. Never names the counterparty's content, only state. */
  safeExplanation: string;
}

export interface AccessStewardDecision {
  decision: AccessStewardOutcome;
  scope: {
    /** The exchange id, or (once ALLOW) the specific artifact id within it. */
    resourceId: string;
    resourceVersion: number | null;
    action: 'read';
    audience: 'exchange-party';
  };
  reasons: AccessStewardReason[];
  /** Policy/state facts only — never content, never a T0 identifier. */
  evidence: string[];
  validity: {
    evaluatedAt: string;
  };
  /** Enforceable controls / contractual obligations that survive an ALLOW. */
  obligations: string[];
  /** An authorized next step, when one exists. Null when there is none. */
  nextAction: string | null;
  /** Correlates to the exchange's own receipt row, when one exists yet. */
  auditRef: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Explain (never decide) whether `requestingPersonaId` may currently READ the
 * counterparty's artifact on a reciprocal exchange.
 *
 * Composes `getExchangeView` — unmodified, called exactly as every other
 * caller calls it. Every DENY/UNRESOLVED branch below is a direct restatement
 * of that function's own already-fail-closed result; this function adds no
 * new authorization logic, no new persistence, and no new identifier.
 */
export async function explainReciprocalExchangeArtifactAccess(
  admin: SupabaseClient,
  input: { exchangeId: string; requestingPersonaId: string },
): Promise<AccessStewardDecision> {
  const evaluatedAt = nowIso();
  const baseScope = {
    resourceId: input.exchangeId,
    resourceVersion: null as number | null,
    action: 'read' as const,
    audience: 'exchange-party' as const,
  };

  const view = await getExchangeView(admin, {
    exchangeId: input.exchangeId,
    personaId: input.requestingPersonaId,
  });

  if (!view.ok) {
    // getExchangeView returns exactly two error shapes today: 'not-a-party'
    // (a real, checked fact — DENY) or a load failure (exchange not found /
    // missing-table / query error — UNRESOLVED, per spec §5: unavailable
    // evidence fails closed but is reported honestly, not as a false DENY).
    if (view.error === 'not-a-party') {
      return {
        decision: 'DENY',
        scope: baseScope,
        reasons: [
          {
            code: 'not-a-party',
            safeExplanation:
              'This principal is not a party to this exchange, so no artifact from it is visible to them.',
          },
        ],
        evidence: ['services/research/reciprocalExchange.ts:getExchangeView — resolveMembership fail-closed'],
        validity: { evaluatedAt },
        obligations: [],
        nextAction: null,
        auditRef: null,
      };
    }
    return {
      decision: 'UNRESOLVED',
      scope: baseScope,
      reasons: [
        {
          code: 'exchange-not-found-or-unavailable',
          safeExplanation:
            'The referenced exchange could not be resolved (not found, or the exchange service was unavailable). Access is not granted while this is unresolved.',
        },
      ],
      evidence: [],
      validity: { evaluatedAt },
      obligations: [],
      nextAction: 'Verify the exchangeId and retry, or contact the exchange steward.',
      auditRef: null,
    };
  }

  const { view: exchangeView } = view;
  const counterpartyArtifact = exchangeView.counterpartyArtifact;

  if (!counterpartyArtifact) {
    return {
      decision: 'UNRESOLVED',
      scope: baseScope,
      reasons: [
        {
          code: 'counterparty-not-yet-deposited',
          safeExplanation: 'The counterparty has not yet deposited an artifact on this exchange.',
        },
      ],
      evidence: [`exchange status: ${exchangeView.exchange.status}`],
      validity: { evaluatedAt },
      obligations: [],
      nextAction: 'Wait for the counterparty to deposit their artifact, or check back later.',
      auditRef: exchangeView.receipt?.id ?? null,
    };
  }

  if (counterpartyArtifact.locked) {
    const revoked = exchangeView.exchange.status === 'REVOKED_ACCESS_POST_EXCHANGE';
    return {
      decision: 'DENY',
      scope: {
        ...baseScope,
        // `id`/`version` are typed nullable on ExchangeArtifactView because the
        // shape is shared with the never-deposited case (toArtifactView(null,
        // ...)) — but this branch already confirmed counterpartyArtifact is
        // non-null, so id/version are always populated here. Fall back to the
        // exchange id only for type-safety, never expected to trigger.
        resourceId: counterpartyArtifact.id ?? input.exchangeId,
        resourceVersion: counterpartyArtifact.version,
      },
      reasons: [
        {
          code: revoked ? 'access-revoked-post-exchange' : 'reciprocal-disclosure-not-yet-crossed',
          safeExplanation:
            counterpartyArtifact.lockedReason ??
            'This artifact is not currently disclosed to this principal under the exchange’s disclosure policy.',
        },
      ],
      evidence: [
        `exchange status: ${exchangeView.exchange.status}`,
        `disclosure policy: ${exchangeView.exchange.disclosurePolicy}`,
      ],
      validity: { evaluatedAt },
      obligations: [],
      nextAction: revoked
        ? null
        : 'Both parties must deposit, freeze-declare and sign the Exchange Instrument before content discloses.',
      auditRef: exchangeView.receipt?.id ?? null,
    };
  }

  // Disclosed — ALLOW, with the exchange's own obligations carried forward
  // rather than invented. `publicationPermitted` is the ONE existing field
  // this exchange record already carries that distinguishes "may read" from
  // "may republish" (spec §5's enforceable-vs-contractual obligation split).
  return {
    decision: 'ALLOW',
    scope: {
      ...baseScope,
      resourceId: counterpartyArtifact.id ?? input.exchangeId,
      resourceVersion: counterpartyArtifact.version,
    },
    reasons: [
      {
        code: 'artifact-disclosed',
        safeExplanation:
          'This principal is a verified party to the exchange and the counterparty’s artifact is disclosed to them under the exchange’s own disclosure policy.',
      },
    ],
    evidence: [
      `exchange status: ${exchangeView.exchange.status}`,
      `disclosure policy: ${exchangeView.exchange.disclosurePolicy}`,
      `receipt: ${exchangeView.receipt?.id ?? 'not yet crossed to a receipt'}`,
      `artifact frozen=${counterpartyArtifact.frozen} signed=${counterpartyArtifact.signed}`,
    ],
    validity: { evaluatedAt },
    obligations: exchangeView.exchange.publicationPermitted
      ? []
      : ['no-onward-publication — this exchange’s publicationPermitted flag is false'],
    nextAction: null,
    auditRef: exchangeView.receipt?.id ?? null,
  };
}
