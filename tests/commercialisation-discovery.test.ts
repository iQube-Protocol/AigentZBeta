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

  it('the PRD did NOT amend the seed crystal', () => {
    const seed = readFileSync(join(ROOT, 'codexes/packs/irl/foundation/canonical-invariants.seed.json'), 'utf8');
    expect(
      seed,
      'PRD-IDE-002 §10 supplies crystal additions as a BLOCK FOR THE OPERATOR TO APPLY. An agent that pastes them ' +
        'in itself has amended canon, which is an operator act under Law XI',
    ).not.toContain('commercialisation');
  });

  it('the PRD states the no-auto-canonisation rule in its own text', () => {
    expect(PRD).toMatch(/proposed/i);
    expect(PRD.toLowerCase()).toContain('no invariant produced by this programme becomes canonical');
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
