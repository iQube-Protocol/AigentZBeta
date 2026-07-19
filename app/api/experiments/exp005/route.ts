/**
 * /api/experiments/exp005 — the Provider-Choice Drill (PSE-2), step API.
 *
 * The rotation (an operator-selected set of 2+ real adapters) travels with
 * every step; the server derives the answering provider (task i →
 * providers[i % n]) and the cross-provider judge (the NEXT provider in the
 * rotation) deterministically — the client never picks a provider per call,
 * so a silent failover onto a different provider is structurally impossible.
 * One step per POST, browser accumulates state (EXP-003 architecture).
 *
 * GET  — battery config + adapter availability + model allowlists
 * POST { action: 'answer', taskIndex, providers: string[] }
 * POST { action: 'judge',  taskIndex, answer, providers: string[] }
 *
 * Admin-gated (spine): drills spend provider credits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { checkExperimentQuota } from '@/services/billing/experimentQuota';
import {
  EXP005_MIN_PROVIDERS,
  exp005AnswerStep,
  exp005Config,
  exp005JudgeStep,
  exp005ValidateProviders,
} from '@/services/experiments/exp005';
import {
  EXPERIMENT_MODEL_OPTIONS,
  EXPERIMENT_PROVIDERS,
  providerAvailable,
  type ExperimentProvider,
} from '@/services/experiments/llm';

export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona?.personaId) return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  const isAdmin = Boolean(persona.cartridgeFlags?.isAdmin);
  const client = getSupabaseServer();
  // Admins are never blocked or metered (operator direction 2026-07-19).
  // Otherwise the caller needs research access (Sovereign-selected research,
  // Steward, or the research add-on) AND remaining monthly experiment quota.
  if (!client) return isAdmin ? { persona } : { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  const q = await checkExperimentQuota(client, persona.personaId, new Date(), isAdmin, 'EXP-005');
  if (!q.allowed) {
    return { error: NextResponse.json({ error: 'forbidden', message: q.reason ?? 'Research access required to run experiments' }, { status: 403 }) };
  }
  return { persona };
}

export async function GET(request: NextRequest) {
  const gate = await requireAdmin(request);
  if ('error' in gate) return gate.error;
  const config = exp005Config();
  return NextResponse.json({
    ok: true,
    minProviders: EXP005_MIN_PROVIDERS,
    providers: (Object.keys(EXPERIMENT_PROVIDERS) as ExperimentProvider[]).map((p) => ({
      id: p,
      available: providerAvailable(p),
      models: EXPERIMENT_MODEL_OPTIONS[p],
    })),
    tasks: config.tasks,
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin(request);
  if ('error' in gate) return gate.error;

  let body: {
    action?: string;
    taskIndex?: number;
    answer?: string;
    providers?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  // Rotation validation happens server-side (2+ distinct, real adapters only)
  // so the measurement's provider set is never negotiable per step.
  const providers = Array.isArray(body.providers)
    ? body.providers.filter((p): p is string => typeof p === 'string')
    : [];
  try {
    exp005ValidateProviders(providers);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid provider rotation';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  try {
    if (body.action === 'answer') {
      const taskIndex = Number(body.taskIndex);
      const result = await exp005AnswerStep(taskIndex, providers);
      return NextResponse.json({ ok: true, result });
    }
    if (body.action === 'judge') {
      const taskIndex = Number(body.taskIndex);
      if (typeof body.answer !== 'string' || !body.answer.trim()) {
        return NextResponse.json({ ok: false, error: 'answer required' }, { status: 400 });
      }
      const result = await exp005JudgeStep(taskIndex, body.answer, providers);
      return NextResponse.json({ ok: true, result });
    }
    return NextResponse.json({ ok: false, error: "action must be 'answer' | 'judge'" }, { status: 400 });
  } catch (error) {
    // A step failure IS drill data (constitutional failure on that task for
    // that provider) — return it as a clean JSON error the runner records
    // honestly; the runner never re-routes it to a different provider.
    const message = error instanceof Error ? error.message : 'step failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
