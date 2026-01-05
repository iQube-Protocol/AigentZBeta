/**
 * API Route: Check Entitlement
 * GET /api/entitlements/check?personaId=xxx&assetId=yyy
 * 
 * Checks if a persona has access to a specific asset.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEntitlementService } from '@/services/rewards/entitlementService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');
    const assetId = searchParams.get('assetId');
    
    if (!personaId || !assetId) {
      return NextResponse.json({ error: 'personaId and assetId are required' }, { status: 400 });
    }
    
    const entitlementService = getEntitlementService();
    const result = await entitlementService.checkAccess(personaId, assetId);
    
    return NextResponse.json({
      personaId,
      assetId,
      hasAccess: result.hasAccess,
      entitlement: result.entitlement,
      reason: result.reason,
    });
  } catch (error) {
    console.error('[API] Error checking entitlement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
