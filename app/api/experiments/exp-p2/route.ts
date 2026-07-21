/**
 * /api/experiments/exp-p2 — EXP-P2 utility (discovered-library vs cold), step API.
 *
 * One LLM call per request (a full run is many sequential calls, far beyond one
 * Lambda); the client accumulates + calls the pure aggregator. Stateless.
 *
 * GET  — config: tasks + discovered-library size + provider availability
 * POST { action: 'answer', provider, taskIndex, arm, model? }    → one answer call
 * POST { action: 'judge',  provider, taskIndex, answer, model? } → one blind judge call
 *
 * Research-access-gated (spine): experiments spend provider credits (same gate
 * as EXP-003).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { checkExperimentQuota } from '@/services/billing/experimentQuota';
import {
  expP2Config,
  expP2AnswerStep,
  expP2JudgeStep,
  expP2ClaimAnalysisStep,
  fetchDiscoveredLibrary,
  type ExpP2Arm,
} from '@/services/experiments/expP2Utility';
import { isAllowedExperimentModel, providerAvailable, type ExperimentProvider } from '@/services/experiments/llm';

export const dynamic = 'force-dynamic';

const PROVIDERS: ExperimentProvider[] = ['anthropic', 'openai', 'venice'];
function isProvider(v: unknown): v is ExperimentProvider {
  return typeof v === 'string' && (PROVIDERS as string[]).includes(v);
}

async function requireAccess(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona?.personaId) return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  const isAdmin = Boolean(persona.cartridgeFlags?.isAdmin);
  const client = getSupabaseServer();
  if (!client) return isAdmin ? { persona } : { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  const q = await checkExperimentQuota(client, persona.personaId, new Date(), isAdmin, 'EXP-P2');
  if (!q.allowed) {
    return { error: NextResponse.json({ error: 'forbidden', message: q.reason ?? 'Research access required to run experiments' }, { status: 403 }) };
  }
  return { persona };
}

export async function GET(request: NextRequest) {
  const gate = await requireAccess(request);
  if ('error' in gate) return gate.error;
  const { domain, tasks, manualBaselineCount } = expP2Config();
  let libraryCount = 0;
  let libraryError: string | null = null;
  try {
    libraryCount = (await fetchDiscoveredLibrary(domain)).length;
  } catch (e) {
    libraryError = e instanceof Error ? e.message : String(e);
  }
  return NextResponse.json(
    {
      ok: true,
      domain,
      tasks,
      libraryCount, // discovered (earned) library size
      manualBaselineCount, // manual baseline arm size
      libraryError,
      providers: PROVIDERS.map((p) => ({ id: p, available: providerAvailable(p) })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: NextRequest) {
  const gate = await requireAccess(request);
  if ('error' in gate) return gate.error;

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    provider?: string;
    taskIndex?: number;
    arm?: string;
    answer?: string;
    model?: string;
    excludeIndex?: number;
  };
  if (!isProvider(body.provider)) return NextResponse.json({ error: 'unknown provider' }, { status: 400 });
  if (!providerAvailable(body.provider)) return NextResponse.json({ error: `${body.provider} not configured` }, { status: 400 });
  const model = typeof body.model === 'string' && body.model ? body.model : undefined;
  if (model && !isAllowedExperimentModel(body.provider, model)) {
    return NextResponse.json({ error: 'model not allowed for provider' }, { status: 400 });
  }
  const taskIndex = Number(body.taskIndex);
  if (!Number.isInteger(taskIndex) || taskIndex < 0) return NextResponse.json({ error: 'bad taskIndex' }, { status: 400 });

  try {
    if (body.action === 'answer') {
      const arm = body.arm as ExpP2Arm;
      if (arm !== 'cold' && arm !== 'manual' && arm !== 'discovered') {
        return NextResponse.json({ error: "arm must be 'cold', 'manual', or 'discovered'" }, { status: 400 });
      }
      // Ablation: dropping a discovered-library index (discovered arm only).
      const excludeIndex =
        arm === 'discovered' && Number.isInteger(body.excludeIndex) && Number(body.excludeIndex) >= 0
          ? Number(body.excludeIndex)
          : undefined;
      const r = await expP2AnswerStep(body.provider, taskIndex, arm, model, excludeIndex);
      return NextResponse.json({ ok: true, ...r }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (body.action === 'judge') {
      const answer = typeof body.answer === 'string' ? body.answer : '';
      if (!answer.trim()) return NextResponse.json({ error: 'answer is required' }, { status: 400 });
      const r = await expP2JudgeStep(body.provider, taskIndex, answer, model);
      return NextResponse.json({ ok: true, ...r }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (body.action === 'claim-analysis') {
      const answer = typeof body.answer === 'string' ? body.answer : '';
      if (!answer.trim()) return NextResponse.json({ error: 'answer is required' }, { status: 400 });
      const r = await expP2ClaimAnalysisStep(body.provider, answer, model);
      return NextResponse.json({ ok: true, ...r }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ error: "action must be 'answer', 'judge', or 'claim-analysis'" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'step failed' }, { status: 500 });
  }
}
