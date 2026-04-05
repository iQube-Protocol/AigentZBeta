/**
 * GET /api/content/entitlements?personaId=xxx
 * Returns all active content entitlements for a persona.
 * Used by SmartTriadProvider to populate ownedContentIds.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSmartContentService } from '@/services/content';

export async function GET(request: NextRequest) {
  try {
    const personaId = request.nextUrl.searchParams.get('personaId');

    if (!personaId) {
      return NextResponse.json(
        { success: false, error: 'Missing required query param: personaId' },
        { status: 400 }
      );
    }

    const service = getSmartContentService();
    const entitlements = await service.getEntitlementsByPersona(personaId);

    return NextResponse.json({
      success: true,
      data: entitlements,
    });
  } catch (error: any) {
    console.error('Failed to get entitlements:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
