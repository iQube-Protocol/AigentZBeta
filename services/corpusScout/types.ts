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
