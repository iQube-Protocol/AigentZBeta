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
  CLASSIFICATION_CHECKS,
  RESTRICTED_INVARIANT_USES,
  PERMITTED_UNCLASSIFIED_USES,
  buildClassificationQueue,
  canUseInvariantFor,
  composeClassificationSuggestion,
  deriveFieldOrigin,
  type ClassificationSuggestionSource,
} from '@/services/research/experimentalPopulations';
import { suggestClassification } from '@/services/invariants/discoveryEngine';
import type { SupabaseClient } from '@supabase/supabase-js';
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

  it('defaults to semanticType constraint when no fifth argument is given (2026-08-05 regression — every prior caller must be unaffected)', async () => {
    const { promoteCandidate } = await import('@/services/invariants/discoveryEngine');
    await promoteCandidate(
      fakeAdmin({ id: 'c4', status: 'candidate', domain: 'financial-services', statement: 'S', confidence: 0.6 }),
      'c4',
      { personaId: 'p1' },
    );
    expect(discoverInvariant.mock.calls[0][0].semanticType).toBe('constraint');
  });

  it('promotes with a steward-reviewed semanticType when one is explicitly passed — the structural-diversity remediation path', async () => {
    const { promoteCandidate } = await import('@/services/invariants/discoveryEngine');
    await promoteCandidate(
      fakeAdmin({ id: 'c5', status: 'candidate', domain: 'financial-services', statement: 'S', confidence: 0.6 }),
      'c5',
      { personaId: 'p1' },
      [],
      'law',
    );
    expect(discoverInvariant.mock.calls[0][0].semanticType).toBe('law');
  });
});

// ── 7 · "Safe" is not "finished" — the classification queue and the gate ────

/**
 * The operator ruling of 2026-07-28 on promoting the twelve Financial Services
 * candidates:
 *
 *   "The promotion path is fail-closed, so promotion will not fabricate
 *    Population A membership. That is good. But 'safe' should not become
 *    'finished.'"
 *
 * Two obligations follow, and both are BEHAVIOURAL here: the queue must SHOW
 * the outstanding work, and the prohibition must REFUSE with a reason — a
 * silent exclusion from a population is indistinguishable from a bug (the
 * defect fixed in `7edfadf52`).
 */
describe('the classification queue — promotion is safe, not finished', () => {
  const promoted = (over: Record<string, unknown> = {}) => ({
    id: 'inv-1',
    statement: 'A settlement finality claim must name the rail that settles it.',
    namespace: 'finance',
    status: 'proposed',
    provenance: {
      source: 'CFS-048 Invariant Discovery Engine (constitutional arm)',
      discoveryProvenance: 'ide',
      domain: 'financial-services',
      evidence_ids: ['e1', 'e2'],
      discovery_candidate_id: 'c1',
      ...over,
    } as Record<string, unknown>,
  });

  it('lists every promoted-but-unclassified invariant, and NOTHING else', () => {
    const queue = buildClassificationQueue([
      promoted(),
      // Already classified — out of the queue whatever population that put it in.
      promoted({ provenanceClass: 'platform-derived' }),
      // Not a promotion at all — a hand-authored record must not be conscripted.
      { id: 'inv-3', statement: 'x', namespace: 'constitutional', status: 'canonical', provenance: { source: 'seed' } },
    ]);
    expect(queue.map((q) => q.invariantId)).toEqual(['inv-1']);
    expect(queue[0].population).toBeNull();
    expect(queue[0].evidenceProvenance).toBeNull();
    expect(queue[0].discoveryProvenance).toBe('ide');
  });

  it('requires exactly the SIX checks the ruling enumerated — no more, no fewer', () => {
    // Mutation: drop `law-ii-status` from CLASSIFICATION_CHECKS → the queue
    // silently stops asking for it and this fails. A looped
    // "every member is reachable" assertion would NOT catch a deletion.
    expect(CLASSIFICATION_CHECKS.map((c) => c.id)).toEqual([
      'evidence-row-inspection',
      'source-document-lineage',
      'evidence-provenance-assignment',
      'domain-namespace-confirmation',
      'duplication-equivalence-comparison',
      'law-ii-status',
    ]);
    const [entry] = buildClassificationQueue([promoted()]);
    expect(entry.checks.map((c) => c.id)).toEqual(CLASSIFICATION_CHECKS.map((c) => c.id));
    // Every check states what the steward must actually do.
    for (const c of entry.checks) expect(c.detail.trim().length).toBeGreaterThan(0);
  });

  it('a steward check is NEVER auto-satisfied — absence of proof is not proof', () => {
    const [entry] = buildClassificationQueue([promoted()], () => 'finance');
    const steward = entry.checks.filter((c) => c.decidedBy === 'steward');
    expect(steward.length).toBeGreaterThan(0);
    for (const c of steward) expect(c.satisfied, `'${c.id}' marked itself done`).toBe(false);
    // The mechanical one that CAN be seen is seen: namespace matches.
    expect(entry.checks.find((c) => c.id === 'domain-namespace-confirmation')!.satisfied).toBe(true);
    // …and evidence provenance is outstanding by construction — a queue entry
    // exists precisely because it is unset.
    expect(entry.checks.find((c) => c.id === 'evidence-provenance-assignment')!.satisfied).toBe(false);
  });

  it('a namespace MISMATCH is reported as a break, not passed over', () => {
    // The population separation is destroyed at the point of entry if a
    // Financial Services discovery lands in `constitutional.*`.
    const [entry] = buildClassificationQueue(
      [{ ...promoted(), namespace: 'constitutional' }],
      () => 'finance',
    );
    const check = entry.checks.find((c) => c.id === 'domain-namespace-confirmation')!;
    expect(check.satisfied).toBe(false);
    expect(check.detail).toMatch(/resolves to 'finance'/);
    // With no expected namespace supplied it is UN-CHECKABLE, never "passed".
    const [blind] = buildClassificationQueue([{ ...promoted(), namespace: 'constitutional' }]);
    expect(blind.checks.find((c) => c.id === 'domain-namespace-confirmation')!.satisfied).toBe(false);
  });

  it('an invariant promoted with NO evidence rows says so — it is the worse case, not the quiet one', () => {
    const [entry] = buildClassificationQueue([promoted({ evidence_ids: [] })]);
    const check = entry.checks.find((c) => c.id === 'evidence-row-inspection')!;
    expect(check.satisfied).toBe(false);
    expect(check.detail).toMatch(/NO evidence rows/);
  });
});

