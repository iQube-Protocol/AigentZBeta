/**
 * Composer Templates API
 * GET /api/composer/templates - List available templates
 * GET /api/composer/templates/[id] - Get specific template
 */

import { NextRequest, NextResponse } from 'next/server';
import { composerService } from '@/services/composer/composerService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const category = searchParams.get('category');
    const complexity = searchParams.get('complexity');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const templates = await composerService.getTemplates(
      category || undefined,
      complexity || undefined
    );

    // Apply pagination
    const paginated = templates.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      templates: paginated,
      total: templates.length,
      limit,
      offset,
      filters: {
        category,
        complexity,
      },
    });

  } catch (error: any) {
    console.error('Composer templates GET error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to retrieve templates',
    }, { status: 500 });
  }
}
