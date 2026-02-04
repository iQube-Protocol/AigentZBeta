/**
 * Series Content API
 * 
 * GET /api/content/smart/series/[seriesId] - Get all content in a series
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSmartContentService, getLibraryService } from '@/services/content';

interface RouteParams {
  params: Promise<{ seriesId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { seriesId } = await params;
    const { searchParams } = new URL(request.url);
    
    const personaId = searchParams.get('personaId') || undefined;
    
    const service = getSmartContentService();
    const contents = await service.getSeriesContent(seriesId);
    
    // Optionally include user progress
    let progress = null;
    if (personaId) {
      const libraryService = getLibraryService();
      progress = await libraryService.getSeriesProgress(personaId, seriesId);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        seriesId,
        contents,
        progress,
      },
    });
  } catch (error: any) {
    console.error('Failed to get series content:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
