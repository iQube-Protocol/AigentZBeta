/**
 * /api/experiments/exp001 — EXP-001 Living KnowledgeQube evaluation, step API.
 *
 * One model call per POST (the full protocol is ~25 sequential calls); the
 * Experiment Lab front-end orchestrates and accumulates. Stateless.
 *
 * GET  — config: artifact ids + question bank (incl. expected markers, so the
 *        client can compute explainability) + provider availability
 * POST { action: 'answers',   provider, artifactId }              → 15-question pass
 * POST { action: 'judge',     provider, q, answersByDoc }         → per-question verdict
 * POST { action: 'coherence', provider, answers }                 → per-document verdict
 *
 * Admin-gated (spine): experiments spend provider credits. The artifact .md
 * files ship in this route's Lambda via outputFileTracingIncludes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { checkExperimentQuota } from '@/services/billing/experimentQuota';
import {
  exp001AnswerPass,
  exp001Config,
  exp001JudgeCoherence,
  exp001JudgeQuestion,
} from '@/services/experiments/exp001';
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
  const cfg = exp001Config();
  return NextResponse.json({
    ok: true,
    artifacts: cfg.artifacts,
    questions: cfg.questions,
    collectionSize: cfg.seedIds.length,
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
    artifactId?: string;
    q?: number;
    answersByDoc?: Record<string, { answer: string; citations: string[] }>;
    answers?: Array<{ q: number; answer: string }>;
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

  try {
    if (body.action === 'answers') {
      if (typeof body.artifactId !== 'string') {
        return NextResponse.json({ error: 'artifactId is required' }, { status: 400 });
      }
      const answers = await exp001AnswerPass(body.provider, body.artifactId, body.model);
      return NextResponse.json({ ok: true, artifactId: body.artifactId, answers });
    }
    if (body.action === 'judge') {
      if (!Number.isInteger(body.q) || !body.answersByDoc) {
        return NextResponse.json({ error: 'q (int) and answersByDoc are required' }, { status: 400 });
      }
      const verdict = await exp001JudgeQuestion(body.provider, Number(body.q), body.answersByDoc, body.model);
      return NextResponse.json({ ok: true, q: body.q, verdict });
    }
    if (body.action === 'coherence') {
      if (!Array.isArray(body.answers)) {
        return NextResponse.json({ error: 'answers (array) is required' }, { status: 400 });
      }
      const verdict = await exp001JudgeCoherence(body.provider, body.answers, body.model);
      return NextResponse.json({ ok: true, verdict });
    }
    return NextResponse.json({ error: "action must be 'answers', 'judge', or 'coherence'" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'step_failed';
    console.error('[api/experiments/exp001] step failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
