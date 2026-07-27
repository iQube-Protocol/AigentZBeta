/**
 * SPEC-CIR-001 canaries — the Commercialisation Institutional Registry and the
 * generalised registry template.
 *
 * Written under CFS-053 CB-5: **every assertion here was mutation-tested.**
 * Four of today's eight defects were canaries that existed, ran, and passed
 * while the property they named was gone — all four asserted that a SYMBOL was
 * present rather than that a BEHAVIOUR happened. So: no `toContain('someFn')`
 * on a source file standing in for "the function is called"; the diversity
 * binding is proven by driving `getDomainConstitution` against a stub client
 * and reading what comes back.
 *
 * What each block guards:
 *
 *  1. Pillar reality — `upsertInstitutionEntry` refuses an institution whose
 *     pillar does not exist ("propose the pillar first"). A registry entry on
 *     an invented pillar is un-insertable, so the mapping must be checked at
 *     build time, not discovered at seed time.
 *  2. The tier boundary is STRUCTURAL. A practitioner source that could be
 *     counted as a primary scientific authority is the methodological error
 *     the operator's direction names explicitly.
 *  3. The disciplines are dependencies, not institutions. A discipline with a
 *     `seed_url` would break Agent B's institution-targeted navigation.
 *  4. ONE template, not two (inv.engineering.036/037). If Commercialisation
 *     gets a template and Financial Services keeps an ad hoc registry, they
 *     diverge — which is the defect the template exists to prevent.
 *  5. No fabrication. The fifteen URLs are the operator's, resolution never
 *     falls back to a guess, and the FS registry's un-captured fields stay
 *     null rather than being filled in with plausible prose.
 *  6. Law II can FAIL. A diversity rule that reports compliance everywhere on
 *     its first run is CFS-053's latent-mechanism defect wearing a rosette.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COMMERCIALISATION_REGISTRY,
  FINANCIAL_SERVICES_REGISTRY,
  INSTITUTIONAL_REGISTRIES,
  COMMERCIALISATION_DEPENDENCIES,
  ACQUISITION_PRIORITY_ORDER,
  ACQUISITION_PRIORITY_UNRANKED,
  LAW_II_TEXT,
  LAW_II_MIN_AUTHORITIES,
  LAW_II_MIN_TRADITIONS,
  acquisitionPriority,
  assessRegistryDiversity,
  registryEntryUrl,
  registryEntriesForDomain,
  findRegistryEntry,
  isSourceTier,
  type DiversityInput,
  type InstitutionalRegistryEntry,
} from '../services/corpusScout/institutionalRegistry';
import { resolveCanonicalHomepage } from '../services/corpusScout/canonicalInstitutionHomepages';
import { getDomainConstitution } from '../services/corpusScout/domainConstitution';
import { discoveryDomain } from '../services/invariants/discoveryDomains';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const SPEC_PATH = 'codexes/packs/irl/foundation/SPEC-CIR-001_commercialisation-institutional-registry.md';
const PRD_PATH = 'codexes/packs/irl/foundation/PRD-IDE-002_commercialisation-invariant-discovery.md';
const FS_SEED_PATH = 'supabase/migrations/20260817000000_corpus_domain_constitution.sql';
const COM_SEED_PATH = 'supabase/migrations/20260827000000_commercialisation_institutional_registry.sql';

const SPEC = read(SPEC_PATH);
const PRD = read(PRD_PATH);
const FS_SEED = read(FS_SEED_PATH);
const COM_SEED = read(COM_SEED_PATH);

const PILLAR_KEYS = discoveryDomain('commercialisation')!.subDomains.map((s) => s.value);

const tier1 = COMMERCIALISATION_REGISTRY.filter((e) => e.tier === 'institutional-authority');
const tier2 = COMMERCIALISATION_REGISTRY.filter((e) => e.tier === 'practitioner-pattern');

/** `('commercialisation', 'venture-operations', 'NBER', 'institutional-authority', 'proposed')` → the triple. */
function seededInstitutionRows(sql: string, domain: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`\\('${domain}',\\s*'([^']+)',\\s*'((?:[^']|'')+)'`, 'g');
  // Only the corpus_institutional_registry INSERT block — the pillar and
  // dependency blocks use the same tuple shape.
  const block = sql.slice(sql.indexOf('INSERT INTO public.corpus_institutional_registry'));
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) out.push(`${m[1]}::${m[2].replace(/''/g, "'")}`);
  return out.sort();
}

