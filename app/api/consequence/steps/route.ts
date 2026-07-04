/**
 * /api/consequence/steps — chain-facing step adapter (Chrysalis Phase 3b).
 *
 * The rpc target for the consequence-operating-model.v1 intent chain. The
 * dispatcher POSTs { chain_id, step_id, phase, ...chain-context } with the
 * X-Chain-Orchestrator-Token header; this endpoint executes the stage(s) and
 * emits the expected outcome orchestration event (metadata.chain_id) that
 * advances the chain — per the rpc contract in services/intentChains/advancer.ts.
 *
 * Phases:
 *   preflight — Intent → … → Planning (runConsequencePipeline, chain mode).
 *               Emits consequence_preflight_completed with T1-safe products
 *               (disposition, risk score, forecast counts, invariant ids).
 *   flywheel  — Execution → … → Knowledge Evolution (executeApproved over a
 *               run reconstructed from chain context). Emits
 *               consequence_flywheel_completed.
 *
 * Auth: orchestrator service token ONLY (server-to-server). Not spine-gated —
 * there is no persona on chain dispatches; the chain layer carries the T2
 * alias commitment and emits its own receipts.
 */

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';
import { executeApproved, runConsequencePipeline } from '@/services/consequence';
import type { ConsequenceRun } from '@/types/consequence';
import { INVARIANT_NAMESPACES, type InvariantNamespace } from '@/types/invariants';

export const dynamic = 'force-dynamic';

interface StepBody {
  chain_id?: string;
  step_id?: string;
  phase?: 'preflight' | 'flywheel';
  intentRef?: string;
  contextDomain?: string;
  namespace?: string;
  // flywheel phase — written into chain context by the preflight outcome event
  disposition?: string;
  compressed_invariant_ids?: string[];
  run_id?: string;
  outcome?: 'confirmed' | 'contradicted';
  outcome_note?: string;
}

export async function POST(request: NextRequest) {
  const expectedToken = process.env.ORCHESTRATOR_SERVICE_TOKEN || '';
  const gotToken = request.headers.get('x-chain-orchestrator-token') || '';
  if (!expectedToken || gotToken !== expectedToken) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: StepBody;
  try {
    body = (await request.json()) as StepBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { chain_id, step_id, phase } = body;
  if (!chain_id || !phase) {
    return NextResponse.json({ error: 'chain_id and phase are required' }, { status: 400 });
  }
  if (!body.intentRef) {
    return NextResponse.json({ error: 'intentRef is required in chain context' }, { status: 400 });
  }
  if (body.namespace && !(INVARIANT_NAMESPACES as string[]).includes(body.namespace)) {
    return NextResponse.json({ error: 'invalid namespace' }, { status: 400 });
  }

  const emitOutcome = (
    eventType: 'consequence_preflight_completed' | 'consequence_flywheel_completed',
    metadata: Record<string, unknown>,
  ) =>
    emitOrchestrationEvent({
      event_id: randomUUID(),
      event_type: eventType,
      from_role: 'aigent-z',
      to_role: 'aigent-z',
      reason: 'consequence_chain_step',
      journey_stage: 'prospect',
      active_cartridge: 'agentiq',
      active_codex: null,
      receipt_eligible: true,
      timestamp: new Date().toISOString(),
      // T1-safe only: ids, counts, scores — never persona identifiers.
      metadata: { chain_id, step_id, ...metadata },
    });

  try {
    if (phase === 'preflight') {
      const run = await runConsequencePipeline({
        intentRef: body.intentRef,
        contextDomain: body.contextDomain ?? null,
        namespace: (body.namespace as InvariantNamespace) ?? undefined,
        actor: null, // chain mode — receipts come from the chain layer
      });
      await emitOutcome('consequence_preflight_completed', {
        run_id: run.runId,
        intentRef: run.intentRef,
        disposition: run.disposition,
        coherent: run.knowledge?.coherent ?? false,
        knowledge_size: run.compressedInvariantIds.length,
        compressed_invariant_ids: run.compressedInvariantIds,
        risk_score: run.risk?.overall_score ?? null,
        work_potential_qc: run.value?.work_potential_qc ?? null,
        forecast_enables: run.forecast?.enables ?? 0,
        forecast_contradicts: run.forecast?.contradicts ?? 0,
        forecast_rationale: run.forecast?.rationale ?? '',
      });
      return NextResponse.json({ ok: true, phase, disposition: run.disposition });
    }

    // flywheel — reconstruct the minimal executable run from chain context.
    const invariantIds = Array.isArray(body.compressed_invariant_ids)
      ? body.compressed_invariant_ids.filter((v): v is string => typeof v === 'string')
      : [];
    const run: ConsequenceRun = {
      runId: body.run_id ?? randomUUID(),
      intentRef: body.intentRef,
      reachedStage: 'planning',
      disposition: body.disposition === 'escalate' ? 'escalate' : 'act',
      knowledge: null,
      compressedInvariantIds: invariantIds,
      risk: null,
      value: null,
      capabilityQubeId: null,
      forecast: null,
      awaitingApproval: true,
      stageReceipts: [],
    };
    const result = await executeApproved({
      run,
      outcome: body.outcome ?? 'confirmed',
      actor: null, // chain mode
      note: body.outcome_note,
    });
    await emitOutcome('consequence_flywheel_completed', {
      run_id: run.runId,
      intentRef: run.intentRef,
      observation: result.observation,
      evolved_count: result.evolved.length,
    });
    return NextResponse.json({ ok: true, phase, evolved: result.evolved.length });
  } catch (error) {
    console.error(`[api/consequence/steps] ${phase} failed`, error);
    return NextResponse.json({ error: 'step_failed' }, { status: 500 });
  }
}
