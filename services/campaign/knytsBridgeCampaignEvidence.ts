/**
 * KNYTS Bridge campaign evidence ledger (Gate A) — the dedupe/idempotency
 * source of truth for the campaign activation
 * (`KNYT_BRIDGE_CAMPAIGN_IMPLEMENTATION_SPEC_CLAUDE_CODE.md` §5-6).
 *
 * Writes to the additive `knyts_bridge_campaign_evidence` table (migration
 * `20260930003200_knyts_bridge_campaign_activation.sql`) — see that
 * migration's header comment for why this is a new table rather than an
 * extension of the existing, shared `campaign_events`/`campaign_states`
 * (persona_id NOT NULL there; three other live campaigns depend on it).
 *
 * Whenever a persona IS known, this also dual-writes into the existing
 * `recordCampaignEvent()` (services/campaign/campaignService.ts) so the
 * already-registered 'knyts-bridge-crossing' campaignRegistry share-reward
 * threshold wiring (clicks/signups/conversions) keeps working unmodified.
 */

import { getCrmClient } from '@/services/crm/crmDataAccess';
import { recordCampaignEvent } from '@/services/campaign/campaignService';
import { KNYTS_BRIDGE_CAMPAIGN_ID } from '@/services/journey/knytsBridgeCrossingJourney';
import type { KnytsBridgeCampaignActionType } from '@/services/journey/knytsBridgeCampaignConfig';

export type EvidenceGrade = 'observed' | 'verified' | 'attested' | 'external-confirmed';

