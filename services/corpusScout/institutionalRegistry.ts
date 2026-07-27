/**
 * Corpus Scout — the GENERALISED Institutional Registry template, and the
 * Commercialisation instance of it (Phase 1 of the operator direction of
 * 2026-07-27; specified in
 * `codexes/packs/irl/foundation/SPEC-CIR-001_commercialisation-institutional-registry.md`).
 *
 * ── Why this module exists ──────────────────────────────────────────────────
 *
 * The Financial Services registry (the ratified first instance, seeded by
 * `supabase/migrations/20260817000000_corpus_domain_constitution.sql`) records
 * only THREE facts per authority: domain, pillar, institution name. The
 * operator's direction generalises it:
 *
 *   "Instead of creating ad hoc registries, every horizontal domain should
 *    define the same metadata: Institution · Category · Authority · URL ·
 *    Evidence Type · Priority · Notes. That becomes the standard input to the
 *    IDE, regardless of domain."
 *
 * A template that Commercialisation uses and Financial Services does not is
 * two registries again — the `inv.engineering.036/037` defect this repo fails
 * builds over. So BOTH domains are declared here, in ONE type, consumed by ONE
 * set of functions. Financial Services' four un-captured fields are `null`,
 * NOT invented (see `FINANCIAL_SERVICES_REGISTRY`); the template is shared by
 * type and by code path today, and by data when a steward completes them.
 *
 * ── What is NOT here (deliberately) ─────────────────────────────────────────
 *
 * The URL. `canonicalInstitutionHomepages.ts` is the single authoritative
 * institution→homepage directory, and `registryEntryUrl()` reads it. Restating
 * a URL here would be the same duplicate defect one field down.
 *
 * The registry ITSELF. The live registry is DB rows in
 * `corpus_institutional_registry`; this module is the curated INPUT that seeds
 * and classifies them, and the only place the tier/category/evidence-type
 * classification of a named institution is declared.
 *
 * ── Nothing here is ratified by being written ───────────────────────────────
 *
 * Every entry lands as `proposed`. Ratification is a steward act
 * (`ratifyInstitutionEntry`) and is explicitly Phase 2, not Phase 1.
 */

import { resolveCanonicalHomepage } from './canonicalInstitutionHomepages';

// ── The template ────────────────────────────────────────────────────────────

/**
 * The STRUCTURAL tier separation the operator's direction requires:
 *
 *   "[the practitioner sources] are not primary scientific authorities, but
 *    they provide a rich source of operational patterns that can be compared
 *    against the academic corpus."
 *
 * Recorded as a field rather than as prose in `notes`, because a later
 * analysis that treats a consultancy insight piece as equivalent evidence to
 * an NBER working paper is a serious methodological error, and a Notes column
 * cannot prevent it. `source_tier` exists on the DB row too (migration
 * `20260818000000`) so the distinction survives into SQL-level analysis.
 *
 * ORTHOGONAL to `evidenceType` — the operator's own first tier contains
 * practitioner-guidance publishers (Strategyzer, SVPG, Product School, Lean
 * Startup). Tier answers "which acquisition wave", evidence type answers
 * "what kind of artefact". Neither substitutes for the other.
 */
export type SourceTier = 'institutional-authority' | 'practitioner-pattern';

export const SOURCE_TIERS: readonly SourceTier[] = ['institutional-authority', 'practitioner-pattern'];

export function isSourceTier(v: unknown): v is SourceTier {
  return typeof v === 'string' && (SOURCE_TIERS as readonly string[]).includes(v);
}

/** The operator's "Evidence Type" column: research papers / standards /
 *  policy / practitioner guidance / datasets. */
export type EvidenceTypeClass =
  | 'research-papers'
  | 'standards'
  | 'policy'
  | 'practitioner-guidance'
  | 'datasets';

export const EVIDENCE_TYPE_CLASSES: readonly EvidenceTypeClass[] = [
  'research-papers', 'standards', 'policy', 'practitioner-guidance', 'datasets',
];

