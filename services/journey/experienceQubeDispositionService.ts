/**
 * experienceQubeDispositionService — the constitutional disposition write
 * path, generalized (operator instruction, Constitutional Internet Bridge
 * brief: "Generalize the current MoneyPenny/Horizen-specific write path into
 * a reusable constitutional service/API rather than duplicating it").
 *
 * Extracted verbatim from
 * app/api/journey/moneypenny-horizen/aigentme/disposition/route.ts — same
 * two-receipt shape (idempotent `aigentme_activated`, then
 * `experienceqube_focus_disposition_recorded`), same fail-faithful error
 * classification, same DVN-anchorable action types
 * (services/dvn/activityReceiptDvnPipeline.ts already lists both). The
 * Horizen route now calls this service instead of writing receipts inline;
 * its request/response shape, defaults and error text are UNCHANGED — this
 * is a pure extraction, not a behavior change (inv.engineering.036/037: one
 * authoritative write path, not two).
 *
 * A caller (Horizen's MoneyPenny/Nakamoto disposition, or the Constitutional
 * Internet Bridge's agent-role/action-mode disposition) supplies its own
 * `runtimeAgentId` scope and `actionInput` shape — the receipt taxonomy and
 * idempotency rule are shared; the disposition VOCABULARY is not, because
 * "is this domain focus part of my ExperienceQube" (Horizen) and "what role
 * should an agent play, with how much authority" (Constitutional Internet
 * Bridge) are genuinely different questions with genuinely different answer
 * sets. Forcing one vocabulary onto the other would be the fork this module
 * exists to avoid in the other direction.
 */

import {
  createActivityReceipt,
  listActivityReceiptsForPersona,
  type ActivityReceiptRecord,
} from '@/services/receipts/activityReceiptService';

export interface RecordDispositionParams {
  personaId: string;
  /** agents_invoked scope — the SAME value a read must pass to find this receipt again. */
  runtimeAgentId: string;
  /** Human-readable name used only in the idempotent activation receipt's summary. */
  agentDisplayName: string;
  /** Summary text for the disposition receipt itself — caller's own wording. */
  dispositionSummary: string;
  /** Freeform payload — Horizen writes {disposition, domainFocus}; Constitutional Internet Bridge writes {role, actionMode, context}. */
  actionInput: Record<string, unknown>;
  activeCartridge?: string;
}

export type DispositionWriteFailure = {
  ok: false;
  error: string;
  refusalCode: 'RECEIPT_TYPE_NOT_PERMITTED' | 'RECEIPT_WRITE_FAILED';
  step: 'aigentme_activated' | 'experienceqube_focus_disposition_recorded';
  detail: string;
};

export type DispositionWriteResult =
  | { ok: true; receiptId: string | null }
  | DispositionWriteFailure;

/*
 * FAIL FAITHFUL (see the Horizen route's own header for the incident this
 * classification closes: a bare 500 under a sovereign choice the principal
 * just made, with nothing to act on). Preserved verbatim from the original
 * inline implementation.
 */
async function attemptWrite(
  step: DispositionWriteFailure['step'],
  write: () => Promise<unknown>,
): Promise<DispositionWriteFailure | null> {
  try {
    await write();
    return null;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[experienceQubeDisposition] receipt write failed', { step, message });
    const constraintRejected = /violates check constraint|invalid input value|action_type/i.test(message);
    return {
      ok: false,
      error: constraintRejected
        ? `This environment does not yet accept '${step}' activity receipts. ` +
          'Apply the receipt-type migrations under supabase/migrations/ ' +
          '(20260930000300_gjr001_journey_receipt_types.sql and later), then try again.'
        : `Your choice could not be recorded (${step}).`,
      refusalCode: constraintRejected ? 'RECEIPT_TYPE_NOT_PERMITTED' : 'RECEIPT_WRITE_FAILED',
      step,
      detail: message,
    };
  }
}

/**
 * Idempotent activation + disposition write, scoped by `runtimeAgentId`.
 * Mirrors the original route's exact sequencing: activation is written once
 * per (persona, agent) pair; the disposition receipt is written every call
 * (the caller decides whether "change my answer" re-invokes this).
 */
export async function recordExperienceQubeDisposition(
  params: RecordDispositionParams,
): Promise<DispositionWriteResult> {
  const activeCartridge = params.activeCartridge ?? 'metame-codex';

  const existing = await listActivityReceiptsForPersona(params.personaId, {
    actionTypes: ['aigentme_activated'],
    agentsInvoked: [params.runtimeAgentId],
    limit: 1,
  });
  if (existing.length === 0) {
    const failure = await attemptWrite('aigentme_activated', () =>
      createActivityReceipt({
        personaId: params.personaId,
        activeCartridge,
        actionType: 'aigentme_activated',
        summary: `aigentMe activated as the principal's constitutional companion, regarding ${params.agentDisplayName}`,
        agentsInvoked: [params.runtimeAgentId],
      }),
    );
    if (failure) return failure;
  }

  let receipt: ActivityReceiptRecord | null = null;
  const failure = await attemptWrite('experienceqube_focus_disposition_recorded', async () => {
    receipt = await createActivityReceipt({
      personaId: params.personaId,
      activeCartridge,
      actionType: 'experienceqube_focus_disposition_recorded',
      summary: params.dispositionSummary,
      agentsInvoked: [params.runtimeAgentId],
      actionInput: params.actionInput,
    });
  });
  if (failure) return failure;

  return { ok: true, receiptId: (receipt as ActivityReceiptRecord | null)?.id ?? null };
}

export interface DispositionReadResult {
  aigentMeActive: boolean;
  dispositionReceipt: ActivityReceiptRecord | null;
}

export async function readExperienceQubeDisposition(
  personaId: string,
  runtimeAgentId: string,
): Promise<DispositionReadResult> {
  const receipts = await listActivityReceiptsForPersona(personaId, {
    actionTypes: ['aigentme_activated', 'experienceqube_focus_disposition_recorded'],
    agentsInvoked: [runtimeAgentId],
    limit: 10,
  });

  return {
    aigentMeActive: receipts.some((r) => r.actionType === 'aigentme_activated'),
    dispositionReceipt: receipts.find((r) => r.actionType === 'experienceqube_focus_disposition_recorded') ?? null,
  };
}
