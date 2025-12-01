/**
 * Content Recommendations API
 * 
 * GET /api/content/library/[personaId]/recommendations - Get personalized recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLibraryService, type DiscoveryResult } from '@/services/content';

interface RouteParams {
  params: Promise<{ personaId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { personaId } = await params;
    const { searchParams } = new URL(request.url);
    
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10;
    const source = searchParams.get('source') as DiscoveryResult['source'] | undefined;
    
    const service = getLibraryService();
    const recommendations = await service.getRecommendations(personaId, {
      limit,
      source,
    });
    
    return NextResponse.json({
      success: true,
      data: recommendations,
    });
  } catch (error: any) {
    console.error('Failed to get recommendations:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
