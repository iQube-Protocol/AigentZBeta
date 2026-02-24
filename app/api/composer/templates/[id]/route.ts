/**
 * Individual Template API
 * GET /api/composer/templates/[id] - Get specific template
 */

import { NextRequest, NextResponse } from 'next/server';
import { composerService } from '@/services/composer/composerService';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Template ID is required',
      }, { status: 400 });
    }

    const template = await composerService.getTemplate(id);

    if (!template) {
      return NextResponse.json({
        success: false,
        error: 'Template not found',
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      template,
    });

  } catch (error: any) {
    console.error('Composer template GET error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to retrieve template',
    }, { status: 500 });
  }
}
