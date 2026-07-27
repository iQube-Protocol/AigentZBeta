/**
 * Corpus Scout — the GENERALISED Institutional Registry template, the
 * Commercialisation instance of it, and the document-level acquisition seeds
 * that go with it (Phase 1 of the operator direction of 2026-07-27, extended
 * by the ruling of the same day; specified in
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
 * set of functions. Financial Services' un-captured fields are `null`, NOT
 * invented (see `FINANCIAL_SERVICES_REGISTRY`).
 *
 * ── ONE ENTRY PER (INSTITUTION, PILLAR) ─────────────────────────────────────
 *
 * The operator's ruling is explicit: *"The existing institutions may serve more
 * than one pillar where their published corpus genuinely supports it. Reuse is
 * preferable to inventing a new institution merely to make the matrix look
 * complete. The provenance must attach to the specific pillar and acquired
 * document."*
 *
 * So the entry is keyed by (institution, pillar), exactly like the DB row it
 * seeds — NOT by institution with a list of pillars. That is what lets NBER
 * carry `Entrepreneurship Research` on `venture-operations` and `Academic
 * Economics` on `pricing`, and OECD carry three different traditions across
 * three pillars. Collapsing those to one per-institution tradition would erase
 * precisely the distinction Law II's diversity check counts.
 *
 * ── What is NOT here (deliberately) ─────────────────────────────────────────
 *
 * The URL. `canonicalInstitutionHomepages.ts` is the single authoritative
 * institution→homepage directory, and `registryEntryUrl()` reads it.
 *
 * The registry ITSELF. The live registry is DB rows in
 * `corpus_institutional_registry`; this module is the curated INPUT that seeds
 * and classifies them.
 *
 * ── Nothing here is ratified, and nothing here is verified ──────────────────
 *
 * Every entry seeds as `status: proposed` and `verification_status: proposed`.
 * Ratification is a steward act; verification is a run against the live web
 * that cannot happen in this environment. An operator-supplied URL is not a
 * verified URL (`registryVerification.ts`).
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
 * `20260827000000`) so the distinction survives into SQL-level analysis.
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

/** Where an entry's homepage came from — recorded because this environment
 *  cannot verify a URL and must never claim to have. */
export type UrlProvenance =
  /** Supplied verbatim by the operator (2026-07-27 direction or ruling). */
  | 'operator-supplied'
  /** Already in the curated directory before this registry existed. */
  | 'pre-existing'
  /** No URL supplied by anyone. Resolution fails honestly. */
  | 'none';

/**
 * ONE registry row, for ANY domain. The operator's seven columns
 * (Institution · Category · Authority · URL · Evidence Type · Priority ·
 * Notes) map on as:
 *
 *   Institution   → `institution`
 *   Category      → `category`      (the institutional TRADITION for THIS
 *                                    pillar — the axis Law II counts)
 *   Authority     → `authority`     (WHY this source is authoritative here)
 *   URL           → derived, `registryEntryUrl()`
 *   Evidence Type → `evidenceType`
 *   Priority      → derived, `acquisitionPriority()`
 *   Notes         → `notes`
 *
 * Two columns are DERIVED rather than stored. URL, because the homepage
 * directory already owns that fact. Priority, because acquisition order is a
 * function of which coverage pillar an entry serves and which pillars are the
 * widest evidential gaps (PRD-IDE-002 §11.2).
 */
export interface InstitutionalRegistryEntry {
  institution: string;
  /**
   * The Constitutional Coverage Model pillar this entry is registered against
   * — the natural key half of `corpus_institutional_registry`. `null` means
   * no pillar basis was supplied, and `upsertInstitutionEntry` cannot insert
   * such an entry at all: a pillar-less institution is structurally
   * un-acquirable until a steward assigns one.
   */
  pillarKey: string | null;
  /** Null where the source registry never captured it. NEVER invented. */
  category: string | null;
  /** Null where the source registry never captured it. NEVER invented. */
  authority: string | null;
  /** Null where the source registry never captured it. NEVER invented. */
  evidenceType: EvidenceTypeClass | null;
  tier: SourceTier;
  notes: string | null;
  urlProvenance: UrlProvenance;
}

/** The entry's seed URL — read from the curated homepage directory, never
 *  restated here and never searched for. `null` when the institution isn't in
 *  the directory, which is an honest failure, not a gap to fill with a guess. */
