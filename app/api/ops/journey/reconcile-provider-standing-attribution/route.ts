import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveRegistrableAgentByRuntimeId, type RegistrableAgentConfig } from '@/services/horizen/registrableAgents';
import { resolveAgentAdmissionState } from '@/services/journey/agentAdmissionState';
import { resolveAgentStandingPersonaId, resolveCanonicalAgentPersonaId } from '@/services/standing/agentStandingPersona';
import { accrueStanding } from '@/services/crm/standingAccrualService';
import { createActivityReceipt, findAgentReceiptRefs } from '@/services/receipts/activityReceiptService';
import { SERVICE_COMPLETION_CVS } from '@/services/financialServices/serviceRequestOrchestrator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const REATTRIBUTE_CORRECTION_KIND = 'service_completion_reattribution';
const BACKFILL_CORRECTION_KIND = 'service_completion_provider_backfill';

/**
 * POST /api/ops/journey/reconcile-provider-standing-attribution
 *
 * The one-time, idempotent, non-mutating reconciliation for the 2026-08-23
 * operator directive "Horizen Pilot — close Standing + MoneyPenny Runtime
 * now", part 3 ("Reconcile existing live pilot interactions"). Before this
 * pass, `services/financialServices/serviceRequestOrchestrator.ts`'s Standing
 * accrual credited the REQUESTER's own CRM Standing persona
 * (`context.standingPersonaId`) for a successfully DELIVERED service — never
 * the PROVIDER that actually did the work (fixed going forward by the P0-A
 * repair on that file). The operator has identified genuine completed
 * MoneyPenny service interactions in the live pilot predating that fix (two
 * for Nakamoto, one for Kn0w1) whose requester-side credit needs reversing
 * and whose provider-side credit was never issued at all.
 *
 * ── No-Guessing: explicit receipt ids only ──────────────────────────────────
 * Historical `standing_accrued` receipts carry no reliable structural marker
 * distinguishing "this was a Financial-Services provider-credit misattributed
 * to the requester" from any other legitimate requester accrual (task
 * completion, venture outcomes, etc.) — the only common signal, a `cvs`
 * matching `SERVICE_COMPLETION_CVS`, is a coincidental numeric match, not
 * proof. This route therefore NEVER auto-discovers candidates: the operator
 * supplies the exact `originalReceiptId` for each known interaction, and the
 * route independently re-verifies the defect signature (receipt genuinely
 * exists, genuinely credits the named requester's own identity persona, and
 * the interaction sequences after the provider's genuine
 * `capability_registered` receipt) before acting.
 *
 * ── What each correction does ───────────────────────────────────────────────
 * 1. Reverses the requester-side credit via `accrueStanding({ cvs:
 *    -SERVICE_COMPLETION_CVS, ... })` — the exact inverse magnitude of the
 *    original erroneous accrual, using the SAME canonical accrual primitive
 *    (never a bespoke ledger mutation), which correctly also reverses any
 *    sponsor delegated/stewardship side-credit the original accrual produced.
 * 2. Credits the provider's own canonical Standing persona once via an
 *    ordinary `accrueStanding({ cvs: +SERVICE_COMPLETION_CVS, ... })` call —
 *    idempotently provisioning the provider's `aigent-canonical-standing`
 *    persona first if it does not yet exist. This is a REAL accrual (not a
 *    label-only correction) — it is the genuine Standing the provider never
 *    received.
 * 3. Writes ONE additive `standing_corrected` AUDIT receipt (never mutating
 *    the original) tagged `actionInput.correctionKind:
 *    'service_completion_reattribution'`, naming the original receipt id,
 *    the requester, and the provider as explicit source invocation refs —
 *    this is the idempotency marker checked on every re-run, and is
 *    deliberately NOT read back into `standingEvidenceProjection.ts`'s
 *    contribution set (the provider's own new `standing_accrued` receipt
 *    from step 2 is already directly discoverable evidence; counting the
 *    audit receipt too would double-count one interaction as two pieces of
 *    evidence).
 *
 * ── Never resurrects MoneyPenny's superseded nominal seed ──────────────────
 * This route only ever calls `accrueStanding` for a genuine, freshly-composed
 * contribution credit (`subjectAgentRef: providerAgentId`) — it never touches
 * `registrationStandingSeedAward.ts` or writes a receipt carrying the seed's
 * `basis: 'iqube_registry_registration'` shape.
 *
 * ── Sequencing validity ─────────────────────────────────────────────────────
 * Refuses (`SEQUENCING_INVALID`) unless the provider has at least one genuine
 * `capability_registered` receipt whose `createdAt` precedes the original
 * receipt's `createdAt` — the same ordering discipline
 * `standingEvidenceProjection.ts` already applies to the nominal seed,
 * applied here explicitly because a Financial Services contribution accrual
 * is not otherwise ingestion-gated.
 *
 * ── Second mode: BACKFILL_MISSING_PROVIDER_CREDIT (operator directive,
 *    live-DB-verified follow-up) ──────────────────────────────────────────
 * The operator's own live read of the dev database established that of
 * three genuinely completed MoneyPenny service interactions, only ONE has a
 * matching erroneous requester-side `standing_accrued` receipt to reverse —
 * the other two have NO Standing receipt at all (the provider credit was
 * simply never issued; there is nothing to reverse). Reusing the
 * REATTRIBUTE flow for those would require fabricating a nonexistent
 * "original receipt", which this route must never do.
 *
 * `mode: 'BACKFILL_MISSING_PROVIDER_CREDIT'` instead takes the REAL
 * `capability_invocation_completed` receipt id for the historical
 * interaction (`invocationReceiptId`) and:
 * 1. Verifies that receipt genuinely exists, is a `capability_invocation_completed`
 *    receipt, and that its OWN `agents_invoked`/`action_input.resolvedProviderId`
 *    corroborate the caller-supplied `requestingAgentId`/`providerAgentId` —
 *    never trusting caller-supplied identity alone.
 * 2. Verifies sequencing exactly as REATTRIBUTE does (provider's genuine
 *    `capability_registered` receipt must precede the invocation).
 * 3. Verifies prior-credit absence via the SAME idempotency marker pattern
 *    (a `standing_corrected` receipt already naming this exact
 *    `invocationReceiptId` under `correctionKind:
 *    'service_completion_provider_backfill'` means it was already backfilled
 *    — skip, never re-credit).
 * 4. Issues the provider's missing credit ONCE via an ordinary
 *    `accrueStanding({ cvs: +SERVICE_COMPLETION_CVS, ... })` call — NEVER an
 *    inverse/reversal accrual (there is no requester credit to reverse) and
 *    NEVER a fabricated "original" `standing_accrued` receipt.
 *
 * Auth: CRON_TRIGGER_TOKEN, same convention as every other `/api/ops/*` route.
 */

