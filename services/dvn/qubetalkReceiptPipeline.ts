import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

export interface QubeTalkDvnReceiptInput {
  receiptId: string;
  delegationId: string;
  tenantId?: string;
  status: 'completed' | 'failed';
  taskCompleted: string;
  fromAgentId: string;
  toAgentId: string;
  policyEvaluation: unknown;
  resultData?: unknown;
}

export interface QubeTalkDvnReceiptResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export async function submitQubeTalkReceiptToDvn(
  input: QubeTalkDvnReceiptInput
): Promise<QubeTalkDvnReceiptResult> {
  try {
    const canisterId =
      process.env.CROSS_CHAIN_SERVICE_CANISTER_ID ||
      process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID;

    if (!canisterId) {
      return {
        ok: false,
        error: 'CROSS_CHAIN_SERVICE_CANISTER_ID not configured',
      };
    }

    const dvn = await getActor<any>(canisterId, dvnIdl);

    const eventType =
      input.status === 'completed'
        ? 'qubetalk_receipt_completed'
        : 'qubetalk_receipt_failed';

    const payload = JSON.stringify({
      action: 'QUBETALK_RECEIPT',
      eventType,
      receiptId: input.receiptId,
      delegationId: input.delegationId,
      tenantId: input.tenantId ?? null,
      taskCompleted: input.taskCompleted,
      fromAgentId: input.fromAgentId,
      toAgentId: input.toAgentId,
      status: input.status,
      policy: input.policyEvaluation,
      resultData: input.resultData ?? null,
      timestamp: Date.now(),
    });

    const payloadBytes = Array.from(new TextEncoder().encode(payload));
    const messageId = `qubetalk_receipt_${input.receiptId}_${Date.now()}`;

    const submitResponse = await dvn.submit_dvn_message(0, 0, payloadBytes, messageId);

    if (typeof submitResponse === 'string') {
      return { ok: true, messageId: submitResponse };
    }

    return {
      ok: false,
      error: 'submit_dvn_message returned unexpected result',
    };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || 'QubeTalk DVN submission failed',
    };
  }
}