export interface RecordEvidenceInput {
  actionType: KnytsBridgeCampaignActionType;
  idempotencyKey: string;
  personaId?: string | null;
  crmPersonaId?: string | null;
  normalizedEmail?: string | null;
  investorKnown?: boolean;
  evidenceGrade?: EvidenceGrade;
  sourceSurface?: string;
  externalRef?: string | null;
  contentId?: string | null;
  referrerPersonaId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface KnytsBridgeEvidenceRow {
  id: string;
  actionType: KnytsBridgeCampaignActionType;
  personaId: string | null;
  crmPersonaId: string | null;
  normalizedEmail: string | null;
  investorKnown: boolean;
  evidenceGrade: EvidenceGrade;
  contentId: string | null;
  metadata: Record<string, unknown> | null;
  reputationAppliedAt: string | null;
  standingAppliedAt: string | null;
  rewardAppliedAt: string | null;
  createdAt: string;
}

export interface RecordEvidenceResult {
  isNew: boolean;
  evidence: KnytsBridgeEvidenceRow;
}

function rowToEvidence(row: Record<string, unknown>): KnytsBridgeEvidenceRow {
  return {
    id: row.id as string,
    actionType: row.action_type as KnytsBridgeCampaignActionType,
    personaId: (row.persona_id as string) ?? null,
    crmPersonaId: (row.crm_persona_id as string) ?? null,
    normalizedEmail: (row.normalized_email as string) ?? null,
    investorKnown: Boolean(row.investor_known),
    evidenceGrade: (row.evidence_grade as EvidenceGrade) ?? 'observed',
    contentId: (row.content_id as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? null,
    reputationAppliedAt: (row.reputation_applied_at as string) ?? null,
    standingAppliedAt: (row.standing_applied_at as string) ?? null,
    rewardAppliedAt: (row.reward_applied_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

/**
 * Record one campaign evidence event, idempotently. Repeated calls with the
 * same idempotencyKey return the ORIGINAL row (`isNew: false`) rather than
 * creating a duplicate or re-running downstream accrual.
 */
export async function recordKnytsBridgeEvidence(input: RecordEvidenceInput): Promise<RecordEvidenceResult> {
  const client = getCrmClient();

  // Settled-fact idempotency: check before writing (same idiom as
  // services/journey/agentRegistryActivation.ts::ensureAgentRegistryActivation).
  const { data: existing } = await client
    .from('knyts_bridge_campaign_evidence')
    .select('*')
    .eq('campaign_id', KNYTS_BRIDGE_CAMPAIGN_ID)
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle();
  if (existing) {
    return { isNew: false, evidence: rowToEvidence(existing as Record<string, unknown>) };
  }

  const insertPayload = {
    campaign_id: KNYTS_BRIDGE_CAMPAIGN_ID,
    action_type: input.actionType,
    idempotency_key: input.idempotencyKey,
    persona_id: input.personaId ?? null,
    crm_persona_id: input.crmPersonaId ?? null,
    normalized_email: input.normalizedEmail ?? null,
    investor_known: input.investorKnown ?? false,
    evidence_grade: input.evidenceGrade ?? 'observed',
    source_surface: input.sourceSurface ?? null,
    external_ref: input.externalRef ?? null,
    content_id: input.contentId ?? null,
    referrer_persona_id: input.referrerPersonaId ?? null,
    metadata: input.metadata ?? null,
  };

  const { data: inserted, error: insertError } = await client
    .from('knyts_bridge_campaign_evidence')
    .insert(insertPayload)
    .select('*')
    .single();

  if (insertError || !inserted) {
    // A concurrent insert may have raced us past the read-check above — the
    // unique index on (campaign_id, idempotency_key) is the real guarantee;
    // re-read rather than surface a spurious duplicate-key error.
    const { data: raced } = await client
      .from('knyts_bridge_campaign_evidence')
      .select('*')
      .eq('campaign_id', KNYTS_BRIDGE_CAMPAIGN_ID)
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle();
    if (raced) return { isNew: false, evidence: rowToEvidence(raced as Record<string, unknown>) };
    throw new Error(
      `[knytsBridgeCampaignEvidence] failed to record evidence: ${insertError?.message ?? 'unknown error'}`,
    );
  }

  // Dual-write into the existing generic campaign progress mechanism
  // whenever a persona is known, so the campaignRegistry.ts share-reward
  // threshold wiring already registered for this campaign id continues to
  // observe these events exactly as before this activation.
  if (input.personaId) {
    try {
      const { eventId } = await recordCampaignEvent({
        campaignId: KNYTS_BRIDGE_CAMPAIGN_ID,
        eventType: input.actionType,
        personaId: input.personaId,
        referrerPersonaId: input.referrerPersonaId ?? null,
        contentId: input.contentId ?? null,
        source: input.sourceSurface ?? null,
        metadata: input.metadata ?? null,
      });
      if (eventId) {
        await client
          .from('knyts_bridge_campaign_evidence')
          .update({ dual_write_event_id: eventId })
          .eq('id', (inserted as Record<string, unknown>).id as string);
      }
    } catch (err) {
      console.error('[knytsBridgeCampaignEvidence] dual-write to campaign_events failed (non-fatal):', err);
    }
  }

  return { isNew: true, evidence: rowToEvidence(inserted as Record<string, unknown>) };
}

/** Mark the reputation leg as applied (idempotency for the projector). */
export async function markReputationApplied(evidenceId: string): Promise<void> {
  const client = getCrmClient();
  await client
    .from('knyts_bridge_campaign_evidence')
    .update({ reputation_applied_at: new Date().toISOString() })
    .eq('id', evidenceId)
    .is('reputation_applied_at', null);
}

/** Mark the Standing leg — applied, or withheld with a named reason. */
export async function markStandingOutcome(
  evidenceId: string,
  outcome: { applied: true } | { applied: false; reason: string },
): Promise<void> {
  const client = getCrmClient();
  if (outcome.applied) {
    await client
      .from('knyts_bridge_campaign_evidence')
      .update({ standing_applied_at: new Date().toISOString(), standing_withheld_reason: null })
      .eq('id', evidenceId)
      .is('standing_applied_at', null);
  } else {
    await client
      .from('knyts_bridge_campaign_evidence')
      .update({ standing_withheld_reason: outcome.reason })
      .eq('id', evidenceId)
      .is('standing_applied_at', null);
  }
}

/** Mark the reward leg as applied, recording the amount actually credited. */
export async function markRewardApplied(evidenceId: string, amountKnyt: number): Promise<void> {
  const client = getCrmClient();
  await client
    .from('knyts_bridge_campaign_evidence')
    .update({ reward_applied_at: new Date().toISOString(), reward_amount_knyt: amountKnyt })
    .eq('id', evidenceId)
    .is('reward_applied_at', null);
}
