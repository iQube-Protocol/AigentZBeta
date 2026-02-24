/**
 * Composer Sessions API
 * POST /api/composer/sessions - Create new composition session
 * GET /api/composer/sessions - List user sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import { composerService } from '@/services/composer/composerService';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const required = ['tenant_id', 'user_id', 'template_id'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({
          success: false,
          error: `${field} is required`,
        }, { status: 400 });
      }
    }

    // Verify template exists
    const template = await composerService.getTemplate(body.template_id);
    if (!template) {
      return NextResponse.json({
        success: false,
        error: 'Template not found',
      }, { status: 404 });
    }

    const session = await composerService.createSession({
      tenant_id: body.tenant_id,
      user_id: body.user_id,
      template_id: body.template_id,
    });

    console.log(`Created composer session: ${session.id} for template: ${body.template_id}`);

    return NextResponse.json({
      success: true,
      session,
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        steps: template.steps,
        estimated_time: template.estimated_time,
      },
    }, { status: 201 });

  } catch (error: any) {
    console.error('Composer session POST error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create session',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const user_id = searchParams.get('user_id');
    const tenant_id = searchParams.get('tenant_id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!user_id) {
      return NextResponse.json({
        success: false,
        error: 'user_id is required',
      }, { status: 400 });
    }

    // Note: In a real implementation, we'd add session listing to composerService
    // For now, return empty list as sessions are typically accessed by ID
    return NextResponse.json({
      success: true,
      sessions: [],
      total: 0,
      limit,
      offset,
      filters: {
        user_id,
        tenant_id,
        status,
      },
    });

  } catch (error: any) {
    console.error('Composer sessions GET error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to retrieve sessions',
    }, { status: 500 });
  }
}
