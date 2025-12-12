/**
 * Task Claim API
 * 
 * POST /api/crm/tasks/[taskId]/claim - Claim a task for a persona
 */

import { NextRequest, NextResponse } from 'next/server';
import { claimTask } from '@/services/crm/taskService';

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    const body = await request.json();
    const { tenantId, personaId, source } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    if (!personaId) {
      return NextResponse.json(
        { error: 'personaId is required' },
        { status: 400 }
      );
    }

    const result = await claimTask({
      tenantId,
      taskTemplateId: taskId,
      personaId,
      source,
    });

    return NextResponse.json({
      contribution: result.contribution,
      task: result.task,
      message: 'Task claimed successfully',
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('[API] POST /api/crm/tasks/[taskId]/claim error:', error);
    
    const message = error instanceof Error ? error.message : 'Failed to claim task';
    const status = message.includes('not found') ? 404 :
                   message.includes('not active') || message.includes('expired') || 
                   message.includes('maximum claims') || message.includes('already has') ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
