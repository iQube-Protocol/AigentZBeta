/**
 * GET /api/journey/knyts-bridge/campaign-summary
 *
 * KNYTS Bridge campaign activation, Gate D — makes the three independent
 * outputs (Reputation/Standing/Knightcoin) legible together for the active
 * persona without collapsing their semantics (spec §11).
 *
 * Reads only from `knyts_bridge_campaign_evidence` — the applied_at columns
 * on that ledger are already the record of what was actually credited, so
 * this is a pure read/aggregation, no new write path.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getCrmClient } from '@/services/crm/crmDataAccess';
import { KNYTS_BRIDGE_REWARD_MATRIX } from '@/services/journey/knytsBridgeCampaignConfig';
import type { KnytsBridgeCampaignActionType } from '@/services/journey/knytsBridgeCampaignConfig';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const persona = await getActivePersona(req).catch(() => null);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'authentication-required' }, { status: 401 });
    }

    const client = getCrmClient();
    const { data: rows, error } = await client
      .from('knyts_bridge_campaign_evidence')
      .select('action_type, reputation_applied_at, standing_applied_at, reward_applied_at, reward_amount_knyt, created_at')
      .eq('persona_id', persona.personaId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    let reputationEarned = 0;
    let standingEvidenceCount = 0;
    let knytcoinEarned = 0;
    const recentActions: Array<{ actionType: string; occurredAt: string }> = [];

    for (const r of rows ?? []) {
      const row = r as Record<string, unknown>;
      const actionType = row.action_type as KnytsBridgeCampaignActionType;
      const rule = KNYTS_BRIDGE_REWARD_MATRIX[actionType];
      if (row.reputation_applied_at && rule) reputationEarned += rule.reputationDelta;
      if (row.standing_applied_at) standingEvidenceCount += 1;
      if (row.reward_applied_at) knytcoinEarned += Number(row.reward_amount_knyt ?? 0);
      recentActions.push({ actionType, occurredAt: row.created_at as string });
    }

    recentActions.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));

    return NextResponse.json({
      ok: true,
      summary: {
        reputationEarned,
        standingEvidenceCount,
        knytcoinEarned,
        recentActions: recentActions.slice(0, 10),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