/** Where an entry's homepage came from — recorded because the sandbox cannot
 *  verify a URL and must never claim to have. */
export type UrlProvenance =
  /** Supplied verbatim by the operator in the 2026-07-27 direction. */
  | 'operator-supplied'
  /** Already in the curated directory before this registry existed (FS). */
  | 'pre-existing'
  /** No URL supplied by anyone. Resolution fails honestly; the entry is not
   *  eligible for Agent B/C until a steward provides a seedUrl. */
  | 'none';

/**
 * ONE registry row, for ANY domain. The operator's seven columns
 * (Institution · Category · Authority · URL · Evidence Type · Priority ·
 * Notes) map on as:
 *
 *   Institution   → `institution`
 *   Category      → `category`      (the institutional TRADITION — also the
 *                                    axis Law II's diversity check counts)
 *   Authority     → `authority`     (WHY this source is authoritative)
 *   URL           → derived, `registryEntryUrl()`
 *   Evidence Type → `evidenceType`
 *   Priority      → derived, `acquisitionPriority()`
 *   Notes         → `notes`
 *
 * Two columns are DERIVED rather than stored. URL, because the homepage
 * directory already owns that fact. Priority, because acquisition order is a
 * function of which coverage pillars an institution serves and which pillars
 * are the widest evidential gaps (PRD-IDE-002 §11.2) — a hand-typed number
 * would go stale the moment either changes.
 */
export interface InstitutionalRegistryEntry {
  institution: string;
  /** Null where the source registry never captured it. NEVER invented. */
  category: string | null;
  /** Null where the source registry never captured it. NEVER invented. */
  authority: string | null;
  /** Null where the source registry never captured it. NEVER invented. */
  evidenceType: EvidenceTypeClass | null;
  tier: SourceTier;
  /**
   * The Constitutional Coverage Model pillars this institution is registered
   * against — the natural key half of `corpus_institutional_registry`.
   * EMPTY means "no pillar basis was supplied", and `upsertInstitutionEntry`
   * cannot insert such an entry at all: a pillar-less institution is
   * structurally un-acquirable until a steward assigns one.
   */
  pillarKeys: readonly string[];
  notes: string | null;
  urlProvenance: UrlProvenance;
}

/** The entry's seed URL — read from the curated homepage directory, never
 *  restated here and never searched for. `null` when the institution isn't in
 *  the directory, which is an honest failure, not a gap to fill with a guess. */
export function registryEntryUrl(entry: InstitutionalRegistryEntry): string | null {
  return resolveCanonicalHomepage(entry.institution);
}

// ── Acquisition priority — DERIVED from the ratified evidential gaps ─────────

/**
 * PRD-IDE-002 §11.2's ordered acquisition priorities, bound to the coverage
 * pillars each one names. Pinned to the PRD by canary — if §11.2 is reordered
 * and this is not, the build fails rather than the registry acquiring in the
 * wrong order.
 */
export const ACQUISITION_PRIORITY_ORDER: readonly {
  rank: number;
  gap: string;
  pillarKeys: readonly string[];
}[] = [
  { rank: 1, gap: 'Commercial failure post-mortems', pillarKeys: ['commercial-failure-modes'] },
  { rank: 2, gap: 'Entrepreneurship / customer-development primary research', pillarKeys: ['customer-discovery', 'venture-operations'] },
  { rank: 3, gap: 'Platform & network economics', pillarKeys: ['adoption', 'distribution', 'partnerships'] },
  { rank: 4, gap: 'Pricing research', pillarKeys: ['pricing'] },
  { rank: 5, gap: 'Service design / service operations', pillarKeys: ['outcome-assurance', 'value-proposition'] },
];

/** An entry serving no gap-ranked pillar acquires after every ranked one. */
export const ACQUISITION_PRIORITY_UNRANKED = ACQUISITION_PRIORITY_ORDER.length + 1;

