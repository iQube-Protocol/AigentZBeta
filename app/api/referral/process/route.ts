/**
 * API Route: Process Referral
 * POST /api/referral/process
 * 
 * Processes a referral at signup via FIO handle.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getReferralService } from '@/services/rewards/referralService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { newPersonaId, referrerHandle, referrerPersonaId, campaignId } = body;
    
    if (!newPersonaId) {
      return NextResponse.json({ error: 'newPersonaId is required' }, { status: 400 });
    }
    
    if (!referrerHandle && !referrerPersonaId) {
      return NextResponse.json({ 
        error: 'Either referrerHandle or referrerPersonaId is required' 
      }, { status: 400 });
    }
    
    const referralService = getReferralService();
    const result = await referralService.processReferral({
      newPersonaId,
      referrerHandle,
      referrerPersonaId,
      campaignId,
    });
    
    return NextResponse.json({
      success: result.success,
      referrerFound: result.referrerFound,
      referrerPersonaId: result.referrerPersonaId,
      referrerHandle: result.referrerHandle,
      error: result.error,
    });
  } catch (error) {
    console.error('[API] Error processing referral:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
