/**
 * Persistence for IRL-REVIEW-001 review records.
 *
 * Lives OUTSIDE `services/research/review/` on purpose. That directory is
 * canaried to import no database client at all — a reviewer must not be able to
 * reach the corpus even by accident, and the cheapest way to guarantee that is
 * for the code path a reviewer runs through to have no way of addressing a
 * database. So the review engine takes data in and returns artifacts out, and
 * everything that touches a table lives here and in the API routes.
 *
 * Storage reuses `research_objects` (`object_kind: 'review'`) rather than a new
 * table, per SPEC §12: "reuse the existing workspace, receipts, evidence and
 * agent-routing primitives — do not build a separate review-management
 * product." A review's fields ride in `payload`, exactly as the artifact rows
 * PRD-EPI-001 introduced already do.
 *
 * ── The one thing this module must never do ────────────────────────────────
 *
 * Write to `invariants`, to Standing, or to any lifecycle state of a reviewed
 * asset. `lifecycle_state` on the row it writes is the REVIEW's queue state
 * ('planned' → 'running' → 'completed'/'contested' → 'resolved'), never the
 * asset's. The two happening to share a column name is a coincidence of the
 * shared table, not a coupling, and a canary asserts this module's writes are
 * confined to `research_objects`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BlockDecision,
  ReviewDecision,
  ReviewPackage,
  ReviewRequest,
  ReviewResolution,
  ReviewerAssignment,
  StewardAssignment,
} from '@/services/research/review';

const TABLE = 'research_objects';
const OBJECT_KIND = 'review';

export type ReviewQueueState = 'planned' | 'running' | 'completed' | 'contested' | 'resolved';

export const REVIEW_QUEUE_STATES: readonly ReviewQueueState[] = [
  'planned', 'running', 'completed', 'contested', 'resolved',
];

/** Governed resolution actions available on a completed review (SPEC §12). */
export type ReviewResultAction = 'accept' | 'revise' | 'defer' | 'reject';

export const REVIEW_RESULT_ACTIONS: readonly ReviewResultAction[] = ['accept', 'revise', 'defer', 'reject'];

/**
 * What each action does — and, more usefully, what it does NOT.
 *
 * Every one of them records a governed resolution on the REVIEW record. None
 * writes to the corpus, grants Standing, changes an asset's lifecycle, or
 * freezes anything. `accept` in particular is the one a reader will assume is a
 * write, so it is spelled out: accepting a review means the review's findings
 * are accepted as evidence. The freeze remains a separate governed act.
 */
export const REVIEW_ACTION_EFFECT: Record<ReviewResultAction, string> = {
  accept:
    'The review is accepted as evidence. This does NOT ratify, freeze or admit the reviewed asset — ' +
    'the freeze remains a separate governed act.',
  revise: 'The review is returned for revision. The package and its hash are unchanged.',
  defer: 'The review is deferred. Nothing about the reviewed asset changes.',
  reject: 'The review is rejected as evidence. The reviewed asset is untouched.',
};

export interface ReviewRecord {
  reviewId: string;
  queueState: ReviewQueueState;
  request: ReviewRequest;
  package: ReviewPackage;
  assignments: ReviewerAssignment[];
  steward: StewardAssignment;
  blockDecisions: BlockDecision[];
  r1Decisions: ReviewDecision[];
  r2Decisions: ReviewDecision[];
  resolutions: ReviewResolution[];
  /** Governed resolution recorded from the Review Result view. */
  action: ReviewResultAction | null;
  actionReason: string | null;
  actionByRef: string | null;
  actionAt: string | null;
  receiptId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Row {
  object_id: string;
  payload: unknown;
  lifecycle_state: string;
  receipt_id: string | null;
  created_at: string;
  updated_at: string;
}

function toRecord(row: Row): ReviewRecord {
  const p = (row.payload ?? {}) as Partial<ReviewRecord>;
  return {
    reviewId: row.object_id,
    queueState: (REVIEW_QUEUE_STATES as readonly string[]).includes(row.lifecycle_state)
      ? (row.lifecycle_state as ReviewQueueState)
      : 'planned',
    request: p.request as ReviewRequest,
    package: p.package as ReviewPackage,
    assignments: p.assignments ?? [],
    steward: p.steward as StewardAssignment,
    blockDecisions: p.blockDecisions ?? [],
    r1Decisions: p.r1Decisions ?? [],
    r2Decisions: p.r2Decisions ?? [],
    resolutions: p.resolutions ?? [],
    action: p.action ?? null,
    actionReason: p.actionReason ?? null,
    actionByRef: p.actionByRef ?? null,
    actionAt: p.actionAt ?? null,
    receiptId: row.receipt_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listReviews(admin: SupabaseClient, limit = 50): Promise<ReviewRecord[]> {
  const { data, error } = await admin
    .from(TABLE)
    .select('object_id,payload,lifecycle_state,receipt_id,created_at,updated_at')
    .eq('object_kind', OBJECT_KIND)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`review list failed: ${error.message}`);
  return ((data ?? []) as unknown as Row[]).map(toRecord);
}

export async function getReview(admin: SupabaseClient, reviewId: string): Promise<ReviewRecord | null> {
  const { data, error } = await admin
    .from(TABLE)
    .select('object_id,payload,lifecycle_state,receipt_id,created_at,updated_at')
    .eq('object_kind', OBJECT_KIND)
    .eq('object_id', reviewId)
    .maybeSingle();
  if (error) throw new Error(`review read failed: ${error.message}`);
  return data ? toRecord(data as unknown as Row) : null;
}

export async function upsertReview(
  admin: SupabaseClient,
  record: Omit<ReviewRecord, 'createdAt' | 'updatedAt' | 'receiptId'> & { receiptId?: string | null },
): Promise<void> {
  const { reviewId, queueState, receiptId, ...payload } = record;
  const { error } = await admin.from(TABLE).upsert(
    {
      object_kind: OBJECT_KIND,
      object_id: reviewId,
      payload,
      lifecycle_state: queueState,
      receipt_id: receiptId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'object_kind,object_id' },
  );
  if (error) throw new Error(`review write failed: ${error.message}`);
}
