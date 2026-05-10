/**
 * API Route: Episode Progress — spine-conformant
 * POST /api/engagement/episode-progress
 *
 * Records episode engagement events for Knight-of-Attention task chain
 * (decisions doc §3 + ops backlog §2). Persona resolved via the spine
 * via getActivePersona — body.personaId is no longer trusted (T0 leak
 * + spoof risk).
 *
 * On 'completed' events, engagementService.recordEngagement creates a
 * crm_rewards row with status='approved' which the Phase D
 * /api/wallet/knyt/rewards/redeem endpoint redeems through the spine.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEngagementService } from '@/services/rewards/engagementService';
import { getActivePersona } from '@/services/identity/getActivePersona';

export async function POST(request: NextRequest) {
  try {
    const persona = await getActivePersona(request);
    if (!persona) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { episodeId, eventType, progressPercent, timeSpentSeconds, metadata } = body;

    if (!episodeId || !eventType) {
      return NextResponse.json({
        error: 'episodeId and eventType are required',
      }, { status: 400 });
    }

    if (!['started', 'progress', 'completed'].includes(eventType)) {
      return NextResponse.json({
        error: 'eventType must be started, progress, or completed',
      }, { status: 400 });
    }

    const engagementService = getEngagementService();
    const result = await engagementService.recordEngagement({
      personaId: persona.personaId,
      episodeId,
      eventType,
      progressPercent,
      timeSpentSeconds,
      metadata,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      eventId: result.eventId,
      rewardTriggered: result.rewardTriggered,
      rewardAmount: result.rewardAmount,
    });
  } catch (error) {
    console.error('[API] Error recording engagement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