/** The strongest (lowest) §11.2 rank among the pillars this entry serves. */
export function acquisitionPriority(entry: Pick<InstitutionalRegistryEntry, 'pillarKeys'>): number {
  let best = ACQUISITION_PRIORITY_UNRANKED;
  for (const band of ACQUISITION_PRIORITY_ORDER) {
    if (entry.pillarKeys.some((p) => band.pillarKeys.includes(p)) && band.rank < best) best = band.rank;
  }
  return best;
}

// ── Law II of Constitutional Discovery — the diversity check ────────────────

/**
 * The constitutional acquisition rule the operator states for ALL future IDE
 * domains, proposed as **Law II of Constitutional Discovery** (sibling of
 * Law I, which lives in the ratified PRD-ICA-001 amendment §2.0):
 *
 *   "Every IDE corpus shall contain multiple independent schools of thought
 *    and institutional traditions. No invariant family may rely upon a single
 *    institution, publisher, methodology, or ideological perspective."
 *
 * Carried verbatim, pinned to SPEC-CIR-001 by canary. A rule nothing can check
 * is the CFS-053 latent-mechanism defect, so it is checked in three places,
 * of which ONE is built:
 *
 *   registry-time  (BUILT, here + surfaced by `getDomainConstitution`) — a
 *                  pillar must register ≥2 institutional-authority sources
 *                  from ≥2 distinct traditions before its corpus is trusted.
 *   ratification   (PROPOSED, SPEC-CIR-001 §7) — `confirmPillarSaturation`
 *                  refuses while a pillar's verdict is not `satisfied`.
 *   corpus-time    (PROPOSED, SPEC-CIR-001 §7) — issuer concentration over
 *                  `corpus_candidate_sources.issuer` per pillar.
 */
export const LAW_II_TEXT =
  'Every IDE corpus shall contain multiple independent schools of thought and institutional traditions. ' +
  'No invariant family may rely upon a single institution, publisher, methodology, or ideological perspective.';

/** Minimum distinct institutional-authority sources per pillar. */
export const LAW_II_MIN_AUTHORITIES = 2;
/** Minimum distinct institutional TRADITIONS (the Category axis) per pillar. */
export const LAW_II_MIN_TRADITIONS = 2;

export type LawIIVerdict = 'satisfied' | 'unsatisfied' | 'undeterminable';

export interface PillarDiversityRow {
  pillarKey: string;
  /** Count of tier-1 institutions registered against this pillar. Practitioner
   *  -tier and tier-undeclared rows are NOT counted — fail-closed. */
  authorityCount: number;
  traditions: string[];
  evidenceTypes: string[];
  verdict: LawIIVerdict;
  reason: string;
}

/** The shape `assessRegistryDiversity` needs — satisfied by a template entry
 *  and by a DB row joined to its template entry alike. */
export interface DiversityInput {
  institution: string;
  category: string | null;
  evidenceType: EvidenceTypeClass | null;
  /** `null` = the row does not declare a tier. Never counted as an authority. */
  tier: SourceTier | null;
  pillarKeys: readonly string[];
}

/**
 * Law II, evaluated per pillar. `undeterminable` is a distinct verdict from
 * `unsatisfied` on purpose: the Financial Services registry records no
 * `category` for any institution, so its tradition diversity cannot be
 * VERIFIED — reporting that as a violation would be as dishonest as reporting
 * it as compliance.
 */
