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
import { listActivityReceiptsForPersona, type ActivityActionType } from '@/services/receipts/activityReceiptService';
import { resolveJourneyState, type AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';

export const dynamic = 'force-dynamic';

const MONEYPENNY_FIO_HANDLE = 'moneypenny@aigent';

const JOURNEY_ACTION_TYPES: ActivityActionType[] = [
  'agent_card_discovered',
  'horizen_agent_registered',
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

  let agentCard: Record<string, unknown> | null = null;
  try {
    const res = await fetch(`${origin}/api/agents/moneypenny/agent-card.json`, { cache: 'no-store' });
    if (res.ok) agentCard = await res.json();
  } catch {
    // Soft-fail — Agent Card unreachable, Register stage stays evidence-incomplete.
  }

  const receiptRefs: Record<string, string[]> = {};
  try {
    const supabase = getSupabaseServer();
    const { data: persona } = await supabase
      .from('personas')
      .select('id')
      .ilike('fio_handle', MONEYPENNY_FIO_HANDLE)
      .maybeSingle();

    if (persona?.id) {
      const receipts = await listActivityReceiptsForPersona(persona.id, {
        actionTypes: JOURNEY_ACTION_TYPES,
        limit: 100,
      });
      for (const receipt of receipts) {
        (receiptRefs[receipt.actionType] ??= []).push(receipt.id);
      }
    }
  } catch {
    // Soft-fail — receipts unavailable, journey stays at its currently-evidenced state.
  }

  const hasReceipt = (type: ActivityActionType) => (receiptRefs[type]?.length ?? 0) > 0;
  const horizen = (agentCard?.metadata as Record<string, unknown> | undefined)?.horizen as
    | Record<string, unknown>
    | undefined;

  const platformState: AuthoritativePlatformState = {
    receiptRefs,
    stages: {
      register: {
        tokenId: (horizen?.tokenId as string | null) ?? null,
        registryRereadOk: hasReceipt('horizen_agent_registered'),
        ownerWalletMatches: hasReceipt('horizen_agent_registered'),
        agentCardResolves: !!agentCard,
      },
      verify: {
        pulseAuthorizationVerified: hasReceipt('horizen_pnl_transparency_enabled'),
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
