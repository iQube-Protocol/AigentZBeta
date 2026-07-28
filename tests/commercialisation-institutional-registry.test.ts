/**
 * SPEC-CIR-001 canaries — the Commercialisation Institutional Registry, the
 * generalised registry template, and the registry-level VERIFICATION protocol
 * the operator's 2026-07-27 ruling added.
 *
 * Written under CFS-053 CB-5: **every assertion here was mutation-tested.**
 * Four of that day's eight defects were canaries that existed, ran, and passed
 * while the property they named was gone — all four asserted that a SYMBOL was
 * present rather than that a BEHAVIOUR happened. So: no `toContain('someFn')`
 * on a source file standing in for "the function is called". The diversity
 * binding is proven by driving `getDomainConstitution`; the refusal gate by
 * driving `runDiscoveryForInstitution`; the four verification conjuncts by
 * driving `runVerification` against injected transports.
 *
 * What each block guards:
 *
 *  1. Pillar reality — `upsertInstitutionEntry` refuses an institution whose
 *     pillar does not exist. All fourteen pillars are now served (the ruling:
 *     "Do not waive the five empty pillars").
 *  2. The tier boundary is STRUCTURAL. A practitioner source that could be
 *     counted as a primary scientific authority is the methodological error
 *     the operator's direction names explicitly.
 *  3. The disciplines are dependencies, not institutions.
 *  4. ONE template, not two (inv.engineering.036/037) — and provenance keyed
 *     PER PILLAR, so OECD's three traditions cannot collapse into one.
 *  5. No fabrication. Every URL is the operator's; resolution never falls back.
 *  6. Law II can FAIL. Two pillars still do, and the verdict is reported, not
 *     tuned.
 *  7. The Corpus Qualification Standard is promoted, single-sourced, and states
 *     its unit.
 *  8. Verification is more than reachability, `verified` is unforgeable, and
 *     the refusal gate actually refuses.
 *  9. Phase 1 does not ratify and does not verify.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COMMERCIALISATION_REGISTRY,
  COMMERCIALISATION_REGISTRY_WAVE_2,
  COMMERCIALISATION_REGISTRY_WAVE_3,
  COMMERCIALISATION_ACQUISITION_SEEDS,
  FINANCIAL_SERVICES_REGISTRY,
  INSTITUTIONAL_REGISTRIES,
  COMMERCIALISATION_DEPENDENCIES,
  ACQUISITION_PRIORITY_ORDER,
  ACQUISITION_PRIORITY_UNRANKED,
  LAW_II_TEXT,
  LAW_II_MIN_AUTHORITIES,
  LAW_II_MIN_TRADITIONS,
  NBER_TRADITION,
  TRADITION_CONFLICTS_PENDING_OPERATOR_RULING,
  institutionTraditionConflicts,
  acquisitionPriority,
  acquisitionSeedsFor,
  assessRegistryDiversity,
  registryEntryUrl,
  registryEntriesForDomain,
  findRegistryEntry,
  isSourceTier,
  type DiversityInput,
  type InstitutionalRegistryEntry,
} from '../services/corpusScout/institutionalRegistry';
import { resolveCanonicalHomepage, listCanonicalInstitutionNames } from '../services/corpusScout/canonicalInstitutionHomepages';
import { getDomainConstitution } from '../services/corpusScout/domainConstitution';
import { runDiscoveryForInstitution, runDiscoveryForDomain } from '../services/corpusScout/discoveryOrchestrator';
import {
  VERIFICATION_STATUSES,
  RUN_OUTCOME_STATUSES,
  canRunInstitutionDiscovery,
  isVerificationStatus,
  isVerificationTransitionAllowed,
  runVerification,
  applyVerificationOutcome,
  type VerificationDeps,
  type VerificationStatus,
} from '../services/corpusScout/registryVerification';
import {
  CQS_PDF_MIN_PAGE_COUNT,
  CQS_PDF_MIN_SUBSTANTIVE_CHARACTERS,
  CQS_PDF_MAX_BLANK_PAGE_RATIO,
  CQS_TEXT_ONLY_MIN_SUBSTANTIVE_CHARACTERS,
  CORPUS_QUALIFICATION_STANDARD_STATEMENT,
} from '../services/corpusScout/corpusQualificationStandard';
import { discoveryDomain } from '../services/invariants/discoveryDomains';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const SPEC_PATH = 'codexes/packs/irl/foundation/SPEC-CIR-001_commercialisation-institutional-registry.md';
const PRD_IDE_PATH = 'codexes/packs/irl/foundation/PRD-IDE-002_commercialisation-invariant-discovery.md';
const PRD_ICA_PATH = 'codexes/packs/irl/foundation/PRD-ICA-001_invariant-corpus-acquisition-agent.md';
const FS_SEED_PATH = 'supabase/migrations/20260817000000_corpus_domain_constitution.sql';
const COM_SEED_PATH = 'supabase/migrations/20260827000000_commercialisation_institutional_registry.sql';
const VERIFY_SEED_PATH = 'supabase/migrations/20260828000000_corpus_registry_verification.sql';
const LAW_II_SEED_PATH = 'supabase/migrations/20260829000000_commercialisation_law_ii_closure.sql';

const SPEC = read(SPEC_PATH);
const PRD_IDE = read(PRD_IDE_PATH);
const PRD_ICA = read(PRD_ICA_PATH);
const FS_SEED = read(FS_SEED_PATH);
const COM_SEED = read(COM_SEED_PATH);
const VERIFY_SEED = read(VERIFY_SEED_PATH);
const LAW_II_SEED = read(LAW_II_SEED_PATH);

const PILLAR_KEYS = discoveryDomain('commercialisation')!.subDomains.map((s) => s.value);

const tier1 = COMMERCIALISATION_REGISTRY.filter((e) => e.tier === 'institutional-authority');
const tier2 = COMMERCIALISATION_REGISTRY.filter((e) => e.tier === 'practitioner-pattern');

/** `('commercialisation', 'venture-operations', 'NBER', …)` → `pillar::institution`. */
function seededInstitutionRows(sql: string, domain: string): string[] {
  const out: string[] = [];
  const start = sql.indexOf('INSERT INTO public.corpus_institutional_registry');
  if (start < 0) return out;
  // Bound to THIS insert only — corpus_acquisition_seeds uses the same tuple
  // shape, and a greedy slice would count document seeds as institutions.
  const next = sql.indexOf('INSERT INTO', start + 1);
  const block = next < 0 ? sql.slice(start) : sql.slice(start, next);
  const re = new RegExp(`\\('${domain}',\\s*'([^']+)',\\s*'((?:[^']|'')+)'`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) out.push(`${m[1]}::${m[2].replace(/''/g, "'")}`);
  return out;
}

// ── 1 · Every registered institution sits on a REAL coverage pillar ─────────