export function assessRegistryDiversity(
  entries: readonly DiversityInput[],
  pillarKeys: readonly string[],
): PillarDiversityRow[] {
  return pillarKeys.map((pillarKey) => {
    const forPillar = entries.filter((e) => e.pillarKeys.includes(pillarKey));
    const authorities = forPillar.filter((e) => e.tier === 'institutional-authority');
    const traditions = [...new Set(authorities.map((e) => e.category).filter((c): c is string => !!c))].sort();
    const evidenceTypes = [...new Set(authorities.map((e) => e.evidenceType).filter((t): t is EvidenceTypeClass => !!t))].sort();
    const authorityCount = authorities.length;

    if (authorityCount === 0) {
      return {
        pillarKey, authorityCount, traditions, evidenceTypes,
        verdict: 'unsatisfied' as const,
        reason: 'no institutional-authority source is registered against this pillar',
      };
    }
    if (authorities.some((e) => !e.category)) {
      return {
        pillarKey, authorityCount, traditions, evidenceTypes,
        verdict: 'undeterminable' as const,
        reason: 'at least one registered authority declares no institutional tradition — Law II cannot be verified, only assumed',
      };
    }
    if (authorityCount < LAW_II_MIN_AUTHORITIES) {
      return {
        pillarKey, authorityCount, traditions, evidenceTypes,
        verdict: 'unsatisfied' as const,
        reason: `only ${authorityCount} institutional authority registered — Law II requires at least ${LAW_II_MIN_AUTHORITIES}`,
      };
    }
    if (traditions.length < LAW_II_MIN_TRADITIONS) {
      return {
        pillarKey, authorityCount, traditions, evidenceTypes,
        verdict: 'unsatisfied' as const,
        reason: `all ${authorityCount} authorities come from one tradition ('${traditions[0]}') — Law II forbids reliance on a single institutional perspective`,
      };
    }
    return {
      pillarKey, authorityCount, traditions, evidenceTypes,
      verdict: 'satisfied' as const,
      reason: `${authorityCount} authorities across ${traditions.length} traditions`,
    };
  });
}

// ── The Commercialisation registry — TIER 1 ─────────────────────────────────

/**
 * The operator's first-tier table, 2026-07-27, verbatim in name, category,
 * and URL. **The URLs are OPERATOR-SUPPLIED.** They were not verified from
 * this sandbox — outbound HTTPS is blocked here — and nothing in this module
 * claims otherwise. The first discovery run on the deployed app is what
 * verifies them; a dead entry surfaces as an honest Agent B/C failure, never
 * as a search fallback.
 *
 * `authority` restates the operator's own "Purpose" column — it is a record
 * of what the operator asserted, not an independent claim about what any of
 * these institutions publishes.
 *
 * `pillarKeys` is AGENT-PROPOSED. The operator supplied Category and Purpose,
 * not coverage pillars; every mapping below is derived from the operator's own
 * words against PRD-IDE-002 §4's pillar definitions, and each one is argued in
 * SPEC-CIR-001 §4. A steward ratifies or corrects them in Phase 2. Where the
 * operator's words give no basis for a pillar, none is asserted — which is why
 * five of the fourteen pillars have no tier-1 institution (SPEC-CIR-001 §5).
 */
