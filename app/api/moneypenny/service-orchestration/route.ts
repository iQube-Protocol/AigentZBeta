/**
 * /api/moneypenny/service-orchestration — Phase 3 Track A, the
 * operator-facing MoneyPenny Financial Services oversight console.
 *
 * Consumer model (operator ruling, 2026-08-22): the human principal is NEVER
 * the `requestingAgentId`. They observe/trigger/authorise an ADMITTED,
 * DELEGATED agent (MoneyPenny/Nakamoto/Kn0w1) consuming a Financial Service.
 * This route resolves the caller's own persona via the spine (for receipt
 * attribution only) and always sets `requestingAgentId` to the agent named
 * in the request — it does not, and must not, accept a human persona as the
 * consumer.
 *
 * GET  — no query: catalog + registrable-agent list, for the picker UI.
 * GET  ?agentId=<runtimeAgentId> — discovery: every catalog service
 *      annotated with that agent's real eligibility
 *      (`discoverFinancialServicesForConsumer`, unchanged).
 * POST { agentId, serviceId, input?, standingPersonaId? } — triggers
 *      `requestFinancialService()` UNCHANGED for that agent. `standingPersonaId`
 *      is optional and caller-supplied: `RegistrableAgentConfig` carries no
 *      agent->CRM-persona mapping today, so Runtime's Standing check honestly
 *      reports `STANDING_PERSONA_UNRESOLVED` (never a guess) when omitted —
 *      see the Track A session doc for why this is a documented gap, not
 *      something this route fabricates a mapping for.
 *
 * This route computes NO authority, projection, authorisation, or execution
 * decision of its own — it is glue over `services/financialServices/`,
 * exactly like every other caller of that module.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { listRegistrableAgents, resolveRegistrableAgentByRuntimeId } from '@/services/horizen/registrableAgents';
import { listFinancialServiceDefinitions } from '@/services/financialServices/serviceCatalog';
import { discoverFinancialServicesForConsumer } from '@/services/financialServices/discovery';
import { requestFinancialService } from '@/services/financialServices/serviceRequestOrchestrator';
import { forecastConsequences } from '@/services/consequence/stages';
import type { ConstitutionalAuthority } from '@/types/constitutionalCommerce';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const agentId = req.nextUrl.searchParams.get('agentId');
  if (!agentId) {
    return NextResponse.json({
      ok: true,
      agents: listRegistrableAgents(),
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

  const standingPersonaId = req.nextUrl.searchParams.get('standingPersonaId');
  const discovery = await discoverFinancialServicesForConsumer(agentId, standingPersonaId, admin);
  return NextResponse.json({ ok: true, agentId, discovery });
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    agentId?: string;
    serviceId?: string;
    input?: Record<string, unknown>;
    standingPersonaId?: string;
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
  const authority: ConstitutionalAuthority = {
    principalRef: `polref-${agentId}-oversight`,
    actorRef: agentId,
    authoritySource: 'passport+standing',
    mandateRef: `mandate-fsvc-oversight-${agentId}`,
    state: 'ACTIVE',
  };

  const publicForecast = await forecastConsequences(['inv.finance.001']);

  const { outcome, causalChain } = await requestFinancialService({
    request: {
      requestRef: `fsvc-oversight-${agentId}-${serviceId}-${Date.now()}`,
      serviceId,
      requestingAgentId: agentId,
      principalRef: authority.principalRef,
      mandateRef: authority.mandateRef,
      input: body.input ?? {},
    },
    authority,
    publicForecast,
    // Track A scope: this console does not itself source confidential
    // evidence — that is Stage 3.3 territory (docs/vela/VELA-LIVE-ACTIVATION-001.md).
    // Passing null here is honest, not a placeholder: for Runtime it composes
    // UNRESOLVED under REQUIRED confidentiality, which is the correct,
    // visible, fail-closed result this console exists to surface.
    confidentialEvidence: null,
    standingPersonaId: body.standingPersonaId ?? null,
    personaId: persona.personaId,
    now,
    admin,
  });

  return NextResponse.json({ ok: true, outcome, causalChain });
}
