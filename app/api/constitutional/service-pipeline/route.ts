/**
 * /api/constitutional/service-pipeline — the canonical constitutional service
 * pattern (CRP-003a Increment 2; PRD §10) run for one intent, on a Domain-3
 * (Financial Intelligence, read-only) capability.
 *
 * POST { intent, capabilityRef, selectedAgentRef, mode? } — runs the twelve
 *   steps. `mode` defaults to 'shadow' (observe-first, CFS-017): the N1
 *   agreement gate (step 3) decision is RECORDED and the delegated call is made
 *   only when an authorized agreement exists — otherwise the trace shows what
 *   the authoritative path would refuse, with no side effects. 'authoritative'
 *   BLOCKS at step 3 on a gate refusal (409-shaped ok:false).
 *
 * Spine-authenticated — the caller is the requesting operator (the gate looks up
 * the operator's own authorized agreement). No personaId is returned.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  resolvePersonaOrTimeout,
  PERSONA_TIMEOUT_MESSAGE,
} from '@/app/api/dev-command-center/_lib/persona';
import {
  runConstitutionalServicePattern,
  type ServicePipelineMode,
} from '@/services/constitutional/constitutionalServicePipeline';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const pr = await resolvePersonaOrTimeout(request);
  if (pr.status === 'timeout') {
    return NextResponse.json({ ok: false, error: PERSONA_TIMEOUT_MESSAGE }, { status: 503 });
  }
  if (pr.status === 'unauthenticated') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: 'JSON body required' }, { status: 400 });
  const intent = String(body.intent ?? '').trim();
  const capabilityRef = String(body.capabilityRef ?? '').trim();
  const selectedAgentRef = String(body.selectedAgentRef ?? '').trim();
  if (!intent || !capabilityRef || !selectedAgentRef) {
    return NextResponse.json({ ok: false, error: 'intent, capabilityRef, selectedAgentRef required' }, { status: 400 });
  }
  const mode: ServicePipelineMode = body.mode === 'authoritative' ? 'authoritative' : 'shadow';

  const result = await runConstitutionalServicePattern({
    intent,
    capabilityRef,
    selectedAgentRef,
    requestingPersonaId: pr.persona.personaId,
    mode,
  });

  // Authoritative refusal at the agreement gate is a 409 (the x409 idiom).
  if (!result.ok && result.blockedAtStep === 3) {
    return NextResponse.json({ ok: false, ...result }, { status: 409 });
  }
  return NextResponse.json(result);
}