const COMMERCIALISATION_TIER_1: readonly InstitutionalRegistryEntry[] = [
  {
    institution: 'NBER',
    category: 'Entrepreneurship Research',
    authority: 'Operator-designated: entrepreneurship, innovation, venture research (National Bureau of Economic Research).',
    evidenceType: 'research-papers',
    tier: 'institutional-authority',
    pillarKeys: ['venture-operations', 'adoption'],
    notes: 'Pillars proposed from the operator Purpose: "venture research" → venture-operations; "innovation" → adoption (§4: how a party moves through the states of using the offer).',
    urlProvenance: 'operator-supplied',
  },
  {
    institution: 'Kauffman Foundation',
    category: 'Entrepreneurship Research',
    authority: 'Operator-designated: entrepreneurship and startup ecosystems.',
    evidenceType: 'research-papers',
    tier: 'institutional-authority',
    pillarKeys: ['venture-operations', 'partnerships'],
    notes: 'Pillars proposed from the operator Purpose: "startup ecosystems" is a direct word match for §4 partnerships ("Partnerships & Ecosystem Development").',
    urlProvenance: 'operator-supplied',
  },
  {
    institution: 'SSRN',
    category: 'Research Repository',
    authority: 'Operator-designated: entrepreneurship, strategy, innovation papers.',
    evidenceType: 'research-papers',
    tier: 'institutional-authority',
    pillarKeys: ['venture-operations', 'adoption'],
    notes: 'A repository, not an issuer — cross-pillar by nature. Registered only against the pillars its operator Purpose names. "strategy" has no §4 pillar and is deliberately not mapped.',
    urlProvenance: 'operator-supplied',
  },
  {
    institution: 'OECD',
    category: 'Economics',
    authority: 'Operator-designated: innovation, productivity, digital economy.',
    evidenceType: 'policy',
    tier: 'institutional-authority',
    pillarKeys: ['adoption', 'scaling'],
    notes: 'Pillars proposed from the operator Purpose: "innovation" → adoption; "productivity" → scaling (§4: how delivery is repeated without linear cost).',
    urlProvenance: 'operator-supplied',
  },
  {
    institution: 'World Bank',
    category: 'Economics',
    authority: 'Operator-designated: private sector development, entrepreneurship.',
    evidenceType: 'policy',
    tier: 'institutional-authority',
    pillarKeys: ['venture-operations', 'commercial-governance'],
    notes: 'Already present in the curated homepage directory as a Financial Services authority — one institution, two domains, one URL fact. Not re-declared.',
    urlProvenance: 'pre-existing',
  },
  {
    institution: 'MIT Sloan',
    category: 'Innovation',
    authority: 'Operator-designated: innovation management research.',
    evidenceType: 'research-papers',
    tier: 'institutional-authority',
    pillarKeys: ['adoption', 'venture-operations'],
    notes: 'Pillars proposed from the operator Purpose: "innovation" → adoption; "management" → venture-operations (§4: how the commercialising organisation is structured and progressed).',
    urlProvenance: 'operator-supplied',
  },
  {
    institution: 'Stanford Graduate School of Business',
    category: 'Innovation',
    authority: 'Operator-designated: entrepreneurship and scaling.',
    evidenceType: 'research-papers',
    tier: 'institutional-authority',
    pillarKeys: ['scaling', 'venture-operations'],
    notes: 'Both pillars are verbatim word matches in the operator Purpose — the least inferential mapping in the tier.',
    urlProvenance: 'operator-supplied',
  },
  {
    institution: 'Harvard Business School',
    category: 'Innovation',
    authority: 'Operator-designated: strategy, innovation, commercialisation.',
    evidenceType: 'research-papers',
    tier: 'institutional-authority',
    pillarKeys: ['revenue-architecture', 'adoption'],
    notes: 'Pillars proposed from the operator Purpose: "commercialisation"/"strategy" → revenue-architecture (§4: where revenue originates and how offers compose); "innovation" → adoption.',
    urlProvenance: 'operator-supplied',
  },
  {
    institution: 'Strategic Management Society',
    category: 'Strategy',
    authority: 'Operator-designated: strategy research.',
    evidenceType: 'research-papers',
    tier: 'institutional-authority',
    pillarKeys: ['revenue-architecture', 'commercial-governance'],
    notes: 'Weakest mapping in the tier — §4 has no "strategy" pillar. Flagged in SPEC-CIR-001 §4 as the entry most likely to be re-pillared by a steward.',
    urlProvenance: 'operator-supplied',
  },
  {
    institution: 'Santa Fe Institute',
    category: 'Systems',
    authority: 'Operator-designated: complex adaptive systems, emergence.',
    evidenceType: 'research-papers',
    tier: 'institutional-authority',
    pillarKeys: ['scaling'],
    notes: 'Deliberately NOT mapped to commercial-failure-modes: "complex adaptive systems, emergence" does not say failure studies, and the pillar PRD-IDE-002 §11.2 ranks as the widest gap must not be closed by inference.',
    urlProvenance: 'operator-supplied',
  },
  {
    institution: 'INCOSE',
    category: 'Systems',
    authority: 'Operator-designated: systems engineering and organisational systems.',
    evidenceType: 'standards',
    tier: 'institutional-authority',
    pillarKeys: ['outcome-assurance', 'commercial-governance'],
    notes: 'The tier\'s only standards issuer — the sole source of evidence-type diversity for both pillars it serves.',
    urlProvenance: 'operator-supplied',
  },
  {
    institution: 'Silicon Valley Product Group',
    category: 'Product',
    authority: 'Operator-designated: product management and product-market fit.',
    evidenceType: 'practitioner-guidance',
    tier: 'institutional-authority',
    pillarKeys: ['customer-discovery', 'value-proposition'],
    notes: '"product-market fit" is a verbatim match for §4 customer-discovery ("Customer Discovery & Fit"). Tier 1 by the operator\'s own table despite practitioner-guidance evidence — the two axes are orthogonal.',
    urlProvenance: 'operator-supplied',
  },
  {
    institution: 'Product School',
    category: 'Product',
    authority: 'Operator-designated: product management practice.',
    evidenceType: 'practitioner-guidance',
    tier: 'institutional-authority',
    pillarKeys: ['customer-discovery', 'value-proposition'],
    notes: 'Same tradition and evidence type as Silicon Valley Product Group — the pair adds no Law II diversity to the pillars it shares with it.',
    urlProvenance: 'operator-supplied',
  },
  {
    institution: 'Strategyzer',
    category: 'Customer Development',
    authority: 'Operator-designated: business models, value propositions.',
    evidenceType: 'practitioner-guidance',
    tier: 'institutional-authority',
    pillarKeys: ['value-proposition', 'revenue-architecture'],
    notes: 'Pillars proposed from the operator Purpose: "value propositions" verbatim; "business models" → revenue-architecture.',
    urlProvenance: 'operator-supplied',
  },
  {
    institution: 'Lean Startup',
    category: 'Customer Development',
    authority: 'Operator-designated: customer discovery methodology.',
    evidenceType: 'practitioner-guidance',
    tier: 'institutional-authority',
    pillarKeys: ['customer-discovery'],
    notes: '"customer discovery" is a verbatim pillar match. Not mapped to value-proposition — the operator Purpose names a discovery method, not an offer structure.',
    urlProvenance: 'operator-supplied',
  },
];

