/**
 * bearingDiscovery — IDE 2.0's positive/negative/dual discovery (Phase 3).
 *
 * ── The order is LOCKED, and enforced here rather than documented ──────────
 *
 *   initial Risk Field  →  positive-bearing  →  risk-informed negative-bearing
 *                       →  convergence / dual marking
 *
 * Operator ruling, 2026-08-15. The load-bearing part is that the Risk Field is
 * built FIRST: Risk of Repair is a BEARING USED TO BROADEN DISCOVERY, not a
 * report assembled afterwards from what discovery happened to find. A negative
 * pass with no risk field to reason from has nothing to widen its search WITH,
 * and collapses into "the positive pass, phrased as warnings" — which is
 * exactly the failure the operator's acceptance scenario is designed to catch.
 *
 * `discoverBearings()` therefore REFUSES to run without a risk field, and
 * records the field revision each pass ran against. It is a precondition, not
 * a suggestion.
 *
 * ── Risk vectors are not invariants ───────────────────────────────────────
 *
 * A `RiskVectorRef` guides where to look. It never becomes an
 * `EnvelopeInvariant`, is never cited as one, and carries no `statement`. The
 * output of a risk-driven search is a causal CONDITION discovered because of
 * the vector — the vector itself is the reason, not the finding.
 *
 * ── The causal chain ──────────────────────────────────────────────────────
 *
 *   intent / risk vector  →  repair path  →  scope expansion  →  candidate
 *
 * Every negative-bearing recovery retains all four links. An out-of-domain
 * finding that cannot show its chain is unauditable, and will eventually be
 * pruned as noise by someone who cannot tell it from a hallucination.
 *
 * ── Purity boundary ───────────────────────────────────────────────────────
 *
 * Generation of candidate STATEMENTS is a reasoning act and sits behind
 * `BearingDiscoveryProvider`. Everything else — ordering, precondition,
 * scope expansion bookkeeping, convergence, independence checking — is pure
 * and canaried directly. The seam exists so the ORCHESTRATION can be proven
 * without a live model; the provider is not a stand-in for the thing under
 * test, it is the boundary of it.
 */

import {
  type BearingRecovery,
  type EnvelopeInvariant,
  type IntentRiskField,
  type InvariantScope,
  type RiskVectorRef,
  type ScopeExpansion,
} from '@/types/invariantEnvelope';

// ---------------------------------------------------------------------------
// The provider seam
// ---------------------------------------------------------------------------

/** A causal condition returned by a discovery pass, before it becomes a member. */
export interface DiscoveredCondition {
  /**
   * The causal condition, stated as a condition that must hold — NOT as a
   * prohibition. `providerContractText()` below carries this requirement into
   * the provider prompt (PRD §9).
   */
  statement: string;
  /** The domain the search was in when this surfaced. */
  searchDomain: string;
  /** For a risk-driven finding: the repair path the vector implied. */
  repairPath?: string | null;
}

export interface PositivePassInput {
  intentText: string;
  intentDomain: string;
  /** Already-retrieved members, so the pass does not rediscover known ground. */
  known: readonly EnvelopeInvariant[];
}

export interface NegativePassInput {
  intentText: string;
  intentDomain: string;
  /** The vector being reasoned from. One call per vector. */
  vector: RiskVectorRef;
  /** The domain this vector directs the search into. */
  searchDomain: string;
  known: readonly EnvelopeInvariant[];
}

export interface BearingDiscoveryProvider {
  positive(input: PositivePassInput): Promise<DiscoveredCondition[]>;
  negative(input: NegativePassInput): Promise<DiscoveredCondition[]>;
}

/**
 * The wording requirement every provider must carry into its prompt.
 *
 * Exported as data rather than buried in a prompt string so it is one
 * canonical statement rather than two drifting ones, and so a canary can
 * assert it says what PRD §9 requires.
 */
export const CAUSAL_ABSTRACTION_CONTRACT =
  'State each finding as a CAUSAL CONDITION THAT MUST REMAIN TRUE, never as a prohibition. ' +
  '"Never process duplicate transactions" names the act; "logical transaction identity remains ' +
  'stable across retries" names the condition, and only the second can be checked, reused, or ' +
  'falsified. Seek the condition, not the rule.';

