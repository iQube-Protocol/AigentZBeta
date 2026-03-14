/**
 * Composer ExperienceQubes API
 * POST /api/composer/experiences - Create new ExperienceQube
 * GET /api/composer/experiences - List ExperienceQubes
 */

import { NextRequest, NextResponse } from 'next/server';
import { composerService } from '@/services/composer/composerService';

export const runtime = 'nodejs';
export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  return NextResponse.json(body, { ...init, headers });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const required = ['tenant_id', 'creator_id', 'template_id', 'name', 'description'];
    for (const field of required) {
      if (!body[field]) {
        return jsonNoStore({
          success: false,
          error: `${field} is required`,
        }, { status: 400 });
      }
    }

    const experienceQube = await composerService.createExperienceQube({
      tenant_id: body.tenant_id,
      creator_id: body.creator_id,
      template_id: body.template_id,
      name: body.name,
      description: body.description,
      configuration: body.configuration || {},
    });

    console.log(`Created ExperienceQube: ${experienceQube.id} for tenant: ${body.tenant_id}`);

    return jsonNoStore({
      success: true,
      experience_qube: experienceQube,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Composer ExperienceQube POST error:', error);
    return jsonNoStore({
      success: false,
      error: error.message || 'Failed to create ExperienceQube',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const tenant_id = searchParams.get('tenant_id');
    const creator_id = searchParams.get('creator_id');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await composerService.listExperienceQubes({
      tenant_id: tenant_id || undefined,
      creator_id: creator_id || undefined,
      status: status || undefined,
      category: category || undefined,
      limit,
      offset,
    });

    return jsonNoStore({
      success: true,
      experience_qubes: result.items,
      total: result.total,
      limit,
      offset,
      filters: {
        tenant_id,
        creator_id,
        status,
        category,
      },
    });

  } catch (error: any) {
    console.error('Composer ExperienceQubes GET error:', error);
    return jsonNoStore({
      success: false,
      error: error.message || 'Failed to retrieve ExperienceQubes',
    }, { status: 500 });
  }
}
