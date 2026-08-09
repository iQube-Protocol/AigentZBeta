/**
 * GET/POST /api/journey/moneypenny-horizen/orient/acknowledge
 *
 * The Orient stage's ONE guided action (Threshold Journey — Orient stage +
 * Consequence Fork, operator spec, 2026-08-09). GET resolves the contextual
 * orientation ritual and whether it is already complete; POST records the
 * operator's explicit acknowledgment — the ONLY thing that ever flips
 * `orientationComplete` true. Merely calling GET, or merely having visited
 * the Orient stage, never completes it (Journey Guidance Principle, §5.1).
 *
 * Spine-gated: resolves the caller's OWN active persona via getActivePersona,
 * mirroring aigentme/disposition/route.ts exactly — same agent-selectable
 * pattern (`agentSlug`, defaulting to MoneyPenny), same idempotent-write-
 * scoped-by-agentsInvoked shape, same named-refusal-on-every-exit contract.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  createActivityReceipt,
  listActivityReceiptsForPersona,
} from '@/services/receipts/activityReceiptService';
import { resolveRegistrableAgent, DEFAULT_REGISTRABLE_AGENT_SLUG } from '@/services/horizen/registrableAgents';
import { resolveOrientationContext, resolveOrientationCompletion } from '@/services/journey/orientationContext';

export const dynamic = 'force-dynamic';

/*
 * EVERY EXIT IS A NAMED ANSWER — same contract as every other journey route
 * (aigentme/disposition/route.ts's own header explains why: a bare, silent
 * 500 leaves the operator with nothing to act on).
 */
export async function GET(request: NextRequest) {
  try {
    return await getImpl(request);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_ROUTE_ERROR',
        error:
          `This request threw before it could answer: ` +
          `${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. ` +
          'Nothing here says whether the work completed — re-read the state before retrying.',
      },
      { status: 500 },
    );
  }
}

async function getImpl(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const agentSlug = request.nextUrl.searchParams.get('agentSlug');
  const agent = resolveRegistrableAgent(agentSlug) ?? resolveRegistrableAgent(DEFAULT_REGISTRABLE_AGENT_SLUG)!;
  const supabase = getSupabaseServer();

  /*
   * SAME COMPLETION SIGNAL THE JOURNEY STEPPER READS — never a second,
   * receipt-only observer of "is Orient done" (the exact two-observer defect
   * this codebase repeatedly guards against). `resolveOrientationCompletion`
   * recognises BOTH the explicit ritual and the legacy-precedent
   * compatibility path (services/journey/orientationContext.ts), so an agent
   * whose admission predates Orient never sees this panel re-prompt for an
   * acknowledgment their own stepper already renders complete.
   */
  const [orientationContext, completion] = await Promise.all([
    resolveOrientationContext(persona.personaId, agent),
    supabase
      ? resolveOrientationCompletion(supabase, persona.personaId, agent)
      : Promise.resolve({ complete: false, source: 'none' as const }),
  ]);

  return NextResponse.json({
    ok: true,
    orientationComplete: completion.complete,
    orientationCompletionSource: completion.source,
    orientationContext,
  });
}

export async function POST(request: NextRequest) {
  try {
    return await postImpl(request);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_ROUTE_ERROR',
        error:
          `This request threw before it could answer: ` +
          `${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. ` +
          'Nothing here says whether the work completed — re-read the state before retrying.',
      },
      { status: 500 },
    );
  }
}

interface AcknowledgeBody {
  agentSlug?: string;
}

async function postImpl(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let body: AcknowledgeBody = {};
  try {
    body = (await request.json()) as AcknowledgeBody;
  } catch {
    // A body is optional here — agentSlug may also arrive on GET-style query,
    // but this route accepts it in the body to match the POST-only contract.
  }
  const agent = resolveRegistrableAgent(body.agentSlug) ?? resolveRegistrableAgent(DEFAULT_REGISTRABLE_AGENT_SLUG)!;
  const orientationContext = await resolveOrientationContext(persona.personaId, agent);

  /*
   * A LEGACY-PRECEDENT AGENT NEVER GETS A WRITTEN RITUAL RECEIPT (operator
   * instruction, 2026-08-09: "Do not counterfeit historical user
   * acknowledgement"). If this agent's admission already crossed the
   * stronger downstream boundary before Orient existed, Orient is already
   * complete via that compatibility path — POSTing here would fabricate an
   * explicit ceremony that never happened. Report success without writing.
   */
  const supabase = getSupabaseServer();
  if (supabase) {
    const priorCompletion = await resolveOrientationCompletion(supabase, persona.personaId, agent);
    if (priorCompletion.complete) {
      return NextResponse.json({
        ok: true,
        orientationComplete: true,
        orientationCompletionSource: priorCompletion.source,
        ritualKind: orientationContext.ritualKind,
      });
    }
  }

  // Idempotent — scoped by agentsInvoked so acknowledging Orient for one
  // agent never shadows, or is shadowed by, another agent's acknowledgment
  // under the same persona (same pattern as aigentme_activated above).
  const existing = await listActivityReceiptsForPersona(persona.personaId, {
    actionTypes: ['orientation_ritual_completed'],
    agentsInvoked: [agent.runtimeAgentId],
    limit: 1,
  });

  if (existing.length === 0) {
    try {
      await createActivityReceipt({
        personaId: persona.personaId,
        activeCartridge: 'metame-codex',
        actionType: 'orientation_ritual_completed',
        summary: `Operator completed the orientation ritual (${orientationContext.ritualKind}) for ${agent.displayName}`,
        agentsInvoked: [agent.runtimeAgentId],
        actionInput: { ritualKind: orientationContext.ritualKind },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[orient acknowledge] receipt write failed', { message });
      const constraintRejected = /violates check constraint|invalid input value|action_type/i.test(message);
      return NextResponse.json(
        {
          ok: false,
          error: constraintRejected
            ? "This environment does not yet accept 'orientation_ritual_completed' activity receipts. " +
              'Apply supabase/migrations/20260930002400_orientation_ritual_completed_receipt_type.sql, then try again.'
            : 'Your acknowledgment could not be recorded.',
          refusalCode: constraintRejected ? 'RECEIPT_TYPE_NOT_PERMITTED' : 'RECEIPT_WRITE_FAILED',
          detail: message,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    orientationComplete: true,
    orientationCompletionSource: 'ritual',
    ritualKind: orientationContext.ritualKind,
  });
}
