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

  const runtimeState = resolveJourneyState(HORIZEN_MONEYPENNY_JOURNEY, platformState);

  return NextResponse.json({ ok: true, state: runtimeState, agentCardResolved: !!agentCard });
}
