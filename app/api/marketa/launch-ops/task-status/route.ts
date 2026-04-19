import { NextRequest, NextResponse } from 'next/server';
import { updateTaskStatus } from '@/services/launch-ops/launchOpsService';
import type { LoTaskStatus } from '@/types/launchOps';

const VALID_STATUSES: LoTaskStatus[] = ['todo', 'doing', 'blocked', 'done', 'canceled'];

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId, status } = body as { taskId?: string; status?: string };

    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json({ ok: false, error: 'taskId required' }, { status: 400 });
    }
    if (!status || !VALID_STATUSES.includes(status as LoTaskStatus)) {
      return NextResponse.json({ ok: false, error: 'invalid status' }, { status: 400 });
    }

    await updateTaskStatus(taskId, status as LoTaskStatus);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[launch-ops task-status PATCH]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