describe('SPEC-CIR-001 · pillar reality', () => {
  it('every commercialisation registry entry maps only to PRD-IDE-002 §4 pillars', () => {
    expect(PILLAR_KEYS.length).toBe(14);
    for (const entry of COMMERCIALISATION_REGISTRY) {
      if (entry.pillarKey === null) continue; // tier 2 — deliberately un-pillared
      expect(
        PILLAR_KEYS,
        `'${entry.institution}' is registered against '${entry.pillarKey}', which is not a coverage pillar — ` +
          'upsertInstitutionEntry would refuse it ("propose the pillar first")',
      ).toContain(entry.pillarKey);
    }
  });

  it('ALL FOURTEEN pillars are now served — the ruling refused to waive the five empty ones', () => {
    const covered = new Set(tier1.map((e) => e.pillarKey));
    const uncovered = PILLAR_KEYS.filter((p) => !covered.has(p));
    expect(
      uncovered,
      'a pillar has no institutional authority — the operator ruled "Do not waive the five empty pillars"',
    ).toEqual([]);
    // Every pillar carries at least the two authorities Law II needs — the
    // five the first ruling named AND the two the Law II ruling closed.
    for (const pillar of PILLAR_KEYS) {
      expect(
        tier1.filter((e) => e.pillarKey === pillar).length,
        `'${pillar}' has fewer than two institutional authorities`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it('the two seed migrations and the curated template are the same set', () => {
    const seeded = [
      ...seededInstitutionRows(COM_SEED, 'commercialisation'),
      ...seededInstitutionRows(VERIFY_SEED, 'commercialisation'),
      ...seededInstitutionRows(LAW_II_SEED, 'commercialisation'),
    ].sort();
    const template = tier1.map((e) => `${e.pillarKey}::${e.institution}`).sort();
    expect(seeded).toEqual(template);
    expect(seeded.length).toBe(40); // 28 wave 1 + 10 wave 2 + 2 wave 3
    expect(COMMERCIALISATION_REGISTRY_WAVE_2).toHaveLength(10);
    expect(COMMERCIALISATION_REGISTRY_WAVE_3).toHaveLength(2);
  });
});

// ── 2 · Tier 1 and tier 2 cannot be conflated ──────────────────────────────

describe('SPEC-CIR-001 · the tier boundary is structural', () => {
  it('holds all nine of the operator\'s practitioner sources, and none of them in tier 1', () => {
    expect(tier2.map((e) => e.institution).sort()).toEqual([
      'Accenture Research', 'Andreessen Horowitz (a16z)', 'BCG Insights', 'Bain Insights',
      'Deloitte Insights', 'First Round Review', 'McKinsey Insights', 'PwC Strategy', 'Y Combinator Library',
    ]);
    expect(tier1).toHaveLength(40);
  });

  it('a practitioner source carries no pillar and resolves to no URL — so it cannot be acquired', () => {
    for (const entry of tier2) {
      expect(entry.pillarKey, `'${entry.institution}' carries a pillar — upsertInstitutionEntry would accept it`).toBeNull();
      expect(registryEntryUrl(entry), `'${entry.institution}' resolves to a URL the operator never supplied`).toBeNull();
      expect(entry.urlProvenance).toBe('none');
    }
  });

  it('assessRegistryDiversity never counts a practitioner or an undeclared row as an authority', () => {
    const mk = (institution: string, tier: DiversityInput['tier']): DiversityInput => ({
      institution, category: 'Practitioner', evidenceType: 'practitioner-guidance', tier, pillarKey: 'pricing',
    });
    const rows = assessRegistryDiversity(
      [mk('a16z', 'practitioner-pattern'), mk('McKinsey Insights', 'practitioner-pattern'),
       mk('Bain Insights', 'practitioner-pattern'), mk('mystery source', null)],
      ['pricing'],
    );
    expect(rows[0].authorityCount).toBe(0);
    expect(rows[0].verdict).toBe('unsatisfied');
    expect(rows[0].reason).toMatch(/no institutional-authority source/);
  });

  it('the DB column exists, is nullable with no default, and is CHECK-constrained', () => {
    expect(COM_SEED).toMatch(/ADD COLUMN IF NOT EXISTS source_tier text;/);
    expect(/source_tier text\s+(NOT NULL|DEFAULT)/i.test(COM_SEED)).toBe(false);
    expect(COM_SEED).toMatch(/CHECK \(source_tier IS NULL OR source_tier IN \('institutional-authority', 'practitioner-pattern'\)\)/);
    expect(isSourceTier('institutional-authority')).toBe(true);
    expect(isSourceTier('authoritative')).toBe(false);
    expect(isSourceTier(null)).toBe(false);
  });
});

// ── 3 · The disciplines are dependencies, not institutions ─────────────────

describe('SPEC-CIR-001 · where the disciplines went', () => {
  const names = COMMERCIALISATION_DEPENDENCIES.map((d) => d.name);

  it('all eight of the operator\'s adjacent disciplines are reachable in the dependency registry', () => {
    for (const name of [
      'organisation-design', 'behavioural-economics', 'network-science', 'complexity-science',
      'diffusion-of-innovation', 'service-science', 'platform-economics', 'operations',
    ]) {
      expect(names, `'${name}' is not registered as a constitutional dependency`).toContain(name);
    }
    expect(new Set(names).size, 'a discipline is registered twice').toBe(names.length);
  });

  it('no discipline is modelled as an institution or as a coverage pillar', () => {
    const institutions = new Set(Object.values(INSTITUTIONAL_REGISTRIES).flat().map((e) => e.institution.toLowerCase()));
    for (const name of names) {
      const spaced = name.replace(/-/g, ' ');
      expect(institutions, `'${name}' is registered as an institution — it has no homepage to navigate to`).not.toContain(spaced);
      expect(PILLAR_KEYS, `'${name}' is registered as a coverage pillar — a discipline constrains, it does not constitute`).not.toContain(name);
      expect(resolveCanonicalHomepage(spaced), `'${name}' resolves to a homepage`).toBeNull();
    }
  });

  it('every dependency carries its relationship edge — Law I §2.3, "the edge is the point"', () => {
    for (const d of COMMERCIALISATION_DEPENDENCIES) {
      expect(d.relationship.trim().length, `'${d.name}' has no relationship edge`).toBeGreaterThan(0);
      expect(['compared against', 'explained by']).toContain(d.relationship);
    }
    expect(read('services/corpusScout/domainConstitution.ts')).toContain(
      'relationship is required (Law I — the edge is the point)',
    );
  });

  it('the Discovery Domain Registry\'s tangential domains stay a SUBSET of the dependency registry', () => {
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

// ── 4 · ONE template, shared, with PER-PILLAR provenance ───────────────────

describe('SPEC-CIR-001 · the template is shared, not forked', () => {
  it('both domains are declared through the same registry, and resolve through it', () => {
    expect(Object.keys(INSTITUTIONAL_REGISTRIES).sort()).toEqual(['commercialisation', 'financial-services']);
    expect(registryEntriesForDomain('financial-services')).toBe(FINANCIAL_SERVICES_REGISTRY);
    expect(registryEntriesForDomain('healthcare')).toEqual([]);
    expect(findRegistryEntry('healthcare', 'pricing', 'NBER')).toBeNull();
    // Cross-domain lookup must not leak.
    expect(findRegistryEntry('financial-services', 'banking', 'NBER')).toBeNull();
    expect(findRegistryEntry('commercialisation', 'pricing', 'FATF')).toBeNull();
  });

  it('provenance attaches PER PILLAR — but the TRADITION does not', () => {
    // The 2026-07-27 ruling: "The provenance must attach to the specific pillar
    // and acquired document." The 2026-07-28 ruling narrows WHAT may vary:
    // "keep the split, but be precise about what is splitting… What differs per
    // pillar is: evidentiary role; topic; acquisition seed; pillar
    // relationship." NOT the tradition.
    //
    // So: `authority`, `evidenceType` and the acquisition seeds vary per
    // pillar; `category` does not.
    expect(findRegistryEntry('commercialisation', 'adoption', 'OECD')!.evidenceType).toBe('policy');
    expect(findRegistryEntry('commercialisation', 'trust-formation', 'OECD')!.evidenceType).toBe('research-papers');
    expect(findRegistryEntry('commercialisation', 'pricing', 'NBER')!.authority)
      .not.toBe(findRegistryEntry('commercialisation', 'commercial-failure-modes', 'NBER')!.authority);
    expect(acquisitionSeedsFor('commercialisation', 'pricing', 'NBER').map((s) => s.url))
      .not.toEqual(acquisitionSeedsFor('commercialisation', 'partnerships', 'NBER').map((s) => s.url));
  });

  it('NBER declares ONE tradition on every pillar it serves — the 2026-07-28 ruling', () => {
    // "Do not make NBER appear to become three different institutional
    // traditions merely because it serves pricing, partnerships and commercial
    // failure modes."
    //
    // Before this ruling NBER carried THREE: `Entrepreneurship Research` on
    // venture-operations/adoption, `Academic Economics` on
    // pricing/commercial-failure-modes, and a partnerships-only
    // `Academic Economics / Empirical Entrepreneurship Research` minted to make
    // that pillar clear Law II. All five now carry the operator's own naming.
    expect(NBER_TRADITION).toBe('Academic Economics / Empirical Economic Research');
    const nberRows = COMMERCIALISATION_REGISTRY.filter((e) => e.institution === 'NBER');
    expect(nberRows.map((e) => e.pillarKey).sort())
      .toEqual(['adoption', 'commercial-failure-modes', 'partnerships', 'pricing', 'venture-operations']);
    for (const row of nberRows) {
      expect(row.category, `NBER declares a pillar-specific tradition on '${row.pillarKey}'`).toBe(NBER_TRADITION);
    }
    // The three superseded strings must not survive anywhere in the registry —
    // a stale one on a sixth NBER pillar would reintroduce the split silently.
    const allCategories = new Set(COMMERCIALISATION_REGISTRY.map((e) => e.category));
    expect(allCategories.has('Academic Economics / Empirical Entrepreneurship Research')).toBe(false);
    expect(allCategories.has('Academic Economics')).toBe(false);
  });

  it('no institution declares two traditions — the STRUCTURAL guarantee, not just the NBER fix', () => {
    // "Diversity checks should not count one institution three times as
    // independent traditions." This is a rule about the mechanism; the NBER
    // data fix alone would not survive the next entry (CB-1).
    //
    // Asserted as an EXACT set, not `not.toContain('NBER')`: a new
    // multi-tradition institution must fail the build, and resolving OECD must
    // fail it too until OECD is removed from the pending list.
    for (const [domain, registry] of Object.entries(INSTITUTIONAL_REGISTRIES)) {
      const conflicts = institutionTraditionConflicts(registry);
      expect(
        conflicts.map((c) => c.institution),
        `${domain} declares an unaccounted multi-tradition institution: ` +
          conflicts.map((c) => `${c.institution} → ${c.categories.join(' | ')}`).join('; '),
      ).toEqual(domain === 'commercialisation' ? [...TRADITION_CONFLICTS_PENDING_OPERATOR_RULING] : []);
    }
    // The one pending conflict, reported in full so a steward can rule on it.
    const [oecd] = institutionTraditionConflicts(COMMERCIALISATION_REGISTRY);
    expect(oecd.institution).toBe('OECD');
    expect(oecd.categories).toEqual(['Competition Policy', 'Economics', 'International Policy Research']);
    expect(oecd.pillarKeys).toEqual(['adoption', 'pricing', 'scaling', 'trust-formation']);
    // A null category is UNDETERMINABLE, never a conflict — the whole FS
    // registry would otherwise report as one.
    expect(institutionTraditionConflicts(FINANCIAL_SERVICES_REGISTRY)).toEqual([]);
    // …and the detector must actually detect. Two rows, two traditions, one
    // institution — differing only in case and whitespace, the way a duplicate
    // is really introduced.
    expect(institutionTraditionConflicts([
      { institution: 'NBER', pillarKey: 'pricing', category: 'A' },
      { institution: ' nber ', pillarKey: 'adoption', category: 'B' },
    ])).toEqual([{ institution: 'NBER', categories: ['A', 'B'], pillarKeys: ['adoption', 'pricing'] }]);
  });

  it('the Law II closures use DIFFERENT traditions from the authority already on the pillar', () => {
    // The whole point of wave 3. If NBER's partnerships mapping reused
    // Kauffman's `Entrepreneurship Research`, or NISTA reused INCOSE's
    // `Systems`, the pillar would still read `unsatisfied` with two authorities
    // registered — a fix that looks applied and is not.
    const nber = findRegistryEntry('commercialisation', 'partnerships', 'NBER')!;
    const kauffman = findRegistryEntry('commercialisation', 'partnerships', 'Kauffman Foundation')!;
    expect(nber.category).toBe(NBER_TRADITION);
    expect(nber.category, 'NBER reuses Kauffman\'s tradition on this pillar').not.toBe(kauffman.category);
    // …and it clears the pillar WITHOUT a partnerships-only label: the same
    // string NBER carries on its other four pillars is already distinct from
    // Kauffman's. That is the difference between a real difference of school
    // and a string minted to clear the check.
    expect(nber.category).toBe(findRegistryEntry('commercialisation', 'pricing', 'NBER')!.category);
    expect(kauffman.category).toBe('Entrepreneurship Research');

    const nista = findRegistryEntry('commercialisation', 'outcome-assurance', 'National Infrastructure and Service Transformation Authority')!;
    const incose = findRegistryEntry('commercialisation', 'outcome-assurance', 'INCOSE')!;
    expect(nista.category).toBe('Public Project-Delivery Assurance / Independent Stage-Gate Review');
    expect(nista.category, 'NISTA reuses INCOSE\'s tradition on this pillar').not.toBe(incose.category);
    // Same evidence type is FINE — Law II counts traditions, not evidence
    // types — and asserting it keeps that distinction from being "tidied".
    expect(nista.evidenceType).toBe(incose.evidenceType);
  });

  it('the NISTA institutional lineage is recorded where a reviewer will see it', () => {
    // The seed's path says infrastructure-and-projects-authority; the
    // institution is NISTA. Correct, but it reads as an error. The explanation
    // must travel with the DATA (the seed's claim, which lands in the DB row),
    // not only in a migration comment.
    const seed = acquisitionSeedsFor('commercialisation', 'outcome-assurance', 'National Infrastructure and Service Transformation Authority')[0];
    expect(seed.url).toContain('infrastructure-and-projects-authority');
    expect(seed.claim, 'the lineage is not recorded on the seed itself').toMatch(/LINEAGE/i);
    expect(seed.claim).toMatch(/Infrastructure and Projects Authority/);
    expect(seed.claim).toMatch(/National Infrastructure Commission/);
    expect(LAW_II_SEED, 'the lineage does not reach the database row').toMatch(/LINEAGE \(do not "correct"\)/);
    expect(SPEC).toMatch(/recorded so it is not "corrected"/i);
  });

  it('the ruling REUSED institutions rather than inventing new ones where it could', () => {
    // "Reuse is preferable to inventing a new institution merely to make the
    // matrix look complete." Four of wave 2's ten entries reuse an institution
    // already in the registry.
    const wave1Institutions = new Set(
      tier1.filter((e) => !COMMERCIALISATION_REGISTRY_WAVE_2.includes(e)).map((e) => e.institution),
    );
    const reused = COMMERCIALISATION_REGISTRY_WAVE_2.filter((e) => wave1Institutions.has(e.institution)).map((e) => e.institution);
    expect(reused.sort()).toEqual(['NBER', 'NBER', 'OECD', 'OECD']);
  });

  it('the FS template entries match the 20260817000000 seed SQL set-for-set', () => {
    const seeded = seededInstitutionRows(FS_SEED, 'financial-services').sort();
    const template = FINANCIAL_SERVICES_REGISTRY.map((e) => `${e.pillarKey}::${e.institution}`).sort();
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
    expect(ACQUISITION_PRIORITY_ORDER.map((b) => b.rank)).toEqual([1, 2, 3, 4, 5]);
    const s112 = PRD_IDE.slice(PRD_IDE.indexOf('### 11.2'), PRD_IDE.indexOf('### 11.3'));
    const gaps = ACQUISITION_PRIORITY_ORDER.map((b) => b.gap);
    for (const [i, needle] of [
      'Commercial failure post-mortems', 'Entrepreneurship / customer-development primary research',
      'Platform & network economics', 'Pricing research', 'Service design / service operations',
    ].entries()) {
      expect(s112, `§11.2 no longer ranks '${needle}' at ${i + 1}`).toContain(`${i + 1}. **${needle}`);
      expect(gaps[i]).toBe(needle);
    }
    expect(acquisitionPriority({ pillarKey: 'commercial-failure-modes' })).toBe(1);
    expect(acquisitionPriority({ pillarKey: 'pricing' })).toBe(4);
    expect(acquisitionPriority({ pillarKey: 'trust-formation' })).toBe(ACQUISITION_PRIORITY_UNRANKED);
    expect(acquisitionPriority({ pillarKey: null })).toBe(ACQUISITION_PRIORITY_UNRANKED);
    expect(ACQUISITION_PRIORITY_UNRANKED).toBe(6);
  });
});

// ── 5 · No fabricated URL, no search fallback ──────────────────────────────

describe('SPEC-CIR-001 · the operator-supplied URLs, and nothing else', () => {
  const OPERATOR_URLS: Readonly<Record<string, string>> = {
    // Wave 1 — the first-tier direction.
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
    // Wave 2 — the ruling.
    'UK Competition and Markets Authority': 'https://www.gov.uk/government/organisations/competition-and-markets-authority',
    'World Trade Organization': 'https://www.wto.org',
    'UN Trade and Development (UNCTAD)': 'https://unctad.org',
    UNCITRAL: 'https://uncitral.un.org',
    'U.S. Bureau of Labor Statistics': 'https://www.bls.gov',
    // Wave 3 — the Law II ruling. NBER is REUSED and needs no new key.
    'National Infrastructure and Service Transformation Authority':
      'https://www.gov.uk/government/organisations/national-infrastructure-and-service-transformation-authority',
    // Reconciled, NOT the operator's bare https://www.bis.org — see below.
    'BIS Committee on Payments and Market Infrastructures': 'https://www.bis.org/cpmi/',
  };

  it('every tier-1 institution resolves to exactly the URL the operator supplied', () => {
    expect(Object.keys(OPERATOR_URLS)).toHaveLength(22);
    for (const entry of tier1) {
      const expected = OPERATOR_URLS[entry.institution];
      expect(expected, `'${entry.institution}' is in tier 1 but not in the operator's tables`).toBeTruthy();
      expect(registryEntryUrl(entry)).toBe(expected);
    }
    for (const [institution, url] of Object.entries(OPERATOR_URLS)) {
      expect(SPEC, `SPEC-CIR-001 does not carry ${institution}'s URL`).toContain(url);
    }
  });

  it('BIS CPMI is RECONCILED to one entry, at the more specific committee page', () => {
    // The operator's seed was the parent `https://www.bis.org`. Adding it would
    // create a second key for one institution AND collide with the plain `bis`
    // entry, giving two institutions one starting page.
    const keys = listCanonicalInstitutionNames().filter((k) => k.includes('committee on payments'));
    expect(keys, 'BIS CPMI has more than one homepage key').toHaveLength(1);
    expect(resolveCanonicalHomepage('BIS Committee on Payments and Market Infrastructures')).toBe('https://www.bis.org/cpmi/');
    expect(resolveCanonicalHomepage('BIS')).toBe('https://www.bis.org');
    expect(SPEC).toMatch(/BIS CPMI/);
  });

  it('resolution fails honestly — it never guesses and never falls back to search', () => {
    expect(resolveCanonicalHomepage('McKinsey Insights')).toBeNull();
    expect(resolveCanonicalHomepage('Y Combinator Library')).toBeNull();
    expect(resolveCanonicalHomepage('Institute of Things That Do Not Exist')).toBeNull();
    expect(resolveCanonicalHomepage('MiCA (EU framework)')).toBeNull();
  });

  it('the operator-supplied provenance is recorded where the URLs live', () => {
    const src = read('services/corpusScout/canonicalInstitutionHomepages.ts');
    expect(src).toMatch(/SUPPLIED VERBATIM BY THE OPERATOR/);
    expect(src).toMatch(/OPERATOR-SUPPLIED, unverified here/);
    expect(tier1.every((e) => e.urlProvenance === 'operator-supplied' || e.urlProvenance === 'pre-existing')).toBe(true);
  });
});

// ── 6 · Law II — and it must be able to FAIL ───────────────────────────────

describe('SPEC-CIR-001 · Law II of Constitutional Discovery', () => {
  const auth = (institution: string, category: string | null, pillarKey: string): DiversityInput => ({
    institution, category, evidenceType: 'research-papers', tier: 'institutional-authority', pillarKey,
  });

  it('carries the operator\'s rule verbatim, in code and in the document', () => {
    expect(LAW_II_TEXT).toBe(
      'Every IDE corpus shall contain multiple independent schools of thought and institutional traditions. ' +
      'No invariant family may rely upon a single institution, publisher, methodology, or ideological perspective.',
    );
    expect(SPEC).toContain('Every IDE corpus shall contain multiple independent schools of thought and institutional traditions.');
    expect(LAW_II_MIN_AUTHORITIES).toBe(2);
    expect(LAW_II_MIN_TRADITIONS).toBe(2);
  });

  it('a single authority is UNSATISFIED', () => {
    const [row] = assessRegistryDiversity([auth('NBER', 'Entrepreneurship Research', 'pricing')], ['pricing']);
    expect(row.verdict).toBe('unsatisfied');
    expect(row.reason).toMatch(/at least 2/);
  });

  it('two authorities from ONE tradition is UNSATISFIED — the institutional-bias case', () => {
    const [row] = assessRegistryDiversity(
      [auth('NBER', 'Entrepreneurship Research', 'pricing'), auth('Kauffman Foundation', 'Entrepreneurship Research', 'pricing')],
      ['pricing'],
    );
    expect(row.verdict).toBe('unsatisfied');
    expect(row.authorityCount).toBe(2);
    expect(row.reason).toMatch(/single institutional perspective/);
  });

  it('two authorities from TWO traditions is SATISFIED', () => {
    const [row] = assessRegistryDiversity(
      [auth('NBER', 'Entrepreneurship Research', 'pricing'), auth('OECD', 'Economics', 'pricing')],
      ['pricing'],
    );
    expect(row.verdict).toBe('satisfied');
  });

  it('ONE institution cannot satisfy Law II by itself — the inflation path is closed', () => {
    // The mechanism half of the 2026-07-28 ruling. Two rows for ONE institution
    // on ONE pillar, carrying two `category` strings, used to count as
    // "2 authorities across 2 traditions" — `satisfied`, produced entirely by
    // the single institutional perspective Law II exists to forbid. Rows are
    // now deduplicated by institution before EITHER count.
    const [row] = assessRegistryDiversity(
      [auth('NBER', 'Academic Economics', 'pricing'), auth('nber', 'Entrepreneurship Research', 'pricing')],
      ['pricing'],
    );
    expect(row.authorityCount, 'one institution counted twice as an authority').toBe(1);
    expect(row.traditions, 'one institution counted twice as a tradition').toHaveLength(1);
    expect(row.verdict).toBe('unsatisfied');
    expect(row.reason).toMatch(/at least 2/);
    // A genuine second institution still counts, so the dedupe is not a blanket
    // suppressor.
    const [ok] = assessRegistryDiversity(
      [auth('NBER', 'Academic Economics', 'pricing'), auth('NBER', 'Academic Economics', 'pricing'),
       auth('OECD', 'Competition Policy', 'pricing')],
      ['pricing'],
    );
    expect(ok.authorityCount).toBe(2);
    expect(ok.verdict).toBe('satisfied');
  });

  it('an authority with no declared tradition makes the verdict UNDETERMINABLE, not satisfied', () => {
    const [row] = assessRegistryDiversity(
      [auth('BIS', null, 'banking'), auth('FCA', null, 'banking'), auth('ECB', null, 'banking')],
      ['banking'],
    );
    expect(row.verdict).toBe('undeterminable');
    expect(row.reason).toMatch(/cannot be verified, only assumed/);
  });

  it('the real registry produces the REPORTED verdict — twelve satisfied, two not', () => {
    const inputs: DiversityInput[] = COMMERCIALISATION_REGISTRY.map((e) => ({
      institution: e.institution, category: e.category, evidenceType: e.evidenceType,
      tier: e.tier, pillarKey: e.pillarKey,
    }));
    const rows = assessRegistryDiversity(inputs, PILLAR_KEYS);
    const byVerdict = (v: string) => rows.filter((r) => r.verdict === v).map((r) => r.pillarKey).sort();

    // Wave 2 closed five pillars, wave 3 the last two. FOURTEEN of fourteen,
    // reached by adding sources — the thresholds are untouched at 2 and 2, and
    // both attempts to move them are mutation-tested.
    expect(byVerdict('unsatisfied')).toEqual([]);
    expect(byVerdict('undeterminable')).toEqual([]);
    expect(byVerdict('satisfied')).toHaveLength(14);
    expect(LAW_II_MIN_AUTHORITIES).toBe(2);
    expect(LAW_II_MIN_TRADITIONS).toBe(2);
    // The two the Law II ruling closed sit at exactly the bar — two
    // authorities, two traditions — so any regression in either shows here.
    for (const key of ['partnerships', 'outcome-assurance']) {
      const row = rows.find((r) => r.pillarKey === key)!;
      expect(row.authorityCount, `'${key}' lost its second authority`).toBe(2);
      expect(row.traditions, `'${key}' collapsed to one tradition`).toHaveLength(2);
    }
    // The document must report the same verdict the function produced.
    expect(SPEC).toMatch(/Fourteen of fourteen satisfied\. Zero unsatisfied\. Zero undeterminable\./);

    // Financial Services, whose registry records no traditions, stays
    // undeterminable everywhere — never silently "satisfied".
    const fsRows = assessRegistryDiversity(
      FINANCIAL_SERVICES_REGISTRY.map((e) => ({
        institution: e.institution, category: e.category, evidenceType: e.evidenceType, tier: e.tier, pillarKey: e.pillarKey,
      })),
      ['banking', 'payments', 'capital-markets', 'insurance', 'financial-infrastructure'],
    );
    expect(fsRows.every((r) => r.verdict === 'undeterminable')).toBe(true);
  });

  it('the check is BOUND — getDomainConstitution runs it and returns the result', async () => {
    const constitution = await getDomainConstitution(stubClient({
      corpus_coverage_pillars: [
        pillarRow('pricing'), pillarRow('adoption'),
      ],
      corpus_institutional_registry: [
        institutionRow('adoption', 'NBER', { source_tier: 'institutional-authority' }),
        institutionRow('adoption', 'OECD', { source_tier: 'institutional-authority' }),
        institutionRow('pricing', 'McKinsey Insights', { source_tier: 'practitioner-pattern', seed_url: null }),
      ],
    }), 'commercialisation');

    expect(constitution.diversity, 'getDomainConstitution returned no Law II assessment').toHaveLength(2);
    const byPillar = Object.fromEntries(constitution.diversity.map((d) => [d.pillarKey, d]));
    expect(byPillar.adoption.verdict).toBe('satisfied');
    expect(byPillar.adoption.traditions).toEqual([NBER_TRADITION, 'Economics']);
    expect(byPillar.pricing.verdict).toBe('unsatisfied');
    expect(byPillar.pricing.authorityCount).toBe(0);
    expect(constitution.institutions.find((i) => i.institutionName === 'McKinsey Insights')!.sourceTier).toBe('practitioner-pattern');
  });
});

// ── 7 · The Corpus Qualification Standard ──────────────────────────────────

describe('SPEC-CIR-001 · the Corpus Qualification Standard', () => {
  it('is PRD-ICA-001 §7\'s ratified numbers, promoted — not new ones', () => {
    expect(CQS_PDF_MIN_PAGE_COUNT).toBe(5);
    expect(CQS_PDF_MIN_SUBSTANTIVE_CHARACTERS).toBe(5_000);
    expect(CQS_PDF_MAX_BLANK_PAGE_RATIO).toBe(0.25);
    expect(CQS_TEXT_ONLY_MIN_SUBSTANTIVE_CHARACTERS).toBe(2_000);
    // Pinned to the PRD text they were promoted from.
    expect(PRD_ICA).toContain('pageCount ≥ 5 AND substantiveTextCharacters ≥ 5,000 AND blankPageRatio < 0.25');
  });

  it('states its UNIT — the operator\'s own recollection was "5,000 words"', () => {
    // 5,000 words is ~30,000 characters. A named standard whose unit is
    // implicit is a standard that gets misapplied by a factor of six.
    expect(CORPUS_QUALIFICATION_STANDARD_STATEMENT).toMatch(/CHARACTERS \(not words\)/);
    expect(SPEC).toMatch(/CHARACTERS, not words/);
  });

  it('the Inspection Agent CONSUMES the standard instead of keeping its own copy', () => {
    const src = read('services/corpusScout/inspection.ts');
    expect(src).toContain("from './corpusQualificationStandard'");
    // The mutation this survives: re-declaring `const PDF_MIN_PAGE_COUNT = 5`
    // locally would leave both callers "working" while drifting apart.
    // ANY module-level numeric constant, not just the five original names — the
    // mutation that survived the first version added `PDF_MIN_PAGE_COUNT2`,
    // which a name-prefixed pattern missed by one character.
    const declarations = src.match(/^const\s+\w+\s*[:=][^=][^;]*?\b\d[\d._]*\s*;/gm) ?? [];
    expect(declarations, `inspection.ts re-declares a threshold: ${declarations.join(' | ')}`).toEqual([]);
  });
});

// ── 8 · Verification — more than reachability, and the refusal gate ────────

describe('SPEC-CIR-001 · registry verification', () => {
  it('declares exactly the operator\'s eight statuses', () => {
    expect([...VERIFICATION_STATUSES].sort()).toEqual([
      'deprecated', 'insufficient_corpus', 'pending_verification', 'proposed',
      'redirect_changed', 'temporarily_unavailable', 'verification_failed', 'verified',
    ]);
    expect(isVerificationStatus('verified')).toBe(true);
    expect(isVerificationStatus('ok')).toBe(false);
    expect(isVerificationStatus(null)).toBe(false);

    // The five a RUN may produce, as an exact SET. Looping over the constant
    // and asserting each member is reachable is not enough: DELETING a member
    // shortens the loop and still passes, which is CFS-053 defect 7's shape (a
    // count where the property is "each of these, individually").
    expect([...RUN_OUTCOME_STATUSES].sort()).toEqual([
      'insufficient_corpus', 'redirect_changed', 'temporarily_unavailable', 'verification_failed', 'verified',
    ]);
    // …and every outcome `runVerification` can actually return must be in it,
    // or the run produces a status it is not allowed to record.
    for (const produced of ['verified', 'verification_failed', 'insufficient_corpus', 'temporarily_unavailable', 'redirect_changed'] as const) {
      expect(RUN_OUTCOME_STATUSES, `a run can return '${produced}' but may not record it`).toContain(produced);
    }

    // BOTH CHECK constraints, separately — the registry's and the seeds table's.
    // A single whole-file `toContain` passes while one of the two is missing a
    // status, because the other still mentions it.
    const checks = VERIFY_SEED.match(/CHECK \(verification_status IS NULL OR verification_status IN \([^)]*\)\)/g) ?? [];
    expect(checks, 'expected a verification_status CHECK on both tables').toHaveLength(2);
    for (const [i, check] of checks.entries()) {
      for (const st of VERIFICATION_STATUSES) {
        expect(check, `CHECK #${i + 1} omits '${st}'`).toContain(`'${st}'`);
      }
    }
  });

  it('`verified` is reachable ONLY from `pending_verification`', () => {
    // The load-bearing transition rule. Without it, anything that can write the
    // column can declare an entry verified and the refusal gate is decoration.
    for (const from of VERIFICATION_STATUSES) {
      expect(
        isVerificationTransitionAllowed(from, 'verified'),
        `'${from}' → 'verified' is allowed — verification can be asserted instead of earned`,
      ).toBe(from === 'pending_verification');
    }
    expect(isVerificationTransitionAllowed('proposed', 'pending_verification')).toBe(true);
    expect(isVerificationTransitionAllowed('deprecated', 'pending_verification')).toBe(false);
    expect(isVerificationTransitionAllowed('deprecated', 'proposed')).toBe(true);
    // Every run outcome must be reachable from a run, or the run can't record it.
    for (const outcome of RUN_OUTCOME_STATUSES) {
      expect(isVerificationTransitionAllowed('pending_verification', outcome), `a run cannot record '${outcome}'`).toBe(true);
    }
    // Re-verification is always available; a verified entry can go stale.
    expect(isVerificationTransitionAllowed('verified', 'pending_verification')).toBe(true);
  });

  it('the refusal gate needs BOTH ratification and verification', () => {
    expect(canRunInstitutionDiscovery({ status: 'ratified', verificationStatus: 'verified' }).allowed).toBe(true);
    // Ratified but not verified — the case the ruling exists for.
    for (const v of VERIFICATION_STATUSES.filter((s) => s !== 'verified')) {
      const gate = canRunInstitutionDiscovery({ status: 'ratified', verificationStatus: v });
      expect(gate.allowed, `a '${v}' entry is allowed to acquire`).toBe(false);
    }
    expect(canRunInstitutionDiscovery({ status: 'ratified', verificationStatus: null }).allowed).toBe(false);
    // Verified but not ratified — acquiring from an authority nobody accepted.
    expect(canRunInstitutionDiscovery({ status: 'proposed', verificationStatus: 'verified' }).allowed).toBe(false);
  });

  it('the gate is BOUND — runDiscoveryForInstitution refuses a ratified-but-unverified entry', async () => {
    // Behavioural, not symbolic: the real orchestrator, a real registry row,
    // and the assertion that nothing was acquired. If the gate is removed this
    // call proceeds to seed-URL resolution and network access.
    const admin = stubClient({
      corpus_coverage_pillars: [pillarRow('pricing')],
      corpus_institutional_registry: [
        institutionRow('pricing', 'NBER', { status: 'ratified', verification_status: 'pending_verification' }),
      ],
    });
    const result = await runDiscoveryForInstitution(admin, { domain: 'commercialisation', pillarKey: 'pricing', institutionName: 'NBER' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/must be VERIFIED before discovery can run/);
    expect(result.submitted).toBe(0);
    expect(result.found).toBe(0);
  });

  it('a domain run cannot become a way around the per-institution refusal', async () => {
    const admin = stubClient({
      corpus_coverage_pillars: [pillarRow('pricing')],
      corpus_institutional_registry: [
        institutionRow('pricing', 'NBER', { status: 'ratified', verification_status: 'proposed' }),
        institutionRow('pricing', 'OECD', { status: 'ratified', verification_status: 'insufficient_corpus' }),
      ],
    });
    const result = await runDiscoveryForDomain(admin, 'commercialisation');
    expect(result.institutionsAttempted).toBe(0);
    expect(result.totalSubmitted).toBe(0);
  });

  it('reachability alone is NOT verification — an empty listing is insufficient_corpus', async () => {
    const outcome = await runVerification('https://www.nber.org', deps({ candidates: [] }));
    expect(outcome.status).toBe('insufficient_corpus');
    expect(outcome.detail).toMatch(/reachable is not the same as acquirable/);
    expect(outcome.qualifyingDocuments).toEqual([]);
  });

  it('candidates that all fall below the standard are insufficient_corpus, not verified', async () => {
    const outcome = await runVerification('https://www.nber.org', deps({ passes: false }));
    expect(outcome.status).toBe('insufficient_corpus');
    expect(outcome.candidatesFound).toBe(1);
    expect(outcome.documentsInspected).toBe(1);
    expect(outcome.qualifyingDocuments).toEqual([]);
  });

  it('all four conjuncts satisfied ⇒ verified, WITH the bytes and inspection recorded', async () => {
    const outcome = await runVerification('https://www.nber.org', deps({}));
    expect(outcome.status).toBe('verified');
    expect(outcome.resolvedUrl).toBe('https://www.nber.org');
    expect(outcome.qualifyingDocuments).toHaveLength(1);
    const [doc] = outcome.qualifyingDocuments;
    // §3 of the ruling: record resolved URL, timestamp, representative
    // documents, inspection results and content hashes.
    expect(doc.contentHash).toBe('sha256-abc');
    expect(doc.pageCount).toBe(12);
    expect(doc.substantiveTextCharacters).toBe(9_000);
    expect(outcome.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(outcome.standard).toBe(CORPUS_QUALIFICATION_STANDARD_STATEMENT);
  });

  it('a timeout is temporarily_unavailable; an off-host redirect is redirect_changed', async () => {
    const timedOut = await runVerification('https://www.nber.org', deps({ redirectFailure: 'timeout' }));
    expect(timedOut.status).toBe('temporarily_unavailable');

    const moved = await runVerification('https://www.nber.org', deps({ finalUrl: 'https://elsewhere.example/nber' }));
    expect(moved.status).toBe('redirect_changed');
    expect(moved.detail).toMatch(/redirects off-host/);
    // A same-host hop is routine and must NOT trip it.
    const sameHost = await runVerification('https://www.nber.org', deps({ finalUrl: 'https://www.nber.org/en/' }));
    expect(sameHost.status).toBe('verified');
  });

  it('applyVerificationOutcome refuses an illegal transition and writes nothing', async () => {
    const writes: unknown[] = [];
    const admin = stubClient({}, writes);
    const outcome = await runVerification('https://www.nber.org', deps({}));
    const refused = await applyVerificationOutcome(
      admin, { domain: 'commercialisation', pillarKey: 'pricing', institutionName: 'NBER' },
      'proposed', outcome,
    );
    expect(refused.ok).toBe(false);
    expect((refused as { error: string }).error).toMatch(/'proposed' → 'verified' is not allowed/);
    expect(writes, 'a refused transition still wrote to the registry').toEqual([]);
  });
});

// ── 9 · Phase 1 does not ratify and does not verify ────────────────────────

describe('SPEC-CIR-001 · nothing is ratified or verified by being written', () => {
  it('every commercialisation row either migration seeds lands `proposed`', () => {
    for (const [name, sql] of [['20260827', COM_SEED], ['20260828', VERIFY_SEED], ['20260829', LAW_II_SEED]] as const) {
      for (const line of sql.split('\n').filter((l) => l.includes("'commercialisation'") && !l.trim().startsWith('--'))) {
        expect(line, `${name} seeds a ratified commercialisation row: ${line.trim()}`).not.toMatch(/'ratified'/);
      }
    }
  });

  it('NOTHING is seeded `verified` — an operator-supplied URL is not a verified URL', () => {
    // Strip comments AND the DO $$ … END $$ blocks, whose CHECK constraints
    // legitimately list every status including 'verified'. What must not appear
    // is an INSERT or UPDATE that WRITES it.
    const sql = VERIFY_SEED
      .replace(/^\s*--.*$/gm, '')
      .replace(/DO \$\$[\s\S]*?END \$\$;/g, '')
      .replace(/COMMENT ON[\s\S]*?;\n/g, '');
    expect(sql, 'the migration marks something verified without a run').not.toMatch(/'verified'/);
    // Every operator URL enters pending_verification instead.
    expect((sql.match(/'pending_verification'/g) ?? []).length).toBeGreaterThanOrEqual(27);
    expect(SPEC).toMatch(/Do not treat the URLs as verified merely because they are operator-supplied/);
  });

  it('the wave-3 migration lands `proposed` / `pending_verification` — the browser check is not verification', () => {
    // "They have been live-checked here, but only the deployed Corpus Scout
    // inspection run may award `verified`."
    const sql = LAW_II_SEED.replace(/^\s*--.*$/gm, '');
    expect(sql, 'wave 3 marks something verified without a run').not.toMatch(/'verified'/);
    expect(sql, 'wave 3 ratifies something').not.toMatch(/'ratified'/);
    // Two institution rows and two seeds, each explicitly pending.
    expect((sql.match(/'pending_verification'/g) ?? []).length).toBe(4);
    for (const institution of ['NBER', 'National Infrastructure and Service Transformation Authority']) {
      expect(sql).toContain(institution);
    }
    // A NEW file — the two applied migrations must not be edited to carry it.
    expect(COM_SEED).not.toContain('National Infrastructure and Service Transformation Authority');
    expect(VERIFY_SEED).not.toContain('National Infrastructure and Service Transformation Authority');
    expect(VERIFY_SEED).not.toContain('w17181');
  });

  it('the acquisition seeds are DOCUMENTS, not institutional seed URLs', () => {
    expect(COMMERCIALISATION_ACQUISITION_SEEDS).toHaveLength(19);
    for (const seed of COMMERCIALISATION_ACQUISITION_SEEDS) {
      // Every seed hangs off a (pillar, institution) that is really registered.
      expect(
        findRegistryEntry(seed.domain, seed.pillarKey, seed.institution),
        `seed ${seed.url} has no registry entry for ${seed.pillarKey}/${seed.institution}`,
      ).not.toBeNull();
      // A document seed must never be mistaken for the institution's homepage.
      expect(
        resolveCanonicalHomepage(seed.institution),
        `${seed.institution}'s homepage equals a document seed — seed_url has been overloaded`,
      ).not.toBe(seed.url);
      // The operator's page counts are CLAIMS, never measured facts.
      expect(seed.claim, `seed ${seed.url} states its claim as a fact`).toMatch(/^Operator claim:/);
      expect(
        VERIFY_SEED.includes(seed.url) || LAW_II_SEED.includes(seed.url),
        `seed ${seed.url} is in no migration`,
      ).toBe(true);
    }
    expect(acquisitionSeedsFor('commercialisation', 'pricing', 'OECD')).toHaveLength(2);
    expect(acquisitionSeedsFor('commercialisation', 'pricing', 'Santa Fe Institute')).toEqual([]);

    // EVERY operator-supplied entry (waves 2 and 3) carries the acquisition
    // seed that justifies it. Asserting only that a seed's (pillar,
    // institution) exists somewhere in the registry is not enough: NBER is
    // registered on five pillars, so moving its `partnerships` seed to
    // `venture-operations` leaves the seed "valid" while the pillar the
    // operator closed has no evidential target at all. An institution added to
    // close a Law II gap without its seed is a name, not a source.
    for (const entry of [...COMMERCIALISATION_REGISTRY_WAVE_2, ...COMMERCIALISATION_REGISTRY_WAVE_3]) {
      expect(
        acquisitionSeedsFor('commercialisation', entry.pillarKey!, entry.institution),
        `${entry.pillarKey}/${entry.institution} was registered with no acquisition seed`,
      ).not.toHaveLength(0);
    }
    // The two the Law II ruling supplied, pinned to their pillars by URL — the
    // operator called the NBER paper "unusually well targeted", which is a
    // property of the pairing, not of the URL on its own.
    expect(acquisitionSeedsFor('commercialisation', 'partnerships', 'NBER').map((x) => x.url))
      .toEqual(['https://www.nber.org/papers/w17181']);
    expect(acquisitionSeedsFor('commercialisation', 'outcome-assurance', 'National Infrastructure and Service Transformation Authority')
      .map((x) => x.url))
      .toEqual(['https://www.gov.uk/government/collections/infrastructure-and-projects-authority-assurance-review-toolkit']);
    // The table exists and is its own thing, not a column on the registry.
    // Word-bounded: `corpus_acquisition_seeds_x` contains the substring, so a
    // bare toMatch survives a rename of the table the seeds are inserted into.
    expect(VERIFY_SEED).toMatch(/CREATE TABLE IF NOT EXISTS public\.corpus_acquisition_seeds\s*\(/);
    expect(VERIFY_SEED).toMatch(/INSERT INTO public\.corpus_acquisition_seeds\s*\n?\s*\(/);
    // Every table this migration inserts into must be one it creates or one
    // that already exists — a renamed CREATE leaves the INSERT pointing at
    // nothing.
    const created = new Set((VERIFY_SEED.match(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g) ?? []).map((m) => m.split('.')[1]));
    const insertedInto = new Set((VERIFY_SEED.match(/INSERT INTO public\.(\w+)/g) ?? []).map((m) => m.split('.')[1]));
    for (const table of insertedInto) {
      const preExisting = table === 'corpus_institutional_registry';
      expect(created.has(table) || preExisting, `migration inserts into '${table}', which it neither creates nor pre-exists`).toBe(true);
    }
  });

  it('both migrations are additive and idempotent (CFS-010 §3)', () => {
    for (const sql of [COM_SEED, VERIFY_SEED, LAW_II_SEED]) {
      const stripped = sql.replace(/^\s*--.*$/gm, '');
      const inserts = (stripped.match(/INSERT INTO/g) ?? []).length;
      const conflicts = (stripped.match(/ON CONFLICT[\s\S]{0,120}?DO NOTHING/g) ?? []).length;
      expect(conflicts).toBe(inserts);
    }
    expect(VERIFY_SEED).toMatch(/ADD COLUMN IF NOT EXISTS verification_status text/);
    expect(VERIFY_SEED).toMatch(/CREATE TABLE IF NOT EXISTS/);
  });

  it('the registry document is registered in the IRL pack and states its status', () => {
    const collections = JSON.parse(read('codexes/packs/irl/collections.json')) as {
      collections: { id: string; items: string[] }[];
    };
    expect(collections.collections.find((c) => c.id === 'col_foundation')!.items)
      .toContain('foundation/SPEC-CIR-001_commercialisation-institutional-registry.md');
    expect(SPEC).toMatch(/PHASE 1 OUTPUT — PROPOSED, NOTHING HERE IS RATIFIED/);
    expect(SPEC).toMatch(/Do not perform acquisition yet\. Produce the registry first\./);
    expect(SPEC).toMatch(/Recommendation: adopt as Law II of Constitutional Discovery, by amendment to PRD-ICA-001/);
    // The FS backfill is its own work item, not a reason to weaken Law II.
    expect(SPEC).toMatch(/separate remediation work/i);
  });
});

// ── stubs ───────────────────────────────────────────────────────────────────

function pillarRow(pillarKey: string) {
  return {
    id: `p-${pillarKey}`, domain: 'commercialisation', pillar_key: pillarKey, pillar_label: pillarKey,
    completeness_definition: '', status: 'ratified', created_at: '', updated_at: '', saturation_confirmed: false,
  };
}

function institutionRow(pillarKey: string, institution: string, over: Record<string, unknown> = {}) {
  return {
    id: `i-${pillarKey}-${institution}`, domain: 'commercialisation', pillar_key: pillarKey,
    institution_name: institution, status: 'proposed', created_at: '', updated_at: '',
    seed_url: 'https://example.org', source_tier: 'institutional-authority',
    verification_status: 'proposed', ...over,
  };
}

/** Minimal chainable Supabase stub. `writes` collects every `update` payload so
 *  a canary can assert that a refused path wrote nothing. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stubClient(rows: Record<string, unknown[]>, writes: unknown[] = []): any {
  return {
    from(table: string) {
      const data = rows[table] ?? [];
      const self: Record<string, unknown> = {};
      self.select = () => self;
      self.eq = () => self;
      self.update = (payload: unknown) => { writes.push(payload); return self; };
      self.maybeSingle = async () => ({ data: data[0] ?? null, error: null });
      self.order = async () => ({ data, error: null });
      self.then = undefined;
      return self;
    },
  };
}

/** Injected transports for `runVerification` — the four real ones are already
 *  ratified machinery; these stand in for them so the conjuncts can be tested
 *  without network access (which this environment does not have anyway). */
function deps(opts: {
  redirectFailure?: 'timeout' | 'redirect-loop' | 'unknown';
  finalUrl?: string;
  candidates?: { documentUrl: string; title: string; discoveryUrl: string; foundOnUrl: string }[];
  passes?: boolean;
}): VerificationDeps {
  const candidates = opts.candidates ?? [
    { documentUrl: 'https://www.nber.org/papers/w21679.pdf', title: 'A paper', discoveryUrl: 'https://www.nber.org', foundOnUrl: 'https://www.nber.org' },
  ];
  return {
    followRedirects: (async (url: string) =>
      opts.redirectFailure
        ? { ok: false, failureClass: opts.redirectFailure, redirectCount: 1, finalUrl: url }
        : { ok: true, response: new Response('', { status: 200 }), finalUrl: opts.finalUrl ?? url, redirectCount: 0 }
    ) as VerificationDeps['followRedirects'],
    runInstitutionDiscovery: (async () => ({ ok: true, pagesFetched: 1, candidates })) as VerificationDeps['runInstitutionDiscovery'],
    retrieveArtifact: (async () => ({
      ok: true, bytes: Buffer.from('%PDF-1.7 some bytes'), contentType: 'application/pdf',
      declaredMimeMismatch: false, artifactHash: 'sha256-abc', fileSizeBytes: 4096,
      resolutionChain: { discoveryUrl: '', downloadUrl: '', resolvedArtifactUrl: '', redirectCount: 0 },
    })) as VerificationDeps['retrieveArtifact'],
    inspectArtifact: (async () => ({
      ok: true, normalizedText: 'x', pageCount: 12, substantiveTextCharacters: 9_000,
      blankPageRatio: 0.05, extractionWarnings: [],
      passesContentPresenceCheck: opts.passes !== false,
    })) as VerificationDeps['inspectArtifact'],
  };
}

/** Type-level: the shared template is one type for both domains. */
const _sharedTemplate: readonly InstitutionalRegistryEntry[][] = [
  FINANCIAL_SERVICES_REGISTRY as InstitutionalRegistryEntry[],
  COMMERCIALISATION_REGISTRY as InstitutionalRegistryEntry[],
];
void _sharedTemplate;
const _statuses: readonly VerificationStatus[] = VERIFICATION_STATUSES;
void _statuses;