type CorrectionMode = 'REATTRIBUTE' | 'BACKFILL_MISSING_PROVIDER_CREDIT';

interface ReattributeCorrectionRequest {
  mode?: 'REATTRIBUTE';
  originalReceiptId: string;
  requestingAgentId: string;
  providerAgentId: string;
  correctingPersonaId: string;
}

interface BackfillCorrectionRequest {
  mode: 'BACKFILL_MISSING_PROVIDER_CREDIT';
  invocationReceiptId: string;
  requestingAgentId: string;
  providerAgentId: string;
  correctingPersonaId: string;
}

type CorrectionRequest = ReattributeCorrectionRequest | BackfillCorrectionRequest;

interface CorrectionResult {
  mode: CorrectionMode;
  /** Echoes whichever id the request named — `originalReceiptId` for REATTRIBUTE, `invocationReceiptId` for BACKFILL. */
  originalReceiptId?: string;
  invocationReceiptId?: string;
  status: 'corrected' | 'skipped_already_corrected' | 'refused';
  refusalCode?: string;
  detail?: string;
  /** `accrueStanding()` returns the recomputed ledger, not a receipt id — its own fire-and-forget receipt write is not awaited by design (see standingAccrualService.ts). `true` iff the accrual itself did not fail. */
  reversalApplied?: boolean;
  creditApplied?: boolean;
  correctionReceiptId?: string | null;
}

