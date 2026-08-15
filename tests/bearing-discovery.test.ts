/**
 * Bearing discovery canaries (Homecoming III Phase 3).
 *
 * THE ACCEPTANCE BAR (operator, 2026-08-15), quoted because the whole phase
 * turns on it: "Acceptance must include at least one scenario where the
 * negative pass, driven by a material risk vector, finds a causally relevant
 * condition outside the apparent intent domain that the positive pass did not
 * find."
 *
 * The scenario below uses a deliberately ordinary intent — add a retry to a
 * payment submission — whose positive pass stays entirely inside `payments`.
 * The negative pass, driven by a data-integrity risk vector, is sent into
 * `persistence` and finds the idempotency-key condition. That condition is
 * causally decisive for the intent and is NOT reachable from asking "what must
 * be true for a retry to work" — only from asking "what must be true to
 * prevent a retry doing harm".
 *
 * On the provider seam: statement GENERATION is a reasoning act and sits
 * behind BearingDiscoveryProvider. The thing under test here is the
 * ORCHESTRATION — order, precondition, scope expansion, causal chain,
 * convergence, independence. A deterministic provider is the boundary of the
 * unit, not a mock of it.
 */

import { describe, it, expect } from 'vitest';
import {
  CAUSAL_ABSTRACTION_CONTRACT,
  RiskFieldRequiredError,
  buildInitialRiskField,
  claimKey,
  discoverBearings,
  expandScope,
  isIndependentlyRecovered,
  markConvergence,
  type BearingDiscoveryProvider,
  type DiscoveredCondition,
} from '@/services/devCommandCenter/bearingDiscovery';
import {
  mayBeCitedAsEstablished,
  type BearingRecovery,
  type EnvelopeInvariant,
  type RiskVectorRef,
} from '@/types/invariantEnvelope';
import { readSource, stripComments } from './_lib/sourceAuthority';

const SRC = stripComments(readSource('services/devCommandCenter/bearingDiscovery.ts'));
const NOW = '2026-08-15T00:00:00.000Z';

const DATA_INTEGRITY: RiskVectorRef = {
  model: 'bootstrap-heuristic-v1',
  id: 'rv.data-integrity.duplicate-effect',
  label: 'A retried operation applies its effect more than once',
};
const AUTHZ: RiskVectorRef = {
  model: 'bootstrap-heuristic-v1',
  id: 'rv.authorization.stale-grant',
  label: 'An authorization outlives the condition that justified it',
};

/**
 * The acceptance scenario's provider. Deterministic and deliberately narrow:
 * the positive pass knows only about payments; the negative pass knows what
 * each risk vector's domain implies. Neither can see the other's output.
 */
const scenarioProvider: BearingDiscoveryProvider = {
  async positive({ intentDomain }): Promise<DiscoveredCondition[]> {
    return [
      {
        statement: 'A submission that has not been acknowledged remains eligible for resubmission.',
        searchDomain: intentDomain,
      },
      {
        statement: 'The submission endpoint remains reachable for the duration of the retry window.',
        searchDomain: intentDomain,
      },
    ];
  },
  async negative({ vector, searchDomain }): Promise<DiscoveredCondition[]> {
    if (vector.id === DATA_INTEGRITY.id) {
      return [
        {
          statement: 'Logical transaction identity remains stable across retries.',
          searchDomain,
          repairPath:
            'Reconcile the ledger against the payment processor and reverse the duplicated effect.',
        },
      ];
    }
    return [
      {
        statement: 'Authority to submit is re-evaluated at submission time, not at request time.',
        searchDomain,
        repairPath: 'Revoke the grant and re-authorize the operator.',
      },
    ];
  },
};

function envInv(over: Partial<EnvelopeInvariant> = {}): EnvelopeInvariant {
  return {
    ref: 'r',
    statement: 's',
    provenance: 'live-discovery',
    lifecycle: { registry: 'none', status: 'unrecorded' },
    scope: 'intent',
    bearing: null,
    recoveries: [],
    materiality: 'unknown',
    ...over,
  };
}