// ── 1 · Every registered institution sits on a REAL coverage pillar ─────────

describe('SPEC-CIR-001 · pillar reality', () => {
  it('every commercialisation registry entry maps only to PRD-IDE-002 §4 pillars', () => {
    expect(PILLAR_KEYS.length).toBe(14);
    for (const entry of COMMERCIALISATION_REGISTRY) {
      for (const pillar of entry.pillarKeys) {
        expect(
          PILLAR_KEYS,
          `'${entry.institution}' is registered against '${pillar}', which is not a coverage pillar — ` +
            'upsertInstitutionEntry would refuse it ("propose the pillar first")',
        ).toContain(pillar);
      }
    }
  });

  it('the seeded institution rows and the curated template are the same set', () => {
    const seeded = seededInstitutionRows(COM_SEED, 'commercialisation');
    const template = tier1
      .flatMap((e) => e.pillarKeys.map((p) => `${p}::${e.institution}`))
      .sort();
    // Both directions: a row seeded without a template entry has no tier,
    // category or evidence type; a template entry never seeded never acquires.
    expect(seeded).toEqual(template);
    expect(seeded.length).toBe(28);
  });

  it('the five pillars SPEC-CIR-001 §5 records as uncovered really have no institution', () => {
    const covered = new Set(tier1.flatMap((e) => e.pillarKeys));
    const uncovered = PILLAR_KEYS.filter((p) => !covered.has(p)).sort();
    // Recorded as a FINDING in §5. If a later pass silently closes one of
    // these by inference, the doc and the registry must be updated together.
    expect(uncovered).toEqual([
      'commercial-failure-modes',
      'distribution',
      'pricing',
      'settlement-exchange',
      'trust-formation',
    ]);
    for (const pillar of uncovered) {
      expect(SPEC, `§5 does not record '${pillar}' as uncovered`).toContain(`\`${pillar}\` | **none**`);
    }
  });
});

// ── 2 · Tier 1 and tier 2 cannot be conflated ──────────────────────────────

describe('SPEC-CIR-001 · the tier boundary is structural', () => {
  it('holds all nine of the operator\'s practitioner sources, and none of them in tier 1', () => {
    expect(tier2.map((e) => e.institution).sort()).toEqual([
      'Accenture Research',
      'Andreessen Horowitz (a16z)',
      'BCG Insights',
      'Bain Insights',
      'Deloitte Insights',
      'First Round Review',
      'McKinsey Insights',
      'PwC Strategy',
      'Y Combinator Library',
    ]);
    expect(tier1).toHaveLength(15);
  });

  it('a practitioner source carries no pillar and resolves to no URL — so it cannot be acquired', () => {
    for (const entry of tier2) {
      expect(
        entry.pillarKeys,
        `'${entry.institution}' carries a pillar — upsertInstitutionEntry would accept it, and a ` +
          'practitioner source would enter the corpus before the institutional corpus is exhausted',
      ).toEqual([]);
      expect(
        registryEntryUrl(entry),
        `'${entry.institution}' resolves to a URL that the operator never supplied`,
      ).toBeNull();
      expect(entry.urlProvenance).toBe('none');
    }
  });

  it('assessRegistryDiversity never counts a practitioner or an undeclared row as an authority', () => {
    const pillar = 'pricing';
    const mk = (institution: string, tier: DiversityInput['tier']): DiversityInput => ({
      institution, category: 'Practitioner', evidenceType: 'practitioner-guidance', tier, pillarKeys: [pillar],
    });
    // Three practitioner sources plus an undeclared one — four rows, zero
    // authorities. The mutation this survives: flipping the filter to count
    // every row would make this pillar read as satisfied.
    const rows = assessRegistryDiversity(
      [mk('a16z', 'practitioner-pattern'), mk('McKinsey Insights', 'practitioner-pattern'),
       mk('Bain Insights', 'practitioner-pattern'), mk('mystery source', null)],
      [pillar],
    );
    expect(rows[0].authorityCount).toBe(0);
    expect(rows[0].verdict).toBe('unsatisfied');
    expect(rows[0].reason).toMatch(/no institutional-authority source/);
  });

  it('the DB column exists, is nullable with no default, and is CHECK-constrained', () => {
    expect(COM_SEED).toMatch(/ADD COLUMN IF NOT EXISTS source_tier text;/);
    // A DEFAULT would make every future row read as an authority — the exact
    // fail-open the null-means-undeclared design exists to prevent.
    expect(/source_tier text\s+(NOT NULL|DEFAULT)/i.test(COM_SEED)).toBe(false);
    expect(COM_SEED).toMatch(/CHECK \(source_tier IS NULL OR source_tier IN \('institutional-authority', 'practitioner-pattern'\)\)/);
    expect(isSourceTier('institutional-authority')).toBe(true);
    expect(isSourceTier('practitioner-pattern')).toBe(true);
    expect(isSourceTier('authoritative')).toBe(false);
    expect(isSourceTier(null)).toBe(false);
  });
});

