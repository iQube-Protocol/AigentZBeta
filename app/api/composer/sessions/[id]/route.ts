/**
 * Individual Session API
 * GET /api/composer/sessions/[id] - Get specific session
 * PUT /api/composer/sessions/[id] - Update session progress
 * POST /api/composer/sessions/[id]/complete - Complete session and create ExperienceQube
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

    // Complete session and create ExperienceQube
    const experienceQube = await composerService.completeSession(id);

    if (!experienceQube) {
      return NextResponse.json({
        success: false,
        error: 'Failed to complete session - session not found or invalid',
      }, { status: 400 });
    }

    console.log(`Completed composer session: ${id} -> ExperienceQube: ${experienceQube.id}`);

    const supabaseWriteError = (experienceQube as unknown as Record<string, unknown>)._supabase_write_error;
    if (supabaseWriteError) {
      console.warn(`[ExperienceQube] Supabase write failed for ${experienceQube.id}:`, supabaseWriteError);
    }

    return NextResponse.json({
      success: true,
      experience_qube: experienceQube,
      session_id: id,
      completed_at: new Date().toISOString(),
      // Warn caller when Supabase write failed — experience is only in Lambda memory and will
      // not survive a cold start.  Check SUPABASE_SERVICE_ROLE_KEY and table RLS policies.
      ...(supabaseWriteError ? { warning: `Supabase write failed: ${supabaseWriteError}. Experience is not persisted.` } : {}),
    });

  } catch (error: any) {
    console.error('Composer session complete POST error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to complete session',
    }, { status: 500 });
  }
}
