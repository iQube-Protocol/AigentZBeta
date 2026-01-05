/**
 * API Route: Referral Stats
 * GET /api/referral/stats?personaId=xxx
 * 
 * Gets referral statistics for a persona.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getReferralService } from '@/services/rewards/referralService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');
    
    if (!personaId) {
      return NextResponse.json({ error: 'personaId is required' }, { status: 400 });
    }
    
    const referralService = getReferralService();
    const stats = await referralService.getReferralStats(personaId);
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('[API] Error fetching referral stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
