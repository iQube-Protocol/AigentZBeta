/**
 * /api/experiments/exp004 — the Sovereignty Drill, step API.
 *
 * Sovereign mode is venice-only by definition (SOVEREIGN_PROVIDER pinned in
 * the service). REHEARSAL mode (operator-directed, 2026-07-06 — venice
 * credits pending) runs the identical battery on a frontier provider from
 * the fixed REHEARSAL_PROVIDERS allowlist to validate the drill machinery;
 * a rehearsal is never a sovereignty claim. One step per POST, browser
 * accumulates state (EXP-003 architecture).
 *
 * GET  — battery config + provider availability + model allowlists
 * POST { action: 'answer', taskIndex, model?, mode?, rehearsalProvider? }
 * POST { action: 'judge',  taskIndex, answer, model?, mode?, rehearsalProvider? }
 * POST { action: 'pack', mode?, rehearsalProvider? }
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
  isRehearsalProvider,
  REHEARSAL_PROVIDERS,
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
    rehearsal: {
      providers: REHEARSAL_PROVIDERS.map((p) => ({
        id: p,
        available: providerAvailable(p),
        models: EXPERIMENT_MODEL_OPTIONS[p],
      })),
    },
    tasks: battery.tasks,
    packTask: battery.packTask,
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin(request);
  if ('error' in gate) return gate.error;

  let body: {
    action?: string;
    taskIndex?: number;
    answer?: string;
    model?: string;
    mode?: string;
    rehearsalProvider?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  // Provider resolution: sovereign mode is venice, always. Rehearsal mode
  // (machinery drill, never a sovereignty claim) picks from the fixed
  // rehearsal allowlist — arbitrary providers are rejected.
  let provider: typeof SOVEREIGN_PROVIDER | (typeof REHEARSAL_PROVIDERS)[number] = SOVEREIGN_PROVIDER;
  if (body.mode === 'rehearsal') {
    const requested = typeof body.rehearsalProvider === 'string' ? body.rehearsalProvider : 'openai';
    if (!isRehearsalProvider(requested)) {
      return NextResponse.json(
        { ok: false, error: `rehearsal provider must be one of: ${REHEARSAL_PROVIDERS.join(', ')}` },
        { status: 400 },
      );
    }
    provider = requested;
  } else if (body.mode !== undefined && body.mode !== 'sovereign') {
    return NextResponse.json({ ok: false, error: "mode must be 'sovereign' | 'rehearsal'" }, { status: 400 });
  }

  const model = typeof body.model === 'string' && body.model ? body.model : undefined;
  if (model && !isAllowedExperimentModel(provider, model)) {
    return NextResponse.json(
      { ok: false, error: `model '${model}' is not on the ${provider} allowlist` },
      { status: 400 },
    );
  }

  try {
    if (body.action === 'answer') {
      const taskIndex = Number(body.taskIndex);
      const result = await exp004AnswerStep(taskIndex, model, provider);
      return NextResponse.json({ ok: true, result });
    }
    if (body.action === 'judge') {
      const taskIndex = Number(body.taskIndex);
      if (typeof body.answer !== 'string' || !body.answer.trim()) {
        return NextResponse.json({ ok: false, error: 'answer required' }, { status: 400 });
      }
      const result = await exp004JudgeStep(taskIndex, body.answer, model, provider);
      return NextResponse.json({ ok: true, result });
    }
    if (body.action === 'pack') {
      const result = await exp004PackStep(provider);
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