describe('the prohibition GATE — it refuses, and it says why', () => {
  const unclassified = { provenance: { discoveryProvenance: 'ide', domain: 'financial-services' }, status: 'proposed' };

  it('refuses all three prohibited uses, each with a reason a human can act on', () => {
    // The operator's own lesson (`7edfadf52`): a refusal must say why. A silent
    // exclusion from a population is indistinguishable from a bug. Mutation:
    // return a bare `{ allowed: false }` → the reason assertions fail.
    expect(RESTRICTED_INVARIANT_USES).toHaveLength(3);
    for (const use of RESTRICTED_INVARIANT_USES) {
      const gate = canUseInvariantFor(unclassified, use);
      expect(gate.allowed, `'${use}' is allowed for an unclassified invariant`).toBe(false);
      const reason = (gate as { reason: string }).reason;
      expect(reason, `'${use}' refused without a reason`).toMatch(/unclassified/);
      expect(reason.length, `'${use}' reason is too thin to act on`).toBeGreaterThan(80);
    }
    // Each of the three names its OWN consequence — three copies of one string
    // would pass the loop above and tell the reader nothing.
    const reasons = RESTRICTED_INVARIANT_USES.map((u) => (canUseInvariantFor(unclassified, u) as { reason: string }).reason);
    expect(new Set(reasons).size).toBe(3);
    expect(reasons[0]).toMatch(/experimental population/);
    expect(reasons[1]).toMatch(/classification queue/);
    expect(reasons[2]).toMatch(/self-affirming|confirmator/i);
  });

  it('REVIEW and COMPARISON stay permitted — the ruling allows them by name', () => {
    expect([...PERMITTED_UNCLASSIFIED_USES].sort()).toEqual(['comparison', 'review']);
    // …and neither is in the restricted set, or the queue could not be worked.
    for (const permitted of PERMITTED_UNCLASSIFIED_USES) {
      expect(RESTRICTED_INVARIANT_USES as readonly string[]).not.toContain(permitted);
    }
  });

  it('COMPOSES with the population machinery instead of forking it', () => {
    // Population A + canonical ⇒ allowed. Mutation: hardcode `allowed: false`
    // for everything → this fails, so the gate cannot become a blanket refusal
    // that merely looks safe.
    const popA = { provenance: { provenanceClass: 'external-established' }, status: 'canonical' };
    expect(canUseInvariantFor(popA, 'external-crystal-population').allowed).toBe(true);
    expect(canUseInvariantFor(popA, 'confirmatory-experimental-treatment').allowed).toBe(true);
    expect(canUseInvariantFor(popA, 'canonical-domain-invariant').allowed).toBe(true);

    // Population B is CLASSIFIED but not primary — refused, and the reason
    // names the population rather than repeating "unclassified".
    const popB = { provenance: { provenanceClass: 'platform-derived' }, status: 'canonical' };
    const gate = canUseInvariantFor(popB, 'external-crystal-population');
    expect(gate.allowed).toBe(false);
    expect((gate as { reason: string }).reason).toMatch(/Population B/);
    expect((gate as { reason: string }).reason).not.toMatch(/unclassified/);
    // The gate agrees with `inPrimaryPopulation` — one authority, not two.
    expect(inPrimaryPopulation(popB.provenance)).toBe(false);
    expect(inPrimaryPopulation(popA.provenance)).toBe(true);

    // Classified but still `proposed` — canonical use refused on STATUS, and
    // the reason says classification is not ratification.
    const proposedA = { provenance: { provenanceClass: 'external-established' }, status: 'proposed' };
    const canon = canUseInvariantFor(proposedA, 'canonical-domain-invariant');
    expect(canon.allowed).toBe(false);
    expect((canon as { reason: string }).reason).toMatch(/does not ratify/);
  });

  it('a reclassification through the RECORDED path is what clears the gate', () => {
    // End to end: the queue entry exists → a reclassification with real
    // external evidence lands → the invariant leaves the queue and the gate
    // opens. A quiet field edit is not available (§5 above proves the refusal).
    const before = { discoveryProvenance: 'ide', domain: 'financial-services', evidence_ids: ['e1'], discovery_candidate_id: 'c1' };
    expect(buildClassificationQueue([{ id: 'i', statement: 's', namespace: 'finance', status: 'proposed', provenance: before }]))
      .toHaveLength(1);
    expect(canUseInvariantFor({ provenance: before, status: 'proposed' }, 'external-crystal-population').allowed).toBe(false);

    const result = applyProvenanceReclassification(before, {
      to: 'external-established',
      evidenceRefs: ['https://www.bis.org/cpmi/publ/d216.htm'],
      rationale: 'Steward inspected the acquired CPMI document; the statement is compressed from it.',
      at: '2026-07-28T00:00:00.000Z',
      actor: 'steward-commitment',
    });
    expect(result.ok).toBe(true);
    const after = (result as { provenance: Record<string, unknown> }).provenance;
    expect(buildClassificationQueue([{ id: 'i', statement: 's', namespace: 'finance', status: 'proposed', provenance: after }]))
      .toHaveLength(0);
    expect(canUseInvariantFor({ provenance: after, status: 'proposed' }, 'external-crystal-population').allowed).toBe(true);
  });
});

