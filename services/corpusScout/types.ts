/**
 * Corpus Scout (PRD-ICA-001) — shared types for the acquisition/verification/
 * review pipeline. See `codexes/packs/irl/foundation/PRD-ICA-001_invariant-corpus-acquisition-agent.md`.
 *
 * Two independent, composable axes (PRD-ICA-001 §0.3 — never conflate):
 *   ProvenanceClass       — evidence-integrity question ("what kind of source is this").
 *   ReviewWorkflowStatus  — pipeline-state question ("what did the reviewer decide").
 */

// The registry TEMPLATE (SPEC-CIR-001) owns the tier vocabulary and the Law II
// assessment shape; this module re-uses them rather than declaring a second
// copy. `institutionalRegistry.ts` imports only the homepage directory, so
// there is no cycle.
import type { SourceTier, PillarDiversityRow } from './institutionalRegistry';
import type { VerificationStatus } from './registryVerification';

/**
 * The EVIDENCE-PROVENANCE vocabulary — "where did the evidence come from".
 * Originally the four values ratified by `CRYSTAL-ENLARGEMENT_plan.md` §2a;
 * a fifth (`platform-doctrine`) was added by the operator ruling of
 * 2026-07-27. Corpus Scout adopts this vocabulary; it does not invent a
 * second one, and neither does anything else — this declaration is the single
 * authoritative list (inv.engineering.036).
 *
 * ── Reconciliation of the two four-value lists (2026-07-27) ────────────────
 *
 * §2a ratified:  external-established | external-empirical | platform-derived | platform-hypothesized
 * The ruling named: external-established | external-empirical | platform-derived | platform-doctrine
 *
 * These are NOT the same four. `platform-hypothesized` and `platform-doctrine`
 * denote different things and neither subsumes the other:
 *
 *   platform-hypothesized  a claim asserted in a platform DOCUMENT with no
 *                          evidence compressed from artefacts behind it —
 *                          "a doc-only claim" (PRD-IDE-002 §6). It is in live
 *                          use in the Corpus Scout review path and in
 *                          `crystalReadiness`'s ineligibility message.
 *   platform-doctrine      deliberately PROPRIETARY constitutional doctrine
 *                          (MoneyPenny / Q¢) — "neither externally established
 *                          nor intended as general scientific evidence"
 *                          (operator ruling 2026-07-27). It is not a weaker
 *                          form of evidence; it is evidence offered for a
 *                          different purpose, which is why the ruling gives it
 *                          its own experimental population (C) rather than
 *                          folding it into the ablation (B).
 *
 * Resolution: KEEP all four §2a values and ADD `platform-doctrine` — five
 * values in ONE vocabulary. Dropping `platform-hypothesized` to hit a count of
 * four would silently reclassify every doc-only claim as either compressed-
 * from-artefacts evidence or proprietary doctrine, both of which are false.
 *
 * The ORTHOGONAL axis — "who discovered the invariant" — is
 * `DiscoveryProvenance` in `services/research/experimentalPopulations.ts`,
 * which also holds the A/B/C population partition these five values induce.
 * The two axes are never conflated: discovery provenance has NO bearing on
 * which experimental population an invariant belongs to.
 */
export type ProvenanceClass =
  | 'external-established'
  | 'external-empirical'
  | 'platform-derived'
  | 'platform-hypothesized'
  | 'platform-doctrine';

export const PROVENANCE_CLASSES: readonly ProvenanceClass[] = [
  'external-established', 'external-empirical', 'platform-derived', 'platform-hypothesized',
  'platform-doctrine',
];

/** PRD-ICA-001 §8's eleven reviewWorkflowStatus values. */
export type ReviewWorkflowStatus =
  | 'pending_review'
  | 'needs_retrieval_fix'
  | 'approved_exp_p1'
  | 'approved_general_finance'
  | 'approved_reference_only'
  | 'duplicate'
  | 'superseded'
  | 'rejected_out_of_domain'
  | 'rejected_low_substance'
  | 'rejected_provenance'
  | 'rejected_access_or_license';

export const REVIEW_WORKFLOW_STATUSES: readonly ReviewWorkflowStatus[] = [
  'pending_review', 'needs_retrieval_fix',
  'approved_exp_p1', 'approved_general_finance', 'approved_reference_only',
  'duplicate', 'superseded',
  'rejected_out_of_domain', 'rejected_low_substance', 'rejected_provenance', 'rejected_access_or_license',
];

/** Only these two statuses may be handed to the Ingestion Broker (PRD-ICA-001
 *  §6, §11 — "MAY NOT approve its own sources / write directly to a canonical
 *  registry"; approval is a human act, never automatic). */
export const APPROVED_FOR_INGESTION: ReadonlySet<ReviewWorkflowStatus> = new Set([
  'approved_exp_p1', 'approved_general_finance',
]);