function recovery(over: Partial<BearingRecovery> = {}): BearingRecovery {
  return {
    bearing: 'positive',
    route: 'intent-driven',
    searchDomain: 'payments',
    riskVectorRef: null,
    repairPath: null,
    scopeExpansion: null,
    ...over,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// ACCEPTANCE — the negative pass reaches where the positive pass cannot
// ───────────────────────────────────────────────────────────────────────────

describe('ACCEPTANCE — risk-driven discovery finds what intent-driven discovery cannot', () => {
  const riskField = buildInitialRiskField({
    intentRef: 'intent.retry-payment-submission',
    projected: [DATA_INTEGRITY],
    retrieved: [AUTHZ],
    now: NOW,
  });

  const run = () =>
    discoverBearings({
      intentText: 'Add an automatic retry to the payment submission path.',
      intentDomain: 'payments',
      riskField,
      vectorDomains: {
        [DATA_INTEGRITY.id]: 'persistence',
        [AUTHZ.id]: 'authorization',
      },
      known: [],
      provider: scenarioProvider,
      now: NOW,
    });

  it('surfaces at least one causally relevant condition OUTSIDE the intent domain', async () => {
    const { discovered } = await run();
    const outside = discovered.filter(
      (d) => d.recoveries.some((r) => r.route === 'risk-driven') && d.scope === 'cross-domain',
    );
    expect(outside.length, 'the negative pass must reach outside the intent domain').toBeGreaterThan(0);
    const domains = new Set(outside.flatMap((d) => d.recoveries.map((r) => r.searchDomain)));
    expect(domains.has('persistence')).toBe(true);
    expect(domains.has('payments'), 'an out-of-domain finding must not be in the intent domain').toBe(false);
  });

  it('the positive pass did NOT find it — the two passes are not one process twice', async () => {
    const { discovered } = await run();
    const positiveClaims = new Set(
      discovered
        .filter((d) => d.recoveries.every((r) => r.route === 'intent-driven'))
        .map((d) => claimKey(d.statement)),
    );
    const idempotency = discovered.find((d) => d.statement.includes('Logical transaction identity'));
    expect(idempotency, 'the idempotency condition must have been discovered').toBeDefined();
    expect(
      positiveClaims.has(claimKey(idempotency!.statement)),
      'the intent-driven pass must not have produced this claim',
    ).toBe(false);
    expect(idempotency!.recoveries.every((r) => r.route === 'risk-driven')).toBe(true);
  });

  it('the finding carries the FULL causal chain: risk vector → repair path → scope expansion', async () => {
    const { discovered } = await run();
    const idempotency = discovered.find((d) => d.statement.includes('Logical transaction identity'))!;
    const r = idempotency.recoveries[0];

    // 1 — the risk vector that motivated the search
    expect(r.riskVectorRef?.id).toBe(DATA_INTEGRITY.id);
    // 2 — the repair path it implied
    expect(r.repairPath).toBeTruthy();
    expect(r.repairPath).toContain('Reconcile');
    // 3 — the scope expansion it caused, attributed to that vector
    expect(r.scopeExpansion).not.toBeNull();
    expect(r.scopeExpansion!.fromDomain).toBe('payments');
    expect(r.scopeExpansion!.toDomain).toBe('persistence');
    expect(r.scopeExpansion!.motivatedByRiskVectorId).toBe(DATA_INTEGRITY.id);
    // 4 — the candidate itself, which has earned nothing by being found
    expect(idempotency.provenance).toBe('live-discovery');
    expect(idempotency.lifecycle).toEqual({ registry: 'none', status: 'unrecorded' });
  });

  it('every discovery is unrecorded and uncitable — discovery promotes nothing', async () => {
    const { discovered } = await run();
    expect(discovered.length).toBeGreaterThan(0);
    for (const d of discovered) {
      expect(d.provenance).toBe('live-discovery');
      expect(mayBeCitedAsEstablished(d.lifecycle), `citable: ${d.ref}`).toBe(false);
    }
  });

  it('records which risk-field revision the passes ran against', async () => {
    const { riskFieldRevision, passOrder } = await run();
    expect(riskFieldRevision).toBe(riskField.revision);
    expect([...passOrder]).toEqual(['risk-field', 'positive', 'negative', 'convergence']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// The locked order
// ───────────────────────────────────────────────────────────────────────────

describe('the Phase 3 order is enforced, not documented', () => {
  it('REFUSES to discover without a risk field — the field is a precondition', async () => {
    await expect(
      discoverBearings({
        intentText: 'x',
        intentDomain: 'payments',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        riskField: null as any,
        vectorDomains: {},
        known: [],
        provider: scenarioProvider,
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(RiskFieldRequiredError);
  });

  it('the refusal explains WHY, not merely that it refused', () => {
    const e = new RiskFieldRequiredError();
    expect(e.message).toMatch(/broaden/i);
    expect(e.message).toContain('phrased as warnings');
  });

  it('a risk field with no vectors yields no negative findings — and says so honestly', async () => {
    const empty = buildInitialRiskField({ intentRef: 'i', now: NOW });
    expect(empty.vectors).toEqual([]);
    expect(empty.originsPresent, 'an empty origin set is stated, not implied').toEqual([]);
    const { discovered } = await discoverBearings({
      intentText: 'x',
      intentDomain: 'payments',
      riskField: empty,
      vectorDomains: {},
      known: [],
      provider: scenarioProvider,
      now: NOW,
    });
    expect(discovered.every((d) => d.recoveries.every((r) => r.route === 'intent-driven'))).toBe(true);
  });

  it('the risk field dedupes vectors across origins without losing origin visibility', () => {
    const f = buildInitialRiskField({
      intentRef: 'i',
      projected: [DATA_INTEGRITY],
      retrieved: [DATA_INTEGRITY, AUTHZ],
      now: NOW,
    });
    expect(f.vectors.map((v) => v.id)).toEqual([DATA_INTEGRITY.id, AUTHZ.id]);
    expect(f.originsPresent).toEqual(['projected', 'retrieved']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CANARY-04 — dual is evidence, never promotion
// ───────────────────────────────────────────────────────────────────────────

describe('CANARY-04 — convergence requires independent routes', () => {
  it('marks dual when the same claim arrives by BOTH routes', () => {
    const claim = 'Material state relied upon by dependent capabilities remains independently observable.';
    const out = markConvergence([
      envInv({ ref: 'a', statement: claim, bearing: 'positive', recoveries: [recovery()] }),
      envInv({
        ref: 'b',
        statement: claim,
        bearing: 'negative',
        recoveries: [recovery({ bearing: 'negative', route: 'risk-driven', riskVectorRef: DATA_INTEGRITY })],
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].bearing).toBe('dual');
    expect(out[0].recoveries).toHaveLength(2);
    expect(new Set(out[0].recoveries.map((r) => r.route)).size).toBe(2);
  });

  it('does NOT mark dual when the same claim arrives twice by the SAME route', () => {
    /*
     * The operator's exact exclusion: "Merely invoking the same discovery
     * process twice with different labels does not satisfy IDE 2.0."
     */
    const claim = 'Submitted state eventually becomes observable to dependent consumers.';
    const out = markConvergence([
      envInv({ ref: 'a', statement: claim, bearing: 'positive', recoveries: [recovery()] }),
      envInv({ ref: 'b', statement: claim, bearing: 'positive', recoveries: [recovery()] }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].bearing).not.toBe('dual');
    // The recoveries are still merged — the evidence is kept, the CLAIM is not made.
    expect(out[0].recoveries).toHaveLength(2);
  });

  it('dual does not touch lifecycle — a converged finding is as unrecorded as before', () => {
    const claim = 'A dependent capability observes the state it depends on.';
    const out = markConvergence([
      envInv({ ref: 'a', statement: claim, recoveries: [recovery()] }),
      envInv({
        ref: 'b',
        statement: claim,
        recoveries: [recovery({ bearing: 'negative', route: 'risk-driven' })],
      }),
    ]);
    expect(out[0].bearing).toBe('dual');
    expect(out[0].lifecycle).toEqual({ registry: 'none', status: 'unrecorded' });
    expect(mayBeCitedAsEstablished(out[0].lifecycle)).toBe(false);
  });

  it('independence is decided by route, not by count', () => {
    expect(isIndependentlyRecovered([recovery(), recovery()])).toBe(false);
    expect(isIndependentlyRecovered([recovery(), recovery({ route: 'risk-driven' })])).toBe(true);
  });

  it('distinct claims are never merged', () => {
    const out = markConvergence([
      envInv({ ref: 'a', statement: 'Transaction identity remains stable across retries.' }),
      envInv({ ref: 'b', statement: 'Authority is re-evaluated at submission time.' }),
    ]);
    expect(out).toHaveLength(2);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Risk vectors are not invariants
// ───────────────────────────────────────────────────────────────────────────

describe('risk vectors guide search; they are not invariants', () => {
  it('a RiskVectorRef carries no statement and cannot be cited', () => {
    expect(Object.keys(DATA_INTEGRITY).sort()).toEqual(['id', 'label', 'model']);
    expect('statement' in DATA_INTEGRITY).toBe(false);
    expect('lifecycle' in DATA_INTEGRITY).toBe(false);
    expect('provenance' in DATA_INTEGRITY).toBe(false);
  });

  it('no function converts a risk vector into an envelope member', () => {
    expect(SRC).not.toMatch(/function\s+\w*[Vv]ectorTo(Invariant|Member|Envelope)/);
    expect(SRC).not.toMatch(/fromRiskVector/);
  });

  it('a vector appears on a recovery as a REASON, never in the invariant list', async () => {
    const riskField = buildInitialRiskField({ intentRef: 'i', projected: [DATA_INTEGRITY], now: NOW });
    const { discovered } = await discoverBearings({
      intentText: 'x',
      intentDomain: 'payments',
      riskField,
      vectorDomains: { [DATA_INTEGRITY.id]: 'persistence' },
      known: [],
      provider: scenarioProvider,
      now: NOW,
    });
    // The vector's own label must never appear as a discovered statement.
    expect(discovered.map((d) => d.statement)).not.toContain(DATA_INTEGRITY.label);
    // But it must be present as the reason on the risk-driven recovery.
    const driven = discovered.filter((d) => d.recoveries.some((r) => r.riskVectorRef));
    expect(driven.length).toBeGreaterThan(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CANARY-03 — negative discovery seeks conditions, not prohibitions
// ───────────────────────────────────────────────────────────────────────────

describe('CANARY-03 — causal abstraction, not prohibition', () => {
  it('the provider contract demands a condition and names the failure it prevents', () => {
    expect(CAUSAL_ABSTRACTION_CONTRACT).toMatch(/CAUSAL CONDITION THAT MUST REMAIN TRUE/);
    expect(CAUSAL_ABSTRACTION_CONTRACT).toContain('never as a prohibition');
    // It carries the PRD's own worked example, so the requirement is legible
    // rather than abstract.
    expect(CAUSAL_ABSTRACTION_CONTRACT).toContain('Never process duplicate transactions');
    expect(CAUSAL_ABSTRACTION_CONTRACT).toContain('logical transaction identity remains');
  });

  it('the contract is stated once — no second copy to drift from', () => {
    const copies = SRC.match(/CAUSAL CONDITION THAT MUST REMAIN TRUE/g) ?? [];
    expect(copies).toHaveLength(1);
  });

  it('the scenario findings are conditions, not prohibitions', async () => {
    const riskField = buildInitialRiskField({
      intentRef: 'i',
      projected: [DATA_INTEGRITY, AUTHZ],
      now: NOW,
    });
    const { discovered } = await discoverBearings({
      intentText: 'x',
      intentDomain: 'payments',
      riskField,
      vectorDomains: { [DATA_INTEGRITY.id]: 'persistence', [AUTHZ.id]: 'authorization' },
      known: [],
      provider: scenarioProvider,
      now: NOW,
    });
    for (const d of discovered) {
      expect(d.statement, `prohibition-shaped: ${d.statement}`).not.toMatch(/^(Never|Do not|Don't|Avoid)\b/i);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Scope expansion bookkeeping
// ───────────────────────────────────────────────────────────────────────────

describe('scope expansion is recorded only where it happened', () => {
  it('returns null when the vector points back into the intent domain', () => {
    expect(expandScope('payments', 'payments', 'intent', 'cross-domain', DATA_INTEGRITY)).toBeNull();
  });

  it('attributes the expansion to the vector that caused it', () => {
    const e = expandScope('payments', 'persistence', 'intent', 'cross-domain', DATA_INTEGRITY)!;
    expect(e.motivatedByRiskVectorId).toBe(DATA_INTEGRITY.id);
    expect(e.fromDomain).toBe('payments');
    expect(e.toDomain).toBe('persistence');
  });

  it('a negative finding that stayed in-domain claims no expansion', async () => {
    const riskField = buildInitialRiskField({ intentRef: 'i', projected: [AUTHZ], now: NOW });
    const { discovered } = await discoverBearings({
      intentText: 'x',
      intentDomain: 'authorization',
      riskField,
      // vector points at the intent's OWN domain — no widening occurred
      vectorDomains: { [AUTHZ.id]: 'authorization' },
      known: [],
      provider: scenarioProvider,
      now: NOW,
    });
    const negative = discovered.filter((d) => d.recoveries.some((r) => r.route === 'risk-driven'));
    expect(negative.length).toBeGreaterThan(0);
    for (const d of negative) {
      expect(d.recoveries[0].scopeExpansion, 'no widening ⇒ no expansion claim').toBeNull();
      expect(d.scope).toBe('intent');
    }
  });
});
