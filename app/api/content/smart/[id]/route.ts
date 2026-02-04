/**
 * Smart Content API - Single Item Operations
 * 
 * GET /api/content/smart/[id] - Get content by ID
 * PATCH /api/content/smart/[id] - Update content
 * DELETE /api/content/smart/[id] - Soft delete content
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSmartContentService } from '@/services/content';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const service = getSmartContentService();
    const content = await service.getById(id);
    
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Content not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: content,
    });
  } catch (error: any) {
    console.error('Failed to get smart content:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const service = getSmartContentService();
    
    // Check if content exists
    const existing = await service.getById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Content not found' },
        { status: 404 }
      );
    }
    
    const content = await service.update(id, body);
    
    return NextResponse.json({
      success: true,
      data: content,
    });
  } catch (error: any) {
    console.error('Failed to update smart content:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const service = getSmartContentService();
    
    const success = await service.delete(id);
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete content' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Content deleted',
    });
  } catch (error: any) {
    console.error('Failed to delete smart content:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
