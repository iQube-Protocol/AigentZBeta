/**
 * Content Library Item API
 * 
 * PATCH /api/content/library/[personaId]/[contentId] - Update library item
 * DELETE /api/content/library/[personaId]/[contentId] - Remove from library
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLibraryService } from '@/services/content';

interface RouteParams {
  params: Promise<{ personaId: string; contentId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { personaId, contentId } = await params;
    const body = await request.json();
    
    const service = getLibraryService();
    let result;
    
    // Handle different update types
    if (body.progressPercentage !== undefined) {
      result = await service.updateProgress({
        personaId,
        contentId,
        progressPercentage: body.progressPercentage,
        timeSpentSeconds: body.timeSpentSeconds,
      });
    } else if (body.toggleFavorite) {
      result = await service.toggleFavorite(personaId, contentId);
    } else if (body.rating !== undefined) {
      result = await service.setRating(personaId, contentId, body.rating);
    } else if (body.notes !== undefined) {
      result = await service.setNotes(personaId, contentId, body.notes);
    } else if (body.shelfName) {
      result = await service.moveToShelf(personaId, contentId, body.shelfName, body.customShelfId);
    } else {
      return NextResponse.json(
        { success: false, error: 'No valid update fields provided' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Failed to update library item:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { personaId, contentId } = await params;
    
    const service = getLibraryService();
    const success = await service.removeFromLibrary(personaId, contentId);
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to remove from library' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Removed from library',
    });
  } catch (error: any) {
    console.error('Failed to remove from library:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
