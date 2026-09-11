/**
 * POST /api/experience/complete-tasks
 *
 * Workstream C-b — the consumer task runner calls this when ALL of an
 * experience's nextActions are checked. Resolves the caller through the
 * identity spine, then routes the experience's configured reward into the
 * wallet (KNYT via grantRewardForTask / Q¢ via creditQc), applies reputation
 * deltas, and writes a DVN-anchored activity receipt.
 *
 * Idempotent: a UNIQUE(persona, experience) constraint means a repeat POST
 * returns 409 with the existing completion record (so the client clears
 * localStorage either way).
 *
 * Spine: getActivePersona attaches the T0 personaId from the Bearer token;
 * the response carries only T1-safe fields (no personaId).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { recordExperienceTaskCompletion } from '@/services/experience/experienceTaskCompletion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context?.personaId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    experienceId?: string;
    completedTasks?: unknown;
    totalTasks?: unknown;
    cartridgeSlug?: string;
  };

  if (!body.experienceId || typeof body.experienceId !== 'string') {
    return NextResponse.json({ error: 'experienceId required' }, { status: 400 });
  }

  const completedTasks = Array.isArray(body.completedTasks)
    ? body.completedTasks.filter((x): x is string => typeof x === 'string')
    : [];
  const totalTasks = Number.isFinite(Number(body.totalTasks)) ? Number(body.totalTasks) : completedTasks.length;

  const result = await recordExperienceTaskCompletion({
    personaId: context.personaId,
    experienceId: body.experienceId,
    completedTasks,
    totalTasks,
    cartridgeSlug: typeof body.cartridgeSlug === 'string' ? body.cartridgeSlug : '',
  });

  const { status, ...payload } = result;
  return NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
}
