/**
 * GET /api/journey/moneypenny-horizen/state
 *
 * Assembles the AuthoritativePlatformState for the Horizen x MoneyPenny
 * Guided Journey (PRD-GJR-001) from real reads — MoneyPenny's live Agent
 * Card, and any activity receipts already recorded against her persona for
 * this journey's action types — and resolves it via resolveJourneyState().
 *
 * Honesty over completeness (CLAUDE.md "No Guessing"): most of this
 * journey's sovereign actions (Marketa's recommendation, sponsorship,
 * delegation, aigentMe activation, etc.) have not yet happened for real, so
 * their receipts do not exist yet and those stages correctly resolve
 * NOT_STARTED/READY, never fabricated as complete. As each real action ships
 * (services/passport/externalAgentAdmission.ts wiring, the Verify-stage
 * Pulse toggle, etc.) and starts writing receipts via createActivityReceipt,
 * this route picks them up automatically — no change needed here.
 *
 * persona_id is T0 (services/receipts/activityReceiptService.ts) — resolved
 * server-side only, never included in the JSON response.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { findAgentReceiptRefs, type ActivityActionType } from '@/services/receipts/activityReceiptService';
import { resolveJourneyState, type AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
import { resolveRegistrableAgent, DEFAULT_REGISTRABLE_AGENT_SLUG } from '@/services/horizen/registrableAgents';
import { resolveAgentRegistrationState } from '@/services/horizen/agentRegistrationBinding';
import { checkAuthorizationStoreAvailable } from '@/services/horizen/partnerAuthorizationStore';
import { resolvePassportEligibility } from '@/services/journey/passportEligibility';
import {
  journeyAct,
  readJourneyResolution,
  recordJourneyResolution,
  resolveMonotonicJourneyState,
  type BlockingReason,
} from '@/services/journey/stageResolution';
import type { ExceptionRecord } from '@/services/research/exceptionIsolation';

export const dynamic = 'force-dynamic';

const JOURNEY_ACTION_TYPES: ActivityActionType[] = [
  'agent_card_discovered',
  'horizen_agent_registered',
  // Wallet Signing Topology (operator ruling 2026-08-01) — the Register
  // ceremony's five independent evidence types.
  'principal_registration_mandate_signed',
  'agent_registry_transaction_signed',
  'horizen_registration_submitted',
  'horizen_registration_confirmed',
  'agent_registry_binding_recorded',
  'horizen_pulse_authorized',
  'horizen_pnl_transparency_enabled',
  'agent_card_enriched',
  'agent_control_proven',
  'marketa_eligibility_recommended',
  'operator_passport_validated',
  'agent_sponsorship_recorded',
  'agent_delegate_passport_issued',
  'agent_delegated',
  'finance_authoritative_execution',
  'standing_accrued',
  'aigentme_activated',
  'experienceqube_focus_disposition_recorded',
  'journey_completed',
];

export async function GET(req: NextRequest) {
  const origin = resolveRequestOrigin(req);
  const agentSlug = req.nextUrl.searchParams.get('agentSlug') ?? DEFAULT_REGISTRABLE_AGENT_SLUG;
  const agent = resolveRegistrableAgent(agentSlug) ?? resolveRegistrableAgent(DEFAULT_REGISTRABLE_AGENT_SLUG)!;

  let agentCard: Record<string, unknown> | null = null;
  try {
    const res = await fetch(`${origin}${agent.agentCardPath}`, { cache: 'no-store' });
    if (res.ok) agentCard = await res.json();
  } catch {
    // Soft-fail — Agent Card unreachable, Register stage stays evidence-incomplete.
  }

  const receiptRefs: Record<string, string[]> = {};
  let aigentQubeResolved = false;
  /*
   * THE SETTLED REGISTRATION — RETRIEVED, NEVER RE-DERIVED.
   *
   * `resolveAgentRegistrationState` is the resolution boundary: it consults
   * the settled fact first and only reasons when nothing has been settled.
   * This route consumes its answer and must never reconstruct one of its own
   * from `hasReceipt(...)` — a sixth observer of "is Nakamoto registered"
   * would reintroduce exactly the defect
   * RES-2026-08-03-HORIZEN-OBSERVER-RECONCILIATION-001 closed.
   */
  let registration: Awaited<ReturnType<typeof resolveAgentRegistrationState>> | null = null;
  let authorizationStore: Awaited<ReturnType<typeof checkAuthorizationStoreAvailable>> | null = null;
  let priorResolution: Awaited<ReturnType<typeof readJourneyResolution>> = null;
  try {
    const supabase = getSupabaseServer();
    /*
     * FIND THIS AGENT'S RECEIPTS BY THE AGENT, NOT BY A PERSONA (2026-08-03).
     *
     * This resolved the AGENT's own persona (`fio_handle = nakamoto@aigent`)
     * and listed ITS receipts — but every journey receipt is written with
     * `personaId: actorPersonaId`, the OPERATOR who acted (ArkAgent). The
     * agent's persona therefore never holds them: `receiptRefs` came back
     * empty, every `hasReceipt(...)` below was false, and Register could
     * never reach COMPLETE no matter how completely it had succeeded.
     *
     * Aigent Nakamoto's confirmed registration (tokenId 8798) sat behind
     * exactly this: a real receipt, looked for under the wrong persona.
     * Identical defect to the one fixed in agentRegistrationBinding.ts the
     * same day — see OS-6 in
     * codexes/packs/agentiq/updates/2026-08-03_observer-state-invariants.md.
     */
    const refs = await findAgentReceiptRefs(agent.runtimeAgentId, JOURNEY_ACTION_TYPES, { limit: 100 });
    for (const ref of refs) {
      (receiptRefs[ref.actionType] ??= []).push(ref.id);
    }

    // §3.1.1 correction — Register requires a real, persisted AigentQube
    // before anything else (registered externally != backed by an AigentQube).
    const { data: aigentQube } = await supabase
      .from('registry_assets')
      .select('asset_id')
      .eq('asset_id', agent.aigentQubeId)
      .maybeSingle();
    aigentQubeResolved = !!aigentQube;

    registration = await resolveAgentRegistrationState(supabase, agent);
    authorizationStore = await checkAuthorizationStoreAvailable(supabase);
    priorResolution = await readJourneyResolution(supabase, agent.aigentQubeId, HORIZEN_MONEYPENNY_JOURNEY.id);
  } catch {
    // Soft-fail — receipts/registry unavailable, journey stays at its currently-evidenced state.
  }

  const hasReceipt = (type: ActivityActionType) => (receiptRefs[type]?.length ?? 0) > 0;
  const horizen = (agentCard?.metadata as Record<string, unknown> | undefined)?.horizen as
    | Record<string, unknown>
    | undefined;

  const platformState: AuthoritativePlatformState = {
    receiptRefs,
    stages: {
      register: {
        aigentQubeResolved,
        tokenId: (horizen?.tokenId as string | null) ?? null,
        registryRereadOk: hasReceipt('horizen_agent_registered'),
        ownerWalletMatches: hasReceipt('horizen_agent_registered'),
        agentCardResolves: !!agentCard,
        // Wallet Signing Topology (operator ruling 2026-08-01) — Register
        // reaches COMPLETE only once the full wallet-mediated ceremony has
        // run, not merely on the pre-ceremony horizen_agent_registered receipt.
        principalRegistrationMandateSigned: hasReceipt('principal_registration_mandate_signed'),
        agentRegistryTransactionSigned: hasReceipt('agent_registry_transaction_signed'),
        horizenRegistrationSubmitted: hasReceipt('horizen_registration_submitted'),
        horizenRegistrationConfirmed: hasReceipt('horizen_registration_confirmed'),
        agentRegistryBindingRecorded: hasReceipt('agent_registry_binding_recorded'),
      },
      verify: {
        pulseAuthorizationVerified: hasReceipt('horizen_pulse_authorized'),
        pnlTransparencyEnabled: hasReceipt('horizen_pnl_transparency_enabled'),
        agentCardEnrichmentCommitted: hasReceipt('agent_card_enriched'),
      },
      claim: {
        controlProofFresh: hasReceipt('agent_control_proven'),
        marketaFinalRecommendation: hasReceipt('marketa_eligibility_recommended'),
      },
      passport: {
        operatorPolityCitizenPassportValid: hasReceipt('operator_passport_validated'),
        sponsorBinding: hasReceipt('agent_sponsorship_recorded'),
        delegatePassportIssued: hasReceipt('agent_delegate_passport_issued'),
      },
      delegate: {
        delegatePassportActive: hasReceipt('agent_delegate_passport_issued'),
        boundedDelegationActive: hasReceipt('agent_delegated'),
        contextualMandate: hasReceipt('agent_delegated'),
        bootstrapApproval: hasReceipt('finance_authoritative_execution'),
        aigentZObserverReceipt: hasReceipt('finance_authoritative_execution'),
        fsRuntimeActive: hasReceipt('finance_authoritative_execution'),
      },
      activate: {
        delegatePassportActive: hasReceipt('agent_delegate_passport_issued'),
        boundedDelegationActive: hasReceipt('agent_delegated'),
        standingGatewayEnabled: hasReceipt('standing_accrued'),
      },
      aigentme: {
        aigentMeActive: hasReceipt('aigentme_activated'),
        focusDispositionRecorded: hasReceipt('experienceqube_focus_disposition_recorded'),
        moneypennyRecordedAsDelegatedAgent: hasReceipt('agent_delegated'),
        evidenceChainComplete: hasReceipt('journey_completed'),
      },
    },
  };

  /*
   * ══ STAGE TRUTH, THEN STAGE EVIDENCE ═════════════════════════════════════
   *
   * Register's canonical outcome is the SETTLED FACT — not the ten receipts.
   * Several of those receipt types postdate Nakamoto's real registration (the
   * Wallet Signing Topology ruling introduced them on 2026-08-01), so they do
   * not exist for it and never will. Under the old single boolean that
   * unrecoverable paperwork gap rendered as "not registered". It is now what
   * it actually is: a canonically complete stage with partial evidence and
   * named audit gaps.
   */
  const storeUnavailable = authorizationStore ? authorizationStore.available === false : false;

  const verifyBlockers: BlockingReason[] = [];
  const verifyExceptions: ExceptionRecord[] = [];

  const eligibility = resolvePassportEligibility({
    registration: registration
      ? {
          registered: registration.registered,
          settled: registration.settled,
          tokenId: registration.tokenId,
          auditGaps: registration.auditGaps,
        }
      : null,
    principal: {
      // Receipt-derived, exactly as every other stage signal on this route.
      personhoodEstablished: hasReceipt('operator_passport_validated'),
      citizenPassportValid: hasReceipt('operator_passport_validated'),
    },
    claim: {
      controlProven: hasReceipt('agent_control_proven'),
      controlProofFresh: hasReceipt('agent_control_proven'),
      quarantined: hasReceipt('marketa_eligibility_quarantined'),
    },
    // Sponsorship is the sovereign human act the Passport stage exists for.
    requiredAuthorizations: [
      { id: 'sponsorship', label: 'sponsorship of this agent', granted: hasReceipt('agent_sponsorship_recorded') },
    ],
    ancillary: {
      pulseAuthorized: hasReceipt('horizen_pulse_authorized'),
      pnlDisclosureAuthorized: hasReceipt('horizen_pnl_transparency_enabled'),
      authorizationStoreAvailable: authorizationStore ? authorizationStore.available : undefined,
      authorizationStoreRemedy: authorizationStore && !authorizationStore.available ? authorizationStore.remedy : undefined,
      partnerMetadataComplete: registration ? registration.auditGaps.length === 0 : undefined,
    },
  });

  if (storeUnavailable && authorizationStore && !authorizationStore.available) {
    /*
     * VERIFY-ONLY. The same condition is a BLOCKER here (this is the act it
     * genuinely prevents) and a NON-BLOCKING EXCEPTION everywhere downstream
     * (it prevents no other act). One condition, two correct classifications
     * — which is only expressible because blockers and exceptions are
     * separate fields rather than one `blocking: boolean`.
     */
    verifyBlockers.push({
      code: 'authorization-store-unavailable',
      stageId: 'verify',
      summary: 'Local authorization store unavailable — the transparency authorization cannot be prepared in this deployment.',
      acts: [
        journeyAct('verify', 'apply-authorization-migration', 'apply-migration', 'Apply migration', authorizationStore.remedy),
        journeyAct('verify', 'reload-schema-cache', 'reload-schema-cache', 'Refresh schema', "NOTIFY pgrst, 'reload schema';"),
        journeyAct('verify', 'recheck-authorization-store', 're-check', 'Re-check'),
      ],
    });
    verifyExceptions.push(
      ...eligibility.nonBlockingExceptions.filter((e) => e.code === 'authorization-store-unavailable'),
    );
  }

  const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, platformState, {
    canonicalOutcomes: { register: registration?.registered === true },
    priorCanonicalStages: priorResolution?.canonicalStages ?? [],
    priorMilestones: priorResolution?.milestones ?? [],
    auditGaps: { register: registration?.auditGaps ?? [] },
    operationalBlockers: { verify: verifyBlockers, passport: eligibility.blockingReasons },
    nonBlockingExceptions: {
      verify: verifyExceptions,
      passport: eligibility.nonBlockingExceptions.filter((e) => e.blocksCurrentAct === false),
    },
    // The isolation. A missing local migration stops Verify and nothing else.
    nonBlockingIncompleteStages: storeUnavailable ? ['verify'] : [],
  });

  // Persist so refresh, persona change and route change all resolve the same
  // result. The write is itself monotonic — see recordJourneyResolution.
  try {
    const supabase = getSupabaseServer();
    if (supabase) {
      await recordJourneyResolution(supabase, agent.aigentQubeId, {
        journeyId: resolution.journeyId,
        journeyVersion: resolution.journeyVersion,
        subjectRef: resolution.subjectRef,
        canonicalStages: resolution.stages.filter((s) => s.canonicalOutcome).map((s) => s.stageId),
        milestones: resolution.milestones,
        highestMilestone: resolution.highestMilestone,
      });
    }
  } catch {
    // A failed record is an audit gap, never a reason to report less progress.
  }

  return NextResponse.json({
    ok: true,
    // Unchanged shape for every existing consumer — now carrying canonical
    // outcomes and gating relief, so the stepper and this route cannot
    // disagree (One-State Principle §5.3).
    state: resolution.runtimeState,
    resolution: {
      stages: resolution.stages,
      milestones: resolution.milestones,
      highestMilestone: resolution.highestMilestone,
      nextExecutableAct: resolution.nextExecutableAct,
      complete: resolution.complete,
    },
    passportEligibility: eligibility,
    agentCardResolved: !!agentCard,
  });
}