// ─── 7. REACHABILITY — the door out of `unclassified` must have a caller ────
//
// Everything above proves `applyProvenanceReclassification` BEHAVES correctly.
// None of it proved anything could CALL it. Until 2026-07-28 nothing did: no
// route action, no UI control, anywhere in the codebase. So the queue could be
// rendered and never cleared, every promoted invariant stayed in NO
// experimental population, and the operator hit the same wall twice — once on
// the Financial Services cross-referenced batch, again on commercialisation.
//
// This is the Composed Liveness shape (corollary 4: "a checklist with no write
// path is doctrine, not machinery"). A behavioural canary on a function that
// nothing invokes is exactly the blind spot that let it ship.

describe('reachability — the classification act has a live caller', () => {
  const ROUTE = join(process.cwd(), 'app', 'api', 'invariants', 'discovery', 'route.ts');
  const TAB = join(process.cwd(), 'components', 'composer', 'InvariantDiscoveryTab.tsx');

  it('the discovery route exposes a classify action that invokes applyProvenanceReclassification', () => {
    const source = readFileSync(ROUTE, 'utf8');
    expect(source).toMatch(/case 'classify'/);
    expect(source).toMatch(/applyProvenanceReclassification\(/);
    // …and PERSISTS what it returns. Computing a new bag and dropping it would
    // pass a symbol-presence check while changing nothing.
    expect(source).toMatch(/updateInvariant\([\s\S]{0,120}provenance:\s*result\.provenance/);
  });

  it('the route names the classify action in its own action list — an unlisted action is undiscoverable', () => {
    const source = readFileSync(ROUTE, 'utf8');
    const actionList = /action must be one of: ([^']+)'/.exec(source)?.[1] ?? '';
    expect(actionList).toContain('classify');
  });

  it('the steward surface can invoke it — the queue renders a control, not just a checklist', () => {
    const source = readFileSync(TAB, 'utf8');
    expect(source).toMatch(/action:\s*"classify"/);
    // The control must be attached to the QUEUE entries; a classify handler
    // that nothing renders is the same defect one layer up.
    expect(source).toMatch(/renderClassifyPanel\(q\)/);
  });

  it('the actor recorded on a reclassification is never a raw T0 persona id', () => {
    const source = readFileSync(ROUTE, 'utf8');
    // `actor` is documented as "a T2-safe commitment or an agent id, never a
    // raw T0 id", and this bag is durable, widely-read invariant provenance.
    expect(source).toMatch(/actor:\s*personaPublicRef\(/);
    expect(source).not.toMatch(/actor:\s*persona\.personaId/);
  });
});

// ─── 8. PRE-POPULATION — a suggestion, never an assertion ───────────────────
//
// Operator, 2026-07-28: "the URL and rationale for inclusion was provided with
// the sources. Please use that to pre-populate these fields for operator
// validation and sign-off rather than having the operator have to re-enter
// these from scratch."
//
// The convenience is the easy part. The danger is that a pre-filled field is
// read as a fact: a plausible-looking URL the system produced rather than
// holds would launder an unverifiable citation into Population A, and it would
// do so through a field the operator has been trained to trust. So the
// property under test is not "the fields get filled" — it is that EVERY value
// the suggester emits came from a stored row, and that the emptiness of a
// record survives all the way to an empty field.

describe('classification suggestion — every emitted value comes from a stored row', () => {
  const source = (over: Partial<ClassificationSuggestionSource> = {}): ClassificationSuggestionSource => ({
    sourceRef: 'https://www.nber.org/papers/w17181',
    evidenceIds: ['e1'],
    evidenceTitles: ['Business Partners, Financing, and the Commercialization of Inventions'],
    candidateTitle: null,
    issuer: null,
    recordedProvenanceClass: null,
    reviewNotes: null,
    seedInstitution: null,
    seedClaim: null,
    ...over,
  });

  it('emits ONLY refs that appear in its input, byte for byte — the fabrication guard', () => {
    // THE canary of this whole feature. Mutation: have the composer derive,
    // normalise, or repair a URL (add a scheme, strip a query, guess a DOI) →
    // the emitted ref stops being byte-identical to the stored one and this
    // fails. A suggester that "helpfully" rewrites a citation is producing a
    // reference no row in the database contains.
    const stored = 'http://EXAMPLE.gov/a%20b?x=1#frag';
    const s = composeClassificationSuggestion({
      invariantId: 'inv-1',
      evidenceIds: ['e1'],
      resolvedEvidenceIds: ['e1'],
      evidenceIdsWithoutSourceRef: [],
      sources: [source({ sourceRef: stored, evidenceIds: ['e1'] })],
    });
    expect(s.suggestedEvidenceRefs).toEqual([stored]);
    for (const ref of s.suggestedEvidenceRefs) {
      expect(s.sources.some((src) => src.sourceRef === ref)).toBe(true);
    }
  });

  it('invents NOTHING when there are no sources — empty refs AND an empty rationale', () => {
    // Mutation: give the rationale a default preamble that renders even with no
    // sources → suggestedRationale becomes non-empty, the server's blank-
    // rationale refusal stops firing, and a classification can be recorded
    // whose stated justification was written by the suggester.
    const s = composeClassificationSuggestion({
      invariantId: 'inv-1', evidenceIds: [], resolvedEvidenceIds: [], evidenceIdsWithoutSourceRef: [], sources: [],
    });
    expect(s.suggestedEvidenceRefs).toEqual([]);
    expect(s.suggestedRationale).toBe('');
    expect(s.complete).toBe(false);
    expect(s.notes.join(' ')).toMatch(/NO evidence rows/);
  });

  it('drops a source whose stored ref is blank rather than substituting anything for it', () => {
    // Mutation: fall back to the evidence title, the invariant id, or a
    // constructed URL when source_ref is empty → a ref appears that no
    // discovery_evidence row carries.
    const s = composeClassificationSuggestion({
      invariantId: 'inv-1',
      evidenceIds: ['e1'],
      resolvedEvidenceIds: ['e1'],
      evidenceIdsWithoutSourceRef: [],
      sources: [source({ sourceRef: '   ', evidenceTitles: ['A title that is not a URL'] })],
    });
    expect(s.suggestedEvidenceRefs).toEqual([]);
    expect(s.suggestedRationale).toBe('');
  });

  it('dedupes a chunked document to ONE ref while keeping every evidence row id', () => {
    const s = composeClassificationSuggestion({
      invariantId: 'inv-1',
      evidenceIds: ['e1', 'e2', 'e3'],
      resolvedEvidenceIds: ['e1', 'e2', 'e3'],
      evidenceIdsWithoutSourceRef: [],
      sources: [source({ sourceRef: 'https://a.example/doc', evidenceIds: ['e1', 'e2', 'e3'] })],
    });
    expect(s.suggestedEvidenceRefs).toEqual(['https://a.example/doc']);
    expect(s.suggestedRationale).toMatch(/Evidence rows: e1, e2, e3/);
    expect(s.complete).toBe(true);
  });

  it('reproduces the stored acquisition claim and reviewer note VERBATIM, and asserts nothing beside them', () => {
    // Mutation: paraphrase, summarise, or add an evaluative clause ("this is an
    // independent external source") → the verbatim match fails. The rationale
    // is recorded permanently on the invariant; a sentence the operator did not
    // write and the record does not contain must never end up in it.
    const claim = 'Operator claim: "Business Partners, Financing, and the Commercialization of Inventions" — studies how partners affect commercialisation probability.';
    const note = 'Reviewed 2026-07-20; extraction clean, 41 pages.';
    const s = composeClassificationSuggestion({
      invariantId: 'inv-1',
      evidenceIds: ['e1'],
      resolvedEvidenceIds: ['e1'],
      evidenceIdsWithoutSourceRef: [],
      sources: [source({ seedInstitution: 'NBER', seedClaim: claim, reviewNotes: note, recordedProvenanceClass: 'external-empirical' })],
    });
    expect(s.suggestedRationale).toContain(claim);
    expect(s.suggestedRationale).toContain(note);
    expect(s.suggestedRationale).toContain('external-empirical');
    // No independence/quality verdict anywhere in the composed text.
    expect(s.suggestedRationale).not.toMatch(/independent|authoritative|qualifies|supports the class/i);
  });

  it('marks a suggestion PARTIAL and names the rows it could not account for', () => {
    // Mutation: report `complete: true` whenever any ref was found, or drop the
    // gap notes → the operator sees a full-looking citation set that silently
    // omits half the evidence, and records it as the invariant's basis.
    const s = composeClassificationSuggestion({
      invariantId: 'inv-1',
      evidenceIds: ['e1', 'e2', 'e3'],
      resolvedEvidenceIds: ['e1', 'e2'],
      evidenceIdsWithoutSourceRef: ['e2'],
      sources: [source({ evidenceIds: ['e1'] })],
    });
    expect(s.complete).toBe(false);
    expect(s.unresolvedEvidenceIds).toEqual(['e3']);
    expect(s.notes.join(' ')).toMatch(/e3/);
    expect(s.notes.join(' ')).toMatch(/e2/);
    // The gaps travel INSIDE the rationale too, so a suggestion recorded
    // verbatim still states what it could not account for.
    expect(s.suggestedRationale).toMatch(/Gaps in this record/);
    expect(s.suggestedRationale).toMatch(/e3/);
  });

  it('a suggestion built from repo-internal refs is STILL REFUSED on submit', () => {
    // Pre-population must not become a bypass. The refs below are exactly what
    // the suggester would emit if an invariant's evidence rows cited repo
    // files — and the anti-laundering gate must refuse them just as it refuses
    // a hand-typed set. Mutation: exempt suggested refs from looksInternal (or
    // have the route trust the suggestion) → this passes and the suggester
    // becomes a laundering path into Population A.
    const s = composeClassificationSuggestion({
      invariantId: 'inv-1',
      evidenceIds: ['e1', 'e2'],
      resolvedEvidenceIds: ['e1', 'e2'],
      evidenceIdsWithoutSourceRef: [],
      sources: [
        source({ sourceRef: 'codexes/packs/irl/foundation/PRD-IDE-002.md', evidenceIds: ['e1'] }),
        source({ sourceRef: 'CFS-048 Invariant Discovery Engine charter', evidenceIds: ['e2'] }),
      ],
    });
    expect(s.suggestedEvidenceRefs).toHaveLength(2);
    const r = applyProvenanceReclassification(
      { discoveryProvenance: 'ide' },
      {
        to: 'external-established',
        evidenceRefs: s.suggestedEvidenceRefs,
        rationale: s.suggestedRationale,
        at: '2026-07-28T00:00:00Z',
        actor: 'steward-commitment',
      },
    );
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/laundering/);
  });

  it('a COMPLETE suggestion is still only a suggestion — it classifies nothing on its own', () => {
    // The constitutional point (PRD-ICA-001 §6/§11: approval is a human act).
    // Composing a suggestion must not produce a provenance bag, a class, or a
    // population. Mutation: have the composer return a `to` / apply itself →
    // the classification stops being the operator's act.
    const s = composeClassificationSuggestion({
      invariantId: 'inv-1',
      evidenceIds: ['e1'],
      resolvedEvidenceIds: ['e1'],
      evidenceIdsWithoutSourceRef: [],
      sources: [source({ recordedProvenanceClass: 'external-established' })],
    });
    expect(s.complete).toBe(true);
    expect(Object.keys(s)).not.toContain('to');
    expect(Object.keys(s)).not.toContain('provenance');
    // The record it describes is untouched: still unclassified, still queued.
    const record = { id: 'inv-1', statement: 'x', namespace: 'finance', status: 'proposed', provenance: { discoveryProvenance: 'ide', evidence_ids: ['e1'] } };
    expect(experimentalPopulation(record.provenance)).toBeNull();
    expect(buildClassificationQueue([record])).toHaveLength(1);
  });
});

// ── The resolver: what it reads, and what it refuses to guess ───────────────

describe('suggestClassification — resolves the recorded chain, guesses nothing', () => {
  type Row = Record<string, unknown>;
  const admin = (tables: Record<string, Row[]>, opts: { evidenceError?: string } = {}) =>
    ({
      from: (table: string) => ({
        select: () => ({
          in: (col: string, vals: string[]) => {
            if (table === 'discovery_evidence' && opts.evidenceError) {
              return Promise.resolve({ data: null, error: { message: opts.evidenceError } });
            }
            return Promise.resolve({
              data: (tables[table] ?? []).filter((r) => vals.includes(String(r[col]))),
              error: null,
            });
          },
        }),
      }),
    }) as unknown as SupabaseClient;

  const provenance = (ids: string[]) => ({ discoveryProvenance: 'ide', evidence_ids: ids });

  it('reads source_ref off the evidence rows and attaches the acquisition record + seed claim', async () => {
    const s = await suggestClassification(
      admin({
        discovery_evidence: [{ id: 'e1', title: 'NBER w17181 (part 1/2)', source_ref: 'https://www.nber.org/papers/w17181' },
                             { id: 'e2', title: 'NBER w17181 (part 2/2)', source_ref: 'https://www.nber.org/papers/w17181' }],
        corpus_candidate_sources: [{ source_id: 'SRC-1', title: 'Business Partners…', issuer: 'NBER', canonical_url: 'https://www.nber.org/papers/w17181', provenance_class: 'external-empirical', human_review_notes: 'clean extraction', evidence_row_id: 'e1' }],
        corpus_acquisition_seeds: [{ document_url: 'https://www.nber.org/papers/w17181', institution_name: 'NBER', claim: 'Operator claim: unusually well targeted.' }],
      }),
      'inv-1',
      provenance(['e1', 'e2']),
    );
    expect(s.suggestedEvidenceRefs).toEqual(['https://www.nber.org/papers/w17181']);
    expect(s.sources[0].issuer).toBe('NBER');
    expect(s.sources[0].recordedProvenanceClass).toBe('external-empirical');
    expect(s.sources[0].seedClaim).toMatch(/unusually well targeted/);
    expect(s.sources[0].evidenceIds).toEqual(['e1', 'e2']);
    expect(s.complete).toBe(true);
  });

  it('reports a row with no source_ref as a gap instead of filling it in', async () => {
    // Mutation: fall back to the candidate title, the domain, or any composed
    // string when source_ref is null → `complete` goes true and an invented
    // citation reaches the form.
    const s = await suggestClassification(
      admin({ discovery_evidence: [{ id: 'e1', title: 'Pasted text', source_ref: null }] }),
      'inv-1',
      provenance(['e1']),
    );
    expect(s.suggestedEvidenceRefs).toEqual([]);
    expect(s.evidenceIdsWithoutSourceRef).toEqual(['e1']);
    expect(s.complete).toBe(false);
  });

  it('attaches NO acquisition record when several share the URL — and says why', async () => {
    // Fail-closed disambiguation. Mutation: take the first match → one
    // acquisition's reviewer notes and recorded class are attributed to
    // another's evidence, silently.
    const s = await suggestClassification(
      admin({
        discovery_evidence: [{ id: 'e1', title: 'doc', source_ref: 'https://a.example/doc' }],
        corpus_candidate_sources: [
          { source_id: 'SRC-1', title: 'First acquisition', issuer: 'A', canonical_url: 'https://a.example/doc', provenance_class: 'external-established', human_review_notes: 'note A', evidence_row_id: null },
          { source_id: 'SRC-2', title: 'Second acquisition', issuer: 'B', canonical_url: 'https://a.example/doc', provenance_class: 'platform-derived', human_review_notes: 'note B', evidence_row_id: null },
        ],
      }),
      'inv-1',
      provenance(['e1']),
    );
    expect(s.sources[0].issuer).toBeNull();
    expect(s.sources[0].recordedProvenanceClass).toBeNull();
    expect(s.sources[0].reviewNotes).toBeNull();
    expect(s.notes.join(' ')).toMatch(/2 acquisition records share the URL/);
    // The REF still stands — it came off the evidence row, not the ambiguous
    // acquisition record.
    expect(s.suggestedEvidenceRefs).toEqual(['https://a.example/doc']);
  });

  it('prefers the acquisition record LINKED to this invariant\'s own evidence row', async () => {
    const s = await suggestClassification(
      admin({
        discovery_evidence: [{ id: 'e1', title: 'doc', source_ref: 'https://a.example/doc' }],
        corpus_candidate_sources: [
          { source_id: 'SRC-1', title: 'Unlinked', issuer: 'A', canonical_url: 'https://a.example/doc', provenance_class: 'platform-derived', human_review_notes: null, evidence_row_id: null },
          { source_id: 'SRC-2', title: 'Linked', issuer: 'B', canonical_url: 'https://a.example/doc', provenance_class: 'external-established', human_review_notes: null, evidence_row_id: 'e1' },
        ],
      }),
      'inv-1',
      provenance(['e1']),
    );
    expect(s.sources[0].issuer).toBe('B');
    expect(s.sources[0].recordedProvenanceClass).toBe('external-established');
  });

  it('suggests nothing when the evidence rows cannot be read — and says so', async () => {
    const s = await suggestClassification(
      admin({}, { evidenceError: 'connection reset' }),
      'inv-1',
      provenance(['e1']),
    );
    expect(s.suggestedEvidenceRefs).toEqual([]);
    expect(s.suggestedRationale).toBe('');
    expect(s.notes.join(' ')).toMatch(/connection reset/);
  });

  it('rejects an unratified provenance_class on the acquisition record rather than passing it through', async () => {
    const s = await suggestClassification(
      admin({
        discovery_evidence: [{ id: 'e1', title: 'doc', source_ref: 'https://a.example/doc' }],
        corpus_candidate_sources: [{ source_id: 'SRC-1', title: 't', issuer: null, canonical_url: 'https://a.example/doc', provenance_class: 'externally-vibes-checked', human_review_notes: null, evidence_row_id: 'e1' }],
      }),
      'inv-1',
      provenance(['e1']),
    );
    expect(s.sources[0].recordedProvenanceClass).toBeNull();
  });
});

// ── fieldOrigin — "cited" and "accepted what was offered" are different acts ──

describe('fieldOrigin — the log distinguishes a reviewed citation from an accepted default', () => {
  const suggestion = { suggestedEvidenceRefs: ['https://a.example/doc'], suggestedRationale: 'Assembled from the stored record.' };

  it('records `suggested` when both fields were submitted exactly as offered', () => {
    expect(deriveFieldOrigin({ evidenceRefs: ['https://a.example/doc'], rationale: 'Assembled from the stored record.' }, suggestion))
      .toEqual({ evidenceRefs: 'suggested', rationale: 'suggested' });
  });

  it('records `edited` when the steward changed what was offered', () => {
    // Mutation: report `suggested` regardless → the log stops distinguishing a
    // citation the steward verified from one they never looked at.
    expect(deriveFieldOrigin({ evidenceRefs: ['https://b.example/other'], rationale: 'I checked this myself.' }, suggestion))
      .toEqual({ evidenceRefs: 'edited', rationale: 'edited' });
  });

  it('records `operator` when no suggestion was in play', () => {
    expect(deriveFieldOrigin({ evidenceRefs: ['https://a.example/doc'], rationale: 'typed' }, null))
      .toEqual({ evidenceRefs: 'operator', rationale: 'operator' });
    expect(deriveFieldOrigin({ evidenceRefs: ['x'], rationale: 'y' }, { suggestedEvidenceRefs: [], suggestedRationale: '' }))
      .toEqual({ evidenceRefs: 'operator', rationale: 'operator' });
  });

  it('travels into the append-only log WITHOUT changing the reclassification signature or any refusal', () => {
    // Mutation: drop the spread that carries the event into the record → the
    // annotation is accepted and silently discarded.
    const r = applyProvenanceReclassification(
      { discoveryProvenance: 'ide' },
      {
        to: 'external-empirical',
        evidenceRefs: ['https://www.nber.org/papers/w17181'],
        rationale: 'Assembled from the stored acquisition record.',
        at: '2026-07-28T00:00:00Z',
        actor: 'steward-commitment',
        fieldOrigin: { evidenceRefs: 'suggested', rationale: 'edited' },
      },
    );
    expect(r.ok).toBe(true);
    const log = readReclassifications((r as { provenance: Record<string, unknown> }).provenance);
    expect(log[0].fieldOrigin).toEqual({ evidenceRefs: 'suggested', rationale: 'edited' });
    // …and the refusals are untouched: the same event with no refs is refused.
    const refused = applyProvenanceReclassification({ discoveryProvenance: 'ide' }, {
      to: 'external-empirical', evidenceRefs: [], rationale: 'x', at: 'now', actor: 'a',
      fieldOrigin: { evidenceRefs: 'suggested', rationale: 'suggested' },
    });
    expect(refused.ok).toBe(false);
  });
});

// ── Reachability + non-submission, at the two live callers ──────────────────

describe('the suggestion is reachable, and is never a submission', () => {
  const ROUTE = join(ROOT, 'app', 'api', 'invariants', 'discovery', 'route.ts');
  const TAB = join(ROOT, 'components', 'composer', 'InvariantDiscoveryTab.tsx');

  it('the route exposes suggest-classification and NAMES it in its own action list', () => {
    const src = readFileSync(ROUTE, 'utf8');
    expect(src).toMatch(/case 'suggest-classification'/);
    expect(src).toMatch(/suggestClassification\(/);
    const actionList = /action must be one of: ([^']+)'/.exec(src)?.[1] ?? '';
    expect(actionList).toContain('suggest-classification');
  });

  it('the suggest branch performs NO write — it cannot classify, only propose', () => {
    // Mutation: have the suggest branch call updateInvariant or
    // applyProvenanceReclassification "since it already has the values" → the
    // operator's submit stops being the constitutional act.
    const src = readFileSync(ROUTE, 'utf8');
    const branch = src.slice(src.indexOf("case 'suggest-classification'"), src.indexOf("case 'classify'"));
    expect(branch.length).toBeGreaterThan(200);
    expect(branch).not.toMatch(/updateInvariant\(/);
    expect(branch).not.toMatch(/applyProvenanceReclassification\(/);
  });

  it('the steward surface asks for the suggestion and pre-fills BOTH fields from it', () => {
    // Scoped to the OPENER, not the file. `suggestedRationale` also appears in
    // the response type declaration, so a file-wide symbol check passes even
    // when the rationale is never actually pre-filled — the symbol-presence
    // defect this file's header names (CFS-053 CB-5). Both names must be
    // CONSUMED where the form state is built.
    const src = readFileSync(TAB, 'utf8');
    const opener = src.slice(src.indexOf('const openClassifyPanel'), src.indexOf('const classify ='));
    expect(opener.length).toBeGreaterThan(200);
    expect(opener).toMatch(/action:\s*"suggest-classification"/);
    expect(opener).toMatch(/suggestion\?\.suggestedEvidenceRefs/);
    expect(opener).toMatch(/suggestion\?\.suggestedRationale/);
    // And it is wired to the queue's classify control, not merely defined.
    expect(src).toMatch(/openClassifyPanel\(q\)/);
  });

  it('the surface never PRE-SELECTS the evidence-provenance class', () => {
    // With refs and rationale pre-filled, a defaulted class would let the whole
    // classification be committed by one click on a form nobody read. The
    // clerical fields are transcription; the class is the judgement.
    // Mutation: restore `to: "external-established"` on open → this fails.
    const src = readFileSync(TAB, 'utf8');
    const opener = src.slice(src.indexOf('const openClassifyPanel'), src.indexOf('const classify ='));
    expect(opener).toMatch(/to:\s*""/);
    expect(opener).not.toMatch(/to:\s*"(external|platform)-/);
    // …and the submit control is inert until a class is chosen.
    expect(src).toMatch(/disabled=\{busy !== null \|\| !f\.to\}/);
  });

  it('a late suggestion never overwrites what the steward has already typed', () => {
    // Mutation: assign the suggestion unconditionally → a slow response wipes
    // the operator's own citation mid-edit.
    const src = readFileSync(TAB, 'utf8');
    const opener = src.slice(src.indexOf('const openClassifyPanel'), src.indexOf('const classify ='));
    expect(opener).toMatch(/evidenceRefs:\s*f\.evidenceRefs\s*\|\|/);
    expect(opener).toMatch(/rationale:\s*f\.rationale\s*\|\|/);
  });

  it('the classify branch DERIVES fieldOrigin server-side rather than trusting the client', () => {
    // Mutation: read fieldOrigin off the request body → the client can assert
    // 'operator' for a field it pre-filled, which is the exact fact recorded.
    const src = readFileSync(ROUTE, 'utf8');
    expect(src).toMatch(/deriveFieldOrigin\(/);
    expect(src).not.toMatch(/body\.fieldOrigin/);
  });
});