export function registryEntryUrl(entry: Pick<InstitutionalRegistryEntry, 'institution'>): string | null {
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

/** The §11.2 rank of the pillar this entry serves. */
export function acquisitionPriority(entry: Pick<InstitutionalRegistryEntry, 'pillarKey'>): number {
  const pillarKey = entry.pillarKey;
  if (!pillarKey) return ACQUISITION_PRIORITY_UNRANKED;
  return ACQUISITION_PRIORITY_ORDER.find((b) => b.pillarKeys.includes(pillarKey))?.rank ?? ACQUISITION_PRIORITY_UNRANKED;
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
 * is the CFS-053 latent-mechanism defect, so it is checked in three places, of
 * which ONE is built (SPEC-CIR-001 §8.2).
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
  pillarKey: string | null;
  category: string | null;
  evidenceType: EvidenceTypeClass | null;
  /** `null` = the row does not declare a tier. Never counted as an authority. */
  tier: SourceTier | null;
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
    const forPillar = entries.filter((e) => e.pillarKey === pillarKey);
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

const A = (
  institution: string,
  pillarKey: string,
  category: string,
  authority: string,
  evidenceType: EvidenceTypeClass,
  notes: string,
  urlProvenance: UrlProvenance = 'operator-supplied',
): InstitutionalRegistryEntry => ({
  institution, pillarKey, category, authority, evidenceType,
  tier: 'institutional-authority', notes, urlProvenance,
});

/**
 * WAVE 1 — the operator's first-tier table of 2026-07-27, verbatim in name,
 * category, purpose and URL. The PILLAR mapping is AGENT-PROPOSED and argued
 * per row in SPEC-CIR-001 §4.1; a steward ratifies or corrects it.
 */
const COMMERCIALISATION_WAVE_1: readonly InstitutionalRegistryEntry[] = [
  A('NBER', 'venture-operations', 'Entrepreneurship Research', 'Operator-designated: entrepreneurship, innovation, venture research.', 'research-papers', '"venture research" → §4 venture-operations.'),
  A('NBER', 'adoption', 'Entrepreneurship Research', 'Operator-designated: entrepreneurship, innovation, venture research.', 'research-papers', '"innovation" → §4 adoption.'),
  A('Kauffman Foundation', 'venture-operations', 'Entrepreneurship Research', 'Operator-designated: entrepreneurship and startup ecosystems.', 'research-papers', '"entrepreneurship" → §4 venture-operations.'),
  A('Kauffman Foundation', 'partnerships', 'Entrepreneurship Research', 'Operator-designated: entrepreneurship and startup ecosystems.', 'research-papers', '"startup ecosystems" is a direct word match for §4 Partnerships & Ecosystem Development.'),
  A('SSRN', 'venture-operations', 'Research Repository', 'Operator-designated: entrepreneurship, strategy, innovation papers.', 'research-papers', 'A repository, cross-pillar by nature; registered only against the pillars its Purpose names. "strategy" has no §4 pillar and is deliberately not mapped.'),
  A('SSRN', 'adoption', 'Research Repository', 'Operator-designated: entrepreneurship, strategy, innovation papers.', 'research-papers', '"innovation" → §4 adoption.'),
  A('OECD', 'adoption', 'Economics', 'Operator-designated: innovation, productivity, digital economy.', 'policy', '"innovation" → §4 adoption.'),
  A('OECD', 'scaling', 'Economics', 'Operator-designated: innovation, productivity, digital economy.', 'policy', '"productivity" → §4 scaling (repeated without linear cost).'),
  A('World Bank', 'venture-operations', 'Economics', 'Operator-designated: private sector development, entrepreneurship.', 'policy', 'Already in the homepage directory as a Financial Services authority — one institution, two domains, one URL fact.', 'pre-existing'),
  A('World Bank', 'commercial-governance', 'Economics', 'Operator-designated: private sector development, entrepreneurship.', 'policy', 'A multilateral policy issuer → §4 commercial-governance (authority, attribution and disclosure rules).', 'pre-existing'),
  A('MIT Sloan', 'adoption', 'Innovation', 'Operator-designated: innovation management research.', 'research-papers', '"innovation" → §4 adoption.'),
  A('MIT Sloan', 'venture-operations', 'Innovation', 'Operator-designated: innovation management research.', 'research-papers', '"management" → §4 venture-operations.'),
  A('Stanford Graduate School of Business', 'scaling', 'Innovation', 'Operator-designated: entrepreneurship and scaling.', 'research-papers', 'Verbatim word match — the least inferential mapping in the wave.'),
  A('Stanford Graduate School of Business', 'venture-operations', 'Innovation', 'Operator-designated: entrepreneurship and scaling.', 'research-papers', 'Verbatim word match.'),
  A('Harvard Business School', 'revenue-architecture', 'Innovation', 'Operator-designated: strategy, innovation, commercialisation.', 'research-papers', '"commercialisation"/"strategy" → §4 revenue-architecture (where revenue originates, how offers compose).'),
  A('Harvard Business School', 'adoption', 'Innovation', 'Operator-designated: strategy, innovation, commercialisation.', 'research-papers', '"innovation" → §4 adoption.'),
  A('Strategic Management Society', 'revenue-architecture', 'Strategy', 'Operator-designated: strategy research.', 'research-papers', 'WEAKEST mapping in the wave — §4 has no "strategy" pillar. Most likely to be re-pillared by a steward.'),
  A('Strategic Management Society', 'commercial-governance', 'Strategy', 'Operator-designated: strategy research.', 'research-papers', 'Weak mapping; see the revenue-architecture note.'),
  A('Santa Fe Institute', 'scaling', 'Systems', 'Operator-designated: complex adaptive systems, emergence.', 'research-papers', 'Deliberately NOT mapped to commercial-failure-modes: "complex adaptive systems, emergence" does not say failure studies.'),
  A('INCOSE', 'outcome-assurance', 'Systems', 'Operator-designated: systems engineering and organisational systems.', 'standards', 'Systems engineering → §4 outcome-assurance (how delivered outcome is measured and sustained).'),
  A('INCOSE', 'commercial-governance', 'Systems', 'Operator-designated: systems engineering and organisational systems.', 'standards', 'A professional standards body → §4 commercial-governance.'),
  A('Silicon Valley Product Group', 'customer-discovery', 'Product', 'Operator-designated: product management and product-market fit.', 'practitioner-guidance', '"product-market fit" is a verbatim match for §4 Customer Discovery & Fit.'),
  A('Silicon Valley Product Group', 'value-proposition', 'Product', 'Operator-designated: product management and product-market fit.', 'practitioner-guidance', 'Tier 1 by the operator\'s own table despite practitioner-guidance evidence — the two axes are orthogonal.'),
  A('Product School', 'customer-discovery', 'Product', 'Operator-designated: product management practice.', 'practitioner-guidance', 'Same tradition and evidence type as Silicon Valley Product Group — adds no Law II diversity to the pillars it shares with it.'),
  A('Product School', 'value-proposition', 'Product', 'Operator-designated: product management practice.', 'practitioner-guidance', 'See the customer-discovery note.'),
  A('Strategyzer', 'value-proposition', 'Customer Development', 'Operator-designated: business models, value propositions.', 'practitioner-guidance', '"value propositions" verbatim.'),
  A('Strategyzer', 'revenue-architecture', 'Customer Development', 'Operator-designated: business models, value propositions.', 'practitioner-guidance', '"business models" → §4 revenue-architecture.'),
  A('Lean Startup', 'customer-discovery', 'Customer Development', 'Operator-designated: customer discovery methodology.', 'practitioner-guidance', 'Verbatim pillar match. Not mapped to value-proposition — the Purpose names a discovery method, not an offer structure.'),
];

/**
 * WAVE 2 — the operator's RULING of 2026-07-27, closing the five pillars
 * SPEC-CIR-001 §5 reported as empty:
 *
 *   "Do not waive the five empty pillars… Populate them with authoritative
 *    sources… The existing institutions may serve more than one pillar where
 *    their published corpus genuinely supports it. Reuse is preferable to
 *    inventing a new institution merely to make the matrix look complete."
 *
 * Institutions, traditions, evidence types, URLs **and pillars** are the
 * operator's — unlike wave 1, these mappings were supplied, not inferred.
 * OECD picks up two more pillars and NBER two more, each under a DIFFERENT
 * tradition: exactly the reuse the ruling prefers, and exactly why the entry
 * is keyed per pillar.
 */
const COMMERCIALISATION_WAVE_2: readonly InstitutionalRegistryEntry[] = [
  A('OECD', 'trust-formation', 'International Policy Research',
    'Operator-designated: international policy research; empirical consumer survey.', 'research-papers',
    'Reuse of a wave-1 institution under a DIFFERENT tradition — OECD is `Economics` on adoption/scaling and `International Policy Research` here. Per-pillar provenance, per the ruling.'),
  A('UK Competition and Markets Authority', 'trust-formation', 'Competition & Consumer Enforcement',
    'Operator-designated: competition/consumer enforcement; market evidence.', 'policy',
    'New institution — no existing entry covers enforcement-derived consumer-trust evidence.'),
  A('NBER', 'pricing', 'Academic Economics',
    'Operator-designated: academic economics; empirical and formal modelling.', 'research-papers',
    'Reuse under a different tradition: NBER is `Entrepreneurship Research` on venture-operations/adoption and `Academic Economics` here.'),
  A('OECD', 'pricing', 'Competition Policy',
    'Operator-designated: competition policy; digital-market pricing.', 'policy',
    'OECD\'s THIRD tradition in this registry. Collapsing these to one per-institution category would erase the diversity Law II counts.'),
  A('World Trade Organization', 'distribution', 'International Trade Doctrine',
    'Operator-designated: international trade and market-access doctrine.', 'policy',
    'New institution.'),
  A('UN Trade and Development (UNCTAD)', 'distribution', 'Development Economics',
    'Operator-designated: development economics; digital commerce and trade measurement.', 'datasets',
    'New institution. The registry\'s first `datasets` evidence type — "measurement" is the operator\'s own framing.'),
  A('BIS Committee on Payments and Market Infrastructures', 'settlement-exchange', 'Payment & Settlement Infrastructure',
    'Operator-designated: payment, clearing and settlement infrastructure.', 'standards',
    'Already in the homepage directory as a Financial Services authority at the MORE SPECIFIC https://www.bis.org/cpmi/ — the operator\'s seed https://www.bis.org is its parent. The specific entry is kept and NOT duplicated (SPEC-CIR-001 §4.3).',
    'pre-existing'),
  A('UNCITRAL', 'settlement-exchange', 'International Commercial Law',
    'Operator-designated: international commercial law; electronic contracting and transferable records.', 'standards',
    'New institution.'),
  A('NBER', 'commercial-failure-modes', 'Academic Economics',
    'Operator-designated: academic entrepreneurship and market-failure research.', 'research-papers',
    'Closes PRD-IDE-002 §11.2\'s #1-ranked evidential gap, which SPEC-CIR-001 §5 refused to close by inference.'),
  A('U.S. Bureau of Labor Statistics', 'commercial-failure-modes', 'Official Statistics',
    'Operator-designated: official longitudinal business-demography evidence.', 'datasets',
    'New institution. Official statistics is a tradition no other entry carries.'),
];

/**
 * WAVE 3 — the operator's RULING of 2026-07-27 closing the last two Law II
 * gaps: *"Do not waive Law II. Add a second authority from a different
 * tradition for each pillar."*
 *
 * `partnerships` and `outcome-assurance` each carried exactly ONE institutional
 * authority and therefore failed Law II. Neither was closed by lowering a
 * threshold — the thresholds are unchanged and both attempts to move them are
 * mutation-tested. Each pillar gains a second authority from a genuinely
 * different tradition.
 *
 * **The tradition strings here are load-bearing, not decoration.** Law II
 * counts DISTINCT `category` values per pillar. NBER's `partnerships` mapping
 * must not reuse Kauffman's `Entrepreneurship Research`, or the pillar still
 * reads `unsatisfied` with two authorities on the board — the exact failure the
 * ruling asks to avoid. It carries the operator's own phrasing instead, which
 * is also a fourth distinct NBER tradition in this registry (after
 * `Entrepreneurship Research` on venture-operations/adoption and `Academic
 * Economics` on pricing/commercial-failure-modes). That is the per-pillar
 * keying working as designed, not drift.
 */
const COMMERCIALISATION_WAVE_3: readonly InstitutionalRegistryEntry[] = [
  A('NBER', 'partnerships', 'Academic Economics / Empirical Entrepreneurship Research',
    'Operator-designated: academic economics / empirical entrepreneurship research; working papers and peer-reviewed economic research.', 'research-papers',
    'NBER\'s FOURTH tradition in this registry and its THIRD pillar. Deliberately NOT `Entrepreneurship Research` — that is Kauffman\'s tradition on this same pillar, and reusing it would leave `partnerships` failing Law II with two authorities registered. The operator\'s acquisition seed is pillar-specific rather than generic partnership commentary.'),
  A('National Infrastructure and Service Transformation Authority', 'outcome-assurance',
    'Public Project-Delivery Assurance / Independent Stage-Gate Review',
    'Operator-designated: public project-delivery assurance / independent stage-gate review; assurance standards, review guidance, templates and benefits-realisation guidance.', 'standards',
    'An independent assurance tradition beside INCOSE\'s `Systems`. Same evidence type (standards), different tradition — which is what Law II counts. NISTA is the current body formed from the Infrastructure and Projects Authority and the National Infrastructure Commission; see the lineage note on its acquisition seed.'),
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
 * Two structural consequences, both deliberate: **no URL** (none was supplied,
 * so `registryEntryUrl` returns null and Agent B/C cannot start), and **no
 * pillar** (`upsertInstitutionEntry` refuses an entry whose pillar does not
 * exist). A practitioner source therefore cannot enter the corpus until a
 * steward supplies both — the "once the institutional corpus has been
 * exhausted" gate, expressed as the shape of the data.
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
  pillarKey: null,
  category: 'Practitioner',
  authority: 'Operator-designated: NOT a primary scientific authority — a source of operational patterns for comparison against the academic corpus.',
  evidenceType: 'practitioner-guidance' as const,
  tier: 'practitioner-pattern' as const,
  notes: 'No URL and no pillar supplied by the operator; neither is invented. Un-acquirable until a steward supplies both.',
  urlProvenance: 'none' as const,
}));

