/**
 * /api/moneypenny/runtime — PRD-MPY-001 Phase 4, Runtime mode. Increment
 * P4-1: MoneyPenny becomes a driving agent of the built constitutional
 * service pipeline, starting inert-safe.
 *
 * Mirrors `/api/constitutional/service-pipeline`'s integration pattern
 * verbatim (same spine-resolution helper, same single call into
 * `runConstitutionalServicePattern`) — this route does NOT reimplement
 * pipeline invocation, it just supplies MoneyPenny-specific default
 * capability/agent refs so her agreements are separately attributable
 * from the generic FinancialServicesTab demo ones.
 *
 * SAFETY CLAMP (this increment only): `mode` is hard-coded to 'shadow'
 * server-side regardless of what the request body asks for. The
 * authoritative path is deliberately not wired yet — that's later
 * increments (P4-3 for Domain 3, gated further for Domains 1/2 behind the
 * money-moving grade check that doesn't exist yet, PRD-MPY-001 §7/CLAUDE.md
 * money-moving discipline).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  resolvePersonaOrTimeout,
  PERSONA_TIMEOUT_MESSAGE,
} from '@/app/api/dev-command-center/_lib/persona';
import { runConstitutionalServicePattern } from '@/services/constitutional/constitutionalServicePipeline';
import type { FinancialDomain } from '@/services/constitutional/financialIntelligenceExecutor';

const DOMAINS: FinancialDomain[] = ['intelligence', 'investment', 'market'];

const MONEYPENNY_CAPABILITY_REF = 'cap-moneypenny-financial-services';
const MONEYPENNY_AGENT_REF = 'agent-moneypenny';

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
  if (!intent) return NextResponse.json({ ok: false, error: 'intent required' }, { status: 400 });

  const capabilityRef = String(body.capabilityRef ?? '').trim() || MONEYPENNY_CAPABILITY_REF;
  const selectedAgentRef = String(body.selectedAgentRef ?? '').trim() || MONEYPENNY_AGENT_REF;
  const domain: FinancialDomain = DOMAINS.includes(body.domain as FinancialDomain) ? (body.domain as FinancialDomain) : 'intelligence';

  // P4-1 safety clamp: shadow only, no matter what the request asked for.
  const requestedMode = body.mode === 'authoritative' ? 'authoritative' : 'shadow';
  const clamped = requestedMode !== 'shadow';

  const result = await runConstitutionalServicePattern({
    intent,
    capabilityRef,
    selectedAgentRef,
    requestingPersonaId: pr.persona.personaId,
    domain,
    mode: 'shadow',
  });

  return NextResponse.json({
    ...result,
    ...(clamped ? { clamped: true, clampReason: 'MoneyPenny Runtime P4-1: authoritative mode not yet enabled' } : {}),
  });
}
