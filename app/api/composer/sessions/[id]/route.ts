/**
 * Individual Session API
 * GET /api/composer/sessions/[id] - Get specific session
 * PUT /api/composer/sessions/[id] - Update session progress
 * POST /api/composer/sessions/[id]/complete - Complete session and create ExperienceQube
 */

import { NextRequest, NextResponse } from 'next/server';
import { composerService } from '@/services/composer/composerService';
import { getPipelineOrchestrator } from '@/services/pipeline/orchestrator';
import { resolveRuntimeIdentity } from '@/services/runtime/identityResolver';

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
        error: 'Session ID is required',
      }, { status: 400 });
    }

    const session = await composerService.getSession(id);

    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'Session not found or expired',
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      session,
    });

  } catch (error: any) {
    console.error('Composer session GET error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to retrieve session',
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
        error: 'Session ID is required',
      }, { status: 400 });
    }

    // Validate session exists
    const existingSession = await composerService.getSession(id);
    if (!existingSession) {
      return NextResponse.json({
        success: false,
        error: 'Session not found or expired',
      }, { status: 404 });
    }

    // Update session with new data
    const updatedSession = await composerService.updateSession(id, {
      current_step: body.current_step,
      data: body.data,
      status: body.status,
    });

    return NextResponse.json({
      success: true,
      session: updatedSession,
    });

  } catch (error: any) {
    console.error('Composer session PUT error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to update session',
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
        error: 'Session ID is required',
      }, { status: 400 });
    }

    if (body.action !== 'complete') {
      return NextResponse.json({
        success: false,
        error: 'Unsupported action. Use: { "action": "complete" }',
      }, { status: 400 });
    }

    // Resolve caller identity for pipeline tracking
    const identity = await resolveRuntimeIdentity({
      userId: body.userId,
      tenantId: body.tenantId,
    });

    const orchestrator = getPipelineOrchestrator();

    // Initiate pipeline run — throws if Supabase is unavailable (no silent fallback)
    const pipelineRun = await orchestrator.initiate({
      tenantId: identity.tenantId ?? body.tenantId ?? 'unknown',
      userId: identity.userId,
      personaId: identity.activePersonaId ?? body.personaId ?? 'unknown',
      agentId: body.agentId,
      initiatedVia: 'studio-composer',
      templateRef: body.templateRef,
      sourceOfTruth: identity.source,
      resolutionStatus: identity.activePersonaId ? 'resolved' : 'partial',
    });

    let experienceQube;
    try {
      await orchestrator.transition(pipelineRun.pipelineRunId, 'session.created');

      // Complete session and create ExperienceQube
      experienceQube = await composerService.completeSession(id);

      if (!experienceQube) {
        await orchestrator.fail(pipelineRun.pipelineRunId, 'Session not found or invalid');
        return NextResponse.json({
          success: false,
          error: 'Failed to complete session - session not found or invalid',
          pipelineRunId: pipelineRun.pipelineRunId,
        }, { status: 400 });
      }

      await orchestrator.transition(pipelineRun.pipelineRunId, 'bundle.generated', { experienceId: experienceQube.id });
      await orchestrator.complete(pipelineRun.pipelineRunId);
    } catch (completionError: any) {
      // Attempt to mark pipeline as failed; ignore secondary errors
      try { await orchestrator.fail(pipelineRun.pipelineRunId, completionError?.message ?? 'Unknown error'); } catch {}
      throw completionError;
    }

    console.log(`Completed composer session: ${id} -> ExperienceQube: ${experienceQube.id} (pipeline: ${pipelineRun.pipelineRunId})`);

    return NextResponse.json({
      success: true,
      experience_qube: experienceQube,
      session_id: id,
      pipeline_run_id: pipelineRun.pipelineRunId,
      completed_at: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Composer session complete POST error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to complete session',
    }, { status: 500 });
  }
}