async function resolveAgentStandingContext(
  admin: SupabaseClient,
  agent: RegistrableAgentConfig,
): Promise<
  | { ok: true; identityPersonaId: string; crmPersonaId: string }
  | { ok: false; refusalCode: string; detail: string }
> {
  const admission = await resolveAgentAdmissionState(admin, agent).catch(() => undefined);
  const agentRootDid = admission?.agentRootDid;
  if (agentRootDid === undefined) {
    return { ok: false, refusalCode: 'ADMISSION_UNRESOLVED', detail: `could not resolve ${agent.runtimeAgentId}'s admission state` };
  }
  if (agentRootDid === null) {
    return { ok: false, refusalCode: 'NO_ROOT_IDENTITY', detail: `${agent.runtimeAgentId} has no agent_root_identity yet` };
  }
  const identityPersonaId = await resolveCanonicalAgentPersonaId(admin, agent, agentRootDid);
  if (!identityPersonaId) {
    return { ok: false, refusalCode: 'IDENTITY_PERSONA_UNRESOLVED', detail: `could not resolve ${agent.runtimeAgentId}'s canonical identity persona` };
  }
  const crmPersonaId = await resolveAgentStandingPersonaId(admin, agent, agentRootDid);
  if (!crmPersonaId) {
    return { ok: false, refusalCode: 'STANDING_PERSONA_UNRESOLVED', detail: `could not resolve or provision ${agent.runtimeAgentId}'s canonical Standing persona` };
  }
  return { ok: true, identityPersonaId, crmPersonaId };
}