export const COMMERCIALISATION_REGISTRY: readonly InstitutionalRegistryEntry[] = [
  ...COMMERCIALISATION_WAVE_1,
  ...COMMERCIALISATION_WAVE_2,
  ...COMMERCIALISATION_WAVE_3,
  ...COMMERCIALISATION_TIER_2,
];

/** The wave-2 additions alone — what migration `20260828000000` seeds. */
export const COMMERCIALISATION_REGISTRY_WAVE_2: readonly InstitutionalRegistryEntry[] = COMMERCIALISATION_WAVE_2;

/** The wave-3 additions alone — what migration `20260829000000` seeds. The
 *  three earlier migrations have been RUN; a new one is the only additive way
 *  to land these without editing applied SQL. */
export const COMMERCIALISATION_REGISTRY_WAVE_3: readonly InstitutionalRegistryEntry[] = COMMERCIALISATION_WAVE_3;

// ── The Financial Services registry, expressed in the SAME template ─────────

/**
 * The nineteen ratified Financial Services authorities, in the shared
 * template. Pinned set-for-set against
 * `supabase/migrations/20260817000000_corpus_domain_constitution.sql` by
 * canary — the seed SQL is already applied to the database and cannot be
 * derived from, so parity is enforced instead of derivation.
 *
 * **`category`, `authority`, `evidenceType` and `notes` are `null` for every
 * entry, and that is the honest state, not an oversight.** The FS registry was
 * captured before the template existed and recorded only pillar + institution
 * name. Populating those fields would mean asserting facts about what BIS,
 * FATF, ESMA et al. publish — facts this environment cannot verify and
 * CLAUDE.md's zero-tolerance rule forbids inventing.
 *
 * Backfilling them is tracked as its OWN remediation item (SPEC-CIR-001 §10),
 * per the operator's ruling that it *"should not be used to weaken Law II or
 * block completion of the properly constituted Commercialisation registry."*
 * The visible consequence stays intentional: every FS pillar reports
 * `undeterminable`, never `satisfied`.
 */
