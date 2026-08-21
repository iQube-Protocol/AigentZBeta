/**
 * Admin Action Centre — canonical service (P1).
 *
 * ONE canonical store (`public.admin_action_items`, migration
 * 20260930010000). This module owns every read/write to that table; no
 * caller should query it directly (mirrors the discipline
 * services/receipts/activityReceiptService.ts already establishes for
 * activity_receipts).
 *
 * Auth is NOT enforced here — callers (API routes) gate via
 * `requireCartridgeAdmin` first, exactly like services/passport/
 * issuanceService.ts trusts its caller's steward gate. This service is a
 * pure data layer.
 *
 * Ordering discipline (operator brief §11): this module NEVER decides
 * issuance or review outcomes. It only records what already happened
 * (`recordAdminAction`) or reports triage state (list/markRead/resolve).
 * The canonical order for any producer is: evidence evaluation → issuance/
 * review decision → state transition → receipt → admin notification. If a
 * caller finds itself deciding domain policy inside this file, that call
 * belongs in the domain service instead.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type {
  AdminActionItem,
  AdminActionStatus,
  AdminActionSummary,
  RecordAdminActionInput,
} from '@/types/adminActionItem';

interface AdminActionRow {
  id: string;
  category: string;
  severity: string;
  disposition: string;
  status: string;
  title: string;
  summary: string;
  source_type: string;
  source_ref: string | null;
  source_surface: string | null;
  action_type: string | null;
  action_href: string | null;
  created_at: string;
  read_at: string | null;
  resolved_at: string | null;
  metadata: Record<string, unknown> | null;
}

function rowToItem(row: AdminActionRow): AdminActionItem {
  return {
    id: row.id,
    category: row.category,
    severity: row.severity as AdminActionItem['severity'],
    disposition: row.disposition as AdminActionItem['disposition'],
    status: row.status as AdminActionStatus,
    title: row.title,
    summary: row.summary,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
    sourceSurface: row.source_surface,
    actionType: row.action_type,
    actionHref: row.action_href,
    createdAt: row.created_at,
    readAt: row.read_at,
    resolvedAt: row.resolved_at,
    metadata: row.metadata,
  };
}

const SELECT_COLUMNS =
  'id, category, severity, disposition, status, title, summary, source_type, source_ref, source_surface, action_type, action_href, created_at, read_at, resolved_at, metadata';

export type RecordAdminActionResult =
  | { ok: true; id: string; created: boolean }
  | { ok: false; error: string };

/**
 * Idempotently record an admin action item. A repeated call with the SAME
 * `idempotencyKey` (a retry, a re-poll, a duplicate event) returns the
 * EXISTING row's id with `created: false` — it never creates a duplicate.
 * This is the unique-constraint discipline `admin_action_items.idempotency_key`
 * enforces at the DB level; this function just surfaces that outcome to the
 * caller instead of letting a 23505 bubble up as an error.
 */
export async function recordAdminAction(
  input: RecordAdminActionInput,
): Promise<RecordAdminActionResult> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase configuration missing' };

  const { data, error } = await admin
    .from('admin_action_items')
    .insert({
      idempotency_key: input.idempotencyKey,
      category: input.category,
      severity: input.severity,
      disposition: input.disposition,
      title: input.title,
      summary: input.summary,
      source_type: input.sourceType,
      source_ref: input.sourceRef ?? null,
      source_surface: input.sourceSurface ?? null,
      action_type: input.actionType ?? null,
      action_href: input.actionHref ?? null,
      metadata: input.metadata ?? null,
    })
    .select('id')
    .single();

  if (!error) return { ok: true, id: String(data.id), created: true };

  // 23505 = unique_violation (idempotency_key already exists). Look the
  // existing row up rather than treating a duplicate as a failure — the
  // caller's event already landed once, which is exactly the intended
  // outcome, not an error.
  if (error.code === '23505') {
    const { data: existing, error: lookupError } = await admin
      .from('admin_action_items')
      .select('id')
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle();
    if (lookupError || !existing) {
      return { ok: false, error: lookupError?.message ?? 'idempotency lookup failed' };
    }
    return { ok: true, id: String(existing.id), created: false };
  }

  return { ok: false, error: error.message };
}

