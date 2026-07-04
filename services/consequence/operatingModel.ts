/**
 * The Consequence Operating Model — runner (CFS-006a).
 *
 * The reference/synchronous executor of the canonical pipeline (pipeline.ts).
 * It sequences the pre-approval stages, computes the Planning disposition, and
 * stops at the Planning → Execution approval gate. `executeApproved` runs the
 * post-approval arc and closes the flywheel by feeding observed consequence
 * back into the invariant graph (Knowledge Evolution).
 *
 * This is NOT a re-implementation of the intent_chains engine — it is a thin
 * sequencer over the invariant substrate + existing receipt spine. The
 * async/charged production deployment (as a chain template on the intent_chains
 * dispatcher) is Phase 3b.
 *
 * T0: the acting personaId is accepted as a parameter and never placed on the
 * returned ConsequenceRun.
 *
 * Server-only.
 */

import { randomUUID } from 'crypto';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { getInvariantsByIds } from '@/services/invariants/store';
import { recordConsequence } from '@/services/invariants/lifecycle';
import { citeInvariants } from '@/services/invariants/grounding';
import { aggregateConfidence, aggregateStanding } from '@/services/invariants/publish';
import type { AgentDisposition } from '@/types/orchestration';
import type { ConsequenceRun, StageReceiptRef } from '@/types/consequence';
import type { InvariantNamespace } from '@/types/invariants';
import {
  assessRiskHeuristic,
  assessValueHeuristic,
  forecastConsequences,
  knowledgeCuration,
} from './stages';

export interface RunPipelineInput {
  intentRef: string;
  contextDomain?: string | null;
  namespace?: InvariantNamespace;
  /**
   * Acting persona (T0, never placed on the returned run). Pass null in
   * chain mode — the intent_chains layer emits its own step receipts and
   * carries only the T2 alias commitment.
   */
  actor: { personaId: string; sessionId?: string } | null;
}

export async function runConsequencePipeline(
  input: RunPipelineInput,
): Promise<ConsequenceRun> {
  const runId = randomUUID();
  const now = new Date().toISOString();
  const stageReceipts: StageReceiptRef[] = [];

  const record = async (
    stage: StageReceiptRef['stage'],
    actionType: Parameters<typeof createActivityReceipt>[0]['actionType'],
    summary: string,
  ) => {
    if (!input.actor) {
      stageReceipts.push({ stage, receiptId: null, summary });
      return;
    }
    const receipt = await createActivityReceipt({
      personaId: input.actor.personaId,
      sessionId: input.actor.sessionId,
      actionType,
      summary,
      activeCartridge: 'agentiq',
    }).catch((err) => {
      console.error(`[consequence] ${stage} receipt failed`, err);
      return null;
    });
    stageReceipts.push({ stage, receiptId: receipt?.id ?? null, summary });
  };

  // ── Knowledge Curation ──────────────────────────────────────────────
  const knowledge = await knowledgeCuration({
    intentRef: input.intentRef,
    contextDomain: input.contextDomain,
    namespace: input.namespace,
  });
  await record(
    'knowledge_curation',
    'knowledge_curated',
    `Curated ${knowledge.invariantIds.length} invariant(s) (+${knowledge.closureIds.length} closure) for intent ${input.intentRef}${knowledge.coherent ? '' : ' — INCOHERENT'}`,
  );

  // ── Knowledge Compression ───────────────────────────────────────────
  // v1: curated invariants ARE the compressed knowledge. Net-new invariant
  // discovery from raw sources is discoverInvariant() in the Invariant
  // Service — a documented wiring point when the pipeline curates non-
  // invariant sources.
  const compressedInvariantIds = knowledge.invariantIds;
  const members = await getInvariantsByIds(compressedInvariantIds);
  const aggConfidence = aggregateConfidence(members.map((m) => m.confidence));
  const aggStanding = aggregateStanding(members.map((m) => m.standing));

  // ── Risk / Value ────────────────────────────────────────────────────
  const risk = assessRiskHeuristic({
    iqubeId: input.intentRef,
    aggregateConfidence: aggConfidence,
    knowledgeSize: compressedInvariantIds.length,
    coherent: knowledge.coherent,
    now,
  });
  const value = assessValueHeuristic({
    iqubeId: input.intentRef,
    aggregateStanding: aggStanding,
    knowledgeSize: compressedInvariantIds.length,
    now,
  });

  // ── Capability Composition ──────────────────────────────────────────
  // v1: no agent/tool composition performed here. CapabilityQube assembly
  // (ClusterQube specialization over ToolQubes/AigentQubes) is the wiring
  // point; the run records a null capability until then.
  const capabilityQubeId: string | null = null;

  // ── Consequence Forecasting ─────────────────────────────────────────
  const forecast = await forecastConsequences(compressedInvariantIds);
  await record(
    'consequence_forecasting',
    'consequence_forecast_recorded',
    forecast.rationale,
  );

  // ── Planning (disposition) ──────────────────────────────────────────
  let disposition: AgentDisposition;
  if (!knowledge.coherent) {
    disposition = 'deny';
  } else if (forecast.forcesEscalation || risk.overall_score >= 70) {
    disposition = 'escalate';
  } else if (compressedInvariantIds.length === 0 || risk.overall_score >= 40) {
    disposition = 'ask';
  } else {
    disposition = 'act';
  }
  const awaitingApproval = disposition === 'act' || disposition === 'escalate';

  return {
    runId,
    intentRef: input.intentRef,
    reachedStage: 'planning',
    disposition,
    knowledge,
    compressedInvariantIds,
    risk,
    value,
    capabilityQubeId,
    forecast,
    awaitingApproval,
    stageReceipts,
  };
}