const FS = (pillarKey: string, institution: string): InstitutionalRegistryEntry => ({
  institution,
  pillarKey,
  category: null,
  authority: null,
  evidenceType: null,
  tier: 'institutional-authority',
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

/**
 * The template entry for a (pillar, institution) pair, or `null`. Keyed by
 * BOTH, because the ruling attaches provenance to the specific pillar: an
 * institution-only lookup would return OECD's `Economics` tradition when the
 * caller asked about `pricing`, where it is `Competition Policy`.
 */
export function findRegistryEntry(
  domain: string,
  pillarKey: string,
  institutionName: string,
): InstitutionalRegistryEntry | null {
  const needle = institutionName.trim().toLowerCase();
  return registryEntriesForDomain(domain).find(
    (e) => e.pillarKey === pillarKey && e.institution.toLowerCase() === needle,
  ) ?? null;
}

// ── Acquisition seeds — DOCUMENT level, deliberately NOT `seed_url` ─────────

/**
 * The operator's substantive acquisition seeds: specific publications, one or
 * more per (pillar, institution).
 *
 * **Why these are not `corpus_institutional_registry.seed_url`.** That column
 * is ONE URL per institution row and it means "the institution's own
 * publication entry point" — Agent B's starting page for navigation
 * (`runInstitutionDiscovery(seedUrl)` fetches it and walks its links). A
 * publication URL is not an institutional seed: it TERMINATES navigation
 * rather than starting it, there are several per institution, and each carries
 * its own claim and its own verification state. Overloading `seed_url` would
 * break Agent B's contract and reduce several documents to one.
 *
 * **Why they are not candidate sources either.** `createCandidateSource`
 * RETRIEVES bytes and hashes them; a candidate row without them would assert a
 * Level-4 acquisition that never happened (PRD-ICA-001 §2). A seed is a *plan*,
 * not an acquisition.
 *
 * **The model had no slot, and this is the smallest addition.** PRD-ICA-001 §5
 * already specifies a "Corpus Acquisition Plan per source lane… target source
 * types, likely primary institutions… indicative document count, priority",
 * reviewed before broad acquisition begins — Agent A's output. Only its
 * INSTITUTION half was ever persisted (the Institutional Registry). The
 * document half has always been specified and never had a table.
 * `corpus_acquisition_seeds` is that missing half: one row per planned
 * document, carrying its own provenance and its own verification status, and
 * linking to the candidate source it eventually produces.
 *
 * **`claim` is the operator's description, recorded AS A CLAIM.** "76-page
 * survey, 10,000 consumers, ten countries" is what the operator recorded, not
 * something this environment measured. It is stored so the first verification
 * run can be compared against it — a page count that comes back at 4 is a
 * finding, and it can only be a finding if the claim was written down first.
 */
export interface AcquisitionSeed {
  domain: string;
  pillarKey: string;
  institution: string;
  url: string;
  /** The operator's own description — a CLAIM pending verification, never a
   *  measured fact. Compared against the inspection result on first run. */
  claim: string;
}

const S = (pillarKey: string, institution: string, url: string, claim: string): AcquisitionSeed => ({
  domain: 'commercialisation', pillarKey, institution, url, claim,
});

/**
 * Operator-supplied, 2026-07-27 ruling. Not verified here and not verifiable
 * here — outbound HTTPS is blocked from the build environment. Every seed
 * enters at `pending_verification`, per the operator's own instruction:
 * *"Do not treat the URLs as verified merely because they are operator-supplied
 * or resolve in an ordinary browser."*
 */
export const COMMERCIALISATION_ACQUISITION_SEEDS: readonly AcquisitionSeed[] = [
  S('trust-formation', 'OECD',
    'https://www.oecd.org/en/publications/trust-in-peer-platform-markets_1a893b58-en.html',
    'Operator claim: 76-page survey, 10,000 consumers, ten countries.'),
  S('trust-formation', 'OECD',
    'https://www.oecd.org/en/publications/oecd-business-and-finance-outlook-2019_af784794-en.html',
    'Operator claim: 140 pages, trust in business and online markets.'),
  S('trust-formation', 'UK Competition and Markets Authority',
    'https://www.gov.uk/government/consultations/online-reviews-and-endorsements',
    'Operator claim: 71-page findings report on reviews, endorsements, consumer reliance.'),
  S('pricing', 'NBER',
    'https://www.nber.org/papers/w21679',
    'Operator claim: "Pricing with Limited Knowledge of Demand".'),
  S('pricing', 'OECD',
    'https://www.oecd.org/en/publications/personalised-pricing-in-the-digital-era_db4d9c9c-en.html',
    'Operator claim: 49 pages.'),
  S('pricing', 'OECD',
    'https://www.oecd.org/en/publications/algorithmic-pricing-and-competition-in-g7-jurisdictions_f36dacf8-en.html',
    'Operator claim: 26 pages.'),
  S('distribution', 'World Trade Organization',
    'https://www.wto.org/english/tratop_e/serv_e/distribution_e/distribution_e.htm',
    'Operator claim: distribution-services gateway — wholesale, retail, franchising, commission agents, e-commerce.'),
  S('distribution', 'UN Trade and Development (UNCTAD)',
    'https://unctad.org/topic/ecommerce-and-digital-economy/measuring-ecommerce-digital-economy',
    'Operator claim: measuring e-commerce and the digital economy.'),
  S('distribution', 'UN Trade and Development (UNCTAD)',
    'https://tft.unctad.org/en/publications/statistics-on-the-digital-economy-e-commerce-and-digital-trade-report-2025/',
    'Operator claim: statistics on the digital economy, e-commerce and digital trade, 2025 report.'),
  S('settlement-exchange', 'BIS Committee on Payments and Market Infrastructures',
    'https://www.bis.org/cpmi/publ/d216.htm',
    'Operator claim: 33 pages, PvP adoption, settlement risk.'),
  S('settlement-exchange', 'BIS Committee on Payments and Market Infrastructures',
    'https://www.bis.org/cpmi/publ/d202.htm',
    'Operator claim: 65 pages, access to payment systems.'),
  S('settlement-exchange', 'UNCITRAL',
    'https://uncitral.un.org/en/texts/ecommerce',
    'Operator claim: electronic commerce texts.'),
  S('settlement-exchange', 'UNCITRAL',
    'https://uncitral.un.org/en/texts/ecommerce/modellaw/electronic_commerce',
    'Operator claim: Model Law on Electronic Commerce.'),
  S('settlement-exchange', 'UNCITRAL',
    'https://uncitral.un.org/en/texts/ecommerce/modellaw/electronic_transferable_records',
    'Operator claim: Model Law on Electronic Transferable Records.'),
  S('commercial-failure-modes', 'NBER',
    'https://www.nber.org/papers/w19679',
    'Operator claim: "Deals Not Done: Sources of Failure in the Market for Ideas".'),
  S('commercial-failure-modes', 'NBER',
    'https://www.nber.org/papers/w34755',
    'Operator claim: randomized evidence on venture shutdown, survival, "rational quitting".'),
  S('commercial-failure-modes', 'U.S. Bureau of Labor Statistics',
    'https://www.bls.gov/osmr/research-papers/2004/st040060.htm',
    'Operator claim: establishment survival, Business Employment Dynamics.'),

  // ── Wave 3 (the Law II ruling) ───────────────────────────────────────────
  S('partnerships', 'NBER',
    'https://www.nber.org/papers/w17181',
    'Operator claim: "Business Partners, Financing, and the Commercialization of Inventions" — studies how partners affect commercialisation probability and revenue outcomes. Operator note: "unusually well targeted… supports the pillar without relying on generic partnership commentary."'),
  S('outcome-assurance', 'National Infrastructure and Service Transformation Authority',
    'https://www.gov.uk/government/collections/infrastructure-and-projects-authority-assurance-review-toolkit',
    'Operator claim: assurance review toolkit — independent review guidance across strategic assessment, business justification, delivery strategy, readiness for service, operations and benefits realisation. ' +
    'LINEAGE, RECORDED SO IT IS NOT "CORRECTED": the collection path says infrastructure-and-projects-authority while the institution is NISTA. That is not an error — NISTA is the current body formed from the Infrastructure and Projects Authority and the National Infrastructure Commission, and it inherits IPA\'s assurance material. A naive audit reading the path against the institution name would flag a mismatch that does not exist.'),
];

/** Every seed for one (pillar, institution) pair. */
export function acquisitionSeedsFor(domain: string, pillarKey: string, institution: string): AcquisitionSeed[] {
  return COMMERCIALISATION_ACQUISITION_SEEDS.filter(
    (s) => s.domain === domain && s.pillarKey === pillarKey && s.institution === institution,
  );
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
 * publishes nothing, and cannot be navigated to.
 *
 * Law I of Constitutional Discovery leaves exactly two homes: a lane either
 * CONSTITUTES the domain (→ `corpus_coverage_pillars`) or CONSTRAINS it (→
 * `corpus_dependency_registry`). A discipline explains commercialisation
 * rather than constituting it. So: the Constitutional Dependency Registry,
 * each entry carrying its relationship edge, which is the point.
 *
 * PRD-IDE-002 §7.3's ten PLUS the six of the operator's eight that are not
 * already among them ("Platform economics" is already `platform-economics`;
 * "Operations management" is already `operations`). Neighbouring-but-distinct
 * pairs are registered separately with the neighbour named, for a steward to
 * merge or keep at ratification.
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
