/**
 * /api/experiments/exp003 — EXP-003 rediscovery-savings, step API.
 *
 * The Experiment Lab front-end orchestrates the benchmark one LLM call per
 * request (a full run is ~20 sequential calls — far beyond one Lambda), so
 * this route executes exactly one step per POST and holds no state; the
 * client accumulates results.
 *
 * GET  — config: tasks + collection preview + provider availability
 * POST { action: 'answer', provider, taskIndex, arm }        → one answer call
 * POST { action: 'judge',  provider, taskIndex, answer }     → one judge call
 *
 * Admin-gated (spine): experiments spend provider credits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { checkExperimentQuota } from '@/services/billing/experimentQuota';
import {
  exp003AnswerStep,
  exp003Config,
  exp003CountCitations,
  exp003JudgeStep,
  fetchExp003Collection,
} from '@/services/experiments/exp003';
import {
  EXPERIMENT_MODEL_OPTIONS,
  isAllowedExperimentModel,
  providerAvailable,
  type ExperimentProvider,
} from '@/services/experiments/llm';

export const dynamic = 'force-dynamic';

const PROVIDERS: ExperimentProvider[] = ['anthropic', 'openai', 'venice'];

function isProvider(value: unknown): value is ExperimentProvider {
  return typeof value === 'string' && (PROVIDERS as string[]).includes(value);
}

async function requireAdmin(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona?.personaId) return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  const isAdmin = Boolean(persona.cartridgeFlags?.isAdmin);
  const client = getSupabaseServer();
  // Admins are never blocked or metered (operator direction 2026-07-19).
  // Otherwise the caller needs research access (Sovereign-selected research,
  // Steward, or the research add-on) AND remaining monthly experiment quota.
  if (!client) return isAdmin ? { persona } : { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  const q = await checkExperimentQuota(client, persona.personaId, new Date(), isAdmin);
  if (!q.allowed) {
    return { error: NextResponse.json({ error: 'forbidden', message: q.reason ?? 'Research access required to run experiments' }, { status: 403 }) };
  }
  return { persona };
}

export async function GET(request: NextRequest) {
  const gate = await requireAdmin(request);
  if ('error' in gate) return gate.error;
  const { tasks, seedIds } = exp003Config();
  return NextResponse.json({
    ok: true,
    tasks: tasks.map((t) => ({ id: t.id, prompt: t.prompt })),
    collectionSize: seedIds.length,
    providers: Object.fromEntries(PROVIDERS.map((p) => [p, providerAvailable(p)])),
    models: EXPERIMENT_MODEL_OPTIONS,
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin(request);
  if ('error' in gate) return gate.error;

  let body: {
    action?: string;
    provider?: string;
    taskIndex?: number;
    arm?: string;
    answer?: string;
    model?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!isProvider(body.provider)) {
    return NextResponse.json({ error: `provider must be one of: ${PROVIDERS.join(', ')}` }, { status: 400 });
  }
  if (body.model !== undefined && (typeof body.model !== 'string' || !isAllowedExperimentModel(body.provider, body.model))) {
    return NextResponse.json({ error: 'model is not in the experiment allowlist for this provider' }, { status: 400 });
  }
  const taskIndex = Number(body.taskIndex);
  if (!Number.isInteger(taskIndex) || taskIndex < 0) {
    return NextResponse.json({ error: 'taskIndex must be a non-negative integer' }, { status: 400 });
  }

  try {
    if (body.action === 'answer') {
      if (body.arm !== 'cold' && body.arm !== 'initialized') {
        return NextResponse.json({ error: "arm must be 'cold' or 'initialized'" }, { status: 400 });
      }
      const result = await exp003AnswerStep(body.provider, taskIndex, body.arm, body.model);
      const collection = await fetchExp003Collection();
      return NextResponse.json({
        ok: true,
        ...result,
        citations: exp003CountCitations(result.answer, collection),
      });
    }
    if (body.action === 'judge') {
      if (typeof body.answer !== 'string' || body.answer.length === 0) {
        return NextResponse.json({ error: 'answer (string) is required' }, { status: 400 });
      }
      const verdict = await exp003JudgeStep(body.provider, taskIndex, body.answer, body.model);
      return NextResponse.json({ ok: true, verdict });
    }
    return NextResponse.json({ error: "action must be 'answer' or 'judge'" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'step_failed';
    console.error('[api/experiments/exp003] step failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
