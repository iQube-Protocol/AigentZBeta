/**
 * Content Entitlement API
 * 
 * GET /api/content/pricing/[contentId]/entitlement - Check entitlement
 * POST /api/content/pricing/[contentId]/entitlement - Grant entitlement
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSmartContentService } from '@/services/content';

interface RouteParams {
  params: Promise<{ contentId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { contentId } = await params;
    const { searchParams } = new URL(request.url);
    
    const personaId = searchParams.get('personaId');
    
    if (!personaId) {
      return NextResponse.json(
        { success: false, error: 'Missing required query param: personaId' },
        { status: 400 }
      );
    }
    
    const service = getSmartContentService();
    const entitlement = await service.checkEntitlement(contentId, personaId);
    
    return NextResponse.json({
      success: true,
      data: {
        hasAccess: entitlement !== null,
        entitlement,
      },
    });
  } catch (error: any) {
    console.error('Failed to check entitlement:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { contentId } = await params;
    const body = await request.json();
    
    const { personaId, rootDid, scope, acquiredVia, txHash, chainId, expiresAt, maxUsage } = body;
    
    if (!personaId || !scope || !acquiredVia) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: personaId, scope, acquiredVia' },
        { status: 400 }
      );
    }
    
    const service = getSmartContentService();
    const entitlement = await service.grantEntitlement({
      contentId,
      personaId,
      rootDid,
      scope,
      acquiredVia,
      txHash,
      chainId,
      expiresAt,
      maxUsage,
    });

    // Auto-add to library so the item appears in the user's library as owned
    await service.addToLibrary({ personaId, contentId }).catch(() => {
      // Non-fatal: entitlement is the source of truth; library add is best-effort
    });

    return NextResponse.json({
      success: true,
      data: entitlement,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to grant entitlement:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
