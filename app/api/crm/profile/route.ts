/**
 * CRM Unified Profile API
 * 
 * GET /api/crm/profile - Get unified profile for a Kybe DID (cross-tenant view)
 * GET /api/crm/profile?layers=true - Get account layers summary
 * 
 * This endpoint provides a unified view of a user's activity across ALL tenants
 * they participate in, respecting DiDQube privacy settings.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as crmService from '@/services/crm/crmService';
import * as db from '@/services/crm/crmDataAccess';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kybeDid = searchParams.get('kybeDid');
    const layers = searchParams.get('layers') === 'true';

    if (!kybeDid) {
      return NextResponse.json(
        { error: 'kybeDid is required' },
        { status: 400 }
      );
    }

    // If layers=true, return account layers summary
    if (layers) {
      const accountLayers = await db.getUserAccountLayers(kybeDid);
      
      return NextResponse.json({
        success: true,
        data: {
          kybeDid: accountLayers.kybeDid,
          hasPlatformAccount: !!accountLayers.platformAccount,
          platformAccountType: accountLayers.platformAccount?.accountType,
          hasRegistryProfile: !!accountLayers.registryProfile,
          franchiseCount: accountLayers.franchiseAccess.length,
          tenantCount: accountLayers.personaLinks.length,
          franchises: accountLayers.franchiseAccess.map(fa => ({
            franchiseId: fa.franchiseId,
            accessRole: fa.accessRole,
          })),
          tenants: accountLayers.personaLinks.map(pl => ({
            tenantId: pl.tenantId,
            personaId: pl.personaId,
            isPrimary: pl.isPrimaryForTenant,
          })),
        },
      });
    }

    // Get unified profile (cross-tenant view)
    const profile = await crmService.getUnifiedProfile(kybeDid);
    
    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found for this Kybe DID' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    console.error('[CRM API] GET /profile error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
