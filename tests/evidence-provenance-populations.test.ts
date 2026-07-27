/**
 * Evidence provenance vs discovery provenance — the operator ruling of
 * 2026-07-27, made checkable.
 *
 * > "The key question is not where the invariant was discovered, but what its
 * > evidentiary basis is." … "Those are orthogonal attributes and should never
 * > be conflated."
 *
 * Every test here asserts BEHAVIOUR or a COMPUTED value, never that a symbol is
 * present (CFS-053 CB-5: defects 5–8 were canaries that asserted the symbol and
 * survived their own mutation). Each `it` names the mutation it fails under.
 *
 * What is guarded:
 *  1. The vocabulary is ONE list, extended not forked, and the DB CHECK is never
 *     narrower than the TypeScript union (constraint-drift bug class).
 *  2. The two axes are ORTHOGONAL: discovery provenance cannot move a record
 *     between populations. Asserted by CHANGING it and observing no effect.
 *  3. The partition is TOTAL and never defaults — an untagged record is
 *     `unclassified`, not `platform-derived` and never Population A.
 *  4. The seed's real state, computed from the file: Population A is EMPTY, the
 *     eight commercialisation records are Population B, and the counts sum.
 *  5. Reclassification is a recorded event carrying evidence — refused without
 *     evidence refs, refused when it would launder internal citations into
 *     Population A, and append-only when it succeeds.
 *  6. The Discovery Domain Registry, not a literal, decides the namespace a
 *     promoted candidate lands in.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROVENANCE_CLASSES, isProvenanceClass } from '@/services/corpusScout/types';
import {
  DISCOVERY_PROVENANCES,
  POPULATION_BY_EVIDENCE_PROVENANCE,
  PRIMARY_POPULATIONS,
  ABLATION_POPULATIONS,
  RECLASSIFICATION_LOG_KEY,
  readEvidenceProvenance,
  readDiscoveryProvenance,
  experimentalPopulation,
  inPrimaryPopulation,
  inAblationPopulation,
  partitionByPopulation,
  applyProvenanceReclassification,
  readReclassifications,
} from '@/services/research/experimentalPopulations';
import {
  DISCOVERY_DOMAINS,
  discoveryNamespace,
  discoveryDomain,
} from '@/services/invariants/discoveryDomains';
import { COMPOSITION_LAWS, INVARIANT_NAMESPACES } from '@/types/invariants';

const ROOT = join(__dirname, '..');

// ── 1 · One vocabulary, extended — not a fifth one founded ──────────────────

describe('the evidence-provenance vocabulary', () => {
  it('carries all FIVE values — the §2a four plus platform-doctrine', () => {
    // Mutation: drop `platform-doctrine` (or `platform-hypothesized`) from the
    // union in services/corpusScout/types.ts → this fails.
    expect([...PROVENANCE_CLASSES].sort()).toEqual(
      [
        'external-empirical',
        'external-established',
        'platform-derived',
        'platform-doctrine',
        'platform-hypothesized',
      ],
    );
  });

  it('accepts platform-doctrine through the SAME guard the review route uses', () => {
    // Mutation: leave PROVENANCE_CLASSES un-widened → isProvenanceClass rejects
    // 'platform-doctrine' and the review route 400s on a ratified value.
    expect(isProvenanceClass('platform-doctrine')).toBe(true);
    expect(isProvenanceClass('platform-invented')).toBe(false);
  });

  it('the corpus_candidate_sources CHECK is never narrower than the TS union', () => {
    // The "2026-07-15 constraint-drift incident" class: a value the code can
    // produce that the database refuses. Reads the LATEST migration that
    // (re)builds the constraint. Mutation: delete the widening migration → fails.
    const migrations = [
      'supabase/migrations/20260812000000_corpus_candidate_sources.sql',
      'supabase/migrations/20260826000000_provenance_class_platform_doctrine.sql',
    ];
    const latest = migrations
      .map((m) => readFileSync(join(ROOT, m), 'utf8'))
      .filter((sql) => /provenance_class\s+IN\s*\(/i.test(sql) || /provenance_class_check/i.test(sql))
      .pop();
    expect(latest, 'no migration builds the provenance_class CHECK').toBeTruthy();
    for (const value of PROVENANCE_CLASSES) {
      expect(latest, `SQL CHECK omits '${value}'`).toContain(`'${value}'`);
    }
  });

  it('names exactly one discovery-provenance value, and does not pad the list', () => {
    // The ruling names `ide` only. Mutation: invent extra values → fails.
    expect([...DISCOVERY_PROVENANCES]).toEqual(['ide']);
  });
});

// ── 2 · The two axes are ORTHOGONAL ─────────────────────────────────────────

describe('orthogonality — discovery provenance never decides the population', () => {
  it('every evidence-provenance value maps to exactly one population, exhaustively', () => {
    // Mutation: add a sixth ProvenanceClass without a population → TS Record
    // exhaustiveness fails at compile time; this pins the runtime mapping too.
    expect(Object.keys(POPULATION_BY_EVIDENCE_PROVENANCE).sort()).toEqual([...PROVENANCE_CLASSES].sort());
    expect(POPULATION_BY_EVIDENCE_PROVENANCE['external-established']).toBe('A');
    expect(POPULATION_BY_EVIDENCE_PROVENANCE['external-empirical']).toBe('A');
    expect(POPULATION_BY_EVIDENCE_PROVENANCE['platform-derived']).toBe('B');
    expect(POPULATION_BY_EVIDENCE_PROVENANCE['platform-hypothesized']).toBe('B');
    expect(POPULATION_BY_EVIDENCE_PROVENANCE['platform-doctrine']).toBe('C');
  });

  it('CHANGING discovery provenance changes nothing about the population', () => {
    // The load-bearing orthogonality assertion: same evidence, different
    // discoverer, identical population — for EVERY evidence class.
    // Mutation: make experimentalPopulation consult discoveryProvenance → fails.
    for (const ev of PROVENANCE_CLASSES) {
      const withoutDiscoverer = { provenanceClass: ev };
      const withDiscoverer = { provenanceClass: ev, discoveryProvenance: 'ide' };
      expect(experimentalPopulation(withDiscoverer)).toBe(experimentalPopulation(withoutDiscoverer));
      expect(experimentalPopulation(withDiscoverer)).toBe(POPULATION_BY_EVIDENCE_PROVENANCE[ev]);
    }
  });

  it('IDE discovery from an EXTERNAL corpus stays in the primary population', () => {
    // The ruling's central case: "discovered by your IDE, but not authored by
    // IRL". Mutation: exclude anything tagged discoveryProvenance=ide → fails.
    const ideFromFatf = { provenanceClass: 'external-established', discoveryProvenance: 'ide' };
    expect(inPrimaryPopulation(ideFromFatf)).toBe(true);
    expect(experimentalPopulation(ideFromFatf)).toBe('A');
  });

  it('IDE discovery from the PLATFORM corpus does NOT reach the primary population', () => {
    // The converse, and the reason the eight are Population B: being found by
    // the IDE is not evidence of independence.
    const ideFromRepo = { provenanceClass: 'platform-derived', discoveryProvenance: 'ide' };
    expect(inPrimaryPopulation(ideFromRepo)).toBe(false);
    expect(inAblationPopulation(ideFromRepo)).toBe(true);
  });

  it('the two axes are read independently off one bag', () => {
    const bag = { provenanceClass: 'platform-doctrine', discoveryProvenance: 'ide' };
    expect(readEvidenceProvenance(bag)).toBe('platform-doctrine');
    expect(readDiscoveryProvenance(bag)).toBe('ide');
  });

  it('platform doctrine (Q¢ / MoneyPenny) is in NEITHER the primary nor the ablation', () => {
    // Population C is a SEPARATE experimental population, not a heavier B.
    // Mutation: map platform-doctrine to 'B' → this fails on the ablation line.
    const qc = { provenanceClass: 'platform-doctrine' };
    expect(experimentalPopulation(qc)).toBe('C');
    expect(inPrimaryPopulation(qc)).toBe(false);
    expect(inAblationPopulation(qc)).toBe(false);
    expect(PRIMARY_POPULATIONS.has('C')).toBe(false);
    expect(ABLATION_POPULATIONS.has('C')).toBe(false);
  });

  it('the ablation is A ∪ B and the primary is A alone', () => {
    expect([...PRIMARY_POPULATIONS].sort()).toEqual(['A']);
    expect([...ABLATION_POPULATIONS].sort()).toEqual(['A', 'B']);
  });
});

// ── 3 · The partition is total and never defaults ───────────────────────────

describe('the partition never invents or launders provenance', () => {
  it('an untagged record is unclassified — NOT platform-derived, NOT Population A', () => {
    // Mutation: default a missing tag to 'platform-derived' (inventing) or to
    // 'external-established' (laundering) → one of these three fails.
    for (const bag of [undefined, null, {}, { source: 'CFS-009 Law XVI' }]) {
      expect(readEvidenceProvenance(bag)).toBeNull();
      expect(experimentalPopulation(bag)).toBeNull();
      expect(inPrimaryPopulation(bag)).toBe(false);
      expect(inAblationPopulation(bag)).toBe(false);
    }
  });

  it('an unrecognised tag is unclassified, never coerced into a population', () => {
    expect(experimentalPopulation({ provenanceClass: 'externally-ish' })).toBeNull();
  });

  it('partitionByPopulation is TOTAL — every record lands in exactly one bucket', () => {
    // Mutation: drop the `unclassified` branch → the sum stops matching.
    const records = [
      { p: { provenanceClass: 'external-established' } },
      { p: { provenanceClass: 'external-empirical' } },
      { p: { provenanceClass: 'platform-derived' } },
      { p: { provenanceClass: 'platform-hypothesized' } },
      { p: { provenanceClass: 'platform-doctrine' } },
      { p: {} },
      { p: null },
    ];
    const part = partitionByPopulation(records, (r) => r.p as Record<string, unknown> | null);
    expect(part.A.length).toBe(2);
    expect(part.B.length).toBe(2);
    expect(part.C.length).toBe(1);
    expect(part.unclassified.length).toBe(2);
    expect(part.A.length + part.B.length + part.C.length + part.unclassified.length).toBe(records.length);
  });

  it('reads the seed idiom — key=value inside provenance.source', () => {
    // The seed records carry `evidenceProvenance=…; discoveryProvenance=…`
    // inside a prose `source` string. Mutation: delete the source-string branch
    // of the reader → the eight seed records go unclassified and §4 fails.
    const bag = {
      source:
        'PRD-IDE-002 §9.1 C-001; recurrence=3; evidenceProvenance=platform-derived; discoveryProvenance=ide. Trailing prose.',
    };
    expect(readEvidenceProvenance(bag)).toBe('platform-derived');
    expect(readDiscoveryProvenance(bag)).toBe('ide');
    expect(experimentalPopulation(bag)).toBe('B');
  });

  it('the structured field WINS over the source string when both are present', () => {
    const bag = { provenanceClass: 'external-empirical', source: 'evidenceProvenance=platform-derived' };
    expect(readEvidenceProvenance(bag)).toBe('external-empirical');
  });
});

// ── 4 · The seed's real state, COMPUTED from the file ───────────────────────

describe('the canonical seed, partitioned mechanically', () => {
  const seed = JSON.parse(
    readFileSync(join(ROOT, 'codexes/packs/irl/foundation/canonical-invariants.seed.json'), 'utf8'),
  ) as { invariants: Array<{ id: string; namespace: string; provenance?: Record<string, unknown> }> };

  const part = partitionByPopulation(seed.invariants, (i) => i.provenance ?? null);

  it('Population A is EMPTY — no seed record cites an independently authored source', () => {
    // NOT a bug in the partition: it is the finding §2a exists to surface, and
    // the reason the external-corpus acquisition is a prerequisite rather than a
    // nice-to-have. Population A becomes non-empty only through a RECORDED
    // reclassification backed by external evidence (§2a.7) — which means this
    // assertion changing is a deliberate act with its own evidence, not drift.
    expect(part.A.map((i) => i.id)).toEqual([]);
  });

  it('exactly the eight commercialisation records are Population B, by id', () => {
    // Mutation: tag any of the eight `external-established` to make them
    // eligible → they leave B, this fails, and so does the A-is-empty test.
    expect(part.B.map((i) => i.id).sort()).toEqual([
      'inv.commercialisation.001',
      'inv.commercialisation.002',
      'inv.commercialisation.003',
      'inv.commercialisation.004',
      'inv.commercialisation.005',
      'inv.commercialisation.006',
      'inv.commercialisation.007',
      'inv.commercialisation.008',
    ]);
  });

  it('every one of the eight records BOTH axes, and neither implies the other', () => {
    for (const inv of part.B) {
      expect(readEvidenceProvenance(inv.provenance!), inv.id).toBe('platform-derived');
      expect(readDiscoveryProvenance(inv.provenance!), inv.id).toBe('ide');
    }
  });

  it('the partition accounts for every record — nothing silently dropped', () => {
    expect(part.A.length + part.B.length + part.C.length + part.unclassified.length).toBe(
      seed.invariants.length,
    );
    // Records predating the vocabulary are explicitly unclassified, not assumed.
    expect(part.unclassified.length).toBe(seed.invariants.length - 8);
  });

  it('nothing in the seed was canonised by this work — the eight stay proposed', () => {
    // CLAUDE.md hypothesis-vs-canon. Mutation: flip one to 'canonical' → fails.
    const eight = seed.invariants.filter((i) => i.namespace === 'commercialisation');
    expect(eight.length).toBe(8);
    for (const inv of eight) {
      expect((inv as unknown as { status: string }).status, inv.id).toBe('proposed');
    }
  });
});

// ── 5 · Reclassification is a recorded event, never a quiet field edit ──────

describe('provenance reclassification', () => {
  const externalEvidence = ['https://doi.org/10.1000/example', 'FATF Recommendation 16 (2012, updated 2023)'];

  it('REFUSES a class change that carries no evidence refs', () => {
    // The whole point. Mutation: drop the evidenceRefs guard → this passes and
    // a field edit becomes indistinguishable from corpus acquisition.
    const r = applyProvenanceReclassification(
      { provenanceClass: 'platform-derived' },
      { to: 'external-established', evidenceRefs: [], rationale: 'because', at: '2026-08-01T00:00:00Z', actor: 'a' },
    );
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/evidenceRef/);
  });

  it('REFUSES a class change with blank-string evidence refs', () => {
    const r = applyProvenanceReclassification(
      { provenanceClass: 'platform-derived' },
      { to: 'external-established', evidenceRefs: ['  ', ''], rationale: 'x', at: 'now', actor: 'a' },
    );
    expect(r.ok).toBe(false);
  });

  it('REFUSES a move into Population A that cites only repo-internal material', () => {
    // Laundering guard. Mutation: delete the looksInternal check → this passes
    // and every platform-derived record can be relabelled external for free.
    const r = applyProvenanceReclassification(
      { provenanceClass: 'platform-derived' },
      {
        to: 'external-established',
        evidenceRefs: ['codexes/packs/irl/foundation/PRD-IDE-002_commercialisation-invariant-discovery.md', 'CFS-048'],
        rationale: 'it recurs',
        at: 'now',
        actor: 'a',
      },
    );
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/laundering/);
  });

  it('ALLOWS a move into Population A when at least one citation is external', () => {
    const r = applyProvenanceReclassification(
      { provenanceClass: 'platform-derived', source: 'PRD-IDE-002 §9.1 C-001' },
      {
        to: 'external-empirical',
        evidenceRefs: ['codexes/packs/irl/foundation/PRD-IDE-002.md', ...externalEvidence],
        rationale: 'independently re-derived from the acquired external corpus',
        at: '2026-09-01T00:00:00Z',
        actor: 'corpus-scout',
      },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.from).toBe('platform-derived');
    expect(r.to).toBe('external-empirical');
    // The population MOVES as a consequence — B before, A after.
    expect(experimentalPopulation({ provenanceClass: 'platform-derived' })).toBe('B');
    expect(experimentalPopulation(r.provenance)).toBe('A');
    expect(inPrimaryPopulation(r.provenance)).toBe(true);
  });

  it('records the event append-only and preserves the prior class', () => {
    // Mutation: overwrite instead of append (or drop `from`) → fails.
    const first = applyProvenanceReclassification(
      { provenanceClass: 'platform-hypothesized' },
      { to: 'platform-derived', evidenceRefs: ['services/x.ts'], rationale: 'artefact evidence found', at: 't1', actor: 'a' },
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = applyProvenanceReclassification(first.provenance, {
      to: 'external-established',
      evidenceRefs: externalEvidence,
      rationale: 'external corpus landed',
      at: 't2',
      actor: 'b',
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const log = readReclassifications(second.provenance);
    expect(log.length).toBe(2);
    expect(log[0]).toMatchObject({ from: 'platform-hypothesized', to: 'platform-derived', at: 't1' });
    expect(log[1]).toMatchObject({ from: 'platform-derived', to: 'external-established', at: 't2' });
    expect(log[1].evidenceRefs).toEqual(externalEvidence);
    expect(second.provenance[RECLASSIFICATION_LOG_KEY]).toBeDefined();
  });

  it('REFUSES a no-op reclassification', () => {
    const r = applyProvenanceReclassification(
      { provenanceClass: 'platform-derived' },
      { to: 'platform-derived', evidenceRefs: ['x'], rationale: 'y', at: 't', actor: 'a' },
    );
    expect(r.ok).toBe(false);
  });

  it('REFUSES an unratified target class', () => {
    const r = applyProvenanceReclassification(
      {},
      { to: 'external-vibes' as never, evidenceRefs: externalEvidence, rationale: 'y', at: 't', actor: 'a' },
    );
    expect(r.ok).toBe(false);
  });

  it('does not mutate the input bag', () => {
    const input = { provenanceClass: 'platform-derived' as const };
    applyProvenanceReclassification(input, {
      to: 'external-empirical',
      evidenceRefs: externalEvidence,
      rationale: 'y',
      at: 't',
      actor: 'a',
    });
    expect(input.provenanceClass).toBe('platform-derived');
    expect(readReclassifications(input)).toEqual([]);
  });
});

// ── 6 · The namespace is RESOLVED, not hardcoded ────────────────────────────

describe('discovery namespace resolution (operator ruling — experimental traceability)', () => {
  it('Financial Services resolves to finance, NOT constitutional', () => {
    // Mutation: restore `namespace: 'constitutional'` in promoteCandidate, or
    // set FINANCIAL_SERVICES.namespace back to 'constitutional' → fails.
    expect(discoveryNamespace('financial-services')).toBe('finance');
    expect(discoveryNamespace('financial-services')).not.toBe('constitutional');
  });

  it('Commercialisation resolves to commercialisation', () => {
    expect(discoveryNamespace('commercialisation')).toBe('commercialisation');
  });

  it('a qualified observation key resolves to its DISCOVERY domain namespace', () => {
    // `commercialisation/media` is a commercialisation candidate observed in
    // media — it must not resolve as if `commercialisation/media` were a domain.
    expect(discoveryNamespace('commercialisation/media')).toBe('commercialisation');
    expect(discoveryNamespace('commercialisation/financial-services')).toBe('commercialisation');
  });

  it('an UNREGISTERED domain keeps the pre-ruling constitutional fallback', () => {
    expect(discoveryNamespace('some-unchartered-domain')).toBe('constitutional');
  });

  it('every registered domain declares a namespace that exists and has a composition law', () => {
    // CFS-013 §3 — a class's algebra must be declared before members land.
    // Mutation: point a domain at an undeclared namespace → fails.
    for (const d of DISCOVERY_DOMAINS) {
      expect(INVARIANT_NAMESPACES, d.key).toContain(d.namespace);
      expect(COMPOSITION_LAWS[d.namespace], d.key).toBeTruthy();
    }
  });

  it('no registered domain promotes into the constitutional namespace', () => {
    // "The constitutional namespace should contain only constitutional
    // invariants." Mutation: set either domain back to 'constitutional' → fails.
    for (const d of DISCOVERY_DOMAINS) {
      expect(d.namespace, `${d.key} promotes into the constitutional namespace`).not.toBe('constitutional');
    }
    expect(discoveryDomain('financial-services')).toBeTruthy();
  });
});

// ── 6b · promoteCandidate actually CALLS the resolver ───────────────────────
// Asserting the registry value alone would survive the mutation that matters
// (a literal left in promoteCandidate). This exercises the call.

const discoverInvariant = vi.fn();
vi.mock('@/services/invariants/lifecycle', () => ({
  discoverInvariant: (...args: unknown[]) => discoverInvariant(...args),
  addEdge: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/invariants/store', () => ({ listEdgesForInvariants: vi.fn().mockResolvedValue([]) }));
vi.mock('@/services/constitutional/modelRouter', () => ({ callSovereign: vi.fn() }));

function fakeAdmin(candidate: Record<string, unknown>) {
  return {
    from() {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: candidate, error: null }),
            is: () => ({ eq: () => ({ not: async () => ({ data: [] }) }) }),
          }),
        }),
        update: () => ({ eq: async () => ({ error: null }) }),
      };
    },
  } as never;
}

describe('promoteCandidate resolves the namespace from the registry', () => {
  beforeEach(() => {
    discoverInvariant.mockReset();
    discoverInvariant.mockResolvedValue({ invariant: { id: 'inv-1' } });
  });

  it('promotes a financial-services candidate into the finance namespace', async () => {
    // THE mutation this file exists for: revert promoteCandidate to
    // `namespace: 'constitutional'` and this fails, while every source-level
    // "the registry declares finance" assertion would still pass.
    const { promoteCandidate } = await import('@/services/invariants/discoveryEngine');
    const res = await promoteCandidate(
      fakeAdmin({ id: 'c1', status: 'candidate', domain: 'financial-services', statement: 'S', confidence: 0.6 }),
      'c1',
      { personaId: 'p1' },
    );
    expect(res.ok).toBe(true);
    expect(discoverInvariant).toHaveBeenCalledTimes(1);
    expect(discoverInvariant.mock.calls[0][0].namespace).toBe('finance');
  });

  it('promotes a commercialisation candidate into the commercialisation namespace', async () => {
    const { promoteCandidate } = await import('@/services/invariants/discoveryEngine');
    await promoteCandidate(
      fakeAdmin({ id: 'c2', status: 'candidate', domain: 'commercialisation', statement: 'S', confidence: 0.6 }),
      'c2',
      { personaId: 'p1' },
    );
    expect(discoverInvariant.mock.calls[0][0].namespace).toBe('commercialisation');
  });

  it('records discoveryProvenance=ide but leaves evidence provenance UNSET (fail closed)', async () => {
    // The engine cannot know whether the evidence it compressed was external —
    // `discovery_evidence` carries no provenance class. Writing a guess would be
    // the exact conflation the ruling abolishes. Mutation: set
    // `evidenceProvenance: 'external-established'` here → the population
    // assertion below flips to 'A' and this fails.
    const { promoteCandidate } = await import('@/services/invariants/discoveryEngine');
    await promoteCandidate(
      fakeAdmin({ id: 'c3', status: 'candidate', domain: 'financial-services', statement: 'S', confidence: 0.6 }),
      'c3',
      { personaId: 'p1' },
    );
    const prov = discoverInvariant.mock.calls[0][0].provenance as Record<string, unknown>;
    expect(readDiscoveryProvenance(prov)).toBe('ide');
    expect(readEvidenceProvenance(prov)).toBeNull();
    expect(experimentalPopulation(prov)).toBeNull();
    expect(inPrimaryPopulation(prov)).toBe(false);
  });
});
