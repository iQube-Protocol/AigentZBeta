/**
 * Homecoming III Phase 6 Closure — regression fixture for the compression
 * crowd-out defect the live dogfood found (`RES-2026-08-15-PHASE6-COMPRESSION-CROWDOUT-001`).
 *
 * Builds a registry population comparable in SHAPE to the real Phase 6 run:
 * a handful of constitutional constraints, a few established candidates, 30
 * unrelated "noise" candidate signals (mirroring the real devon-projected
 * registry's Pulse/P&L/RootDID material that has nothing to do with the
 * fixture's own intent), one candidate that genuinely IS the most relevant
 * signal for the intent (registered LAST, so array order alone would bury
 * it), and a mix of live discoveries — some intent-driven, some risk-driven
 * and tied to the CURRENT risk field via a real `ProofOfRisk`.
 *
 * Every `it` below maps to one of the seven numbered repair requirements.
 */

import { describe, it, expect } from 'vitest';
import {
  composeImplementationContext,
  deriveRiskDrivenRefs,
  causalRelevanceScore,
  misplacedInEstablished,
  type CausalRelevanceContext,
} from '@/services/devCommandCenter/implementationContext';
import { mayBeCitedAsEstablished, type EnvelopeInvariant, type IntentRiskField, type ProofOfRisk } from '@/types/invariantEnvelope';

function envInv(over: Partial<EnvelopeInvariant> = {}): EnvelopeInvariant {
  return {
    ref: 'r',
    statement: 's',
    provenance: 'projection-devon',
    lifecycle: { registry: 'resolution-records', status: 'candidate' },
    scope: 'repository',
    bearing: null,
    recoveries: [],
    materiality: 'unknown',
    ...over,
  };
}

// ---------------------------------------------------------------------------
// The realistic-scale fixture
// ---------------------------------------------------------------------------

const INTENT_TEXT =
  'Scope and stub the first internal Crystal 2.0 implementation assignment: a contract-first type ' +
  'definition for the context-binding axis platform workspace project developer principal-user session-intent.';

const UNRESOLVED_TEXT = 'Which enforcement layer will eventually consume the context-binding axis rungs?';

const constitutional = [
  envInv({ ref: 'con-1', provenance: 'constitutional-substrate', lifecycle: { registry: 'invariant-substrate', status: 'canonical' }, statement: 'Actor, subject and owner are distinct references.' }),
  envInv({ ref: 'con-2', provenance: 'constitutional-substrate', lifecycle: { registry: 'invariant-substrate', status: 'canonical' }, statement: 'A regression canary must reproduce the defect it claims to protect.' }),
  envInv({ ref: 'con-3', provenance: 'constitutional-substrate', lifecycle: { registry: 'invariant-substrate', status: 'canonical' }, statement: 'Time to Value and Time to Repair are jointly optimised.' }),
];

const established = [
  envInv({
    ref: 'est-relevant',
    lifecycle: { registry: 'resolution-records', status: 'ratified' },
    statement: 'Invariant scope and context binding are kept as separate axes; personal or project state is never a causal scope rung.',
  }),
  envInv({ ref: 'est-generic-1', lifecycle: { registry: 'resolution-records', status: 'ratified' }, statement: 'A confirmed external consequence is independent evidence and must be readable without vendor attestation.' }),
  envInv({ ref: 'est-generic-2', lifecycle: { registry: 'resolution-records', status: 'ratified' }, statement: 'Capacity limits must produce pagination or batching, never silent population truncation.' }),
];

/** 30 unrelated candidate signals — the real registry's Pulse/P&L/RootDID noise, restated generically. */
const NOISE_TOPICS = [
  'Pulse admission confidence must not depend on evidence produced only after admission.',
  'P&L verification is an independent asynchronous capability transition from Pulse admission.',
  'A receipt is admissible as evidence for a runtime agent only if agents_invoked names that exact agent.',
  'RootDID equivalence authorizes an agreement without expanding its allowed actions or TTL.',
  'Reconciling a receipted constitutional state against a fresh read never rewrites that state.',
  'A verified external fact recorded in a DVN-attributable receipt is the canonical state transition.',
  'Schema enrichment must preserve recovery for historical receipts.',
  'A stage outcome and its evidence completeness are separate facts.',
  'Constitutional governance increases decision quality while decreasing interaction cost.',
  'By the time the operator sees something the system has already prepared the recommended disposition.',
];
const noiseSignals = Array.from({ length: 30 }, (_, i) =>
  envInv({ ref: `noise-${i}`, statement: NOISE_TOPICS[i % NOISE_TOPICS.length] + ` (occurrence ${i})` }),
);

