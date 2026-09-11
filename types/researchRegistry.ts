/**
 * Experiment / Constitutional / Invariant Registry — types (Strand 1 of the
 * operator's four-strand programme, 2026-07-24).
 *
 * Deliberately a NEW file, not an extension of `types/research.ts`. That file
 * is the canary-pinned, contract-first RATIFIED/SHIPPED object model
 * (EXPERIMENT_REGISTRY etc.) — its lifecycle ORDER is constitutional data
 * pinned by a canary, and this register's candidate/backlog concept did not
 * exist there. Extending it in place would risk the canary and would blur
 * "ratified registry" with "candidate register", which the charter doc
 * (CFS-051) explicitly keeps distinct. This file composes `types/research.ts`
 * by reference (depends_on entries may cite a bare EXPERIMENT_REGISTRY id
 * like 'EXP-006') rather than by duplication.
 *
 * Shared shape across all three candidate registers + the backlog: id, slug,
 * status (own vocabulary per kind), depends_on (cross-register refs),
 * reviewHistory (append-only), createdAt/updatedAt. T2-safe: reviewer
 * identity is always a `reviewerRef` (sha256 commitment via
 * services/identity/personaReferences.ts::personaPublicRef), never a raw
 * persona id.
 */

export const REGISTRY_KINDS = ['experiment', 'principle', 'invariant', 'backlog'] as const;
export type RegistryKind = (typeof REGISTRY_KINDS)[number];

export const CANDIDATE_EXPERIMENT_STATUSES = [
  'proposed',
  'scoped',
  'protocol-ratified',
  'running',
  'evaluated',
  'published',
  'promoted',
  'archived',
] as const;
export type CandidateExperimentStatus = (typeof CANDIDATE_EXPERIMENT_STATUSES)[number];

export const CANDIDATE_PRINCIPLE_STATUSES = ['proposed', 'under-review', 'ratified', 'rejected'] as const;
export type CandidatePrincipleStatus = (typeof CANDIDATE_PRINCIPLE_STATUSES)[number];

export const CANDIDATE_INVARIANT_STATUSES = [
  'candidate',
  'proposed-for-canonization',
  'canonized',
  'rejected',
] as const;
export type CandidateInvariantStatus = (typeof CANDIDATE_INVARIANT_STATUSES)[number];

export const BACKLOG_PRIORITIES = ['low', 'medium', 'high'] as const;
export type BacklogPriority = (typeof BACKLOG_PRIORITIES)[number];

export const BACKLOG_STATUSES = ['backlog', 'scoped', 'in-progress', 'done'] as const;
export type BacklogStatus = (typeof BACKLOG_STATUSES)[number];

/** One append-only review-history entry. `reviewerRef` is T2-safe — never a
 *  raw persona id (see module doc). `disposition` is free text chosen by the
 *  reviewer (e.g. 'approve', 'needs-revision', 'reject', 'note-only'). */
export interface RegistryReviewEntry {
  reviewerRef: string;
  date: string;
  note: string;
  disposition: string;
}

interface RegistryCommon {
  id: string;
  slug: string;
  dependsOn: string[];
  reviewHistory: RegistryReviewEntry[];
  sourceNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateExperiment extends RegistryCommon {
  title: string;
  family: string | null;
  layer: 'I' | 'II' | 'III' | null;
  seriesId: string | null;
  hypothesis: string;
  charterRef: string | null;
  status: CandidateExperimentStatus;
  governingInvariants: string[];
}

export interface CandidatePrinciple extends RegistryCommon {
  statement: string;
  rationale: string | null;
  status: CandidatePrincipleStatus;
  charterRef: string | null;
}

export interface CandidateInvariant extends RegistryCommon {
  namespace: string | null;
  statement: string;
  rationale: string | null;
  status: CandidateInvariantStatus;
  promotedInvariantId: string | null;
}

export interface BacklogItem extends RegistryCommon {
  title: string;
  description: string | null;
  priority: BacklogPriority;
  status: BacklogStatus;
  linkedExperimentIds: string[];
  linkedHypothesisIds: string[];
}