// ── 3 · The disciplines are dependencies, not institutions ─────────────────

describe('SPEC-CIR-001 · where the disciplines went', () => {
  const names = COMMERCIALISATION_DEPENDENCIES.map((d) => d.name);

  it('all eight of the operator\'s adjacent disciplines are reachable in the dependency registry', () => {
    // Six registered new; two already present under existing names, reused
    // rather than duplicated (inv.engineering.037).
    for (const name of [
      'organisation-design', 'behavioural-economics', 'network-science', 'complexity-science',
      'diffusion-of-innovation', 'service-science',
      'platform-economics', // the direction's "Platform economics"
      'operations',         // the direction's "Operations management"
    ]) {
      expect(names, `'${name}' is not registered as a constitutional dependency`).toContain(name);
    }
    expect(new Set(names).size, 'a discipline is registered twice').toBe(names.length);
  });

  it('no discipline is modelled as an institution or as a coverage pillar', () => {
    const institutions = new Set(
      Object.values(INSTITUTIONAL_REGISTRIES).flat().map((e) => e.institution.toLowerCase()),
    );
    for (const name of names) {
      const spaced = name.replace(/-/g, ' ');
      expect(institutions, `'${name}' is registered as an institution — it has no homepage to navigate to`).not.toContain(spaced);
      expect(PILLAR_KEYS, `'${name}' is registered as a coverage pillar — a discipline constrains the domain, it does not constitute it`).not.toContain(name);
      // And it must never acquire a seed URL, which is what would make Agent B
      // try to navigate to a discipline.
      expect(resolveCanonicalHomepage(spaced), `'${name}' resolves to a homepage`).toBeNull();
    }
  });

  it('every dependency carries its relationship edge — Law I §2.3, "the edge is the point"', () => {
    for (const d of COMMERCIALISATION_DEPENDENCIES) {
      expect(d.relationship.trim().length, `'${d.name}' has no relationship edge`).toBeGreaterThan(0);
      expect(['compared against', 'explained by']).toContain(d.relationship);
    }
    // `upsertDependencyEntry` rejects an empty relationship, so an edgeless
    // entry would be un-seedable, not merely undocumented.
    expect(read('services/corpusScout/domainConstitution.ts')).toContain(
      'relationship is required (Law I — the edge is the point)',
    );
  });

  it('the Discovery Domain Registry\'s tangential domains stay a SUBSET of the dependency registry', () => {
    // discoveryDomains.ts is a docs mirror of PRD-IDE-002 §7.3 and was
    // deliberately not edited. This is what stops the two contradicting each
    // other: every tangential domain must be a registered dependency.
    for (const tangential of discoveryDomain('commercialisation')!.tangentialDomains) {
      expect(names, `'${tangential}' is a tangential domain with no dependency-registry entry`).toContain(tangential);
    }
    expect(COMMERCIALISATION_DEPENDENCIES.filter((d) => d.source === 'PRD-IDE-002 §7.3')).toHaveLength(10);
  });

  it('the dependencies are seeded, and seeded as dependencies', () => {
    const block = COM_SEED.slice(
      COM_SEED.indexOf('INSERT INTO public.corpus_dependency_registry'),
      COM_SEED.indexOf('INSERT INTO public.corpus_institutional_registry'),
    );
    for (const d of COMMERCIALISATION_DEPENDENCIES) {
      expect(block, `'${d.name}' is not seeded into corpus_dependency_registry`).toContain(
        `('commercialisation', '${d.name}', '${d.relationship}', 'proposed')`,
      );
    }
  });
});

// ── 4 · ONE template, shared with Financial Services ───────────────────────