/** Registered LAST — array order alone would bury it behind all 30 noise signals. */
const mostRelevantSignal = envInv({
  ref: 'cand-most-relevant',
  statement: 'The context-binding axis rungs platform workspace project developer principal-user session-intent are pinned as data.',
});

const positiveDiscovery = envInv({
  ref: 'disc-positive',
  provenance: 'live-discovery',
  lifecycle: { registry: 'none', status: 'unrecorded' },
  scope: 'intent',
  bearing: 'positive',
  statement: 'The context-binding axis rungs are pinned as one ordered array a canary asserts exactly.',
  recoveries: [{ bearing: 'positive', route: 'intent-driven', searchDomain: 'devon', riskVectorRef: null, repairPath: null, scopeExpansion: null }],
});

const riskVector = { model: 'bootstrap-heuristic-v1' as const, id: 'rv-test-reopen-risk', label: 'test reopen risk' };
const negativeDiscoveryRiskDriven = envInv({
  ref: 'disc-negative-risk-driven',
  provenance: 'live-discovery',
  lifecycle: { registry: 'none', status: 'unrecorded' },
  scope: 'cross-domain',
  bearing: 'negative',
  statement: 'The context-binding module imports nothing from the causal scope ladder, so the two can never silently couple.',
  recoveries: [{ bearing: 'negative', route: 'risk-driven', searchDomain: 'constitutional-computing', riskVectorRef: riskVector, repairPath: 'a canary asserts import independence', scopeExpansion: null }],
});

const riskField: IntentRiskField = {
  intentRef: 'intent-fixture',
  vectors: [riskVector],
  proofRefs: ['por-1'],
  originsPresent: ['projected'],
  revision: 1,
  constructedAt: '2026-08-15T00:00:00.000Z',
};

const proofsOfRisk: ProofOfRisk[] = [
  {
    id: 'por-1',
    intentRef: 'intent-fixture',
    riskVectorRef: riskVector,
    origin: 'projected',
    invariantRefs: ['disc-negative-risk-driven'],
    initiatingCondition: 'x',
    adverseConsequence: 'x',
    severity: 'unknown',
    probability: 'unknown',
    uncertainty: 'unknown',
    repairPath: null,
    reversibility: 'unknown',
    blastRadius: null,
    evidenceRefs: [],
    status: 'projected',
    createdAt: '2026-08-15T00:00:00.000Z',
  },
];

const relevance: CausalRelevanceContext = {
  intentText: INTENT_TEXT,
  unresolvedText: UNRESOLVED_TEXT,
  riskDrivenRefs: deriveRiskDrivenRefs(proofsOfRisk, riskField),
};

const allInvariants = [...constitutional, ...established, ...noiseSignals, mostRelevantSignal, positiveDiscovery, negativeDiscoveryRiskDriven];

// Budget forces real competition: 3 established + up to ~9 more from a pool of 32 (30 noise + 1 relevant + 2 discoveries).
const BUDGET = 12;

