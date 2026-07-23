/**
 * /api/moneypenny/runtime — PRD-MPY-001 Phase 4, Runtime mode.
 *
 * Mirrors `/api/constitutional/service-pipeline`'s integration pattern
 * verbatim (same spine-resolution helper, same single call into
 * `runConstitutionalServicePattern`) — this route does NOT reimplement
 * pipeline invocation, it just supplies MoneyPenny-specific default
 * capability/agent refs so her agreements are separately attributable
 * from the generic FinancialServicesTab demo ones.
 *
 * capabilityRef/selectedAgentRef are NOT read from the request body —
 * they are ALWAYS MoneyPenny's own fixed refs. Accepting client-supplied
 * refs would let a caller point the 409 gate at an unrelated agreement
 * (e.g. one authorized elsewhere with settlementTerms attached) while
 * still claiming `domain: 'intelligence'` here; pinning the refs closes
 * that off structurally rather than trusting the request.
 *
 * SAFETY CLAMP — authoritative mode is allowed ONLY for Domain 3
 * (Financial Intelligence). `runFinancialCapability`'s intelligence
 * executor is read-only/advice-only (CRP-003 F-201-203) and MoneyPenny's
 * own agreement never carries settlementTerms (RuntimePanel's Form action
 * always sends `settlementTerms: null`), so step 9 (Settlement) stays
 * 'skipped' even in authoritative mode — no settlement intent can bind,
 * let alone a transfer. Investment/Market (Domains 1/2) stay hard-clamped
 * to 'shadow' until the money-moving grade gate exists (P4-5/P4-6,
 * PRD-MPY-001 §7 / CLAUDE.md money-moving discipline).
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

  // Always MoneyPenny's own fixed refs -- never taken from the request body.
  const capabilityRef = MONEYPENNY_CAPABILITY_REF;
  const selectedAgentRef = MONEYPENNY_AGENT_REF;
  const domain: FinancialDomain = DOMAINS.includes(body.domain as FinancialDomain) ? (body.domain as FinancialDomain) : 'intelligence';

  // P4-3: authoritative mode is allowed only for Domain 3 (Financial
  // Intelligence) -- Investment/Market stay shadow-clamped until the
  // money-moving grade gate exists (P4-5/P4-6).
  const requestedMode = body.mode === 'authoritative' ? 'authoritative' : 'shadow';
  const authoritativeAllowed = domain === 'intelligence';
  const mode = requestedMode === 'authoritative' && authoritativeAllowed ? 'authoritative' : 'shadow';
  const clamped = requestedMode === 'authoritative' && !authoritativeAllowed;

  const result = await runConstitutionalServicePattern({
    intent,
    capabilityRef,
    selectedAgentRef,
    requestingPersonaId: pr.persona.personaId,
    domain,
    mode,
  });

  return NextResponse.json({
    ...result,
    ...(clamped
      ? { clamped: true, clampReason: 'MoneyPenny Runtime P4-3: authoritative mode is Financial-Intelligence-only until the money-moving gate ships' }
      : {}),
  });
}
