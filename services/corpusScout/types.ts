/**
 * Corpus Scout (PRD-ICA-001) — shared types for the acquisition/verification/
 * review pipeline. See `codexes/packs/irl/foundation/PRD-ICA-001_invariant-corpus-acquisition-agent.md`.
 *
 * Two independent, composable axes (PRD-ICA-001 §0.3 — never conflate):
 *   ProvenanceClass       — evidence-integrity question ("what kind of source is this").
 *   ReviewWorkflowStatus  — pipeline-state question ("what did the reviewer decide").
 */

/** The four ratified values (CRYSTAL-ENLARGEMENT_plan.md §2a). Corpus Scout
 *  adopts this vocabulary; it does not invent a second one. */
export type ProvenanceClass =
  | 'external-established'
  | 'external-empirical'
  | 'platform-derived'
  | 'platform-hypothesized';

export const PROVENANCE_CLASSES: readonly ProvenanceClass[] = [
  'external-established', 'external-empirical', 'platform-derived', 'platform-hypothesized',
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
}

/** The full constitutional substrate for one domain — what `GET
 *  /api/corpus-scout/domain-constitution?domain=` returns. */
export interface DomainConstitution {
  domain: string;
  definition: DomainDefinitionRow | null;
  pillars: CoveragePillarRow[];
  dependencies: DependencyRegistryRow[];
  institutions: InstitutionalRegistryRow[];
}