async function reconcileReattribute(admin: SupabaseClient, correction: ReattributeCorrectionRequest): Promise<CorrectionResult> {
  const { originalReceiptId, requestingAgentId, providerAgentId, correctingPersonaId } = correction;
  const mode: CorrectionMode = 'REATTRIBUTE';

  const requestingAgent = resolveRegistrableAgentByRuntimeId(requestingAgentId);
  if (!requestingAgent) {
    return { mode, originalReceiptId, status: 'refused', refusalCode: 'UNKNOWN_REQUESTING_AGENT', detail: `'${requestingAgentId}' is not a canonical registrable agent` };
  }
  const providerAgent = resolveRegistrableAgentByRuntimeId(providerAgentId);
  if (!providerAgent) {
    return { mode, originalReceiptId, status: 'refused', refusalCode: 'UNKNOWN_PROVIDER_AGENT', detail: `'${providerAgentId}' is not a canonical registrable agent` };
  }

  const requesterCtx = await resolveAgentStandingContext(admin, requestingAgent);
  if (!requesterCtx.ok) return { mode, originalReceiptId, status: 'refused', refusalCode: requesterCtx.refusalCode, detail: requesterCtx.detail };

  const providerCtx = await resolveAgentStandingContext(admin, providerAgent);
  if (!providerCtx.ok) return { mode, originalReceiptId, status: 'refused', refusalCode: providerCtx.refusalCode, detail: providerCtx.detail };

  // Idempotency FIRST — never re-derive anything for an already-reconciled receipt.
  const existingCorrections = await findAgentReceiptRefs(providerAgentId, ['standing_corrected'], { limit: 100 });
  const alreadyCorrected = existingCorrections.some(
    (r) => r.actionInput?.correctionKind === REATTRIBUTE_CORRECTION_KIND && r.actionInput?.originalReceiptId === originalReceiptId,
  );
  if (alreadyCorrected) {
    return { mode, originalReceiptId, status: 'skipped_already_corrected' };
  }

  const { data: originalRow, error: readErr } = await admin
    .from('activity_receipts')
    .select('id, action_type, persona_id, agents_invoked, action_input, created_at')
    .eq('id', originalReceiptId)
    .maybeSingle();
  if (readErr) return { mode, originalReceiptId, status: 'refused', refusalCode: 'READ_FAILED', detail: readErr.message };
  if (!originalRow) return { mode, originalReceiptId, status: 'refused', refusalCode: 'ORIGINAL_RECEIPT_NOT_FOUND', detail: `no receipt '${originalReceiptId}'` };
  if (originalRow.action_type !== 'standing_accrued') {
    return { mode, originalReceiptId, status: 'refused', refusalCode: 'NOT_A_STANDING_ACCRUAL', detail: `receipt action_type is '${originalRow.action_type}'` };
  }
  if (originalRow.persona_id !== requesterCtx.identityPersonaId) {
    return {
      mode,
      originalReceiptId,
      status: 'refused',
      refusalCode: 'RECEIPT_NOT_REQUESTER_CREDITED',
      detail: `receipt persona_id does not match ${requestingAgentId}'s own canonical identity persona — refusing to guess`,
    };
  }

  // Sequencing validity — the service completion must not predate the
  // provider's own genuine capability registration.
  const providerIngestRows = await findAgentReceiptRefs(providerAgentId, ['capability_registered'], { limit: 50 });
  const earliestGenuineIngestAt = providerIngestRows.map((r) => r.createdAt).sort()[0] ?? null;
  const originalCreatedAt = originalRow.created_at as string;
  if (!earliestGenuineIngestAt || originalCreatedAt < earliestGenuineIngestAt) {
    return {
      mode,
      originalReceiptId,
      status: 'refused',
      refusalCode: 'SEQUENCING_INVALID',
      detail: `no genuine capability_registered receipt for ${providerAgentId} precedes ${originalReceiptId}`,
    };
  }

  // ── 1. Reverse the requester-side credit — exact inverse magnitude. ───────
  const reversal = await accrueStanding({
    crmPersonaId: requesterCtx.crmPersonaId,
    cvs: -SERVICE_COMPLETION_CVS,
    subjectAgentRef: requestingAgentId,
    orchestratorAgentRef: null,
    requestingAgentRef: null,
  });

  // ── 2. Credit the provider once, genuinely. ────────────────────────────────
  const credit = await accrueStanding({
    crmPersonaId: providerCtx.crmPersonaId,
    cvs: SERVICE_COMPLETION_CVS,
    subjectAgentRef: providerAgentId,
    requestingAgentRef: requestingAgentId,
  });

  // ── 3. Additive audit/correction receipt — the idempotency marker. ────────
  const correctionReceipt = await createActivityReceipt({
    personaId: providerCtx.identityPersonaId,
    actionType: 'standing_corrected',
    activeCartridge: 'metame',
    summary: `Service-completion Standing reattributed: ${originalReceiptId} (requester ${requestingAgentId}) reversed, ${providerAgentId} credited genuinely`,
    agentsInvoked: [providerAgentId],
    actionInput: {
      correctionKind: REATTRIBUTE_CORRECTION_KIND,
      originalReceiptId,
      requestingAgentId,
      providerAgentId,
      correctingPersonaId,
    },
  }).catch(() => null);

  return {
    mode,
    originalReceiptId,
    status: 'corrected',
    reversalApplied: reversal !== null,
    creditApplied: credit !== null,
    correctionReceiptId: correctionReceipt?.id ?? null,
  };
}

