/**
 * Capability execution pipeline — single entry point for the whole loop.
 *
 *   issueCapabilityWorkOrder()  → produces a T0-free work order
 *   getAdapter(workOrder.adapter) → dispatches to OpenClaw (Phase 2)
 *   recordCapabilityReceipt()   → writes one receipt via the canonical spine
 *
 * Callers (specialist router, future `/api/capabilities/invoke` route,
 * Pattern A pre-flight gather) use this single function instead of
 * orchestrating the three steps themselves. Keeps the policy /
 * approval / receipt path centralised — there is exactly one place
 * where a T0 identifier could leak, and the compile-time canary on
 * `CapabilityWorkOrder` slams that door.
 */

import type { ActivePersonaContext } from '@/types/access';
import { getAdapter } from './adapters/registry';
import type { AdapterResult } from './adapters/types';
import { issueCapabilityWorkOrder, type IssueWorkOrderInput, type IssueWorkOrderResult } from './gateway';
import { recordCapabilityReceipt } from './receipts/capabilityReceiptService';
import type { CapabilityWorkOrder, PolicyEnvelope } from './types';

export interface ExecuteCapabilityInput
  extends Omit<IssueWorkOrderInput, 'persona' | 'envelope'> {
  persona: ActivePersonaContext;
  envelope: PolicyEnvelope;
  /** Surface-side session / intent linkage for the receipt. */
  sessionId?: string | null;
  intentId?: string | null;
}

export type ExecuteCapabilityResult =
  | {
      ok: true;
      workOrder: CapabilityWorkOrder;
      adapterResult: AdapterResult;
      /** Receipt id (when persisted). Null if receipts table is missing. */
      receiptId: string | null;
    }
  | {
      ok: false;
      /** Where the failure happened — for surface-level error UX. */
      stage: 'gateway' | 'adapter';
      /** Underlying reason from the failing stage. */
      reason: string;
      detail?: string;
      /** When the gateway issued the work order but the adapter failed,
       *  this is the work order so the caller can still trace it. */
      workOrder?: CapabilityWorkOrder;
    };

export async function executeCapability(
  input: ExecuteCapabilityInput,
): Promise<ExecuteCapabilityResult> {
  // 1. Gateway — issue the T0-free work order.
  const issued: IssueWorkOrderResult = issueCapabilityWorkOrder(input);
  if (!issued.ok) {
    return { ok: false, stage: 'gateway', reason: issued.reason, detail: issued.detail };
  }
  const workOrder = issued.workOrder;

  // 2. Pending-approval short-circuit — return the work order so the
  // caller can render SecondTierApprovalCard. No adapter call yet.
  if (workOrder.approval_state === 'pending') {
    const receipt = await recordCapabilityReceipt({
      personaId: input.persona.personaId,
      workOrder,
      status: 'pending_approval',
      result_summary: 'Awaiting second-tier approval before execution',
      sessionId: input.sessionId ?? null,
      intentId: input.intentId ?? null,
    });
    return {
      ok: true,
      workOrder,
      adapterResult: { ok: false, reason: 'approval-pending', detail: 'awaiting user approval' },
      receiptId: receipt?.id ?? null,
    };
  }

  // 3. Dispatch to the adapter.
  const adapter = getAdapter(workOrder.adapter);
  if (!adapter) {
    return {
      ok: false,
      stage: 'adapter',
      reason: 'adapter-unregistered',
      detail: `no adapter registered for '${workOrder.adapter}'`,
      workOrder,
    };
  }
  // serverContext carries T0 (personaId) so in-process adapters can call
  // existing T0-keyed services without us inventing T2-aliased shims for
  // every owned-asset / entitlement lookup. The work order JSON stays
  // T0-free (compile-time canary on CapabilityWorkOrder still holds);
  // this side-channel exists only because the adapter is in-process.
  const adapterResult = await adapter.execute(workOrder, { personaId: input.persona.personaId });

  // 4. Receipt — one per execution attempt regardless of outcome.
  const status = adapterResult.ok ? 'success' : adapterResult.reason === 'approval-pending' ? 'pending_approval' : 'failure';
  const summary = adapterResult.ok
    ? adapterResult.summary
    : `[${adapterResult.reason}] ${adapterResult.detail ?? ''}`.trim();

  const receipt = await recordCapabilityReceipt({
    personaId: input.persona.personaId,
    workOrder,
    status,
    result_summary: summary,
    artifactsCreated: adapterResult.ok
      ? adapterResult.artifacts?.map((a) => a.id) ?? []
      : [],
    sessionId: input.sessionId ?? null,
    intentId: input.intentId ?? null,
  });

  return {
    ok: true,
    workOrder,
    adapterResult,
    receiptId: receipt?.id ?? null,
  };
}