describe('Phase 6 Closure — causal-relevance admission (repairs RES-2026-08-15-PHASE6-COMPRESSION-CROWDOUT-001)', () => {
  it('requirement 1 — constitutional constraints cannot be crowded out, at any budget', () => {
    for (const budget of [0, 1, 5, BUDGET]) {
      const ctx = composeImplementationContext(allInvariants, [], budget, relevance);
      expect(ctx.carried['constitutional-constraints']).toEqual(['con-1', 'con-2', 'con-3']);
    }
  });

  it('requirement 2 — established invariants materially applicable to the intent are protected', () => {
    // Force established itself to compete: 5 established members, tight budget.
    const manyEstablished = [
      ...established,
      envInv({ ref: 'est-generic-3', lifecycle: { registry: 'resolution-records', status: 'ratified' }, statement: 'A canonical term is resolved from Common Ground before it is inferred.' }),
      envInv({ ref: 'est-generic-4', lifecycle: { registry: 'resolution-records', status: 'ratified' }, statement: 'Constitutional control constrains the unsafe record, never the safe remainder.' }),
    ];
    const ctx = composeImplementationContext([...constitutional, ...manyEstablished], [], 2, relevance);
    expect(ctx.carried['established-invariants']).toContain('est-relevant');
  });

  it('requirement 3 — a live discovery resolving residual uncertainty survives 30 unrelated candidates', () => {
    const ctx = composeImplementationContext(allInvariants, [UNRESOLVED_TEXT], BUDGET, relevance);
    expect(ctx.carried['live-discoveries']).toContain('disc-positive');
  });

  it('requirement 4 — a risk-driven finding tied to the CURRENT risk field survives 30 unrelated candidates', () => {
    const ctx = composeImplementationContext(allInvariants, [], BUDGET, relevance);
    expect(ctx.carried['live-discoveries']).toContain('disc-negative-risk-driven');
  });

  it('requirement 5 — candidate signals compete by causal relevance, not registry order', () => {
    const ctx = composeImplementationContext(allInvariants, [], BUDGET, relevance);
    // Registered LAST among the signal population — array order would have buried it.
    expect(ctx.carried['candidate-and-risk-signals']).toContain('cand-most-relevant');
    // At least some noise (registered FIRST) must have been dropped in its favour.
    const carriedNoise = ctx.carried['candidate-and-risk-signals'].filter((r) => r.startsWith('noise-'));
    expect(carriedNoise.length).toBeLessThan(30);
  });

  it('requirement 6 — every omission is honestly represented in omittedRefs', () => {
    const ctx = composeImplementationContext(allInvariants, [], BUDGET, relevance);
    const carriedAll = Object.values(ctx.carried).flat();
    expect(carriedAll.length + ctx.omittedRefs.length).toBe(allInvariants.length);
    // The dropped noise refs are specifically named, not merely counted.
    const droppedNoise = allInvariants.filter((i) => i.ref.startsWith('noise-') && !ctx.carried['candidate-and-risk-signals'].includes(i.ref));
    for (const n of droppedNoise) expect(ctx.omittedRefs).toContain(n.ref);
  });

  it('requirement 7 — lifecycle/provenance distinctions remain intact despite the joint ranking', () => {
    const ctx = composeImplementationContext(allInvariants, [], BUDGET, relevance);
    expect(misplacedInEstablished(ctx, allInvariants)).toEqual([]);
    // No live-discovery ref leaks into the signals section, and no signal ref leaks into discoveries.
    for (const ref of ctx.carried['candidate-and-risk-signals']) {
      expect(allInvariants.find((i) => i.ref === ref)?.provenance).not.toBe('live-discovery');
    }
    for (const ref of ctx.carried['live-discoveries']) {
      expect(allInvariants.find((i) => i.ref === ref)?.provenance).toBe('live-discovery');
    }
  });

  it('a caller supplying no relevance context reproduces the prior array-order behavior exactly', () => {
    // Every item here ties at score 0 (no structural signal, no context to overlap
    // against) — stable sort must leave them in their original order, so a caller
    // that has not yet adopted relevance context sees IDENTICAL behavior to before
    // this repair.
    const flat = [envInv({ ref: 'a' }), envInv({ ref: 'b' }), envInv({ ref: 'c' })];
    const ctx = composeImplementationContext(flat, [], 2);
    expect(ctx.carried['candidate-and-risk-signals']).toEqual(['a', 'b']);
  });
});

describe('causalRelevanceScore — tier ordering', () => {
  it('a risk-driven-in-current-field member outranks an intent-driven-by-construction member', () => {
    const riskDriven = envInv({ ref: 'x', recoveries: [] });
    const intentDriven = envInv({
      ref: 'y',
      recoveries: [{ bearing: 'positive', route: 'intent-driven', searchDomain: 'devon', riskVectorRef: null, repairPath: null, scopeExpansion: null }],
    });
    const ctx: CausalRelevanceContext = { riskDrivenRefs: new Set(['x']) };
    expect(causalRelevanceScore(riskDriven, ctx)).toBeGreaterThan(causalRelevanceScore(intentDriven, ctx));
  });

  it('an assessed materiality outranks a keyword-overlap-only match', () => {
    const assessed = envInv({ ref: 'x', materiality: 0.9 });
    const overlapOnly = envInv({ ref: 'y', statement: INTENT_TEXT });
    const ctx: CausalRelevanceContext = { intentText: INTENT_TEXT };
    expect(causalRelevanceScore(assessed, ctx)).toBeGreaterThan(causalRelevanceScore(overlapOnly, ctx));
  });
});
