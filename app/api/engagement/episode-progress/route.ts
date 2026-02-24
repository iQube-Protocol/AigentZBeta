/**
 * API Route: Episode Progress
 * POST /api/engagement/episode-progress
 * 
 * Records episode engagement events and triggers rewards.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEngagementService } from '@/services/rewards/engagementService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { personaId, episodeId, eventType, progressPercent, timeSpentSeconds, metadata } = body;
    
    if (!personaId || !episodeId || !eventType) {
      return NextResponse.json({ 
        error: 'personaId, episodeId, and eventType are required' 
      }, { status: 400 });
    }
    
    if (!['started', 'progress', 'completed'].includes(eventType)) {
      return NextResponse.json({ 
        error: 'eventType must be started, progress, or completed' 
      }, { status: 400 });
    }
    
    const engagementService = getEngagementService();
    const result = await engagementService.recordEngagement({
      personaId,
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