async function reconcileBackfill(admin: SupabaseClient, correction: BackfillCorrectionRequest): Promise<CorrectionResult> {
  const { invocationReceiptId, requestingAgentId, providerAgentId, correctingPersonaId } = correction;
  const mode: CorrectionMode = 'BACKFILL_MISSING_PROVIDER_CREDIT';

  const requestingAgent = resolveRegistrableAgentByRuntimeId(requestingAgentId);
  if (!requestingAgent) {
    return { mode, invocationReceiptId, status: 'refused', refusalCode: 'UNKNOWN_REQUESTING_AGENT', detail: `'${requestingAgentId}' is not a canonical registrable agent` };
  }
  const providerAgent = resolveRegistrableAgentByRuntimeId(providerAgentId);
  if (!providerAgent) {
    return { mode, invocationReceiptId, status: 'refused', refusalCode: 'UNKNOWN_PROVIDER_AGENT', detail: `'${providerAgentId}' is not a canonical registrable agent` };
  }

  // Resolving/provisioning the provider's Standing context is what lets the
  // FIRST real credit idempotently provision MoneyPenny's missing
  // `aigent-canonical-standing` persona — no separate provisioning step.
  const providerCtx = await resolveAgentStandingContext(admin, providerAgent);
  if (!providerCtx.ok) return { mode, invocationReceiptId, status: 'refused', refusalCode: providerCtx.refusalCode, detail: providerCtx.detail };

  // Idempotency / prior-credit-absence FIRST — never re-derive anything for
  // an interaction already backfilled.
  const existingCorrections = await findAgentReceiptRefs(providerAgentId, ['standing_corrected'], { limit: 100 });
  const alreadyBackfilled = existingCorrections.some(
    (r) => r.actionInput?.correctionKind === BACKFILL_CORRECTION_KIND && r.actionInput?.invocationReceiptId === invocationReceiptId,
  );
  if (alreadyBackfilled) {
    return { mode, invocationReceiptId, status: 'skipped_already_corrected' };
  }

  // Verify the completed interaction is REAL — never fabricate an "original"
  // Standing receipt for it (there was never one to reverse).
  const { data: invocationRow, error: readErr } = await admin
    .from('activity_receipts')
    .select('id, action_type, agents_invoked, action_input, created_at')
    .eq('id', invocationReceiptId)
    .maybeSingle();
  if (readErr) return { mode, invocationReceiptId, status: 'refused', refusalCode: 'READ_FAILED', detail: readErr.message };
  if (!invocationRow) {
    return { mode, invocationReceiptId, status: 'refused', refusalCode: 'INVOCATION_RECEIPT_NOT_FOUND', detail: `no receipt '${invocationReceiptId}'` };
  }
  if (invocationRow.action_type !== 'capability_invocation_completed') {
    return {
      mode,
      invocationReceiptId,
      status: 'refused',
      refusalCode: 'NOT_A_COMPLETED_INVOCATION',
      detail: `receipt action_type is '${invocationRow.action_type}'`,
    };
  }

  // Verify requester + provider against the receipt's OWN evidence — never
  // trust caller-supplied identity alone (emitCapabilityInvocationCompleted
  // writes agentsInvoked: [requestingAgentId, orchestratorAgentId?,
  // resolvedProviderId] and actionInput.resolvedProviderId).
  const invoked = Array.isArray(invocationRow.agents_invoked) ? (invocationRow.agents_invoked as string[]) : [];
  if (!invoked.includes(requestingAgentId)) {
    return {
      mode,
      invocationReceiptId,
      status: 'refused',
      refusalCode: 'REQUESTER_NOT_IN_INVOCATION',
      detail: `'${requestingAgentId}' does not appear in this invocation's agents_invoked — refusing to guess`,
    };
  }
  const invocationActionInput = (invocationRow.action_input ?? {}) as Record<string, unknown>;
  if (invocationActionInput.resolvedProviderId !== providerAgentId || !invoked.includes(providerAgentId)) {
    return {
      mode,
      invocationReceiptId,
      status: 'refused',
      refusalCode: 'PROVIDER_NOT_IN_INVOCATION',
      detail: `'${providerAgentId}' is not this invocation's resolvedProviderId — refusing to guess`,
    };
  }

  // Sequencing validity — identical discipline to REATTRIBUTE.
  const providerIngestRows = await findAgentReceiptRefs(providerAgentId, ['capability_registered'], { limit: 50 });
  const earliestGenuineIngestAt = providerIngestRows.map((r) => r.createdAt).sort()[0] ?? null;
  const invocationCreatedAt = invocationRow.created_at as string;
  if (!earliestGenuineIngestAt || invocationCreatedAt < earliestGenuineIngestAt) {
    return {
      mode,
      invocationReceiptId,
      status: 'refused',
      refusalCode: 'SEQUENCING_INVALID',
      detail: `no genuine capability_registered receipt for ${providerAgentId} precedes ${invocationReceiptId}`,
    };
  }

  // ── Issue the missing provider credit ONCE — no reversal, nothing to
  //    reverse (operator: "do not issue inverse requester accruals for those
  //    two because no requester credit exists to reverse"). ─────────────────
  const credit = await accrueStanding({
    crmPersonaId: providerCtx.crmPersonaId,
    cvs: SERVICE_COMPLETION_CVS,
    subjectAgentRef: providerAgentId,
    requestingAgentRef: requestingAgentId,
  });

  const correctionReceipt = await createActivityReceipt({
    personaId: providerCtx.identityPersonaId,
    actionType: 'standing_corrected',
    activeCartridge: 'metame',
    summary: `Missing provider Standing credit backfilled: ${invocationReceiptId} (requester ${requestingAgentId}) — ${providerAgentId} credited genuinely; no prior requester credit existed to reverse`,
    agentsInvoked: [providerAgentId],
    actionInput: {
      correctionKind: BACKFILL_CORRECTION_KIND,
      invocationReceiptId,
      requestingAgentId,
      providerAgentId,
      correctingPersonaId,
    },
  }).catch(() => null);

  return {
    mode,
    invocationReceiptId,
    status: 'corrected',
    creditApplied: credit !== null,
    correctionReceiptId: correctionReceipt?.id ?? null,
  };
}