describe('SPEC-CIR-001 · the template is shared, not forked', () => {
  it('both domains are declared through the same registry, and resolve through it', () => {
    expect(Object.keys(INSTITUTIONAL_REGISTRIES).sort()).toEqual(['commercialisation', 'financial-services']);
    expect(registryEntriesForDomain('financial-services')).toBe(FINANCIAL_SERVICES_REGISTRY);
    expect(registryEntriesForDomain('commercialisation')).toBe(COMMERCIALISATION_REGISTRY);
    // An unregistered domain gets nothing — never a silent fallback to another
    // domain's registry.
    expect(registryEntriesForDomain('healthcare')).toEqual([]);
    expect(findRegistryEntry('healthcare', 'NBER')).toBeNull();
    // Cross-domain lookup must not leak: NBER is not a Financial Services
    // authority, and FATF is not a commercialisation one.
    expect(findRegistryEntry('financial-services', 'NBER')).toBeNull();
    expect(findRegistryEntry('commercialisation', 'FATF')).toBeNull();
    expect(findRegistryEntry('commercialisation', 'nber')?.category).toBe('Entrepreneurship Research');
  });

  it('the FS template entries match the 20260817000000 seed SQL set-for-set', () => {
    const seeded = seededInstitutionRows(FS_SEED, 'financial-services');
    const template = FINANCIAL_SERVICES_REGISTRY
      .flatMap((e) => e.pillarKeys.map((p) => `${p}::${e.institution}`))
      .sort();
    expect(template).toEqual(seeded);
    expect(seeded.length).toBe(19);
  });

  it('the FS entries keep NULL where the field was never captured — never invented prose', () => {
    for (const e of FINANCIAL_SERVICES_REGISTRY) {
      expect(e.category, `'${e.institution}' claims an institutional tradition nobody recorded`).toBeNull();
      expect(e.authority, `'${e.institution}' claims an authority basis nobody recorded`).toBeNull();
      expect(e.evidenceType, `'${e.institution}' claims an evidence type nobody recorded`).toBeNull();
    }
  });

  it('acquisition priority is DERIVED from PRD-IDE-002 §11.2, not hand-typed', () => {
    // The §11.2 order is a docs mirror; if the PRD reorders its gaps and the
    // registry does not, acquisition runs in the wrong order silently.
    const gaps = ACQUISITION_PRIORITY_ORDER.map((b) => b.gap);
    expect(gaps).toHaveLength(5);
    expect(ACQUISITION_PRIORITY_ORDER.map((b) => b.rank)).toEqual([1, 2, 3, 4, 5]);
    const s112 = PRD.slice(PRD.indexOf('### 11.2'), PRD.indexOf('### 11.3'));
    for (const [i, needle] of [
      'Commercial failure post-mortems', 'Entrepreneurship / customer-development primary research',
      'Platform & network economics', 'Pricing research', 'Service design / service operations',
    ].entries()) {
      expect(s112, `§11.2 no longer ranks '${needle}' at ${i + 1}`).toContain(`${i + 1}. **${needle}`);
      expect(gaps[i]).toBe(needle);
    }
    // And the derivation actually derives: strongest rank wins, unmapped
    // pillars fall to the back, no pillars at all is unranked.
    expect(acquisitionPriority({ pillarKeys: ['commercial-failure-modes', 'pricing'] })).toBe(1);
    expect(acquisitionPriority({ pillarKeys: ['pricing'] })).toBe(4);
    expect(acquisitionPriority({ pillarKeys: ['trust-formation'] })).toBe(ACQUISITION_PRIORITY_UNRANKED);
    expect(acquisitionPriority({ pillarKeys: [] })).toBe(ACQUISITION_PRIORITY_UNRANKED);
    expect(ACQUISITION_PRIORITY_UNRANKED).toBe(6);
  });
});

// ── 5 · No fabricated URL, no search fallback ──────────────────────────────

