/**
 * Content Library API - User's Library
 * 
 * GET /api/content/library/[personaId] - Get user's library
 * POST /api/content/library/[personaId] - Add content to library
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLibraryService } from '@/services/content';
import type { SmartContentApp } from '@/types/smartContent';

interface RouteParams {
  params: Promise<{ personaId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { personaId } = await params;
    const { searchParams } = new URL(request.url);
    
    const options = {
      shelfName: searchParams.get('shelf') || undefined,
      app: searchParams.get('app') as SmartContentApp | undefined,
      category: searchParams.get('category') || undefined,
      completed: searchParams.get('completed') === 'true' ? true : 
                 searchParams.get('completed') === 'false' ? false : undefined,
      favorite: searchParams.get('favorite') === 'true' ? true : undefined,
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') as 'addedAt' | 'lastAccessedAt' | 'title' | 'progress' | 'rating' | undefined,
      sortOrder: searchParams.get('sortOrder') as 'asc' | 'desc' | undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    };
    
    const service = getLibraryService();
    const result = await service.getLibrary(personaId, options);
    
    return NextResponse.json({
      success: true,
      data: result.items,
      total: result.total,
      limit: options.limit,
      offset: options.offset,
    });
  } catch (error: any) {
    console.error('Failed to get library:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { personaId } = await params;
    const body = await request.json();
    
    const { contentId, shelfName, customShelfId } = body;
    
    if (!contentId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: contentId' },
        { status: 400 }
      );
    }
    
    const service = getLibraryService();
    const item = await service.addToLibrary({
      personaId,
      contentId,
      shelfName,
      customShelfId,
    });
    
    return NextResponse.json({
      success: true,
      data: item,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to add to library:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