// ── The Commercialisation registry — TIER 2 (practitioner) ──────────────────

/**
 * The operator's second tier, verbatim:
 *
 *   "Once the institutional corpus has been exhausted, the IDE should expand
 *    to curated practitioner sources… These are not primary scientific
 *    authorities, but they provide a rich source of operational patterns that
 *    can be compared against the academic corpus."
 *
 * Two structural consequences, both deliberate:
 *
 *  1. **No URL.** The operator supplied none, and this sandbox cannot verify
 *     one. None is invented, so `registryEntryUrl()` returns `null` and Agent
 *     B/C cannot start from these entries at all.
 *  2. **No pillar.** The operator supplied no pillar basis either, and
 *     `upsertInstitutionEntry` refuses an entry whose pillar does not exist.
 *     A tier-2 source therefore cannot enter the corpus until a steward
 *     assigns it a pillar — which is exactly the §7 gating the operator
 *     described ("once the institutional corpus has been exhausted"),
 *     enforced by the shape of the data rather than by a reviewer's memory.
 *
 * They are declared here so the registry is complete and the tier boundary is
 * legible — not so they can be acquired today.
 */
const COMMERCIALISATION_TIER_2: readonly InstitutionalRegistryEntry[] = [
  'Andreessen Horowitz (a16z)',
  'First Round Review',
  'Y Combinator Library',
  'McKinsey Insights',
  'Bain Insights',
  'BCG Insights',
  'Deloitte Insights',
  'PwC Strategy',
  'Accenture Research',
].map((institution) => ({
  institution,
  category: 'Practitioner',
  authority: 'Operator-designated: NOT a primary scientific authority — a source of operational patterns for comparison against the academic corpus.',
  evidenceType: 'practitioner-guidance' as const,
  tier: 'practitioner-pattern' as const,
  pillarKeys: [] as readonly string[],
  notes: 'No URL and no pillar supplied by the operator; neither is invented. Un-acquirable until a steward supplies both — the tier boundary enforced structurally.',
  urlProvenance: 'none' as const,
}));

export const COMMERCIALISATION_REGISTRY: readonly InstitutionalRegistryEntry[] = [
  ...COMMERCIALISATION_TIER_1,
  ...COMMERCIALISATION_TIER_2,
];

// ── The Financial Services registry, expressed in the SAME template ─────────

