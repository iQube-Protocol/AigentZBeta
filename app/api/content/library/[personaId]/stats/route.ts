/**
 * Library Statistics API
 * 
 * GET /api/content/library/[personaId]/stats - Get library statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLibraryService } from '@/services/content';

interface RouteParams {
  params: Promise<{ personaId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { personaId } = await params;
    
    const service = getLibraryService();
    const stats = await service.getStats(personaId);
    
    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Failed to get library stats:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
