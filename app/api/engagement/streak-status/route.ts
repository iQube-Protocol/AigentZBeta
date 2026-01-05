/**
 * API Route: Streak Status
 * GET /api/engagement/streak-status?personaId=xxx
 * 
 * Gets weekly streak status for a persona.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEngagementService } from '@/services/rewards/engagementService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');
    
    if (!personaId) {
      return NextResponse.json({ error: 'personaId is required' }, { status: 400 });
    }
    
    const engagementService = getEngagementService();
    const status = await engagementService.getStreakStatus(personaId);
    
    return NextResponse.json(status);
  } catch (error) {
    console.error('[API] Error fetching streak status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