async function reconcileOne(admin: SupabaseClient, correction: CorrectionRequest): Promise<CorrectionResult> {
  if (correction.mode === 'BACKFILL_MISSING_PROVIDER_CREDIT') {
    return reconcileBackfill(admin, correction);
  }
  return reconcileReattribute(admin, correction);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_TRIGGER_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'cron_token_not_configured' }, { status: 503 });
  }
  const provided =
    request.headers.get('x-cron-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { corrections?: CorrectionRequest[] };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const corrections = Array.isArray(body.corrections) ? body.corrections : [];
  if (corrections.length === 0) {
    return NextResponse.json({ error: 'corrections (non-empty array) is required' }, { status: 400 });
  }
  for (const c of corrections) {
    if (!c.requestingAgentId || !c.providerAgentId || !c.correctingPersonaId) {
      return NextResponse.json(
        { error: 'each correction requires requestingAgentId, providerAgentId, correctingPersonaId' },
        { status: 400 },
      );
    }
    if (c.mode === 'BACKFILL_MISSING_PROVIDER_CREDIT') {
      if (!c.invocationReceiptId) {
        return NextResponse.json({ error: 'mode BACKFILL_MISSING_PROVIDER_CREDIT requires invocationReceiptId' }, { status: 400 });
      }
    } else if (!c.originalReceiptId) {
      return NextResponse.json({ error: 'mode REATTRIBUTE (the default) requires originalReceiptId' }, { status: 400 });
    }
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ error: 'db unavailable' }, { status: 503 });
  }

  try {
    const results: CorrectionResult[] = [];
    for (const correction of corrections) {
      results.push(await reconcileOne(admin, correction));
    }
    return NextResponse.json({ ok: true, results }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/** GET shows what this route does — handy for verification without a POST. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      method: 'POST',
      description:
        'Idempotent, non-destructive reconciliation for pre-P0-A live pilot Financial Services interactions. Two ' +
        'additive modes, both requiring explicit receipt ids (No-Guessing rule — never auto-discovers candidates): ' +
        "mode 'REATTRIBUTE' (default) reverses an erroneous requester-side standing_accrued credit and accrues the " +
        'provider once — body: { originalReceiptId, requestingAgentId, providerAgentId, correctingPersonaId }. mode ' +
        "'BACKFILL_MISSING_PROVIDER_CREDIT' issues the provider's missing credit for a genuinely completed " +
        'interaction that produced NO Standing receipt at all — never a reversal, never a fabricated original ' +
        'receipt — body: { mode, invocationReceiptId, requestingAgentId, providerAgentId, correctingPersonaId }. ' +
        'Requires x-cron-token header (CRON_TRIGGER_TOKEN).',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
