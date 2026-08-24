/**
 * POST /api/journey/ian/orient/acknowledge
 *
 * The Orient stage's one guided action for the Ian Boundary Research
 * journey: the participant's explicit acknowledgment that they understand
 * what Boundary Research is and what crossing means (SPEC-JS-001 §14.4
 * PHASE A). Idempotent — a second call after the receipt already exists is
 * a no-op success, never a duplicate write.
 *
 * Deliberately NOT a reuse of
 * app/api/journey/moneypenny-horizen/orient/acknowledge/route.ts — that
 * route's ritual (services/journey/orientationContext.ts) is scoped to
 * EXTERNAL AGENT admission (MoneyPenny/Nakamoto registrable-agent
 * orientation), a different capability instance with a different ritual
 * vocabulary (`ritualKind`, `resolveRegistrableAgent`). Ian is a human
 * researcher acknowledging his OWN orientation, not registering an agent —
 * reusing that route would require an `agent` argument that does not apply
 * here. This route writes the same real, already-valid
 * `orientation_ritual_completed` ActivityActionType, the authoritative
 * source `/api/journey/ian/state` already reads.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  createActivityReceipt,
  listActivityReceiptsForPersona,
} from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const persona = await getActivePersona(request);
    if (!persona) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
    }

    const existing = await listActivityReceiptsForPersona(persona.personaId, {
      actionTypes: ['orientation_ritual_completed'],
      limit: 1,
    });

    if (existing.length === 0) {
      await createActivityReceipt({
        personaId: persona.personaId,
        activeCartridge: 'irl-cartridge',
        actionType: 'orientation_ritual_completed',
        summary: 'Acknowledged the Boundary Research crossing orientation.',
        agentsInvoked: [],
      });
    }

    return NextResponse.json({ ok: true, orientationComplete: true });
  } catch (err) {
    console.error('[ian-orient-acknowledge]', err);
    return NextResponse.json(
      { ok: false, error: 'Your acknowledgment could not be recorded.', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
