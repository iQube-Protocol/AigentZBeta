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
import {
  listFinancialServiceDefinitions,
  resolveFinancialServiceDefinition,
  MONEYPENNY_ADVISOR,
} from '@/services/financialServices/serviceCatalog';
import { discoverFinancialServicesForConsumer } from '@/services/financialServices/discovery';
import { requestFinancialService } from '@/services/financialServices/serviceRequestOrchestrator';
import { forecastConsequences, knowledgeCuration } from '@/services/consequence/stages';
import type { ConsequenceForecast } from '@/types/consequence';
import type { FinancialServiceOutcome } from '@/types/financialServices';

/**
 * Bounded stage markers for the POST lifecycle's top-level error boundary
 * (2026-08-23 repair pass, Track A orchestration-boundary fixes). These name
 * roughly where an UNEXPECTED technical exception occurred — never a
 * substitute for the deterministic INELIGIBLE/REFUSED/UNRESOLVED outcomes
 * `requestFinancialService()` already returns without throwing.
 */
type OrchestrationStage = 'INPUT' | 'PUBLIC_PROJECTION' | 'GATEWAY' | 'PROVIDER_DISPATCH';

function unresolvedOutcome(
  requestRef: string,
  serviceId: string,
  definition: ReturnType<typeof resolveFinancialServiceDefinition>,
  reason: string,
): FinancialServiceOutcome {
  return {
    requestRef,
    serviceId,
    serviceClass: definition?.serviceClass ?? 'INFORMATIONAL',
    providerMode: definition?.providerMode ?? null,
    status: 'UNRESOLVED',
    reason,
    authorisationRef: null,
    executionRef: null,
    observedConsequenceRef: null,
    validationState: null,
    projectionDisposition: null,
  };
}

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
  let stage: OrchestrationStage = 'INPUT';
  let requestRef = `fsvc-oversight-${Date.now()}`;
  let serviceIdForError: string | undefined;

  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated', stage }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      agentId?: string;
      serviceId?: string;
      input?: Record<string, unknown>;
    };
    const agentId = body.agentId?.trim();
    const serviceId = body.serviceId?.trim();
    serviceIdForError = serviceId;
    if (!agentId || !serviceId) {
      return NextResponse.json({ ok: false, error: 'agentId and serviceId are required', stage }, { status: 400 });
    }
    requestRef = `fsvc-oversight-${agentId}-${serviceId}-${Date.now()}`;

    const agent = resolveRegistrableAgentByRuntimeId(agentId);
    if (!agent) return NextResponse.json({ ok: false, error: `Unknown agent '${agentId}'`, stage }, { status: 400 });

    const definition = resolveFinancialServiceDefinition(serviceId);
    if (!definition) {
      return NextResponse.json({ ok: false, error: `Unknown serviceId '${serviceId}'`, stage }, { status: 400 });
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: 'Supabase is not configured in this environment — a service request requires a live admission/Standing/receipt read.', stage },
        { status: 503 },
      );
    }

    const now = new Date().toISOString();

    // ── Public consequence forecasting — ONLY for a service whose execution
    //    path is actually reachable (Runtime today). Advisor/Architect
    //    declare `projectionRequirement: 'NOT_REQUIRED'` and
    //    `executionReachable: false` — composing a forecast for them was
    //    invalid (it fed a hardcoded seed-id STRING into a UUID-keyed graph
    //    API) and unnecessary (requestFinancialService() never uses it for
    //    them). Real persisted invariant UUIDs are resolved through the
    //    canonical invariant service (knowledgeCuration -> listInvariants,
    //    filtered to the ratified `finance` namespace) — never a hardcoded
    //    seed id, and never invented/backfilled if none are live yet.
    stage = 'PUBLIC_PROJECTION';
    let publicForecast: ConsequenceForecast | null = null;
    if (definition.executionPolicy.executionReachable) {
      const knowledge = await knowledgeCuration({
        intentRef: requestRef,
        namespace: 'finance',
      });
      if (knowledge.invariantIds.length === 0) {
        return NextResponse.json({
          ok: true,
          outcome: unresolvedOutcome(
            requestRef,
            serviceId,
            definition,
            "no persisted 'finance' namespace invariants are available to compose a public consequence forecast",
          ),
          causalChain: null,
        });
      }
      publicForecast = await forecastConsequences(knowledge.invariantIds);
    }

    stage = 'GATEWAY';
    const { outcome, causalChain } = await requestFinancialService({
      request: {
        requestRef,
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
  } catch (e) {
    // A top-level, always-JSON error boundary (2026-08-23 repair pass):
    // every deterministic lifecycle outcome above returns via its own
    // INELIGIBLE/REFUSED/UNRESOLVED/DELIVERED/AUTHORISED path without
    // throwing. Reaching here means a genuinely UNEXPECTED technical
    // exception occurred — never secrets or raw private inputs in the
    // response, only the bounded `stage` it happened in.
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: message, stage, serviceId: serviceIdForError },
      { status: 500 },
    );
  }
}
