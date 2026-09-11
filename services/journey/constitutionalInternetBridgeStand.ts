/**
 * constitutionalInternetBridgeStand — the Constitutional Internet Bridge's
 * STAND stage data, built to be HONEST about what Standing actually is.
 *
 * The KNYTS Bridge's own STAND panel (knytsBridgeStand.ts,
 * KnytsBridgeStandPanel.tsx) is a thin, self-documented projection over KNYT
 * engagement counters (reactions, shares, remix lineage) — its own docstring
 * admits it is "never a unified reward ledger or Standing score," yet its
 * UI copy calls those counters "Standing" anyway. This module does not
 * repeat that mistake: it reads the CANONICAL Standing pipeline
 * (services/standing/standingScore.ts's computeStandingScore, which reduces
 * VSP veracity facts + crm_persona_reputation contribution accrual to one
 * real score) and separately surfaces the real, DVN-anchorable receipts a
 * brand-new visitor already has — `passport_issued` and
 * `experienceqube_focus_disposition_recorded` — as "constitutional events
 * recorded," never as a Standing score in themselves.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { listActivityReceiptsForPersona } from '@/services/receipts/activityReceiptService';
import { computeStandingScore, type StandingScoreBreakdown } from '@/services/standing/standingScore';
import { CI_BRIDGE_RUNTIME_AGENT_ID, CI_BRIDGE_DISPOSITION_CONTEXT } from '@/services/journey/constitutionalInternetBridgeJourney';

export interface ConstitutionalEvent {
  actionType: string;
  summary: string;
  occurredAt: string | null;
}

export interface ConstitutionalInternetBridgeStand {
  events: ConstitutionalEvent[];
  standing: StandingScoreBreakdown;
}

export async function getConstitutionalInternetBridgeStand(
  admin: SupabaseClient,
  personaId: string,
): Promise<ConstitutionalInternetBridgeStand> {
  const events: ConstitutionalEvent[] = [];

  // Passport crossing — real, DVN-anchorable receipt (see
  // services/passport/issuanceService.ts's writeReceipt).
  const passportReceipts = await listActivityReceiptsForPersona(personaId, {
    actionTypes: ['passport_issued'],
    limit: 1,
  });
  if (passportReceipts.length > 0) {
    events.push({
      actionType: 'passport_issued',
      summary: 'Your Passport was issued — you are constitutionally present in the Polity.',
      occurredAt: passportReceipts[0].createdAt ?? null,
    });
  }

  // Agent disposition — scoped to THIS journey's own agent + context, so a
  // Horizen/MoneyPenny disposition never counts as a CI Bridge event.
  const dispositionReceipts = await listActivityReceiptsForPersona(personaId, {
    actionTypes: ['experienceqube_focus_disposition_recorded'],
    agentsInvoked: [CI_BRIDGE_RUNTIME_AGENT_ID],
    limit: 5,
  });
  const ciDisposition = dispositionReceipts.find(
    (r) => (r.actionInput as { context?: string } | null)?.context === CI_BRIDGE_DISPOSITION_CONTEXT,
  );
  if (ciDisposition) {
    events.push({
      actionType: 'experienceqube_focus_disposition_recorded',
      summary: 'You recorded a disposition toward your agent relationship.',
      occurredAt: ciDisposition.createdAt ?? null,
    });
  }

  const standing = await computeStandingScore(admin, personaId);

  return { events, standing };
}
