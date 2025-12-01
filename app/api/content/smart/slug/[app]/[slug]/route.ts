/**
 * Smart Content by Slug API
 * 
 * GET /api/content/smart/slug/[app]/[slug] - Get content by app and slug
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSmartContentService } from '@/services/content';
import type { SmartContentApp } from '@/types/smartContent';

interface RouteParams {
  params: Promise<{ app: string; slug: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { app, slug } = await params;
    
    const service = getSmartContentService();
    const content = await service.getBySlug(app as SmartContentApp, slug);
    
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
    console.error('Failed to get content by slug:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
