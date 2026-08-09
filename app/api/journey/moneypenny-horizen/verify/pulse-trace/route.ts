/**
 * POST/GET /api/journey/moneypenny-horizen/verify/pulse-trace
 *
 * "Close Nakamoto Pulse Enrollment — Final Correlated Trace" (operator
 * directive, 2026-08-06; hardened against serverless timeout per Al's
 * review, same day). A DIAGNOSTIC surface, not a replacement for
 * "Authorize"/"Check status again" (PulseTransparencyToggle.tsx, unchanged).
 *
 * POST — STEP 1 ONLY: build -> sign -> submit ONCE, persist raw evidence,
 * perform the immediate (t+0) status read, RETURN IMMEDIATELY. No
 * `setTimeout`/sleep anywhere in this route — the further +5/+15/+30s
 * rereads are a SEPARATE route (./continue/route.ts) the client calls on its
 * own timer, exactly per Al's review: "Do not make one HTTP request wait
 * through t+0/5/15/30... Use a persisted attempt plus short read-only
 * polling calls... There must be exactly one submission and multiple
 * separately invoked status reads under the same attemptId."
 *
 * GET — returns the most recently persisted trace(s) for this agent, without
 * re-running anything (page refresh / polling).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
import { startPulseEnrollmentTrace, getLatestPulseCorrelationTraces } from '@/services/horizen/pulseEnrollmentTrace';
import { resolveRegistrableAgent } from '@/services/horizen/registrableAgents';

export const dynamic = 'force-dynamic';
// This is now a SINGLE build->sign->submit->one-reread round trip — the same
// shape (and the same budget) as verify/authorize/route.ts, never the
// multi-reread sequence that used to live here.
export const maxDuration = 120;

/**
 * This directive names Nakamoto explicitly ("Close Nakamoto Pulse
 * Enrollment") — the default here, unlike verify/authorize's and
 * verify/status's platform-wide 'moneypenny' default, which this route does
 * not change.
 */
export const DEFAULT_TRACE_AGENT_SLUG = 'nakamoto';

export async function POST(request: NextRequest) {
  try {
    return await startTrace(request);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: `The trace start threw before it could answer: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. Nothing here says whether enable_pulse_monitoring was ever called — re-check via GET before re-running.`,
      },
      { status: 500 },
    );
  }
}

async function startTrace(request: NextRequest) {
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

  const result = await startPulseEnrollmentTrace({
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
  try {
    return await getHistory(request);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: `The trace history read threw before it could answer: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. This is a pure read — no signing or submission happens on this path, and nothing here is affected.`,
      },
      { status: 500 },
    );
  }
}

async function getHistory(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  const agentSlug = request.nextUrl.searchParams.get('agentSlug') ?? DEFAULT_TRACE_AGENT_SLUG;
  if (!resolveRegistrableAgent(agentSlug)) {
    return NextResponse.json({ ok: false, error: `"${agentSlug}" is not a registrable agent` }, { status: 400 });
  }

  const records = await getLatestPulseCorrelationTraces(agentSlug);
  return NextResponse.json({ ok: true, records });
}
