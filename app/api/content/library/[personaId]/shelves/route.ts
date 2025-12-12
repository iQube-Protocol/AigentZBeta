/**
 * User Shelves API
 * 
 * GET /api/content/library/[personaId]/shelves - Get user's shelves
 * POST /api/content/library/[personaId]/shelves - Create custom shelf
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
    const shelves = await service.getShelves(personaId);
    
    return NextResponse.json({
      success: true,
      data: shelves,
    });
  } catch (error: any) {
    console.error('Failed to get shelves:', error);
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
    
    const { name, description, coverImageUri, isPublic } = body;
    
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: name' },
        { status: 400 }
      );
    }
    
    const service = getLibraryService();
    const shelf = await service.createShelf({
      personaId,
      name,
      description,
      coverImageUri,
      isPublic,
    });
    
    return NextResponse.json({
      success: true,
      data: shelf,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create shelf:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
