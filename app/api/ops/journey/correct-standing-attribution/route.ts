import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveRegistrableAgentByRuntimeId } from '@/services/horizen/registrableAgents';
import { resolveAgentAdmissionState } from '@/services/journey/agentAdmissionState';
import { resolveCanonicalAgentPersonaId } from '@/services/standing/agentStandingPersona';
import { createActivityReceipt, findAgentReceiptRefs } from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/ops/journey/correct-standing-attribution
 *
 * The non-destructive, idempotent correction for the 2026-08-23 operator
 * directive "Horizen Journey — Standing observer + DVN liveness closure",
 * part 1: `services/crm/standingAccrualService.ts::accrueStanding` used to
 * write every `standing_accrued` receipt with `agentsInvoked: ['aigent-z']`
 * regardless of which agent's Standing was actually credited. That write
 * path is now fixed (callers pass `subjectAgentRef`), but historical
 * receipts already written under the defect remain genuinely misattributed —
 * `resolveStandingEvidence(runtimeAgentId)` (services/journey/
 * standingEvidenceProjection.ts), which resolves evidence by
 * `agents_invoked` containment, can never find them under the agent that
 * actually earned the credit.
 *
 * ── What this does NOT do ────────────────────────────────────────────────
 *
 * NEVER mutates or deletes the original `standing_accrued` receipt — it
 * remains, permanently, exactly as written (including its historical
 * `agentsInvoked: ['aigent-z']`). NEVER calls `accrueStanding` or otherwise
 * re-derives a Standing score — the numeric score already lives correctly in
 * `crm_persona_reputation` (the ledger write was never wrong; only the
 * evidence receipt's discoverability by the wrong observer was). This route
 * closes ONLY the attribution gap, additively.
 *
 * ── What it does ─────────────────────────────────────────────────────────
 *
 * 1. Resolves the agent's OWN canonical Standing identity persona id — the
 *    exact same identity `personas.id` `accrueStanding` resolves internally
 *    before writing a receipt (services/standing/agentStandingPersona.ts's
 *    `resolveCanonicalAgentPersonaId`) — never a fuzzy name match, never
 *    fabricated.
 * 2. Finds every `standing_accrued` receipt whose `persona_id` is that exact
 *    identity persona id (i.e. genuinely credits THIS agent's own Standing)
 *    but whose `agents_invoked` does NOT already contain the agent's
 *    canonical runtime id (i.e. was misattributed at write time).
 * 3. For each one NOT already corrected (idempotency: skips any original
 *    receipt id already named by an existing `standing_corrected` receipt's
 *    `actionInput.originalReceiptId` for this agent), writes ONE NEW
 *    `standing_corrected` receipt (the EXISTING, already-anchorable action
 *    type this codebase already reserves for a correction event — never a
 *    bespoke new type) tagged `agentsInvoked: [agentRuntimeId]` and
 *    `actionInput: { correctionKind: 'standing_attribution', originalReceiptId, correctedFrom }`.
 *    `resolveStandingEvidence` reads this new receipt as genuine
 *    contribution evidence for the agent (see its own header comment).
 *
 * Re-running this route against an already-corrected agent is a safe no-op:
 * every original receipt id is checked against existing corrections before
 * a new one is written.
 *
 * Auth: CRON_TRIGGER_TOKEN, same convention as every other `/api/ops/*` route.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_TRIGGER_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'cron_token_not_configured' }, { status: 503 });
  }
  const provided =
    request.headers.get('x-cron-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { agentRuntimeId?: string; correctingPersonaId?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const { agentRuntimeId, correctingPersonaId } = body;
  if (!agentRuntimeId || !correctingPersonaId) {
    return NextResponse.json({ error: 'agentRuntimeId and correctingPersonaId are both required' }, { status: 400 });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ error: 'db unavailable' }, { status: 503 });
  }

  const agent = resolveRegistrableAgentByRuntimeId(agentRuntimeId);
  if (!agent) {
    return NextResponse.json({ error: `'${agentRuntimeId}' is not a canonical registrable agent` }, { status: 400 });
  }

  try {
    const admission = await resolveAgentAdmissionState(admin, agent);
    const agentRootDid = admission?.agentRootDid;
    if (agentRootDid === undefined) {
      return NextResponse.json(
        { ok: false, refusalCode: 'ADMISSION_UNRESOLVED', detail: `could not resolve ${agentRuntimeId}'s admission state` },
        { status: 409 },
      );
    }
    if (agentRootDid === null) {
      return NextResponse.json(
        { ok: false, refusalCode: 'NO_ROOT_IDENTITY', detail: `${agentRuntimeId} has no agent_root_identity yet — nothing to reconcile` },
        { status: 409 },
      );
    }

    const identityPersonaId = await resolveCanonicalAgentPersonaId(admin, agent, agentRootDid);
    if (!identityPersonaId) {
      return NextResponse.json(
        { ok: false, refusalCode: 'STANDING_PERSONA_UNRESOLVED', detail: `could not resolve or provision ${agentRuntimeId}'s canonical Standing persona` },
        { status: 409 },
      );
    }

    // Every standing_accrued receipt genuinely credited to this agent's own
    // Standing persona — regardless of what agents_invoked says.
    const { data: candidateRows, error: readErr } = await admin
      .from('activity_receipts')
      .select('id, agents_invoked, action_input, created_at')
      .eq('action_type', 'standing_accrued')
      .eq('persona_id', identityPersonaId)
      .order('created_at', { ascending: true });
    if (readErr) {
      return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
    }

    const misattributed = (candidateRows ?? []).filter((row) => {
      const invoked = Array.isArray(row.agents_invoked) ? (row.agents_invoked as string[]) : [];
      return !invoked.includes(agentRuntimeId);
    });

    // Idempotency: which original receipt ids already have a correction.
    const existingCorrections = await findAgentReceiptRefs(agentRuntimeId, ['standing_corrected'], { limit: 100 });
    const alreadyCorrected = new Set(
      existingCorrections
        .filter((r) => r.actionInput?.correctionKind === 'standing_attribution')
        .map((r) => r.actionInput?.originalReceiptId)
        .filter((id): id is string => typeof id === 'string'),
    );

    const corrected: Array<{ originalReceiptId: string; correctionReceiptId: string | null; correctedFrom: string[] }> = [];
    const skippedAlreadyCorrected: string[] = [];

    for (const row of misattributed) {
      const originalReceiptId = row.id as string;
      if (alreadyCorrected.has(originalReceiptId)) {
        skippedAlreadyCorrected.push(originalReceiptId);
        continue;
      }
      const correctedFrom = Array.isArray(row.agents_invoked) ? (row.agents_invoked as string[]) : [];
      const receipt = await createActivityReceipt({
        personaId: identityPersonaId,
        actionType: 'standing_corrected',
        activeCartridge: 'metame',
        summary: `Standing attribution corrected: receipt ${originalReceiptId} genuinely credits ${agentRuntimeId} (was tagged ${correctedFrom.join(', ') || '(none)'})`,
        agentsInvoked: [agentRuntimeId],
        actionInput: {
          correctionKind: 'standing_attribution',
          originalReceiptId,
          correctedFrom,
          correctingPersonaId,
        },
      });
      corrected.push({ originalReceiptId, correctionReceiptId: receipt?.id ?? null, correctedFrom });
    }

    return NextResponse.json(
      {
        ok: true,
        agentRuntimeId,
        standingPersonaId: identityPersonaId,
        misattributedFound: misattributed.length,
        corrected,
        skippedAlreadyCorrected,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/** GET shows what this route does — handy for verification without a POST. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      method: 'POST',
      description:
        'Idempotent, non-destructive correction for standing_accrued receipts genuinely credited to an agent\'s own ' +
        'Standing persona but misattributed to a different agents_invoked value (e.g. the historical aigent-z default). ' +
        'Never mutates the original receipt and never re-accrues Standing — writes an additive standing_corrected ' +
        'evidence receipt per genuinely misattributed original. Body: { agentRuntimeId, correctingPersonaId }. ' +
        'Requires x-cron-token header (CRON_TRIGGER_TOKEN).',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