/**
 * The nineteen ratified Financial Services authorities, in the shared
 * template. Pinned set-for-set against
 * `supabase/migrations/20260817000000_corpus_domain_constitution.sql` by
 * canary — the seed SQL is already applied to the database and cannot be
 * derived from, so parity is enforced instead of derivation (CLAUDE.md's
 * source-of-truth rule).
 *
 * **`category`, `authority`, `evidenceType` and `notes` are `null` for every
 * entry, and that is the honest state, not an oversight.** The FS registry was
 * captured before the template existed and recorded only pillar + institution
 * name. Populating those four fields here would mean asserting facts about
 * what BIS, FATF, ESMA et al. publish — facts this sandbox cannot verify and
 * CLAUDE.md's zero-tolerance rule forbids inventing. A steward completes them.
 *
 * The visible consequence is intentional: `assessRegistryDiversity` reports
 * every Financial Services pillar as `undeterminable` rather than `satisfied`.
 * Law II cannot be verified for a registry that records no traditions, and
 * saying so is the point.
 */
const FS = (pillarKey: string, institution: string): InstitutionalRegistryEntry => ({
  institution,
  category: null,
  authority: null,
  evidenceType: null,
  tier: 'institutional-authority',
  pillarKeys: [pillarKey],
  notes: null,
  urlProvenance: 'pre-existing',
});

export const FINANCIAL_SERVICES_REGISTRY: readonly InstitutionalRegistryEntry[] = [
  FS('banking', 'BIS'),
  FS('banking', 'FCA'),
  FS('banking', 'ECB'),
  FS('payments', 'FATF'),
  FS('payments', 'BIS Committee on Payments and Market Infrastructures'),
  FS('capital-markets', 'SEC'),
  FS('capital-markets', 'ESMA'),
  FS('digital-assets', 'MiCA (EU framework)'),
  FS('digital-assets', 'FinCEN'),
  FS('financial-crime-aml', 'FATF'),
  FS('financial-crime-aml', 'FinCEN'),
  FS('financial-crime-aml', 'CFTC'),
  FS('insurance', 'IAIS'),
  FS('insurance', 'NAIC'),
  FS('insurance', 'PRA'),
  FS('insurance', 'EIOPA'),
  FS('financial-infrastructure', 'IMF'),
  FS('financial-infrastructure', 'World Bank'),
  FS('financial-infrastructure', 'BIS'),
];

/** Every domain whose Institutional Registry is declared through the shared
 *  template. Adding a domain here is what makes it template-governed. */
export const INSTITUTIONAL_REGISTRIES: Readonly<Record<string, readonly InstitutionalRegistryEntry[]>> = {
  'financial-services': FINANCIAL_SERVICES_REGISTRY,
  commercialisation: COMMERCIALISATION_REGISTRY,
};

export function registryEntriesForDomain(domain: string): readonly InstitutionalRegistryEntry[] {
  return INSTITUTIONAL_REGISTRIES[domain] ?? [];
}

/** The template entry for a named institution in a domain, or `null`. Case-
 *  insensitive on the name, matching the homepage directory's normalisation.
 *  For Financial Services an institution can appear under several pillars —
 *  the first match carries the same classification fields as the rest. */
export function findRegistryEntry(domain: string, institutionName: string): InstitutionalRegistryEntry | null {
  const needle = institutionName.trim().toLowerCase();
  return registryEntriesForDomain(domain).find((e) => e.institution.toLowerCase() === needle) ?? null;
}

// ── Constitutional Dependency Registry — where the DISCIPLINES belong ───────