export interface ListAdminActionsFilter {
  category?: string;
  disposition?: AdminActionItem['disposition'];
  /** Defaults to every non-dismissed status when omitted. */
  status?: AdminActionStatus[];
  limit?: number;
}

export async function listAdminActions(
  filter: ListAdminActionsFilter = {},
): Promise<AdminActionItem[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];

  let query = admin
    .from('admin_action_items')
    .select(SELECT_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 50);

  if (filter.category) query = query.eq('category', filter.category);
  if (filter.disposition) query = query.eq('disposition', filter.disposition);
  if (filter.status?.length) {
    query = query.in('status', filter.status);
  } else {
    query = query.neq('status', 'dismissed');
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as AdminActionRow[]).map(rowToItem);
}

/**
 * Aggregate summary for a Command-Centre-style seam (operator brief §13,
 * §4 of the locked decisions: BriefCard.pendingApprovalsCount). Never a
 * full list — `topExceptions` is capped and callers needing more use
 * `listAdminActions` against the item's own domain surface.
 */
export async function getAdminActionSummary(
  categories?: string[],
): Promise<AdminActionSummary> {
  const admin = getSupabaseServer();
  if (!admin) return { total: 0, actionRequired: 0, topExceptions: [] };

  let base = admin
    .from('admin_action_items')
    .select(SELECT_COLUMNS)
    .neq('status', 'dismissed')
    .neq('status', 'resolved');
  if (categories?.length) base = base.in('category', categories);

  const { data, error } = await base;
  if (error || !data) return { total: 0, actionRequired: 0, topExceptions: [] };

  const items = (data as AdminActionRow[]).map(rowToItem);
  const actionRequired = items.filter((i) => i.disposition === 'action_required');
  const severityRank: Record<AdminActionItem['severity'], number> = {
    urgent: 0,
    attention: 1,
    info: 2,
  };
  const topExceptions = [...actionRequired]
    .sort((a, b) => {
      const bySeverity = severityRank[a.severity] - severityRank[b.severity];
      if (bySeverity !== 0) return bySeverity;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 5);

  return { total: items.length, actionRequired: actionRequired.length, topExceptions };
}

export type MarkAdminActionResult = { ok: true } | { ok: false; error: string };

export async function markAdminActionRead(
  id: string,
  actorPersonaId: string,
): Promise<MarkAdminActionResult> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase configuration missing' };

  const { error } = await admin
    .from('admin_action_items')
    .update({ status: 'read', read_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['unread', 'read']);
  if (error) return { ok: false, error: error.message };
  void actorPersonaId; // reserved — see resolveAdminAction's comment.
  return { ok: true };
}

/**
 * Marks an item resolved. Resolving here is independent of, and never a
 * substitute for, acting on the underlying domain record (operator brief
 * §10/§14) — this ONLY updates triage state on this row. `actorPersonaId`
 * is recorded server-side for audit and never echoed back to the client as
 * a raw persona id (mirrors the T0 discipline `resolved_by_persona_id`'s
 * migration comment describes).
 */
export async function resolveAdminAction(
  id: string,
  actorPersonaId: string,
): Promise<MarkAdminActionResult> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase configuration missing' };

  const { error } = await admin
    .from('admin_action_items')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by_persona_id: actorPersonaId,
    })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Resolve every still-open action_required item for one domain record —
 * used when a human review decision supersedes whatever exception(s) drew
 * the item into the queue in the first place (operator brief §10: a
 * notification observes outcomes, it doesn't gate them; once a steward has
 * decided, the exception this item existed to surface is over). At most one
 * item is expected in practice, but this resolves every match rather than
 * assuming uniqueness. Best-effort by design — callers (a review-decision
 * route) must never fail the decision itself because this bookkeeping did.
 */
export async function resolveOpenActionsForSource(
  sourceType: string,
  sourceRef: string,
  actorPersonaId: string,
): Promise<void> {
  const admin = getSupabaseServer();
  if (!admin) return;
  try {
    await admin
      .from('admin_action_items')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by_persona_id: actorPersonaId,
      })
      .eq('source_type', sourceType)
      .eq('source_ref', sourceRef)
      .eq('disposition', 'action_required')
      .in('status', ['unread', 'read']);
  } catch (e) {
    console.error('[adminActionService] resolveOpenActionsForSource failed:', e);
  }
}
