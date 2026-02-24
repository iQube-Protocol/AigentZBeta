/**
 * Task Template Detail API
 * 
 * GET /api/crm/tasks/[taskId] - Get task template by ID
 * PATCH /api/crm/tasks/[taskId] - Update task template
 * DELETE /api/crm/tasks/[taskId] - Deactivate task template
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTaskTemplate,
  updateTaskTemplate,
  deactivateTaskTemplate,
} from '@/services/crm/taskService';

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const task = await getTaskTemplate(tenantId, taskId);

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ task });
  } catch (error: unknown) {
    console.error('[API] GET /api/crm/tasks/[taskId] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get task' },
      { status: 500 }
    );
  }
}

async function handleUpdate(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    const body = await request.json();
    const { tenantId, ...updates } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const task = await updateTaskTemplate(tenantId, taskId, updates);

    return NextResponse.json({ task });
  } catch (error: unknown) {
    console.error('[API] PATCH/PUT /api/crm/tasks/[taskId] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update task' },
      { status: 500 }
    );
  }
}

export const PATCH = handleUpdate;
export const PUT = handleUpdate;

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const task = await deactivateTaskTemplate(tenantId, taskId);

    return NextResponse.json({ task, message: 'Task deactivated' });
  } catch (error: unknown) {
    console.error('[API] DELETE /api/crm/tasks/[taskId] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to deactivate task' },
      { status: 500 }
    );
  }
}