describe('SPEC-CIR-001 · the operator-supplied URLs, and nothing else', () => {
  const OPERATOR_URLS: Readonly<Record<string, string>> = {
    NBER: 'https://www.nber.org',
    'Kauffman Foundation': 'https://www.kauffman.org',
    SSRN: 'https://www.ssrn.com',
    OECD: 'https://www.oecd.org',
    'World Bank': 'https://www.worldbank.org',
    'MIT Sloan': 'https://mitsloan.mit.edu',
    'Stanford Graduate School of Business': 'https://www.gsb.stanford.edu',
    'Harvard Business School': 'https://www.hbs.edu',
    'Strategic Management Society': 'https://www.strategicmanagement.net',
    'Santa Fe Institute': 'https://www.santafe.edu',
    INCOSE: 'https://www.incose.org',
    'Silicon Valley Product Group': 'https://www.svpg.com',
    'Product School': 'https://productschool.com',
    Strategyzer: 'https://www.strategyzer.com',
    'Lean Startup': 'https://theleanstartup.com',
  };

  it('every tier-1 institution resolves to exactly the URL the operator supplied', () => {
    expect(Object.keys(OPERATOR_URLS)).toHaveLength(15);
    for (const entry of tier1) {
      const expected = OPERATOR_URLS[entry.institution];
      expect(expected, `'${entry.institution}' is in tier 1 but not in the operator's table`).toBeTruthy();
      expect(registryEntryUrl(entry)).toBe(expected);
    }
    // And the document the operator reviews states the same URL.
    for (const [institution, url] of Object.entries(OPERATOR_URLS)) {
      expect(SPEC, `SPEC-CIR-001 §4 does not carry ${institution}'s URL`).toContain(url);
    }
  });

  it('resolution fails honestly — it never guesses and never falls back to search', () => {
    expect(resolveCanonicalHomepage('McKinsey Insights')).toBeNull();
    expect(resolveCanonicalHomepage('Y Combinator Library')).toBeNull();
    expect(resolveCanonicalHomepage('Institute of Things That Do Not Exist')).toBeNull();
    // The FS posture is unchanged: a regulation is not a navigable body.
    expect(resolveCanonicalHomepage('MiCA (EU framework)')).toBeNull();
  });

  it('the operator-supplied provenance is recorded where the URLs live', () => {
    const src = read('services/corpusScout/canonicalInstitutionHomepages.ts');
    expect(src).toMatch(/SUPPLIED VERBATIM BY THE OPERATOR/);
    // The claim we must never make.
    expect(/verified against a live/i.test(src)).toBe(true); // the honest negative posture, retained
    expect(tier1.every((e) => e.urlProvenance === 'operator-supplied' || e.urlProvenance === 'pre-existing')).toBe(true);
    // World Bank is shared with Financial Services — one institution, one
    // homepage fact, not two entries.
    expect(findRegistryEntry('commercialisation', 'World Bank')!.urlProvenance).toBe('pre-existing');
  });
});

// ── 6 · Law II — and it must be able to FAIL ───────────────────────────────

