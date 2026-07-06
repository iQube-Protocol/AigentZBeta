/**
 * /api/experiments/exp004 — the Sovereignty Drill, step API.
 *
 * Venice-only by definition (SOVEREIGN_PROVIDER pinned in the service — the
 * route accepts no provider parameter at all). One step per POST, browser
 * accumulates state (EXP-003 architecture).
 *
 * GET  — battery config + venice availability + venice model allowlist
 * POST { action: 'answer', taskIndex, model? }          → one grounded answer
 * POST { action: 'judge',  taskIndex, answer, model? }  → venice-judged verdict
 * POST { action: 'pack' }                               → implementation-pack task
 *
 * Admin-gated (spine): drills spend provider credits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  exp004AnswerStep,
  exp004Battery,
  exp004JudgeStep,
  exp004PackStep,
  SOVEREIGN_PROVIDER,
} from '@/services/experiments/exp004';
import {
  EXPERIMENT_MODEL_OPTIONS,
  isAllowedExperimentModel,
  providerAvailable,
} from '@/services/experiments/llm';

export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  if (!persona.cartridgeFlags?.isAdmin) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { persona };
}

export async function GET(request: NextRequest) {
  const gate = await requireAdmin(request);
  if ('error' in gate) return gate.error;
  const battery = exp004Battery();
  return NextResponse.json({
    ok: true,
    provider: SOVEREIGN_PROVIDER,
    providerAvailable: providerAvailable(SOVEREIGN_PROVIDER),
    models: EXPERIMENT_MODEL_OPTIONS[SOVEREIGN_PROVIDER],
    tasks: battery.tasks,
    packTask: battery.packTask,
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin(request);
  if ('error' in gate) return gate.error;

  let body: { action?: string; taskIndex?: number; answer?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const model = typeof body.model === 'string' && body.model ? body.model : undefined;
  if (model && !isAllowedExperimentModel(SOVEREIGN_PROVIDER, model)) {
    return NextResponse.json(
      { ok: false, error: `model '${model}' is not on the ${SOVEREIGN_PROVIDER} allowlist` },
      { status: 400 },
    );
  }

  try {
    if (body.action === 'answer') {
      const taskIndex = Number(body.taskIndex);
      const result = await exp004AnswerStep(taskIndex, model);
      return NextResponse.json({ ok: true, result });
    }
    if (body.action === 'judge') {
      const taskIndex = Number(body.taskIndex);
      if (typeof body.answer !== 'string' || !body.answer.trim()) {
        return NextResponse.json({ ok: false, error: 'answer required' }, { status: 400 });
      }
      const result = await exp004JudgeStep(taskIndex, body.answer, model);
      return NextResponse.json({ ok: true, result });
    }
    if (body.action === 'pack') {
      const result = await exp004PackStep();
      return NextResponse.json({ ok: true, result });
    }
    return NextResponse.json({ ok: false, error: "action must be 'answer' | 'judge' | 'pack'" }, { status: 400 });
  } catch (error) {
    // A step failure IS drill data (constitutional failure on that task) —
    // return it as a clean JSON error the runner records honestly.
    const message = error instanceof Error ? error.message : 'step failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