// ---------------------------------------------------------------------------
// Scope expansion — where a risk vector sends the search
// ---------------------------------------------------------------------------

/**
 * Widen the search out of the intent's own domain, under a risk vector.
 *
 * Returns null when the vector points back into the intent's own domain: that
 * is not an expansion, and recording it as one would let a negative pass claim
 * out-of-domain reach it never had.
 */
export function expandScope(
  fromDomain: string,
  toDomain: string,
  fromScope: InvariantScope,
  toScope: InvariantScope,
  vector: RiskVectorRef,
): ScopeExpansion | null {
  if (fromDomain === toDomain) return null;
  return {
    fromDomain,
    toDomain,
    fromScope,
    toScope,
    motivatedByRiskVectorId: vector.id,
  };
}

// ---------------------------------------------------------------------------
// Convergence — dual is evidence, never promotion
// ---------------------------------------------------------------------------

/** Normalised form used only to test whether two statements are the same claim. */
export function claimKey(statement: string): string {
  return statement
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
    .sort()
    .join(' ');
}

const STOPWORDS = new Set(['that', 'this', 'must', 'with', 'from', 'into', 'been', 'were', 'their', 'which', 'when', 'where']);

/**
 * True when a set of recoveries constitutes INDEPENDENT recovery.
 *
 * Two recoveries are independent when they arrived by different routes. Two
 * intent-driven recoveries of the same condition are one finding counted
 * twice, and marking that `dual` would be the "invoke one process twice with
 * different labels" failure the operator named explicitly.
 */
export function isIndependentlyRecovered(recoveries: readonly BearingRecovery[]): boolean {
  const routes = new Set(recoveries.map((r) => r.route));
  return routes.size > 1;
}

/**
 * Mark dual bearing where the same causal condition was recovered by BOTH
 * routes, retaining every recovery so the independence claim stays auditable.
 *
 * Dual recovery is EVIDENCE, not a lifecycle promotion: nothing here touches
 * `lifecycle`, and a dual member is as `unrecorded` afterwards as it was
 * before (PRD §10, CANARY-04).
 */
