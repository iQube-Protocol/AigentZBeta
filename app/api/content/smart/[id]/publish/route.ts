/**
 * Smart Content Publish API
 * 
 * POST /api/content/smart/[id]/publish - Publish content
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSmartContentService } from '@/services/content';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const service = getSmartContentService();
    
    // Check if content exists
    const existing = await service.getById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Content not found' },
        { status: 404 }
      );
    }
    
    if (existing.status === 'published') {
      return NextResponse.json(
        { success: false, error: 'Content is already published' },
        { status: 400 }
      );
    }
    
    const content = await service.publish(id);
    
    return NextResponse.json({
      success: true,
      data: content,
      message: 'Content published successfully',
    });
  } catch (error: any) {
    console.error('Failed to publish smart content:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
