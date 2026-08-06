/**
 * POST /api/journey/moneypenny-horizen/verify/pulse-trace/continue
 *
 * STEP 2 of the hardened correlated-trace sequence (Al's review, 2026-08-06)
 * — called by the client's OWN timer at ~+5/+15/+30s relative to when
 * `../route.ts`'s POST (the trace START) returned. Performs EXACTLY ONE
 * authoritative `get_onboarding_status` reread for the given `attemptId` —
 * never re-signs, never resubmits, never calls `enable_pulse_monitoring`
 * again — appends it to the SAME persisted trace, and returns the updated
 * record. A fast, bounded round trip (one MCP call), nothing like the
 * removed 30s+ sleep sequence this replaces.
 *
 * Idempotent past completion: calling this after the trace is already
 * `complete` is a safe no-op (returns the record unchanged).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { continuePulseEnrollmentTrace } from '@/services/horizen/pulseEnrollmentTrace';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    return await continueTrace(request);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: `The trace continuation threw before it could answer: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. The trace's earlier evidence is unaffected — no signing or submission happens on this path.`,
      },
      { status: 500 },
    );
  }
}

async function continueTrace(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  let body: { attemptId?: string } = {};
  try {
    body = (await request.json()) as { attemptId?: string };
  } catch {
    // handled below
  }
  if (!body.attemptId) {
    return NextResponse.json({ ok: false, error: 'attemptId is required' }, { status: 400 });
  }

  const result = await continuePulseEnrollmentTrace(body.attemptId, persona.personaId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 409 });
  }
  return NextResponse.json({ ok: true, record: result.record });
}