export function markConvergence(items: readonly EnvelopeInvariant[]): EnvelopeInvariant[] {
  const byClaim = new Map<string, EnvelopeInvariant[]>();
  for (const item of items) {
    const key = claimKey(item.statement);
    const bucket = byClaim.get(key);
    if (bucket) bucket.push(item);
    else byClaim.set(key, [item]);
  }

  const out: EnvelopeInvariant[] = [];
  for (const bucket of byClaim.values()) {
    if (bucket.length === 1) {
      out.push(bucket[0]);
      continue;
    }
    const recoveries = bucket.flatMap((b) => b.recoveries);
    if (!isIndependentlyRecovered(recoveries)) {
      // Same claim, same route — one finding counted twice, not convergence.
      // Merge the recoveries but leave the bearing as it was.
      out.push({ ...bucket[0], recoveries });
      continue;
    }
    out.push({
      ...bucket[0],
      bearing: 'dual',
      recoveries,
      // lifecycle DELIBERATELY untouched — see the doc comment above.
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The orchestrator — the locked order, enforced
// ---------------------------------------------------------------------------

export interface DiscoveryInput {
  intentText: string;
  intentDomain: string;
  /** REQUIRED. Built before discovery; the negative pass reasons from it. */
  riskField: IntentRiskField;
  /** Which domain each risk vector directs the search into. */
  vectorDomains: Record<string, string>;
  known: readonly EnvelopeInvariant[];
  provider: BearingDiscoveryProvider;
  now: string;
}

export interface DiscoveryResult {
  discovered: EnvelopeInvariant[];
  /** The risk-field revision each pass ran against. */
  riskFieldRevision: number;
  /** Order actually executed — recorded, so the lock is observable in output. */
  passOrder: readonly ['risk-field', 'positive', 'negative', 'convergence'];
}

export class RiskFieldRequiredError extends Error {
  constructor() {
    super(
      'discoverBearings requires an IntentRiskField. Risk of Repair is a bearing used to BROADEN ' +
        'discovery, not a report assembled after it — a negative pass with no field to reason from ' +
        'degenerates into the positive pass phrased as warnings.',
    );
    this.name = 'RiskFieldRequiredError';
  }
}

function toMember(
  condition: DiscoveredCondition,
  scope: InvariantScope,
  recovery: BearingRecovery,
  index: number,
  prefix: string,
): EnvelopeInvariant {
  return {
    ref: `${prefix}-${index}`,
    statement: condition.statement,
    provenance: 'live-discovery',
    lifecycle: { registry: 'none', status: 'unrecorded' },
    scope,
    bearing: recovery.bearing,
    recoveries: [recovery],
    materiality: 'unknown',
  };
}

/**
 * Run discovery in the locked order and return the findings.
 *
 * Nothing here writes to a registry, and nothing promotes: every member comes
 * back `provenance: 'live-discovery'`, `lifecycle: {registry: 'none', status:
 * 'unrecorded'}`. A live discovery has earned nothing by being found.
 */
export async function discoverBearings(input: DiscoveryInput): Promise<DiscoveryResult> {
  // 1 — RISK FIELD. The precondition, refused rather than defaulted.
  if (!input.riskField) throw new RiskFieldRequiredError();
  const revision = input.riskField.revision;

  const discovered: EnvelopeInvariant[] = [];

  // 2 — POSITIVE PASS. Intent-driven, in the intent's own domain.
  const positives = await input.provider.positive({
    intentText: input.intentText,
    intentDomain: input.intentDomain,
    known: input.known,
  });
  positives.forEach((c, i) => {
    const recovery: BearingRecovery = {
      bearing: 'positive',
      route: 'intent-driven',
      searchDomain: c.searchDomain,
      riskVectorRef: null,
      repairPath: null,
      scopeExpansion: null,
    };
    discovered.push(toMember(c, 'intent', recovery, i, 'pos'));
  });

  // 3 — NEGATIVE PASS. Risk-driven, one call per vector, deliberately widened
  //     out of the intent's domain where the vector points elsewhere.
  let n = 0;
  for (const vector of input.riskField.vectors) {
    const searchDomain = input.vectorDomains[vector.id] ?? input.intentDomain;
    const negatives = await input.provider.negative({
      intentText: input.intentText,
      intentDomain: input.intentDomain,
      vector,
      searchDomain,
      known: input.known,
    });
    for (const c of negatives) {
      const expansion = expandScope(
        input.intentDomain,
        c.searchDomain,
        'intent',
        'cross-domain',
        vector,
      );
      const recovery: BearingRecovery = {
        bearing: 'negative',
        route: 'risk-driven',
        searchDomain: c.searchDomain,
        riskVectorRef: vector,
        repairPath: c.repairPath ?? null,
        scopeExpansion: expansion,
      };
      discovered.push(toMember(c, expansion ? 'cross-domain' : 'intent', recovery, n, 'neg'));
      n += 1;
    }
  }

  // 4 — CONVERGENCE. Dual only on independent recovery.
  return {
    discovered: markConvergence(discovered),
    riskFieldRevision: revision,
    passOrder: ['risk-field', 'positive', 'negative', 'convergence'] as const,
  };
}

// ---------------------------------------------------------------------------
// Risk field construction (step 1)
// ---------------------------------------------------------------------------

/**
 * Build the initial Intent Risk Field: projected ∪ retrieved ∪ observed.
 *
 * `originsPresent` names only the origins that actually contributed, so an
 * empty origin is visible rather than implied. `revision` starts at 1 and
 * increments as the field evolves from newly observed risks — the discovery
 * result records which revision it ran against, so a later reader can tell
 * whether a pass saw a given vector.
 */
export function buildInitialRiskField(input: {
  intentRef: string;
  projected?: RiskVectorRef[];
  retrieved?: RiskVectorRef[];
  observed?: RiskVectorRef[];
  now: string;
}): IntentRiskField {
  const originsPresent: IntentRiskField['originsPresent'] = [];
  if (input.projected?.length) originsPresent.push('projected');
  if (input.retrieved?.length) originsPresent.push('retrieved');
  if (input.observed?.length) originsPresent.push('observed');

  const seen = new Set<string>();
  const vectors: RiskVectorRef[] = [];
  for (const v of [...(input.projected ?? []), ...(input.retrieved ?? []), ...(input.observed ?? [])]) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    vectors.push(v);
  }

  return {
    intentRef: input.intentRef,
    vectors,
    proofRefs: [],
    originsPresent,
    revision: 1,
    constructedAt: input.now,
  };
}