export interface ExecuteApprovedInput {
  run: ConsequenceRun;
  outcome: 'confirmed' | 'contradicted';
  /** Null in chain mode — see RunPipelineInput.actor. */
  actor: { personaId: string; sessionId?: string } | null;
  note?: string;
}

/**
 * The post-approval arc: Execution → Observation → Standing → Registry Update →
 * Knowledge Evolution. Closes the flywheel — observed outcome updates the
 * confidence + standing of every invariant the plan was grounded in.
 */
export async function executeApproved(
  input: ExecuteApprovedInput,
): Promise<{ evolved: string[]; observation: 'confirmed' | 'contradicted' }> {
  const { run, outcome, actor } = input;
  if (!run.awaitingApproval) {
    throw new Error(`run disposition '${run.disposition}' is not executable`);
  }

  // Execution + Observation receipts (persona mode only; chain mode's
  // receipts come from the intent_chains layer).
  if (actor) {
    await createActivityReceipt({
      personaId: actor.personaId,
      sessionId: actor.sessionId,
      actionType: 'experience_task_completed',
      summary: `Consequence plan executed for intent ${run.intentRef}; observed ${outcome}`,
      activeCartridge: 'agentiq',
    }).catch((err) => console.error('[consequence] execution receipt failed', err));
  }

  // Knowledge Evolution — feed the outcome back into every grounding invariant.
  // This closes the STANDING arc (Law XII validation-class): a confirmed/
  // contradicted consequence adjusts confidence + timesValidated/Contradicted.
  const evolved: string[] = [];
  for (const invariantId of run.compressedInvariantIds) {
    await recordConsequence(invariantId, outcome, { note: input.note }).catch((err) =>
      console.error(`[consequence] evolution failed for ${invariantId}`, err),
    );
    evolved.push(invariantId);
  }

  // Close the REACH arc (Law XII adoption-class, orthogonal to standing):
  // the plan was grounded in these invariants and has now been executed, so
  // record their usage (CFS-006 §4 / CFS-008 §2 reuse count). Sequenced AFTER
  // the evolution loop so the two read-modify-write arcs never race on a row.
  // Without this the runtime only ever spent knowledge and never recorded
  // that it earned adoption — recordUsage was previously dead code.
  await citeInvariants(run.compressedInvariantIds);

  if (actor) {
    await createActivityReceipt({
      personaId: actor.personaId,
      sessionId: actor.sessionId,
      actionType: 'knowledge_evolved',
      summary: `Knowledge evolution: ${evolved.length} invariant(s) ${outcome} by observed consequence of intent ${run.intentRef}`,
      activeCartridge: 'agentiq',
      iqubesUsed: run.capabilityQubeId ? [run.capabilityQubeId] : [],
    }).catch((err) => console.error('[consequence] evolution receipt failed', err));
  }

  return { evolved, observation: outcome };
}
