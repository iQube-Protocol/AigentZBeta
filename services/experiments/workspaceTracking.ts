/**
 * workspaceTracking — the ONLY workspace-local state on the ExperimentWorkspace
 * spine: milestones and blockers.
 *
 * Operator ruling on the actions substrate ("Hybrid", 2026-07-27): milestones
 * and blockers are workspace-local because nothing in the platform models them;
 * actions and decisions are PROJECTED from IntentQubes and Constitutional
 * Agreements and must never be written here. `assertTrackableKind` makes that
 * refusal explicit rather than trusting a CHECK constraint to explain itself.
 *
 * Storage discipline mirrors `services/constitutional/constitutionalAgreement.ts`:
 * the shared admin client, soft-fail reads that return empty rather than
 * throwing into a surface, and no persona identifier anywhere — authorship is
 * a one-way commitment.
 */

import { createHash } from 'crypto';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { PartnerWorkspaceLayer } from '@/services/venture/partnerWorkspace';

export const TRACKABLE_KINDS = ['milestone', 'blocker'] as const;
export type TrackableKind = (typeof TRACKABLE_KINDS)[number];

export const TRACKABLE_STATUSES = ['open', 'in_progress', 'done', 'cleared'] as const;
export type TrackableStatus = (typeof TRACKABLE_STATUSES)[number];

/**
 * The statuses each kind may hold. A blocker is never "done" and a milestone
 * is never "cleared" — one column in the table, two vocabularies here.
 */
const STATUSES_BY_KIND: Record<TrackableKind, TrackableStatus[]> = {
  milestone: ['open', 'in_progress', 'done'],
  blocker: ['open', 'cleared'],
};

export interface WorkspaceTrackedItem {
  id: string;
  workspaceId: string;
  kind: TrackableKind;
  title: string;
  detail: string | null;
  status: TrackableStatus;
  layer: PartnerWorkspaceLayer | null;
  ownerAgentId: string | null;
  dueDate: string | null;
  /** Reference into the projected substrate — never a copy of it. */
  linkedIntentId: string | null;
  linkedAgreementId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The concerns that are PROJECTED, named so the refusal below can say which
 * substrate already owns each one instead of a bare "invalid kind".
 */
const PROJECTED_ELSEWHERE: Record<string, string> = {
  action: 'IntentQubes (services/iqube/intentQube) — project it, do not store it',
  decision: 'Constitutional Agreements (services/constitutional/constitutionalAgreement) — project it, do not store it',
  participant: 'participation grants (services/passport/participationAccess) — resolve it, do not store it',
  evidence: 'activity receipts (services/receipts/activityReceiptService) — reference it, do not store it',
  invariant: 'the invariant store, resolved with provenance — never a stored id list',
};

export function assertTrackableKind(kind: string): asserts kind is TrackableKind {
  if ((TRACKABLE_KINDS as readonly string[]).includes(kind)) return;
  const owner = PROJECTED_ELSEWHERE[kind];
  throw new Error(
    owner
      ? `workspaceTracking: "${kind}" is owned by ${owner}`
      : `workspaceTracking: unknown kind "${kind}" — only ${TRACKABLE_KINDS.join(' / ')} are workspace-local`,
  );
}

/** Whether a status is legal for a kind (see STATUSES_BY_KIND). */
export function isLegalStatus(kind: TrackableKind, status: string): status is TrackableStatus {
  return STATUSES_BY_KIND[kind].includes(status as TrackableStatus);
}

/** One-way author commitment. NEVER store the personaId itself. */
export function authorCommitment(personaId: string): string {
  return createHash('sha256').update(`workspace:author:${personaId}`).digest('hex').slice(0, 16);
}

function softFail(op: string, message: string): void {
  console.warn(`[workspaceTracking] ${op} failed: ${message}`);
}

function rowToItem(row: Record<string, unknown>): WorkspaceTrackedItem {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    kind: String(row.kind) as TrackableKind,
    title: String(row.title),
    detail: row.detail ? String(row.detail) : null,
    status: String(row.status) as TrackableStatus,
    layer: row.layer ? (String(row.layer) as PartnerWorkspaceLayer) : null,
    ownerAgentId: row.owner_agent_id ? String(row.owner_agent_id) : null,
    dueDate: row.due_date ? String(row.due_date) : null,
    linkedIntentId: row.linked_intent_id ? String(row.linked_intent_id) : null,
    linkedAgreementId: row.linked_agreement_id ? String(row.linked_agreement_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listWorkspaceItems(
  workspaceId: string,
  kind?: TrackableKind,
): Promise<WorkspaceTrackedItem[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  try {
    let query = admin
      .from('experiment_workspace_items')
      .select('*')
      .eq('workspace_id', workspaceId);
    if (kind) query = query.eq('kind', kind);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      softFail('list', error.message);
      return [];
    }
    return (data ?? []).map((r) => rowToItem(r as Record<string, unknown>));
  } catch (e) {
    softFail('list', e instanceof Error ? e.message : String(e));
    return [];
  }
}

export interface CreateWorkspaceItemInput {
  workspaceId: string;
  kind: TrackableKind;
  title: string;
  detail?: string;
  layer?: PartnerWorkspaceLayer;
  ownerAgentId?: string;
  dueDate?: string;
  linkedIntentId?: string;
  linkedAgreementId?: string;
  /** Used ONLY to derive the one-way author commitment. */
  personaId?: string;
}

export async function createWorkspaceItem(
  input: CreateWorkspaceItemInput,
): Promise<WorkspaceTrackedItem | null> {
  assertTrackableKind(input.kind);
  if (!input.title.trim()) throw new Error('workspaceTracking: title is required');

  const admin = getSupabaseServer();
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from('experiment_workspace_items')
      .insert({
        workspace_id: input.workspaceId,
        kind: input.kind,
        title: input.title.trim(),
        detail: input.detail ?? null,
        status: 'open',
        layer: input.layer ?? null,
        owner_agent_id: input.ownerAgentId ?? null,
        due_date: input.dueDate ?? null,
        linked_intent_id: input.linkedIntentId ?? null,
        linked_agreement_id: input.linkedAgreementId ?? null,
        created_by_ref: input.personaId ? authorCommitment(input.personaId) : null,
      })
      .select('*')
      .single();
    if (error) {
      softFail('create', error.message);
      return null;
    }
    return rowToItem(data as Record<string, unknown>);
  } catch (e) {
    softFail('create', e instanceof Error ? e.message : String(e));
    return null;
  }
}

export async function setWorkspaceItemStatus(
  id: string,
  kind: TrackableKind,
  status: TrackableStatus,
): Promise<boolean> {
  assertTrackableKind(kind);
  if (!isLegalStatus(kind, status)) {
    throw new Error(
      `workspaceTracking: "${status}" is not a legal status for a ${kind} (${STATUSES_BY_KIND[kind].join(' / ')})`,
    );
  }
  const admin = getSupabaseServer();
  if (!admin) return false;
  try {
    const { error } = await admin
      .from('experiment_workspace_items')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      softFail('setStatus', error.message);
      return false;
    }
    return true;
  } catch (e) {
    softFail('setStatus', e instanceof Error ? e.message : String(e));
    return false;
  }
}
