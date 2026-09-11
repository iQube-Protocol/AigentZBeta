/**
 * POST /api/assistant/intent-advance
 *
 * Operator-driven advancement for an Active Intent. Lets the user
 * approve the specialist's draft, mark the intent complete, or
 * cancel it from the workspace pill / myLedger card. Emits a
 * receipt-eligible activity row so the chain header re-derives
 * status on the next fetch.
 *
 * Body:
 *   {
 *     intentId: string;
 *     action: 'approve' | 'complete' | 'cancel';
 *     note?: string;   // optional one-liner stored on the receipt
 *   }
 *
 * Auth: spine-resolved persona must own the intent.
 *
 * Side effects:
 *   - 'approve':  emits approval_granted activity_receipt on the intent
 *                 (chain status flips: consulted -> delivered)
 *   - 'complete': sets intent status -> completed + emits session_completed
 *                 receipt (workspace pill flips Green; chain header reads
 *                 "complete")
 *   - 'cancel':   sets intent status -> cancelled (workspace pill flips
 *                 Slate; chain header reads "cancelled")
 *
 * T0 / privacy: persona_id never leaves the server. Receipt projection
 * is the existing T1-safe ActivityReceiptRecord shape.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getIntentQube, setIntentQubeStatus } from '@/services/iqube/intentQube';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';

type AdvanceAction = 'approve' | 'complete' | 'cancel';
const VALID_ACTIONS: ReadonlyArray<AdvanceAction> = ['approve', 'complete', 'cancel'];

interface PostBody {
  intentId?: unknown;
  action?: unknown;
  note?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ error: 'persona-required' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as PostBody;
  const intentId = typeof body.intentId === 'string' ? body.intentId : null;
  const action = typeof body.action === 'string' ? (body.action as AdvanceAction) : null;
  const note = typeof body.note === 'string' ? body.note.slice(0, 280) : null;

  if (!intentId) {
    return NextResponse.json({ error: 'missing-intentId' }, { status: 400 });
  }
  if (!action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: 'invalid-action', allowed: VALID_ACTIONS },
      { status: 400 },
    );
  }

  const intent = await getIntentQube(intentId);
  if (!intent) {
    return NextResponse.json({ error: 'intent-not-found' }, { status: 404 });
  }
  if (intent.personaId !== persona.personaId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Idempotent guards — once an intent terminates, subsequent advance
  // calls become no-ops returning the current state. Cleaner than
  // erroring out when a stale button-click races a refresh.
  if (
    (action === 'complete' && intent.status === 'completed') ||
    (action === 'cancel' && intent.status === 'cancelled')
  ) {
    return NextResponse.json({ ok: true, idempotent: true, status: intent.status });
  }

  try {
    if (action === 'approve') {
      // approval_granted receipt closes the "draft ready" loop on the
      // chain header. Intent status stays in_progress so the operator
      // can still mark complete or cancel after approving.
      await createActivityReceipt({
        personaId: persona.personaId,
        intentId,
        activeCartridge: intent.activeCartridge,
        actionType: 'approval_granted',
        summary: note ? `Approved: ${note}` : `Approved: ${intent.intentName}`,
        agentsInvoked: ['aigent-me'],
        approvalsGranted: [intentId],
        contextShared: ['operator-approval'],
      });
      return NextResponse.json({ ok: true, status: intent.status, action });
    }

    if (action === 'complete') {
      const updated = await setIntentQubeStatus(intentId, 'completed');
      await createActivityReceipt({
        personaId: persona.personaId,
        intentId,
        activeCartridge: intent.activeCartridge,
        actionType: 'session_completed',
        summary: note ? `Marked complete: ${note}` : `Marked complete: ${intent.intentName}`,
        agentsInvoked: ['aigent-me'],
        contextShared: ['operator-completion'],
      });
      return NextResponse.json({ ok: true, status: updated?.status ?? 'completed', action });
    }

    // cancel
    const updated = await setIntentQubeStatus(intentId, 'cancelled');
    await createActivityReceipt({
      personaId: persona.personaId,
      intentId,
      activeCartridge: intent.activeCartridge,
      actionType: 'approval_rejected',
      summary: note ? `Cancelled: ${note}` : `Cancelled: ${intent.intentName}`,
      agentsInvoked: ['aigent-me'],
      contextShared: ['operator-cancellation'],
    });
    return NextResponse.json({ ok: true, status: updated?.status ?? 'cancelled', action });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/intent-advance] ${action} failed: ${msg}`);
    return NextResponse.json({ error: 'advance-failed', detail: msg }, { status: 500 });
  }
}