/**
 * The operator's third tier is **disciplines, not institutions** — "Organisation
 * design · Behavioural economics · Network science · Platform economics ·
 * Complexity science · Diffusion of innovation · Service science · Operations
 * management" — included deliberately so that "commercialisation" does not
 * collapse into "startup advice".
 *
 * They cannot be Institutional Registry rows: that table is keyed
 * `(domain, pillar_key, institution_name)` and its `seed_url` drives Agent B's
 * institution-targeted navigation. "Behavioural economics" has no homepage,
 * publishes nothing, and cannot be navigated to — registering it as an
 * institution would break seed-URL resolution for a row that could never
 * resolve.
 *
 * Law I of Constitutional Discovery leaves exactly two homes: a lane either
 * CONSTITUTES the domain (→ `corpus_coverage_pillars`) or CONSTRAINS it (→
 * `corpus_dependency_registry`). Behavioural economics does not constitute
 * commercialisation — it explains it. So: the **Constitutional Dependency
 * Registry**, each entry carrying its relationship edge, which is the point.
 *
 * This list is PRD-IDE-002 §7.3's ten tangential domains PLUS the six of the
 * operator's eight that are not already among them ("Platform economics" is
 * already `platform-economics`; "Operations management" is already
 * `operations`). Neighbouring-but-distinct pairs — `organisation-design` vs
 * `organisational-behaviour`, `service-science` vs `service-design`,
 * `diffusion-of-innovation` vs `innovation-management` — are registered
 * separately with the neighbour named in `note`, for a steward to merge or
 * keep at ratification. Proposing both and letting a steward decide is the
 * ratification model working; silently merging them would be an agent
 * deciding a taxonomy question that is not its to decide.
 */
export interface DependencyRegistryEntry {
  name: string;
  /** The edge label. Law I §2.3: "the edge is the point" — never omitted. */
  relationship: string;
  source: 'PRD-IDE-002 §7.3' | 'operator direction 2026-07-27';
  note: string | null;
}

export const COMMERCIALISATION_DEPENDENCIES: readonly DependencyRegistryEntry[] = [
  { name: 'financial-services', relationship: 'compared against', source: 'PRD-IDE-002 §7.3', note: 'Also an observed-in vertical — a comparison reference here, not a corpus.' },
  { name: 'economics', relationship: 'explained by', source: 'PRD-IDE-002 §7.3', note: null },
  { name: 'operations', relationship: 'explained by', source: 'PRD-IDE-002 §7.3', note: 'Covers the operator direction\'s "Operations management" — same discipline, existing entry reused rather than duplicated.' },
  { name: 'product-management', relationship: 'compared against', source: 'PRD-IDE-002 §7.3', note: null },
  { name: 'organisational-behaviour', relationship: 'explained by', source: 'PRD-IDE-002 §7.3', note: 'Neighbours organisation-design; a steward may merge them.' },
  { name: 'systems-engineering', relationship: 'explained by', source: 'PRD-IDE-002 §7.3', note: null },
  { name: 'service-design', relationship: 'compared against', source: 'PRD-IDE-002 §7.3', note: 'Neighbours service-science; a steward may merge them.' },
  { name: 'innovation-management', relationship: 'compared against', source: 'PRD-IDE-002 §7.3', note: 'Neighbours diffusion-of-innovation; a steward may merge them.' },
  { name: 'entrepreneurship', relationship: 'compared against', source: 'PRD-IDE-002 §7.3', note: null },
  { name: 'platform-economics', relationship: 'explained by', source: 'PRD-IDE-002 §7.3', note: 'The operator direction\'s "Platform economics" — already registered, not duplicated.' },
  { name: 'organisation-design', relationship: 'explained by', source: 'operator direction 2026-07-27', note: 'Neighbours organisational-behaviour (design vs behaviour); registered distinctly for a steward to rule on.' },
  { name: 'behavioural-economics', relationship: 'explained by', source: 'operator direction 2026-07-27', note: null },
  { name: 'network-science', relationship: 'explained by', source: 'operator direction 2026-07-27', note: null },
  { name: 'complexity-science', relationship: 'explained by', source: 'operator direction 2026-07-27', note: null },
  { name: 'diffusion-of-innovation', relationship: 'explained by', source: 'operator direction 2026-07-27', note: 'Neighbours innovation-management; registered distinctly for a steward to rule on.' },
  { name: 'service-science', relationship: 'explained by', source: 'operator direction 2026-07-27', note: 'Neighbours service-design (discipline vs practice); registered distinctly for a steward to rule on.' },
];
