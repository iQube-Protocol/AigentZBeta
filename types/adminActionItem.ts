/**
 * Admin Action Centre — canonical AdminActionItem types (P1).
 *
 * Hub-and-spoke, not a monolithic inbox (operator ruling, 2026-08-21): this
 * is the ONE canonical shape. Domain surfaces (Passport Bureau, metaMe Pulse
 * admin, KNYT/Qripto admin) project a FILTERED view of items in their own
 * category into their EXISTING queue UI; the Command Centre-equivalent seam
 * (BriefCard.pendingApprovalsCount, see services/orchestration/briefBuilder.ts)
 * gets only an aggregate count + top exceptions. No surface here duplicates
 * a domain's own mutable state — `sourceRef`/`actionHref` index into it.
 */

export type AdminActionSeverity = 'info' | 'attention' | 'urgent';

/**
 * The core distinction (operator brief §2): informational items never
 * require action; action_required items are the only ones that should pull
 * an admin in. Every producer must classify explicitly — there is no
 * default.
 */
export type AdminActionDisposition = 'informational' | 'action_required';

export type AdminActionStatus = 'unread' | 'read' | 'resolved' | 'dismissed';

export interface AdminActionItem {
  id: string;
  category: string;
  severity: AdminActionSeverity;
  disposition: AdminActionDisposition;
  status: AdminActionStatus;

  title: string;
  summary: string;

  sourceType: string;
  sourceRef?: string | null;
  sourceSurface?: string | null;

  actionType?: string | null;
  actionHref?: string | null;

  createdAt: string;
  readAt?: string | null;
  resolvedAt?: string | null;

  metadata?: Record<string, unknown> | null;
}

/**
 * Input to `recordAdminAction` — everything needed to create or idempotently
 * upsert onto one action item. `idempotencyKey` is the caller's contract:
 * one key per logical occurrence (see services/adminActions/idempotencyKeys.ts).
 */
export interface RecordAdminActionInput {
  idempotencyKey: string;
  category: string;
  severity: AdminActionSeverity;
  disposition: AdminActionDisposition;
  title: string;
  summary: string;
  sourceType: string;
  sourceRef?: string | null;
  sourceSurface?: string | null;
  actionType?: string | null;
  actionHref?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AdminActionSummary {
  total: number;
  actionRequired: number;
  /** Highest-severity, most-recent action_required items — for a
   *  Command-Centre-style "N requires attention" projection. Never the
   *  full list; callers needing more page through `listAdminActions`. */
  topExceptions: AdminActionItem[];
}
