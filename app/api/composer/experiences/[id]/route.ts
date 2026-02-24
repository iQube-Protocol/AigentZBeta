/**
 * Individual ExperienceQube API
 * GET /api/composer/experiences/[id] - Get specific ExperienceQube
 * PUT /api/composer/experiences/[id] - Update ExperienceQube
 * DELETE /api/composer/experiences/[id] - Delete ExperienceQube
 * POST /api/composer/experiences/[id]/validate - Validate ExperienceQube configuration
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
        error: 'ExperienceQube ID is required',
      }, { status: 400 });
    }

    const experienceQube = await composerService.getExperienceQube(id);

    if (!experienceQube) {
      return NextResponse.json({
        success: false,
        error: 'ExperienceQube not found',
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      experience_qube: experienceQube,
    });

  } catch (error: any) {
    console.error('Composer ExperienceQube GET error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to retrieve ExperienceQube',
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ExperienceQube ID is required',
      }, { status: 400 });
    }

    // Validate ExperienceQube exists
    const existingExperience = await composerService.getExperienceQube(id);
    if (!existingExperience) {
      return NextResponse.json({
        success: false,
        error: 'ExperienceQube not found',
      }, { status: 404 });
    }

    // Update allowed fields only
    const allowedUpdates = {
      name: body.name ?? existingExperience.name,
      description: body.description ?? existingExperience.description,
      goal: body.goal ?? existingExperience.goal,
      mechanics: body.mechanics ?? existingExperience.mechanics,
      metrics: body.metrics ?? existingExperience.metrics,
      template_id: body.template_id ?? existingExperience.template_id,
      status: body.status ?? existingExperience.status,
      configuration: body.configuration ?? existingExperience.configuration,
      components: body.components ?? existingExperience.components,
      execution: body.execution ?? existingExperience.execution,
      access: body.access ?? existingExperience.access,
      metadata: {
        ...existingExperience.metadata,
        ...body.metadata,
        tags: body.metadata?.tags || (existingExperience.metadata as any).tags,
      },
    };

    const updatedExperience = await composerService.updateExperienceQube(id, allowedUpdates);

    return NextResponse.json({
      success: true,
      experience_qube: updatedExperience,
    });

  } catch (error: any) {
    console.error('Composer ExperienceQube PUT error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to update ExperienceQube',
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ExperienceQube ID is required',
      }, { status: 400 });
    }

    const deleted = await composerService.deleteExperienceQube(id);

    if (!deleted) {
      return NextResponse.json({
        success: false,
        error: 'ExperienceQube not found',
      }, { status: 404 });
    }

    console.log(`Deleted ExperienceQube: ${id}`);

    return NextResponse.json({
      success: true,
      message: 'ExperienceQube deleted successfully',
      experience_qube_id: id,
    });

  } catch (error: any) {
    console.error('Composer ExperienceQube DELETE error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to delete ExperienceQube',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ExperienceQube ID is required',
      }, { status: 400 });
    }

    if (body.action === 'validate') {
      const experienceQube = await composerService.getExperienceQube(id);
      
      if (!experienceQube) {
        return NextResponse.json({
          success: false,
          error: 'ExperienceQube not found',
        }, { status: 404 });
      }

      const validation = await composerService.validateConfiguration(
        experienceQube.template_id,
        experienceQube.configuration
      );

      return NextResponse.json({
        success: true,
        validation,
        experience_qube_id: id,
        validated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Unsupported action. Use: { "action": "validate" }',
    }, { status: 400 });

  } catch (error: any) {
    console.error('Composer ExperienceQube POST error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to process ExperienceQube request',
    }, { status: 500 });
  }
}
