/**
 * Capability receipts — thin composition over `activityReceiptService`.
 *
 * Per the Phase 1 decision: ONE receipt spine, ONE T0 canary regime,
 * ONE DVN write path. This wrapper:
 *
 *   - Maps a `CapabilityWorkOrder` outcome onto the canonical
 *     `createActivityReceipt` call.
 *   - Adds capability-specific fields (workOrderId, adapter,
 *     capability_class, policy_hash, tool_name, approval_state,
 *     result_summary) into existing receipt slots so no schema
 *     migration is needed in Phase 1.
 *   - NEVER writes T0 (`personaId`) to receipt-visible fields. The
 *     underlying row's `persona_id` column is the canonical T0 key
 *     used by the receipts service — that stays. Receipt-payload
 *     fields use the T2 `cohortAliasCommitment` for attribution.
 *
 * Phase 2 may introduce dedicated columns (capability_metadata jsonb)
 * via migration; this wrapper's signature stays stable.
 */

import {
  createActivityReceipt,
  type ActivityActionType,
  type ActivityReceiptRecord,
  type CreateActivityReceiptInput,
} from '@/services/receipts/activityReceiptService';
import type { CapabilityWorkOrder } from '../types';

export interface CapabilityReceiptInput {
  /**
   * T0 persona id used ONLY as the row primary key on the
   * activity_receipts table. Required by the underlying service.
   * Never echoed into receipt-visible payload fields.
   */
  personaId: string;

  /** The work order issued by the gateway. */
  workOrder: CapabilityWorkOrder;

  /** Outcome status surfaced into the summary line. */
  status: 'success' | 'failure' | 'pending_approval' | 'denied';

  /** Short, user-readable description of the result. */
  result_summary: string;

  /** Optional artifact ids produced (registry refs, content qubes, etc.). */
  artifactsCreated?: string[];

  /** Optional iqube refs consulted during execution. */
  iqubesUsed?: string[];

  /** Optional session / intent linkage from the calling route. */
  sessionId?: string | null;
  intentId?: string | null;
}

/**
 * Persist a receipt for a capability work order outcome.
 *
 * Action type mapping (Phase 1 — uses existing `ActivityActionType`):
 *   - send / write / payment  → 'artifact_sent'
 *   - compose                 → 'artifact_created'
 *   - read / search / execute → 'specialist_consulted'
 *   - pending_approval status → 'approval_granted' (with status prefix)
 *
 * Returns the underlying receipt record (or null if the receipts table
 * is missing — see `createActivityReceipt` for the fallback).
 */
export async function recordCapabilityReceipt(
  input: CapabilityReceiptInput,
): Promise<ActivityReceiptRecord | null> {
  const { workOrder, status, result_summary } = input;

  const summary = composeSummary({
    workOrder,
    status,
    result_summary,
  });

  // tools_used encodes the adapter + tool for downstream filtering:
  //   ['openclaw:web-search', 'openclaw:gmail.draft']
  const tools_used = [`${workOrder.adapter}:${workOrder.tool_name}`];

  // agents_invoked surfaces the capability class so the receipts panel
  // can group by what the action did, not just which tool ran.
  const agents_invoked = [`capability:${workOrder.capability_class}`];

  const payload: CreateActivityReceiptInput = {
    personaId: input.personaId,
    sessionId: input.sessionId ?? null,
    intentId: input.intentId ?? null,
    activeCartridge: workOrder.policy.cartridge_scope ?? 'metame',
    actionType: mapActionType(workOrder, status),
    summary,
    agentsInvoked: agents_invoked,
    toolsUsed: tools_used,
    iqubesUsed: input.iqubesUsed ?? [],
    artifactsCreated: input.artifactsCreated ?? [],
    approvalsGranted:
      workOrder.approval_state === 'granted' ? [workOrder.workOrderId] : [],
    // policy_envelope_id stores the policy hash so two work orders sharing
    // a policy can be correlated without exposing the full envelope.
    policyEnvelopeId: workOrder.policy.policyHash,
  };

  return createActivityReceipt(payload);
}

function composeSummary(args: {
  workOrder: CapabilityWorkOrder;
  status: CapabilityReceiptInput['status'];
  result_summary: string;
}): string {
  const { workOrder, status, result_summary } = args;
  // The cohort alias is the T2 attribution key. workOrderId lets the
  // receipts viewer link back to the original work order. Neither field
  // exposes T0.
  const prefix = `[capability ${status}] ${workOrder.capability_class}/${workOrder.tool_name}`;
  const tail = `· workOrder=${workOrder.workOrderId} · alias=${workOrder.policy.cohortAliasCommitment.slice(0, 12)}…`;
  return `${prefix} — ${result_summary} ${tail}`.slice(0, 1000);
}

function mapActionType(
  workOrder: CapabilityWorkOrder,
  status: CapabilityReceiptInput['status'],
): ActivityActionType {
  if (status === 'pending_approval') return 'approval_granted';
  switch (workOrder.capability_class) {
    case 'send':
    case 'write':
    case 'payment':
      return 'artifact_sent';
    case 'compose':
      return 'artifact_created';
    case 'read':
    case 'search':
    case 'execute':
    default:
      return 'specialist_consulted';
  }
}
