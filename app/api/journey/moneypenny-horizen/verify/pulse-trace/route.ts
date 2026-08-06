/**
 * POST/GET /api/journey/moneypenny-horizen/verify/pulse-trace
 *
 * "Close Nakamoto Pulse Enrollment — Final Correlated Trace" (operator
 * directive, 2026-08-06). A DIAGNOSTIC surface, not a replacement for
 * "Authorize"/"Check status again" (PulseTransparencyToggle.tsx, unchanged) —
 * this exists solely to produce the one correlated evidence record the
 * directive asks for. See services/horizen/pulseEnrollmentTrace.ts's own
 * header for the full constraint list this respects (never touches
 * agreement identifiers, ratification, Standing, Agent Bench, wallet
 * selection, signature generation, message selection, or health routing).
 *
 * POST — runs ONE fresh enrollment attempt end to end (build -> sign ->
 * submit -> reread at t+0/5/15/30s), persists the correlation record, and
 * returns it. Takes ~30s+ by design (the required sequence's own timed
 * rereads) — maxDuration raised accordingly, mirroring verify/authorize's
 * own four-leg-ceremony budget.
 *
 * GET — returns the most recently persisted trace(s) for this agent, without
 * re-running anything (page refresh / polling).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
import { runPulseEnrollmentTrace, getLatestPulseCorrelationTraces } from '@/services/horizen/pulseEnrollmentTrace';
import { resolveRegistrableAgent } from '@/services/horizen/registrableAgents';

export const dynamic = 'force-dynamic';
// The required sequence's own rereads (t+0/5/15/30s) take >=30s by design —
// same reasoning as verify/authorize/route.ts's maxDuration, plus headroom
// for the build->sign->submit leg that precedes them.
export const maxDuration = 90;

/**
 * This directive names Nakamoto explicitly ("Close Nakamoto Pulse
 * Enrollment") — the default here, unlike verify/authorize's and
 * verify/status's platform-wide 'moneypenny' default, which this route does
 * not change.
 */
const DEFAULT_TRACE_AGENT_SLUG = 'nakamoto';

export async function POST(request: NextRequest) {
  try {
    return await runTrace(request);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: `The correlation trace threw before it could answer: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. Nothing here says whether enable_pulse_monitoring was ever called — re-check via GET before re-running.`,
      },
      { status: 500 },
    );
  }
}

async function runTrace(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  let body: { agentSlug?: string } = {};
  try {
    body = (await request.json()) as { agentSlug?: string };
  } catch {
    // No body is fine — defaults to Nakamoto below.
  }
  const agentSlug = body.agentSlug ?? DEFAULT_TRACE_AGENT_SLUG;
  if (!resolveRegistrableAgent(agentSlug)) {
    return NextResponse.json({ ok: false, error: `"${agentSlug}" is not a registrable agent` }, { status: 400 });
  }

  const result = await runPulseEnrollmentTrace({
    agentSlug,
    actorPersonaId: persona.personaId,
    origin: resolveRequestOrigin(request),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 409 });
  }
  return NextResponse.json({ ok: true, record: result.record });
}

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  const agentSlug = request.nextUrl.searchParams.get('agentSlug') ?? DEFAULT_TRACE_AGENT_SLUG;
  if (!resolveRegistrableAgent(agentSlug)) {
    return NextResponse.json({ ok: false, error: `"${agentSlug}" is not a registrable agent` }, { status: 400 });
  }

  const records = await getLatestPulseCorrelationTraces(agentSlug);
  return NextResponse.json({ ok: true, records });
}
