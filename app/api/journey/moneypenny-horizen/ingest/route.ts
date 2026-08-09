/**
 * POST /api/journey/moneypenny-horizen/ingest
 * GET  /api/journey/moneypenny-horizen/ingest?agentSlug=nakamoto
 *
 * The Ingest act the Horizen journey never actually had (Horizen Pilot
 * Closure — Final Standing + DVN Closure, part 2, 2026-08-09 operator
 * decision A: "Nakamoto's existing initial Standing seed is premature and
 * must be corrected under the same generic rule as MoneyPenny... close the
 * actual Ingest-act gap").
 *
 * ── THE GAP THIS CLOSES ────────────────────────────────────────────────────
 *
 * The journey `state` route's Ingest/`deploy` stage has always defined
 * `factoryIngested` as `hasReceipt('capability_registered')` — but the ONLY
 * production writer of a `capability_registered` receipt
 * (services/constitutional/capabilityRegistry.ts, the Constitutional
 * Capability Registry) writes it with `agentsInvoked: ['aigent-z']` for an
 * entirely different concept (admitting a SHIPPED SOFTWARE capability into
 * the platform's capability ledger) — never for a Horizen registrable agent
 * (moneypenny/nakamoto). No production path has ever written an agent-scoped
 * `capability_registered` receipt for a Horizen journey agent. Confirmed by
 * direct grep across the repo before writing this route (no second writer
 * exists to be reconciled with — this is a genuinely missing act, not a
 * duplicate).
 *
 * This route is that missing act. It reuses the SAME `capability_registered`
 * action type (the operator's own instruction: "the state route defines
 * [Ingest] solely from capability_registered" — never define a second,
 * parallel evidence key), scoped this time to `agentsInvoked: [agent.
 * runtimeAgentId]` — the registrable agent, never `aigent-z`.
 *
 * ── WHAT THIS DOES NOT DO ──────────────────────────────────────────────────
 *
 * Writes NO Standing. `standing_accrued` is exclusively the job of the
 * EXISTING, unmodified seed-award mechanism already living in the journey
 * `state` route (its `guarded('standing-seed', ...)` block, which calls
 * `awardRegistrationStandingSeedIfEligible`) — it observes Operate-complete
 * AND a `capability_registered` receipt on the very next state read after
 * this route runs, and awards exactly one nominal seed via `settleFact`'s own
 * idempotency guarantee. This route's only consequence is Factory
 * participation / Standing ELIGIBILITY (services/journey/agentStateAxes.ts's
 * own FactoryAxis doctrine) — never Standing itself.
 *
 * ── PRECONDITIONS (all required; first failing one is refused) ───────────
 *
 *   1. Idempotent: an agent-scoped `capability_registered` receipt already
 *      exists -> report `already_ingested`, no new receipt.
 *   2. The agent's AigentQube resolves in the registry (same direct
 *      `registry_assets` presence check the state route's Register stage
 *      already uses for `aigentQubeResolved` — never re-derived differently).
 *   3. The agent's Horizen registration resolves
 *      (`resolveAgentRegistrationState` — the same boundary
 *      `pnl/onboard/route.ts` already gates on; never a second identity
 *      check).
 *   4. Operate/aigentMe is complete — checked via the EXACT SAME receipt
 *      pair (`aigentme_activated` + `experienceqube_focus_disposition_recorded`)
 *      the state route's own seed-award eligibility block already uses as
 *      its "Operate complete enough" predicate (state/route.ts's
 *      `aigentMeActiveForSeed`) — not a new, independently-invented
 *      definition of Operate-complete.
 *
 * Auth: getActivePersona — a real operator attribution is required for the
 * receipt, same as every other Horizen act route (pnl/onboard, orient/
 * acknowledge). No active persona resolvable -> 401, never a static
 * resolver string.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveRegistrableAgent, DEFAULT_REGISTRABLE_AGENT_SLUG, type RegistrableAgentConfig } from '@/services/horizen/registrableAgents';
import { resolveAgentRegistrationState } from '@/services/horizen/agentRegistrationBinding';
import { createActivityReceipt, findAgentReceiptRefs } from '@/services/receipts/activityReceiptService';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface IngestPreconditions {
  aigentQubeResolved: boolean;
  registered: boolean;
  aigentMeActive: boolean;
  focusDispositionRecorded: boolean;
  alreadyIngested: boolean;
  existingIngestReceiptId: string | null;
}

async function resolvePreconditions(agent: RegistrableAgentConfig, admin: SupabaseClient): Promise<IngestPreconditions> {
  const [aigentQubeRow, registration, ingestReceipts, aigentMeReceipts, focusDispositionReceipts] = await Promise.all([
    admin.from('registry_assets').select('asset_id').eq('asset_id', agent.aigentQubeId).maybeSingle(),
    resolveAgentRegistrationState(admin, agent),
    findAgentReceiptRefs(agent.runtimeAgentId, ['capability_registered'], { limit: 1 }),
    findAgentReceiptRefs(agent.runtimeAgentId, ['aigentme_activated'], { limit: 1 }),
    findAgentReceiptRefs(agent.runtimeAgentId, ['experienceqube_focus_disposition_recorded'], { limit: 1 }),
  ]);
  return {
    aigentQubeResolved: !!aigentQubeRow.data,
    registered: registration.registered,
    aigentMeActive: aigentMeReceipts.length > 0,
    focusDispositionRecorded: focusDispositionReceipts.length > 0,
    alreadyIngested: ingestReceipts.length > 0,
    existingIngestReceiptId: ingestReceipts[0]?.id ?? null,
  };
}

interface IngestBody {
  agentSlug?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    return await getIngestStatus(request);
  } catch (err) {
    return NextResponse.json(
      { ok: false, refusalCode: 'UNHANDLED_INGEST_STATUS_ERROR', error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) },
      { status: 500 },
    );
  }
}

async function getIngestStatus(request: NextRequest): Promise<NextResponse> {
  const agentSlug = request.nextUrl.searchParams.get('agentSlug') ?? DEFAULT_REGISTRABLE_AGENT_SLUG;
  const agent = resolveRegistrableAgent(agentSlug);
  if (!agent) {
    return NextResponse.json({ ok: false, refusalCode: 'UNKNOWN_AGENT', error: `"${agentSlug}" is not a registrable agent` }, { status: 400 });
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 503 });

  const pre = await resolvePreconditions(agent, admin);
  return NextResponse.json({
    ok: true,
    agentSlug: agent.slug,
    ...pre,
    eligible: !pre.alreadyIngested && pre.aigentQubeResolved && pre.registered && pre.aigentMeActive && pre.focusDispositionRecorded,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    return await postIngest(request);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_INGEST_ERROR',
        error:
          `The Ingest act threw before it could answer: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. ` +
          'No receipt is confirmed written — re-read status before retrying.',
      },
      { status: 500 },
    );
  }
}

async function postIngest(request: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  let body: IngestBody = {};
  try {
    body = await request.json();
  } catch {
    /* empty body is fine — defaults apply */
  }
  const agentSlug = body.agentSlug ?? DEFAULT_REGISTRABLE_AGENT_SLUG;
  const agent = resolveRegistrableAgent(agentSlug);
  if (!agent) {
    return NextResponse.json({ ok: false, refusalCode: 'UNKNOWN_AGENT', error: `"${agentSlug}" is not a registrable agent` }, { status: 400 });
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 503 });

  const pre = await resolvePreconditions(agent, admin);

  // Idempotent — never a second capability_registered receipt for the same agent.
  if (pre.alreadyIngested) {
    return NextResponse.json({ ok: true, status: 'already_ingested', agentSlug: agent.slug, receiptId: pre.existingIngestReceiptId });
  }
  if (!pre.aigentQubeResolved) {
    return NextResponse.json(
      { ok: false, refusalCode: 'AIGENTQUBE_UNRESOLVED', error: `${agent.displayName}'s AigentQube (${agent.aigentQubeId}) is not present in the registry — Register must complete first` },
      { status: 409 },
    );
  }
  if (!pre.registered) {
    return NextResponse.json(
      { ok: false, refusalCode: 'AGENT_NOT_REGISTERED', error: `${agent.displayName} has no confirmed Horizen registration yet — Register must complete first` },
      { status: 409 },
    );
  }
  if (!pre.aigentMeActive || !pre.focusDispositionRecorded) {
    return NextResponse.json(
      { ok: false, refusalCode: 'OPERATE_NOT_COMPLETE', error: `${agent.displayName} has not completed Operate (aigentMe) yet — Ingest requires Operate first` },
      { status: 409 },
    );
  }

  const receipt = await createActivityReceipt({
    personaId: persona.personaId,
    activeCartridge: 'agentiq',
    actionType: 'capability_registered',
    summary: `${agent.displayName} ingested into the Factory — genuine capability registration establishing Standing eligibility (not itself a Standing award)`,
    agentsInvoked: [agent.runtimeAgentId],
    actionInput: {
      agentSlug: agent.slug,
      aigentQubeId: agent.aigentQubeId,
      basis: 'horizen_factory_ingestion',
      context: 'horizen-admission-journey',
    },
  });

  return NextResponse.json({
    ok: true,
    status: 'ingested',
    agentSlug: agent.slug,
    receiptId: receipt?.id ?? null,
    note: 'No Standing was written by this call. Re-read the journey state to let the existing seed-award mechanism observe this receipt and accrue the nominal initial Standing exactly once.',
  });
}
