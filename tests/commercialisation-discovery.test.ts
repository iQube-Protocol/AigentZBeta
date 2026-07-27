/**
 * PRD-IDE-002 canaries — Commercialisation as a HORIZONTAL capability discovery
 * domain, and the Cross-Domain Recurrence Score.
 *
 * What these guard, and why each one exists:
 *
 *  1. The Discovery Domain Registry is the ONE authoritative domain list.
 *     Before PRD-IDE-002 the list was hand-copied into the discovery route, the
 *     Corpus Scout tab and the discovery tab. Three copies of one list is the
 *     stale-duplicate defect `tests/source-of-truth-parity.test.ts` exists to
 *     fail the build on (inv.engineering.036 / .037).
 *
 *  2. Recurrence is DERIVED, never stored. "In how many distinct domains does
 *     evidence for this candidate exist" is a question the evidence rows already
 *     answer. A persisted score is a second source of truth that goes stale
 *     silently the moment evidence is added — the same defect class, applied to
 *     a number instead of a list.
 *
 *  3. Amendment D §D.4a is MECHANICAL, not a matter of reviewer judgement: one
 *     domain ⇒ `specialized`, and an L4 (domain-independent) claim requires a
 *     second domain. Encoded in `computeRecurrence`, pinned here.
 *
 *  4. Nothing this programme discovers becomes canonical. CLAUDE.md's
 *     hypothesis-vs-canon rule and CFS-052 §2.1: commercial success is
 *     constitutional evidence for a constitutional invariant's USE; it never
 *     promotes an empirical claim to `canonical`.
 *
 *  5. Docs-mirror parity — the PRD's constitutional definition and its
 *     sub-domain taxonomy cannot drift from the executable registry.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readSource, stripComments } from './_lib/sourceAuthority';
import {
  DISCOVERY_DOMAINS,
  DEFAULT_DISCOVERY_DOMAIN,
  discoveryDomain,
  subDomainPresets,
  evidenceDomainsFor,
  observationDomainKey,
  parseObservationDomain,
} from '../services/invariants/discoveryDomains';
import { computeRecurrence, type EvidenceRow } from '../services/invariants/discoveryEngine';
import { INVARIANT_NAMESPACES, COMPOSITION_LAWS } from '../types/invariants';

const ROOT = join(__dirname, '..');
const PRD_PATH = join(ROOT, 'codexes/packs/irl/foundation/PRD-IDE-002_commercialisation-invariant-discovery.md');
const PRD = readFileSync(PRD_PATH, 'utf8');

function ev(id: string, domain: string, title = id): EvidenceRow {
  return { id, domain, subDomain: null, title, sourceKind: 'other', content: 'x', sourceRef: null, createdAt: '' };
}

// ── 1 · The registry ────────────────────────────────────────────────────────

describe('PRD-IDE-002 · Discovery Domain Registry', () => {
  it('registers Commercialisation as a HORIZONTAL capability domain, not a vertical', () => {
    const c = discoveryDomain('commercialisation');
    expect(c, 'commercialisation must be registered in DISCOVERY_DOMAINS').not.toBeNull();
    expect(
      c!.kind,
      'Commercialisation is a parallel HORIZONTAL programme, not an extension of the Financial Services vertical — ' +
        'registering it as a vertical would give it its own corpus and destroy the cross-domain recurrence signal',
    ).toBe('horizontal-capability');
  });

  it('Financial Services stays a vertical, and stays the default domain (no behaviour change)', () => {
    expect(discoveryDomain('financial-services')?.kind).toBe('vertical');
    expect(DEFAULT_DISCOVERY_DOMAIN).toBe('financial-services');
  });

  it('Commercialisation is observed in exactly Addendum A\'s three platform domains', () => {
    expect([...discoveryDomain('commercialisation')!.observedIn].sort()).toEqual([
      'financial-services',
      'human-mobility-services',
      'media',
    ]);
  });

  it('every registered domain has a non-empty sub-domain ladder and unique keys', () => {
    for (const d of DISCOVERY_DOMAINS) {
      expect(d.subDomains.length, `${d.key} must offer a sub-domain ladder`).toBeGreaterThan(0);
      const keys = d.subDomains.map((s) => s.value);
      expect(new Set(keys).size, `${d.key} has a duplicate sub-domain key`).toBe(keys.length);
    }
    const domainKeys = DISCOVERY_DOMAINS.map((d) => d.key);
    expect(new Set(domainKeys).size).toBe(domainKeys.length);
  });

  it('is NOT coupled to the runtime domain-resolution registry (SPEC-CDR-001)', () => {
    const src = readSource('services/invariants/discoveryDomains.ts');
    expect(
      stripComments(src),
      'domain_profiles / SPEC-CDR-001 answers a RUNTIME question ("which domain is this operator acting in"); ' +
        'this registry answers a RESEARCH question. They are deliberately uncoupled — do not import one into the other',
    ).not.toMatch(/domainProfileRegistry|domain_profiles|services\/resolution/);
  });
});

// ── 2 · Observation-domain keys + corpus routing ─────────────────────────────

describe('PRD-IDE-002 · observation-domain keys', () => {
  it('round-trips a qualified key', () => {
    const key = observationDomainKey('commercialisation', 'media');
    expect(key).toBe('commercialisation/media');
    expect(parseObservationDomain(key)).toEqual({ discoveryDomain: 'commercialisation', observedDomain: 'media' });
  });

  it('an UNQUALIFIED key parses to itself — a vertical candidate is observed in one domain', () => {
    expect(parseObservationDomain('financial-services')).toEqual({
      discoveryDomain: 'financial-services',
      observedDomain: 'financial-services',
    });
  });

  it('a vertical reads its OWN corpus — byte-for-byte the pre-existing behaviour', () => {
    expect(evidenceDomainsFor('financial-services')).toEqual(['financial-services']);
  });

  it('an UNREGISTERED domain still reads its own corpus (the engine never fails closed on a free-text domain)', () => {
    expect(evidenceDomainsFor('medicine')).toEqual(['medicine']);
  });

  it('a horizontal domain reads the qualified corpus of each vertical it is observed in', () => {
    expect(evidenceDomainsFor('commercialisation').sort()).toEqual([
      'commercialisation/financial-services',
      'commercialisation/human-mobility-services',
      'commercialisation/media',
    ]);
  });

  it('so a Financial Services run can never sweep up commercialisation observations made inside it', () => {
    expect(evidenceDomainsFor('financial-services')).not.toContain('commercialisation/financial-services');
  });
});

// ── 3 · Cross-Domain Recurrence — derived, and mechanical about §D.4a ────────

describe('PRD-IDE-002 Addendum A · Cross-Domain Recurrence Score', () => {
  const evidence: EvidenceRow[] = [
    ev('f1', 'commercialisation/financial-services'),
    ev('f2', 'commercialisation/financial-services'),
    ev('m1', 'commercialisation/media'),
    ev('h1', 'commercialisation/human-mobility-services'),
    ev('v1', 'financial-services'),
  ];

  it('counts DISTINCT domains, not documents — two FS sources are still one domain', () => {
    const r = computeRecurrence(['f1', 'f2'], evidence);
    expect(r.recurrenceCount).toBe(1);
    expect(r.observedDomains).toEqual(['financial-services']);
    expect(r.tier).toBe('single-domain');
  });

  it('scores 1 → 2 → 3 domains as single- / cross- / broad-cross-domain', () => {
    expect(computeRecurrence(['f1'], evidence).tier).toBe('single-domain');
    expect(computeRecurrence(['f1', 'm1'], evidence).tier).toBe('cross-domain');
    expect(computeRecurrence(['f1', 'm1', 'h1'], evidence).tier).toBe('broad-cross-domain');
  });

  it('lists the observed domains, sorted and deduped', () => {
    expect(computeRecurrence(['h1', 'f1', 'm1', 'f2'], evidence).observedDomains).toEqual([
      'financial-services',
      'human-mobility-services',
      'media',
    ]);
  });

  it('ignores a stale evidence reference rather than inflating the score', () => {
    expect(computeRecurrence(['f1', 'does-not-exist'], evidence).recurrenceCount).toBe(1);
  });

  it('an unqualified (vertical) evidence row contributes its own domain', () => {
    expect(computeRecurrence(['v1'], evidence).observedDomains).toEqual(['financial-services']);
  });

  it('Amendment D §D.4a — ONE domain floors the classification at `specialized` and caps abstraction at L3', () => {
    const r = computeRecurrence(['f1', 'f2'], evidence);
    expect(r.classificationFloor).toBe('specialized');
    expect(
      r.maxAbstractionLevel,
      'a domain-independent (L4) claim requires a second domain — a single-sector finding is specialised, never universal',
    ).toBe('L3');
  });

  it('Amendment D §D.4a — a SECOND domain lifts the floor to `supported` and unlocks L4', () => {
    const r = computeRecurrence(['f1', 'm1'], evidence);
    expect(r.classificationFloor).toBe('supported');
    expect(r.maxAbstractionLevel).toBe('L4');
  });

  it('no evidence at all scores zero and stays at the specialized/L3 floor', () => {
    const r = computeRecurrence([], evidence);
    expect(r.recurrenceCount).toBe(0);
    expect(r.classificationFloor).toBe('specialized');
    expect(r.maxAbstractionLevel).toBe('L3');
  });

  it('recurrence is DERIVED — no persisted column, so a score can never drift from its evidence', () => {
    const src = stripComments(readSource('services/invariants/discoveryEngine.ts'));
    for (const column of ['recurrence_score', 'recurrence_count', 'recurrence_tier', 'observed_domains']) {
      expect(
        src,
        `'${column}' looks like a PERSISTED recurrence score. Recurrence is a query over the candidate's evidence ` +
          'rows, not stored state — a stored score is a second source of truth that goes stale silently ' +
          '(inv.engineering.036). If persistence is genuinely required, justify it and add a parity canary.',
      ).not.toContain(column);
    }
  });
});

// ── 4 · Every surface DERIVES the domain list ───────────────────────────────

describe('PRD-IDE-002 · one authoritative domain list (inv.engineering.036)', () => {
  it('the discovery route derives its presets + default from the registry', () => {
    const src = stripComments(readSource('app/api/invariants/discovery/route.ts'));
    expect(src).toContain('subDomainPresets');
    expect(src).toContain('DEFAULT_DISCOVERY_DOMAIN');
    expect(
      src,
      'SUB_DOMAIN_PRESETS was a hand-maintained literal map in the route. It is now derived from the registry — ' +
        'reintroducing it forks the taxonomy from the one the PRD and the canaries pin',
    ).not.toContain('SUB_DOMAIN_PRESETS');
  });

  it('the discovery route exposes the registry so the client never hardcodes a domain', () => {
    const src = stripComments(readSource('app/api/invariants/discovery/route.ts'));
    expect(src).toContain('DISCOVERY_DOMAINS');
  });

  it('the Corpus Scout tab derives its known-domain list from the registry', () => {
    const src = stripComments(readSource('app/triad/components/codex/tabs/CorpusScoutTab.tsx'));
    expect(src).toContain('DISCOVERY_DOMAINS');
    expect(
      src,
      "KNOWN_DOMAINS was the literal ['financial-services']. A hand-listed copy silently omits every newly " +
        'registered domain, which is exactly how a steward ends up unable to select a chartered domain',
    ).not.toMatch(/KNOWN_DOMAINS\s*=\s*\[\s*'financial-services'/);
  });

  it('the discovery tab defaults from the registry rather than a hardcoded domain', () => {
    const src = stripComments(readSource('components/composer/InvariantDiscoveryTab.tsx'));
    expect(src).toContain('DEFAULT_DISCOVERY_DOMAIN');
    expect(
      src,
      'a hardcoded useState("financial-services") makes the surface single-domain forever — the second discovery ' +
        'domain is unreachable from the UI even though the engine supports it',
    ).not.toMatch(/useState\(\s*["']financial-services["']\s*\)/);
  });
});

// ── 5 · Nothing here becomes canonical ──────────────────────────────────────

describe('PRD-IDE-002 · everything stays proposed', () => {
  it('promotion still lands `proposed` at `agent_verified` — unchanged by this programme', () => {
    const src = stripComments(readSource('services/invariants/discoveryEngine.ts'));
    expect(src).toMatch(/status:\s*'proposed'/);
    expect(src).toMatch(/confidenceBasis:\s*'agent_verified'/);
    expect(
      src,
      'no discovery path may write `canonical` — canonisation is a separate, earned, operator act (Law XI)',
    ).not.toMatch(/status:\s*'canonical'/);
  });

  it('the PRD states the no-auto-canonisation rule in its own text', () => {
    expect(PRD).toMatch(/proposed/i);
    expect(PRD.toLowerCase()).toContain('no invariant produced by this programme becomes canonical');
  });
});

// ── 7 · The seeded crystal population (operator ruling, 2026-07-27) ──────────
//
// This block REPLACES an earlier canary that asserted the seed file carried NO
// commercialisation entry. That canary was correct until the operator ruled;
// it is deliberately INVERTED rather than deleted, because the property worth
// guarding never was "the file is empty" — it was "an agent does not decide
// what enters the crystal, and nothing enters as canon". Both halves now have
// teeth: the eight the operator named must be present, at `proposed`, and the
// three the operator excluded must be absent.

interface SeedRecord {
  id: string;
  namespace: string;
  semantic_type: string;
  statement: string;
  status: string;
  contexts: string[];
  provenance: { source: string };
}
const SEED = JSON.parse(
  readFileSync(join(ROOT, 'codexes/packs/irl/foundation/canonical-invariants.seed.json'), 'utf8'),
) as { namespaces: string[]; invariants: SeedRecord[] };
const COMM = SEED.invariants.filter((i) => i.namespace === 'commercialisation');

describe('PRD-IDE-002 · the seeded commercialisation population', () => {
  it('seeds exactly the EIGHT recurrence-3 candidates the operator named', () => {
    expect(
      COMM.map((i) => i.id).sort(),
      'The ruling: "Seed the eight recurrence-3 proposed candidates, excluding the candidate classified ' +
        'equivalent to CFS-052 III.4." Eight, not seven and not nine — the first freeze optimises for clear ' +
        'class representation, not library completeness',
    ).toEqual([
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

  it('EVERY seeded record is `proposed` — inclusion in the experimental crystal is not ratification', () => {
    for (const r of COMM) {
      expect(
        r.status,
        `${r.id} must be 'proposed'. The ruling is explicit: "The seed should preserve their native status as ` +
          'proposed candidates. Inclusion in the experimental crystal must not imply ratification." A ' +
          "commercialisation record at 'canonical' or 'validated' is a Law XI violation, not a status tweak",
      ).toBe('proposed');
    }
  });

  it('the three EXCLUDED candidates are absent — equivalent + both specialised', () => {
    const statements = COMM.map((i) => i.statement).join('   ');
    // C-006: classified `equivalent` to CFS-052 III.4 — seeding it would enter
    // the same invariant twice under two ids.
    expect(statements, 'C-006 is equivalent to CFS-052 III.4 and was excluded by the ruling').not.toMatch(
      /regenerable from its evidence trail/i,
    );
    // C-009 / C-010: single-domain, `specialized` by §D.4a. "I would not seed
    // the two single-domain specialised candidates into the initial frozen
    // crystal. Keep them in the discovered library."
    expect(statements, 'C-009 is single-domain (media only) and stays in the discovered library').not.toMatch(
      /ring-fenced|Campaign-exclusive/i,
    );
    expect(statements, 'C-010 is single-domain (HMS only) and stays in the discovered library').not.toMatch(
      /inverts its own logistics/i,
    );
  });

  it('but the excluded candidates are RETAINED in the discovered library (the PRD), not deleted', () => {
    for (const key of ['C-006', 'C-009', 'C-010']) {
      expect(
        PRD,
        `${key} is excluded from the frozen crystal but must remain in PRD §9.1's discovered library and ` +
          'available for domain-specific experiments — excluded is not the same as discarded',
      ).toContain(key);
    }
  });

  it('the namespace is FIRST-CLASS and flat — never nested under an application domain', () => {
    expect(SEED.namespaces).toContain('commercialisation');
    for (const ns of SEED.namespaces) {
      expect(ns, `namespace '${ns}' is dotted — the seed's convention is a flat single segment`).not.toContain('.');
    }
    for (const r of COMM) {
      expect(
        r.id,
        `${r.id} must follow the seed's inv.<namespace>.<n> convention with commercialisation as the ` +
          'constitutional parent. `inv.finance.commercialisation.*` would subordinate a cross-domain class to ' +
          'its FIRST APPLICATION DOMAIN and make later portability awkward (operator ruling)',
      ).toMatch(/^inv\.commercialisation\.\d{3}$/);
    }
  });

  it('records retain observed-domain provenance, DERIVED from the registry not hand-typed', () => {
    const observedIn = [...discoveryDomain('commercialisation')!.observedIn].sort();
    for (const r of COMM) {
      const observed = r.contexts.filter((c) => observedIn.includes(c)).sort();
      expect(
        observed,
        `${r.id}'s observed-domain contexts must equal the registry's observedIn. Hand-typing them (e.g. ` +
          "'human-mobility' for 'human-mobility-services') forks the domain key from the one computeRecurrence " +
          'parses, and the record stops being partitionable by evidence domain',
      ).toEqual(observedIn);
      expect(r.contexts[0], `${r.id} must carry its population marker first`).toBe('commercialisation');
    }
  });

  it('each record names a REGISTERED sub-domain, so the taxonomy and the crystal cannot drift', () => {
    const keys = new Set(subDomainPresets('commercialisation').map((s) => s.value));
    for (const r of COMM) {
      const sub = r.contexts.filter((c) => keys.has(c));
      expect(sub, `${r.id} must carry exactly one registered §4 sub-domain in contexts`).toHaveLength(1);
    }
  });

  it('provenance carries the four experimental-metadata fields the ruling specified', () => {
    for (const r of COMM) {
      const s = r.provenance.source;
      // canonicalStatus maps onto the record's OWN `status` field (asserted
      // above) rather than being duplicated as a second status; the other three
      // ride in provenance.source, which is the only provenance slot the seed
      // file's uniform {source} shape has.
      expect(s, `${r.id}: inclusionBasis`).toContain('inclusionBasis=cross-domain-recurrence');
      expect(s, `${r.id}: recurrence`).toContain('recurrence=3');
      expect(s, `${r.id}: experimentalStatus`).toContain('experimentalStatus=seeded-for-evaluation');
      expect(s, `${r.id}: observedDomains`).toContain('observedDomains=');
      expect(s, `${r.id} must record that inclusion is experimental, not ratification`).toMatch(
        /NOT ratification/,
      );
      expect(s, `${r.id} must keep the shared-platform common-cause limitation attached to the record`).toMatch(
        /UNVALIDATED/,
      );
      expect(s, `${r.id} must trace to its PRD candidate`).toMatch(/PRD-IDE-002 §9\.1 C-\d{3}/);
    }
  });

  it('the class declares its ALGEBRA before its members land (CFS-013 §3)', () => {
    expect(INVARIANT_NAMESPACES).toContain('commercialisation');
    expect(
      COMPOSITION_LAWS.commercialisation,
      'CFS-013 §3 — a class cannot be added without declaring its composition law. `contextual`: a horizontal ' +
        'capability invariant resolves per APPLICATION CONTEXT (the vertical). Deliberately not `normative`, ' +
        'which would assert law-like force for claims that are still proposed hypotheses',
    ).toBe('contextual');
  });

  // ── The two directions of the canonisation gate (operator ruling 2026-07-27) ──
  //
  // "The crystal is REFLECTING constitutional canon, not creating it."
  //
  //   Constitution → ratifies → Law N → Invariant Representation → Canonical
  //
  // Direction 1 stops the commercialisation class from drifting into canon: its
  // canonical basis does not exist, which is the whole point of the class.
  // Direction 2 stops the Law promotion from becoming a licence to promote
  // anything: a record may only be canonical-by-reflection if it says WHICH
  // ratified doctrine it reflects. A promotion with no `derived_from` is the
  // unfalsifiable claim this provenance exists to prevent.

  it('DIRECTION 1 — no commercialisation record is canonical or validated', () => {
    for (const r of COMM) {
      expect(
        r.status,
        `${r.id} is canonical-by-nothing. A commercialisation invariant has no ratified constitutional doctrine ` +
          'to reflect — it is a proposed empirical hypothesis with a known common-cause limitation. Promoting one ' +
          'would be the crystal CREATING canon rather than reflecting it',
      ).toBe('proposed');
    }
  });

  it('DIRECTION 2 — every CFS-009 Law representation that is canonical names the Law it represents', () => {
    // Scope: records whose provenance ATTRIBUTES them to a Law — the Law
    // reference is the leading source, optionally behind one "<SPEC> / " prefix
    // (e.g. "CFS-014 / Law XIV"). Deliberately NOT any mention of a Law: four
    // canonical records merely CROSS-REFERENCE one ("…respecting Law XII",
    // "Sharpens inv.constitutional.061"), and a canary that demanded a
    // canonical_basis from those would cry wolf on compliant records. The
    // exact-set assertion in the next test is what stops this predicate from
    // going quietly inert.
    const ATTRIBUTED_TO_LAW = /^(?:[A-Za-z][\w-]*(?:\s+[\w§.]+)?\s*\/\s*)?(?:CFS-009\s+)?Law\s+[IVXL]+\b/;
    const lawRecords = SEED.invariants.filter(
      (r) => ATTRIBUTED_TO_LAW.test(r.provenance.source) && r.status === 'canonical',
    ) as (SeedRecord & {
      provenance: { source: string; canonical_basis?: { source: string; ratified: boolean }; derived_from?: { law: string } };
    })[];
    const LAWS = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI'];
    for (const r of lawRecords) {
      expect(
        r.provenance.canonical_basis,
        `${r.id} is canonical but carries no canonical_basis. Under the ruling a crystal record becomes ` +
          'canonical because it is the MACHINE REPRESENTATION of already-ratified constitutional doctrine — ' +
          'never because the crystal independently ratifies it. No basis, no promotion',
      ).toEqual({ source: 'CFS-009', ratified: true });
      expect(
        r.provenance.derived_from?.law,
        `${r.id} is canonical with no derived_from.law. "Every promoted record must carry which Law it ` +
          'represents; a promotion with no derived_from is exactly the unfalsifiable claim this provenance ' +
          'exists to prevent."',
      ).toBeTruthy();
      expect(LAWS, `${r.id} names a Law outside CFS-009's I–XVI`).toContain(r.provenance.derived_from!.law);
    }
    // Checked LAST, so a promotion that skipped its basis is reported as that
    // specific defect above rather than as a bare count mismatch here. A zero
    // would mean the predicate has gone inert (MS-7) and the loop above is
    // guarding nothing.
    expect(
      lawRecords.length,
      'the predicate must select exactly the Law-attributed canonical records. A zero means the canary went ' +
        'inert; a higher number means a record was promoted into the Law population without being one',
    ).toBe(20);
  });

  it('all fifteen Laws are represented, and the count of representations is pinned', () => {
    const promoted = SEED.invariants.filter(
      (r) => r.status === 'canonical' && (r.provenance as { derived_from?: { law: string } }).derived_from,
    );
    const laws = new Set(
      promoted.map((r) => (r.provenance as unknown as { derived_from: { law: string } }).derived_from.law),
    );
    expect([...laws].length, 'Laws I–XV each need at least one canonical representation').toBe(15);
    // 20, not 15: Laws XII, XIII and XV are multi-clause, and the crystal's own
    // one-sentence canonicalization rule (canonicalizeStatement flags compound
    // statements) forces a multi-clause Law into several atomic records.
    // Pinned exactly, so a 21st promotion is a deliberate act with a diff.
    expect(promoted.length).toBe(20);
    // Law XVI has NO seed entry at all yet (CFS-052 §9 leaves it to the
    // operator), so there is nothing to promote — asserting it here would
    // manufacture a record.
    expect([...laws]).not.toContain('XVI');
  });

  it('the SQL namespace CHECK admits exactly the TS namespaces (constraint-drift bug class)', () => {
    const sql = readFileSync(
      join(ROOT, 'supabase/migrations/20260801000000_commercialisation_invariant_namespace.sql'),
      'utf8',
    );
    const listed = [...sql.matchAll(/namespace IN \(([^)]*)\)/g)].map((m) =>
      m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')),
    );
    expect(listed.length, 'the migration must widen all three namespace CHECK constraints').toBe(3);
    for (const l of listed) {
      expect(
        [...l].sort(),
        'a namespace present in INVARIANT_NAMESPACES but absent from the CHECK constraint fails at INSERT time ' +
          'with a constraint violation, not at build time — the 2026-07-13 and 2026-07-21 drift incidents',
      ).toEqual([...INVARIANT_NAMESPACES].sort());
    }
  });
});

// ── 6 · Docs-mirror parity (the PRD ↔ the executable registry) ───────────────

describe('PRD-IDE-002 · docs-mirror parity', () => {
  it('the registry carries the operator\'s constitutional definition VERBATIM from the PRD', () => {
    const definition = discoveryDomain('commercialisation')!.definition;
    expect(
      PRD.includes(definition),
      'The constitutional definition of the domain must be identical in the PRD and in the code. It is the one ' +
        'sentence that keeps the programme from drifting into conventional business methodology.',
    ).toBe(true);
  });

  it('the PRD taxonomy table and the registry sub-domains are the same set', () => {
    // §4 is the taxonomy section; extract the backticked key in each table row.
    const section = PRD.split(/^## 4\. /m)[1]?.split(/^## /m)[0] ?? '';
    expect(section, 'PRD §4 (the sub-domain taxonomy) not found').not.toBe('');
    const documented = new Set([...section.matchAll(/^\|\s*`([a-z-]+)`\s*\|/gm)].map((m) => m[1]));
    const registered = new Set(subDomainPresets('commercialisation').map((s) => s.value));
    expect([...documented].sort()).toEqual([...registered].sort());
  });

  it('the PRD records the taxonomy VERDICT — a list returned unchanged means it was never tested', () => {
    const section = PRD.split(/^## 5\. /m)[1]?.split(/^## /m)[0] ?? '';
    expect(section, 'PRD §5 (the taxonomy verdict) not found').not.toBe('');
    // Each verdict must be its own DECLARED, COUNTED subsection — not merely a
    // word appearing somewhere in the section. (A first draft asserted only
    // `section.toContain('Rejected')`, which a table header row satisfied: the
    // canary survived a mutation that deleted the entire Rejected verdict.
    // MS-7 — an inert mechanism is a defect.)
    for (const verdict of ['Merged', 'Rejected', 'Split', 'Added']) {
      const heading = new RegExp(`^### ${verdict} \\((\\d+)\\)`, 'm');
      const m = section.match(heading);
      expect(
        m,
        `§5 must carry a "### ${verdict} (n)" subsection recording what was ${verdict.toLowerCase()} and on what ` +
          'evidence. A taxonomy returned unchanged is evidence it was never tested against the corpus.',
      ).not.toBeNull();
      expect(Number(m![1]), `"### ${verdict} (0)" is not a verdict — it is an empty claim`).toBeGreaterThan(0);
    }
    // The verdict must reconcile: 15 proposed − merges − rejections + splits + additions = the registry's count.
    const n = (v: string) => Number(section.match(new RegExp(`^### ${v} \\((\\d+)\\)`, 'm'))![1]);
    const expected = 15 - n('Merged') - n('Rejected') + n('Split') + n('Added');
    expect(
      subDomainPresets('commercialisation').length,
      `§5's arithmetic must reconcile with the registry: 15 proposed − ${n('Merged')} merged − ${n('Rejected')} ` +
        `rejected + ${n('Split')} split + ${n('Added')} added = ${expected}`,
    ).toBe(expected);
  });

  it('is registered in the IRL pack so the operator can actually reach it', () => {
    const collections = JSON.parse(readFileSync(join(ROOT, 'codexes/packs/irl/collections.json'), 'utf8')) as {
      collections: { id: string; items: string[] }[];
    };
    const foundation = collections.collections.find((c) => c.id === 'col_foundation');
    expect(foundation?.items).toContain('foundation/PRD-IDE-002_commercialisation-invariant-discovery.md');
  });
});