/** PRD-ICA-001 §8's structural-value classification vocabulary. Tags assist
 *  human review, never replace it — assigned HEURISTICALLY (keyword/pattern
 *  matching, no ML/LLM) by `services/corpusScout/intelligence.ts`. */
export const STRUCTURAL_VALUE_TAGS = [
  'causal', 'conditional', 'relational', 'mathematical', 'probabilistic',
  'temporal', 'threshold-based', 'feedback', 'trade-off', 'constraint',
  'failure-derived', 'governance', 'definitional', 'empirical-association',
] as const;

export type StructuralValueTag = (typeof STRUCTURAL_VALUE_TAGS)[number];

export interface ResolutionChain {
  discoveryUrl: string;
  downloadUrl: string;
  resolvedArtifactUrl: string;
  redirectCount: number;
}

export type RetrievalFailureClass =
  | 'access-denied'
  | 'empty-artifact'
  | 'corrupted-file'
  | 'mime-mismatch'
  | 'redirect-loop'
  | 'login-required'
  | 'paywall'
  | 'timeout'
  | 'unknown';

export interface RetrievalResult {
  ok: boolean;
  bytes?: Buffer;
  contentType: string | null;
  declaredMimeMismatch: boolean;
  artifactHash: string | null;
  fileSizeBytes: number;
  failureClass?: RetrievalFailureClass;
  resolutionChain: ResolutionChain;
}

export interface InspectionResult {
  ok: boolean;
  normalizedText: string;
  pageCount: number | null;
  substantiveTextCharacters: number;
  blankPageRatio: number | null;
  extractionWarnings: string[];
  passesContentPresenceCheck: boolean;
}

/** Corpus Scout's own provenance record (PRD-ICA-001 §8) — camelCase mirror of
 *  the `corpus_candidate_sources` row. */