describe('SPEC-CIR-001 · Law II of Constitutional Discovery', () => {
  const auth = (institution: string, category: string | null, pillarKeys: string[]): DiversityInput => ({
    institution, category, evidenceType: 'research-papers', tier: 'institutional-authority', pillarKeys,
  });

  it('carries the operator\'s rule verbatim, in code and in the document', () => {
    expect(LAW_II_TEXT).toBe(
      'Every IDE corpus shall contain multiple independent schools of thought and institutional traditions. ' +
      'No invariant family may rely upon a single institution, publisher, methodology, or ideological perspective.',
    );
    expect(SPEC).toContain('Every IDE corpus shall contain multiple independent schools of thought and institutional traditions.');
    expect(SPEC).toContain('No invariant family may rely upon a single institution, publisher, methodology, or ideological perspective.');
    expect(LAW_II_MIN_AUTHORITIES).toBe(2);
    expect(LAW_II_MIN_TRADITIONS).toBe(2);
  });

  it('a single authority is UNSATISFIED — the "one great institution" case the rule exists for', () => {
    const [row] = assessRegistryDiversity([auth('NBER', 'Entrepreneurship Research', ['pricing'])], ['pricing']);
    expect(row.verdict).toBe('unsatisfied');
    expect(row.authorityCount).toBe(1);
    expect(row.reason).toMatch(/at least 2/);
  });

  it('two authorities from ONE tradition is UNSATISFIED — this is the institutional-bias case', () => {
    const [row] = assessRegistryDiversity(
      [auth('NBER', 'Entrepreneurship Research', ['pricing']), auth('Kauffman Foundation', 'Entrepreneurship Research', ['pricing'])],
      ['pricing'],
    );
    // The mutation this survives: dropping the tradition check would report
    // `satisfied` on a corpus drawn entirely from one school of thought —
    // exactly what the operator's rule forbids.
    expect(row.verdict).toBe('unsatisfied');
    expect(row.authorityCount).toBe(2);
    expect(row.traditions).toEqual(['Entrepreneurship Research']);
    expect(row.reason).toMatch(/single institutional perspective/);
  });

  it('two authorities from TWO traditions is SATISFIED', () => {
    const [row] = assessRegistryDiversity(
      [auth('NBER', 'Entrepreneurship Research', ['pricing']), auth('OECD', 'Economics', ['pricing'])],
      ['pricing'],
    );
    expect(row.verdict).toBe('satisfied');
    expect(row.traditions).toEqual(['Economics', 'Entrepreneurship Research']);
  });

  it('an authority with no declared tradition makes the verdict UNDETERMINABLE, not satisfied', () => {
    const [row] = assessRegistryDiversity(
      [auth('BIS', null, ['banking']), auth('FCA', null, ['banking']), auth('ECB', null, ['banking'])],
      ['banking'],
    );
    // Three authorities would pass a naive count. They cannot pass Law II,
    // because nothing records whether they are three traditions or one.
    expect(row.verdict).toBe('undeterminable');
    expect(row.reason).toMatch(/cannot be verified, only assumed/);
  });

  it('the real registries produce real verdicts — the check is not vacuous', () => {
    const inputs: DiversityInput[] = COMMERCIALISATION_REGISTRY.map((e) => ({
      institution: e.institution, category: e.category, evidenceType: e.evidenceType,
      tier: e.tier, pillarKeys: e.pillarKeys,
    }));
    const rows = assessRegistryDiversity(inputs, PILLAR_KEYS);
    const byVerdict = (v: string) => rows.filter((r) => r.verdict === v).map((r) => r.pillarKey).sort();

    // Seven satisfied, seven unsatisfied. If a future edit makes everything
    // pass, this fails — a rule that cannot fail is CFS-053's defect.
    expect(byVerdict('satisfied')).toEqual([
      'adoption', 'commercial-governance', 'customer-discovery', 'revenue-architecture',
      'scaling', 'value-proposition', 'venture-operations',
    ]);
    expect(byVerdict('unsatisfied')).toEqual([
      'commercial-failure-modes', 'distribution', 'outcome-assurance', 'partnerships',
      'pricing', 'settlement-exchange', 'trust-formation',
    ]);
    expect(byVerdict('undeterminable')).toEqual([]);

    // And Financial Services, whose registry records no traditions at all,
    // is undeterminable everywhere — never silently "satisfied".
    const fsRows = assessRegistryDiversity(
      FINANCIAL_SERVICES_REGISTRY.map((e) => ({
        institution: e.institution, category: e.category, evidenceType: e.evidenceType,
        tier: e.tier, pillarKeys: e.pillarKeys,
      })),
      ['banking', 'payments', 'capital-markets', 'insurance', 'financial-infrastructure'],
    );
    expect(fsRows.every((r) => r.verdict === 'undeterminable')).toBe(true);
  });

  it('the check is BOUND — getDomainConstitution runs it and returns the result', async () => {
    // CFS-053 CB-1/CB-6/CB-7: asserting the symbol is present is what let four
    // defects through today. This drives the real function against a stub
    // client and reads the consequence.
    const rows = {
      corpus_domain_definitions: null,
      corpus_coverage_pillars: [
        { id: 'p1', domain: 'commercialisation', pillar_key: 'pricing', pillar_label: 'Pricing', completeness_definition: '', status: 'proposed', created_at: '', updated_at: '', saturation_confirmed: false },
        { id: 'p2', domain: 'commercialisation', pillar_key: 'adoption', pillar_label: 'Adoption', completeness_definition: '', status: 'proposed', created_at: '', updated_at: '', saturation_confirmed: false },
      ],
      corpus_dependency_registry: [],
      corpus_institutional_registry: [
        // Two real tier-1 authorities from two traditions on `adoption`…
        { id: 'i1', domain: 'commercialisation', pillar_key: 'adoption', institution_name: 'NBER', status: 'proposed', created_at: '', updated_at: '', seed_url: 'https://www.nber.org', source_tier: 'institutional-authority' },
        { id: 'i2', domain: 'commercialisation', pillar_key: 'adoption', institution_name: 'OECD', status: 'proposed', created_at: '', updated_at: '', seed_url: 'https://www.oecd.org', source_tier: 'institutional-authority' },
        // …and a practitioner source parked on `pricing`, which must not count.
        { id: 'i3', domain: 'commercialisation', pillar_key: 'pricing', institution_name: 'McKinsey Insights', status: 'proposed', created_at: '', updated_at: '', seed_url: null, source_tier: 'practitioner-pattern' },
      ],
    } as Record<string, unknown>;

    const builder = (table: string) => {
      const data = rows[table];
      const self: Record<string, unknown> = {};
      self.select = () => self;
      self.eq = () => self;
      self.maybeSingle = async () => ({ data: Array.isArray(data) ? (data[0] ?? null) : data, error: null });
      self.order = async () => ({ data: Array.isArray(data) ? data : [], error: null });
      return self;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stub = { from: (table: string) => builder(table) } as any;

    const constitution = await getDomainConstitution(stub, 'commercialisation');

    expect(constitution.diversity, 'getDomainConstitution returned no Law II assessment').toHaveLength(2);
    const byPillar = Object.fromEntries(constitution.diversity.map((d) => [d.pillarKey, d]));
    expect(byPillar.adoption.verdict).toBe('satisfied');
    expect(byPillar.adoption.traditions).toEqual(['Economics', 'Entrepreneurship Research']);
    // The consequence that matters: a practitioner row does not make a pillar
    // look covered.
    expect(byPillar.pricing.verdict).toBe('unsatisfied');
    expect(byPillar.pricing.authorityCount).toBe(0);
    // And the tier survived the DB→row mapping rather than being dropped.
    expect(constitution.institutions.find((i) => i.institutionName === 'McKinsey Insights')!.sourceTier)
      .toBe('practitioner-pattern');
  });
});

// ── 7 · Phase 1 does not ratify ────────────────────────────────────────────

describe('SPEC-CIR-001 · nothing is ratified by being written', () => {
  it('every commercialisation row the migration seeds lands `proposed`', () => {
    const commercialisationBlocks = COM_SEED.split('\n').filter((l) => l.includes("'commercialisation'"));
    expect(commercialisationBlocks.length).toBeGreaterThan(50);
    for (const line of commercialisationBlocks) {
      expect(line, `a commercialisation row is seeded ratified: ${line.trim()}`).not.toMatch(/'ratified'/);
    }
    // The FS backfill of source_tier must not touch anyone's ratification.
    expect(COM_SEED).not.toMatch(/UPDATE[\s\S]*?SET[\s\S]*?status\s*=/i);
  });

  it('the migration is additive and idempotent (CFS-010 §3)', () => {
    expect(COM_SEED).toMatch(/ADD COLUMN IF NOT EXISTS/);
    // Comments stripped first — the file's own header DOCUMENTS the discipline
    // by naming `ON CONFLICT DO NOTHING`, and counting prose as code is the
    // grep-vs-comment defect class `tests/_lib/sourceAuthority.ts` exists for.
    const sql = COM_SEED.replace(/^\s*--.*$/gm, '');
    const insertCount = (sql.match(/INSERT INTO/g) ?? []).length;
    const conflictCount = (sql.match(/ON CONFLICT[\s\S]{0,80}?DO NOTHING/g) ?? []).length;
    expect(insertCount).toBe(4);
    expect(conflictCount).toBe(insertCount);
  });

  it('the registry document is registered in the IRL pack', () => {
    const collections = JSON.parse(read('codexes/packs/irl/collections.json')) as {
      collections: { id: string; items: string[] }[];
    };
    const foundation = collections.collections.find((c) => c.id === 'col_foundation')!;
    expect(foundation.items).toContain('foundation/SPEC-CIR-001_commercialisation-institutional-registry.md');
  });

  it('the document states its Phase 1 status and the hard stop it observed', () => {
    expect(SPEC).toMatch(/PHASE 1 OUTPUT — PROPOSED, NOTHING HERE IS RATIFIED/);
    expect(SPEC).toMatch(/Do not perform acquisition yet\. Produce the registry first\./);
    // §7.1's audit must reach a sited conclusion, not merely list candidates.
    expect(SPEC).toMatch(/Recommendation: adopt as Law II of Constitutional Discovery, by amendment to PRD-ICA-001/);
  });
});

/** Type-level: the shared template is one type for both domains. */
const _sharedTemplate: readonly InstitutionalRegistryEntry[][] = [
  FINANCIAL_SERVICES_REGISTRY as InstitutionalRegistryEntry[],
  COMMERCIALISATION_REGISTRY as InstitutionalRegistryEntry[],
];
void _sharedTemplate;
