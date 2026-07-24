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
 * P4-5/P4-6 — THE MONEY-MOVING GATE, real flip (operator-authorised
 * 2026-07-24). Domain 3 (Financial Intelligence) and Domains 1/2
 * (Investment/Market) now resolve to TWO DISTINCT capabilityRefs, so each
 * domain's 409 gate looks up a DIFFERENT agreement row (the shared
 * agreement primitive's authorization lookup is keyed on
 * capabilityRef+selectedAgentRef+persona, with no domain awareness of its
 * own — using one shared capabilityRef for both risk tiers would let an
 * authorized read-only agreement silently gate open a money-moving call).
 * The settlement-tier agreement is formed with
 * `verificationRequirements: [PROOF_REQUIREMENT.world_id]`
 * (RuntimePanel's Form action) — the shared agreement primitive
 * (`constitutionalAgreement.ts`) now REFUSES to move that agreement to its
 * authorized state unless the human holds a live, World-ID-verified Polity
 * Passport (`hasVerifiedWorldIdPassport`). There is no longer a code-level
 * domain clamp in this route: the real constitutional gate (409 + graded
 * proof) IS the safety boundary, so an authoritative call on an unauthorized
 * or under-graded agreement fails closed at the pipeline's own step 3 (a
 * clear 409, not a silent shadow downgrade). The settlement layer still
 * only ever builds a hash-committed settlement INTENT — it does not sign
 * or broadcast a transfer (see its own file header); actual fund movement
 * remains the operator's separately-supervised wallet step.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  resolvePersonaOrTimeout,
  PERSONA_TIMEOUT_MESSAGE,
} from '@/app/api/dev-command-center/_lib/persona';
import { runConstitutionalServicePattern } from '@/services/constitutional/constitutionalServicePipeline';
import type { FinancialDomain } from '@/services/constitutional/financialIntelligenceExecutor';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

const DOMAINS: FinancialDomain[] = ['intelligence', 'investment', 'market'];

const MONEYPENNY_CAPABILITY_REF = 'cap-moneypenny-financial-services';
// P4-6: a SECOND, distinct capabilityRef for the money-moving domains
// (Investment/Market) — see the file header for why this must not share
// Domain 3's capabilityRef.
const MONEYPENNY_SETTLEMENT_CAPABILITY_REF = 'cap-moneypenny-financial-services-settlement';
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
  // P4-6: capabilityRef is domain-scoped (see file header) -- Domain 3 keeps
  // the original, already-live ref (zero regression); Investment/Market use
  // the settlement-tier ref, whose agreement can only reach its authorized
  // state under the World-ID grade (constitutionalAgreement.ts).
  const domain: FinancialDomain = DOMAINS.includes(body.domain as FinancialDomain) ? (body.domain as FinancialDomain) : 'intelligence';
  const capabilityRef = domain === 'intelligence' ? MONEYPENNY_CAPABILITY_REF : MONEYPENNY_SETTLEMENT_CAPABILITY_REF;
  const selectedAgentRef = MONEYPENNY_AGENT_REF;

  // P4-5/P4-6: no more domain-based code clamp -- the requested mode passes
  // straight through. The REAL safety boundary is the pipeline's own step-3
  // 409 gate: an authoritative call against an unauthorized (or under-graded)
  // agreement fails closed there with a clear reason, never a silent shadow
  // downgrade. This mirrors P4-3's own stated philosophy ("the route
  // re-enforces server-side regardless, so this is a convenience, not the
  // safety boundary") now that the enforcement is real for every domain.
  const mode = body.mode === 'authoritative' ? 'authoritative' : 'shadow';

  const result = await runConstitutionalServicePattern({
    intent,
    capabilityRef,
    selectedAgentRef,
    requestingPersonaId: pr.persona.personaId,
    domain,
    mode,
  });

  // P4-4: an authoritative run is a real (non-shadow) act — DVN-anchorable
  // provenance, same discipline as every other consequential receipt in this
  // codebase. Fire-and-forget: a receipt failure must never fail the call
  // that already executed.
  if (mode === 'authoritative' && result.executed) {
    void createActivityReceipt({
      personaId: pr.persona.personaId,
      actionType: 'finance_authoritative_execution',
      activeCartridge: 'moneypenny',
      summary: `MoneyPenny Runtime authoritative execution [${domain}] agr=${result.agreementId ?? 'none'}: ${intent.slice(0, 140)}`,
      agentsInvoked: [MONEYPENNY_AGENT_REF],
      invariantsUsed: result.execution?.evidenceRefs ?? [],
      contextShared: ['domain', 'agreement_id', 'evidence_refs'],
      policyEnvelopeId: result.agreementId,
    }).catch((e) => console.error('[moneypenny runtime] finance_authoritative_execution receipt failed:', e));
  }

  return NextResponse.json(result);
}
