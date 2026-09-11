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
 *
 * PRINCIPAL-IDENTITY ENFORCEMENT (2026-08-29). Orientation is constitutionally
 * principal-only (SPEC-JS-001 §14.4 Phase A never offers it as delegable).
 * Before writing the receipt, `resolveOrientationPrincipalGate` (services/
 * journey/ianJourneyState.ts) verifies the ACTING persona genuinely is the
 * principal — never a delegated agent's own persona, and never a sibling
 * persona standing in for the one an exchange is actually bound to. This is
 * the exact defect that produced a real misattributed receipt (Ian's own
 * aigentMe persona wrote it instead of his own). A refusal here writes
 * NOTHING — no receipt, no substitute principal, no manufactured
 * `agentsInvoked` provenance — and returns a message the UI surfaces
 * verbatim, directing the operator to the existing persona switcher
 * (ActivePersonaControl, already mounted in every Journey header) rather
 * than a new identity-selection mechanism.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveOrientationPrincipalGate } from '@/services/journey/ianJourneyState';
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

    // FAIL CLOSED: without a real database connection we cannot verify the
    // acting persona is genuinely the principal, so a principal-only act
    // must not proceed on trust alone.
    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: 'principal-verification-unavailable', message: 'Could not verify your identity right now. Please try again in a moment.' },
        { status: 503 },
      );
    }

    const gate = await resolveOrientationPrincipalGate(admin, {
      personaId: persona.personaId,
      authProfileId: persona.authProfileId,
    });
    if (!gate.ok) {
      const message =
        gate.reason === 'wrong-principal' && gate.expectedDisplayName
          ? `Orientation must be acknowledged by ${gate.expectedDisplayName} personally. Switch to the ${gate.expectedDisplayName} persona to continue.`
          : 'Orientation must be acknowledged by your own principal persona, not a delegated agent. Switch to your principal persona to continue.';
      return NextResponse.json({ ok: false, error: 'principal-required', reason: gate.reason, message }, { status: 403 });
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
