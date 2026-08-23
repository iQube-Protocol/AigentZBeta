/**
 * /api/moneypenny/service-orchestration — Phase 3 Track A, the
 * operator-facing MoneyPenny Financial Services oversight console.
 *
 * Consumer model (operator ruling, 2026-08-22): the human principal is NEVER
 * the `requestingAgentId`. They observe/trigger/authorise an ADMITTED,
 * DELEGATED agent (MoneyPenny/Nakamoto/Kn0w1) consuming a Financial Service.
 * This route resolves the caller's own persona via the spine and threads it
 * through as the AUTHENTICATED principal directing the named agent — never
 * as the consumer itself, and never trusted from client input.
 *
 * GET  — no query: catalog + registrable-agent list, for the picker UI. The
 *      agent list EXCLUDES MoneyPenny herself — she is the Financial
 *      Services provider/orchestrator, not a self-consuming agent in this
 *      console, and Gate 1's orchestrated-pattern check
 *      (`PROVIDER_MAY_NOT_ORCHESTRATE`) would refuse her as a consumer
 *      anyway. For the initial operating proof the consumers are Aigent
 *      Nakamoto and Aigent Kn0w1 (operator directive, 2026-08-23).
 * GET  ?agentId=<runtimeAgentId> — discovery: every catalog service
 *      annotated with that agent's real eligibility
 *      (`discoverFinancialServicesForConsumer`). Also returns
 *      `admissionDiagnostic` — the RAW `AgentAdmissionState` this agent's
 *      eligibility was computed from, read from the SAME resolved context
 *      discovery already produced (2026-08-23 repair pass, Repair F — no
 *      second `resolveAgentAdmissionState()` call for the diagnostic).
 * POST { agentId, serviceId, input? } — triggers `requestFinancialService()`
 *      for that agent. `standingPersonaId` is NO LONGER accepted from the
 *      client (Repair C: "Remove client assertions from constitutional
 *      gates") — the agent's own CRM Standing persona is resolved
 *      server-side (`services/standing/agentStandingPersona.ts`).
 *
 * This route computes NO authority, projection, authorisation, or execution
 * decision of its own — it is glue over `services/financialServices/`,
 * exactly like every other caller of that module.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { listRegistrableAgents, resolveRegistrableAgentByRuntimeId } from '@/services/horizen/registrableAgents';
import { listFinancialServiceDefinitions, MONEYPENNY_ADVISOR } from '@/services/financialServices/serviceCatalog';
import { discoverFinancialServicesForConsumer } from '@/services/financialServices/discovery';
import { requestFinancialService } from '@/services/financialServices/serviceRequestOrchestrator';
import { forecastConsequences } from '@/services/consequence/stages';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const agentId = req.nextUrl.searchParams.get('agentId');
  if (!agentId) {
    // MoneyPenny is the provider/orchestrator, not a self-consuming agent —
    // excluded from the consumer picker (see file header).
    const consumerAgents = listRegistrableAgents().filter(
      (a) => a.runtimeAgentId !== MONEYPENNY_ADVISOR.providerAgentId,
    );
    return NextResponse.json({
      ok: true,
      agents: consumerAgents,
      catalog: listFinancialServiceDefinitions(),
    });
  }

  const agent = resolveRegistrableAgentByRuntimeId(agentId);
  if (!agent) return NextResponse.json({ ok: false, error: `Unknown agent '${agentId}'` }, { status: 400 });

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: 'Supabase is not configured in this environment — discovery requires a live admission/Standing read.' },
      { status: 503 },
    );
  }

  const discovery = await discoverFinancialServicesForConsumer(agentId, admin, {
    callerAuthProfileId: persona.authProfileId,
    actorPersonaId: persona.personaId,
  });
  if (!discovery.ok) {
    return NextResponse.json({ ok: false, error: discovery.error }, { status: 400 });
  }

  // The SAME context discovery just resolved — never a second admission read.
  const admissionDiagnostic = discovery.context.admission ?? { readFailed: 'admission state could not be read' };
  return NextResponse.json({
    ok: true,
    agentId,
    // Each entry carries `eligibility` (admission + structural assignment +
    // verification + Standing — never gated on a current delegation grant)
    // and, for Runtime only, `authority` (the separate, non-blocking
    // current-delegation/mandate prerequisite — see discovery.ts).
    discovery: discovery.services,
    admissionDiagnostic,
    structurallyAssigned: discovery.context.structurallyAssigned,
    hasCurrentDelegationToAgent: discovery.context.hasCurrentDelegationToAgent,
    verification: discovery.context.verification,
    standingPersonaId: discovery.context.standingPersonaId,
  });
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    agentId?: string;
    serviceId?: string;
    input?: Record<string, unknown>;
  };
  const agentId = body.agentId?.trim();
  const serviceId = body.serviceId?.trim();
  if (!agentId || !serviceId) {
    return NextResponse.json({ ok: false, error: 'agentId and serviceId are required' }, { status: 400 });
  }

  const agent = resolveRegistrableAgentByRuntimeId(agentId);
  if (!agent) return NextResponse.json({ ok: false, error: `Unknown agent '${agentId}'` }, { status: 400 });

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: 'Supabase is not configured in this environment — a service request requires a live admission/Standing/receipt read.' },
      { status: 503 },
    );
  }

  const now = new Date().toISOString();
  const publicForecast = await forecastConsequences(['inv.finance.001']);

  const { outcome, causalChain } = await requestFinancialService({
    request: {
      requestRef: `fsvc-oversight-${agentId}-${serviceId}-${Date.now()}`,
      serviceId,
      requestingAgentId: agentId,
      // principalRef/mandateRef are omitted — requestFinancialService()
      // resolves the real ConstitutionalAuthority server-side (Repair C: no
      // synthetic authority, never trusted from the caller).
      input: body.input ?? {},
    },
    publicForecast,
    // Track A scope: this console does not itself source confidential
    // evidence — that is Stage 3.3 territory (docs/vela/VELA-LIVE-ACTIVATION-001.md).
    // Passing null here is honest, not a placeholder: for Runtime it composes
    // UNRESOLVED under REQUIRED confidentiality, which is the correct,
    // visible, fail-closed result this console exists to surface.
    confidentialEvidence: null,
    callerAuthProfileId: persona.authProfileId,
    actorPersonaId: persona.personaId,
    personaId: persona.personaId,
    now,
    admin,
  });

  return NextResponse.json({ ok: true, outcome, causalChain });
}
