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
/**
 * A review's queue state is DERIVED from how many of its rows are still in
 * dispute — never asserted independently.
 *
 * Three call sites computed `contested > 0 ? 'contested' : 'completed'` by
 * hand: the web writer, the CLI publish path, and (as of the record-level
 * remedy, 2026-08-02) the row-resolution route. Three hand-copies of one rule
 * is exactly the drift `inv.engineering.036` names — and the remedy route is
 * where it would have bitten first, since remedying the last contested row
 * must move the review out of `contested` or the header contradicts the list
 * beneath it.
 */
export function deriveQueueState(contestedCount: number): 'contested' | 'completed' {
  return contestedCount > 0 ? 'contested' : 'completed';
}

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
  /** Set only by publishIndependenceReview.ts's governed import path — never
   * by the web UI's own writer (app/api/research/review/route.ts), which
   * leaves this undefined. Distinguishes a CLI-executed, artifact-verified
   * publication from an ordinary web-submitted review. */
  source?: 'cli-independent-review';
  importedFrom?: { artifactDir: string; importedAt: string };
  /** Set on a row that a LATER completed review (different content, hence a
   * different reviewId) has replaced. The row is never deleted — only
   * marked. A superseded row's own queueState is untouched (e.g. it may
   * still correctly read 'planned' if it never ran) so its history stays
   * honest; supersededBy is what tells a reader not to treat it as current. */
  supersededBy?: string;
  supersededReason?: string;
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
    source: p.source,
    importedFrom: p.importedFrom,
    supersededBy: p.supersededBy,
    supersededReason: p.supersededReason,
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

/**
 * Mark a prior review row as superseded by a later, completed review with
 * different content (hence a different reviewId) — NEVER deletes it. The
 * superseded row's own queueState/payload are otherwise untouched; only
 * `supersededBy`/`supersededReason` are added, preserving the audit trail
 * (operator ruling 2026-07-31). Which row to supersede must be named
 * explicitly by the caller — this function never guesses "the stale
 * planned row" by heuristics (e.g. matching a version prefix), since that
 * risks superseding an unrelated legitimate review of the same version.
 */
export async function markReviewSuperseded(
  admin: SupabaseClient,
  reviewId: string,
  supersededBy: string,
  reason: string,
): Promise<void> {
  const existing = await getReview(admin, reviewId);
  if (!existing) throw new Error(`cannot mark ${reviewId} superseded — no such review exists`);
  // Same column split as upsertReview: reviewId/queueState/receiptId/
  // createdAt/updatedAt are columns, not payload fields — only the
  // remaining fields (plus the new supersede markers) go into `payload`.
  const { reviewId: _id, queueState, receiptId, createdAt: _createdAt, updatedAt: _updatedAt, ...restPayload } = existing;
  const { error } = await admin
    .from(TABLE)
    .update({
      payload: { ...restPayload, supersededBy, supersededReason: reason },
      lifecycle_state: queueState,
      receipt_id: receiptId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('object_kind', OBJECT_KIND)
    .eq('object_id', reviewId);
  if (error) throw new Error(`marking ${reviewId} superseded failed: ${error.message}`);
}