export interface CandidateSourceRow {
  id: string;
  sourceId: string;
  campaignDomain: string;
  campaignSubDomain: string | null;
  title: string;
  issuer: string | null;
  authors: string[];
  publicationDate: string | null;
  retrievedAt: string | null;
  canonicalUrl: string;
  artifactHash: string | null;
  normalizedTextHash: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  pageCount: number | null;
  licenseStatus: string;
  provenanceClass: ProvenanceClass | null;
  reviewWorkflowStatus: ReviewWorkflowStatus;
  acquisitionMethod: string;
  resolutionChain: ResolutionChain | Record<string, never>;
  extractionStatus: 'pending' | 'ok' | 'below-threshold' | 'failed';
  normalizedText: string;
  extractionWarnings: string[];
  /** HEURISTIC structural-value tags (§8) — advisory review metadata only. */
  structuralTags: StructuralValueTag[];
  duplicateOfSourceId: string | null;
  humanReviewNotes: string | null;
  evidenceRowId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function isProvenanceClass(v: unknown): v is ProvenanceClass {
  return typeof v === 'string' && (PROVENANCE_CLASSES as readonly string[]).includes(v);
}

export function isReviewWorkflowStatus(v: unknown): v is ReviewWorkflowStatus {
  return typeof v === 'string' && (REVIEW_WORKFLOW_STATUSES as readonly string[]).includes(v);
}

/**
 * Constitutional Discovery amendment (PRD-ICA-001 amendment, RATIFIED
 * 2026-07-23) — the substrate Agent 0 (Domain Architect) produces ahead of
 * any acquisition. See `codexes/packs/agentiq/updates/
 * 2026-07-23_prd-ica-001-amendment-constitutional-discovery-domain-architect.md`.
 *
 * One shared two-state lifecycle across all four artifacts (§2/§3): an agent
 * or steward PROPOSES, a steward RATIFIES. No auto-ratification path.
 */
export type RatificationStatus = 'proposed' | 'ratified';

export const RATIFICATION_STATUSES: readonly RatificationStatus[] = ['proposed', 'ratified'];

export function isRatificationStatus(v: unknown): v is RatificationStatus {
  return v === 'proposed' || v === 'ratified';
}

/** §2.1 — what the domain IS. One row per domain. */
export interface DomainDefinitionRow {
  id: string;
  domain: string;
  purpose: string;
  status: RatificationStatus;
  ratifiedBy: string | null;
  ratifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** §2.2 — Constitutional Coverage Model: a pillar that CONSTITUTES the domain
 *  (Law I, §2.0). `pillarKey` doubles as the `campaignSubDomain` lane key so
 *  Gap Detection (§6) can match submitted candidates against ratified pillars
 *  without a second taxonomy. */
export interface CoveragePillarRow {
  id: string;
  domain: string;
  pillarKey: string;
  pillarLabel: string;
  completenessDefinition: string;
  status: RatificationStatus;
  ratifiedBy: string | null;
  ratifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** §6.1 — steward judgment that the Institutional Registry for this pillar
   *  is exhausted. Distinct from (and required in addition to) Gap
   *  Detection's algorithmic "≥1 approved source" check. Never inferred. */
  saturationConfirmed: boolean;
  saturationConfirmedBy: string | null;
  saturationConfirmedAt: string | null;
}

/** §2.3 — Constitutional Dependency Registry: an external domain that
 *  CONSTRAINS this one (Law I, §2.0) without being part of it. `relationship`
 *  is the edge label (e.g. "governed by", "measured by") — never omitted. */
export interface DependencyRegistryRow {
  id: string;
  domain: string;
  dependencyName: string;
  relationship: string;
  status: RatificationStatus;
  ratifiedBy: string | null;
  ratifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** §3 — Institutional Registry, generated FROM (keyed to) a ratified
 *  Coverage Model pillar. */
export interface InstitutionalRegistryRow {
  id: string;
  domain: string;
  pillarKey: string;
  institutionName: string;
  status: RatificationStatus;
  ratifiedBy: string | null;
  ratifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** §4/§9 phase 3 — Agent B's starting point for institution-targeted
   *  navigation (the institution's own publications listing page).
   *  Steward-provided, never search-derived. Null until a steward adds one —
   *  an institution with no seedUrl isn't yet eligible for Agent B/C. */
  seedUrl: string | null;
  /** SPEC-CIR-001 §3 — which acquisition tier this authority belongs to.
   *  `null` means UNDECLARED, which is never treated as authoritative:
   *  `assessRegistryDiversity` refuses to count an undeclared row toward
   *  Law II. Fail-closed, so a practitioner source can never be silently
   *  counted as a primary scientific authority. */
  sourceTier: SourceTier | null;
  /**
   * SPEC-CIR-001 §9 — does this URL still lead to a qualifying corpus?
   * ORTHOGONAL to `status` (proposed | ratified): ratification is a steward's
   * acceptance of the AUTHORITY, verification is a machine's finding about the
   * URL. An entry can be ratified and `verification_failed`. Only `verified`
   * opens the discovery gate (`canRunInstitutionDiscovery`).
   */
  verificationStatus: VerificationStatus | null;
  /** When the entry last became `verified`. Null in every other state — a
   *  failed re-verification clears it rather than leaving a stale success. */
  verifiedAt: string | null;
  /** When verification was last ATTEMPTED, whatever the outcome. */
  verificationCheckedAt: string | null;
  /** The URL the seed actually resolved to after redirects. */
  resolvedUrl: string | null;
  /** The run's recorded evidence: standard applied, candidates found,
   *  documents inspected, and the qualifying documents with their content
   *  hashes. Opaque to the row mapper; shaped by `VerificationOutcome`. */
  verificationDetail: Record<string, unknown> | null;
}

/**
 * SPEC-CIR-001 §7 — ONE PLANNED DOCUMENT. The missing half of PRD-ICA-001 §5's
 * Corpus Acquisition Plan: the registry persisted its "likely primary
 * institutions" and never its target documents.
 *
 * Deliberately NOT `corpus_institutional_registry.seed_url` (that is ONE
 * navigation entry point per institution, and a publication URL terminates
 * navigation rather than starting it), and deliberately NOT a candidate source
 * (that asserts retrieved, hashed bytes — a seed is a plan, not an
 * acquisition).
 */
export interface AcquisitionSeedRow {
  id: string;
  domain: string;
  pillarKey: string;
  institutionName: string;
  documentUrl: string;
  /** The operator's own description, recorded AS A CLAIM — never a measured
   *  fact. Compared against the inspection result on the first run, which is
   *  only possible because the claim was written down first. */
  claim: string;
  verificationStatus: VerificationStatus | null;
  verificationCheckedAt: string | null;
  resolvedUrl: string | null;
  contentHash: string | null;
  /** Set once the seed has produced a real candidate source. */
  candidateSourceId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The full constitutional substrate for one domain — what `GET
 *  /api/corpus-scout/domain-constitution?domain=` returns. */
export interface DomainConstitution {
  domain: string;
  definition: DomainDefinitionRow | null;
  pillars: CoveragePillarRow[];
  dependencies: DependencyRegistryRow[];
  institutions: InstitutionalRegistryRow[];
  /**
   * SPEC-CIR-001 §7 — Law II of Constitutional Discovery, evaluated per
   * pillar over this domain's registry. Present so the rule is BOUND to an
   * observable surface rather than existing only as doctrine (CFS-053 CB-1/
   * CB-6: a mechanism that cannot fire is indistinguishable from one that
   * does not exist).
   */
  diversity: PillarDiversityRow[];
  /** SPEC-CIR-001 §7 — the document-level acquisition plan for this domain. */
  acquisitionSeeds: AcquisitionSeedRow[];
}
