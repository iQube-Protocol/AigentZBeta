/**
 * blueprintHandoff — hand a Venture Blueprint (VentureQube v1.0) to the
 * execution agents (aigentMe / DevOn / Marketa / Venture Lab / Investor
 * Office). The Venture Blueprint is the common operating artifact between
 * Founder Office and every downstream execution system (Founder Office PRD v3
 * "Agent Handoff").
 *
 * Produces a per-agent handoff payload from the venture's Delegation +
 * Execution layers and writes a `venture_blueprint_handoff` activity receipt,
 * which rides the canonical DVN pipeline (the action type is anchorable). The
 * receipt carries only T2-safe refs (venture public ref + iqube id).
 */

import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { getVentureQube } from './ventureQubeService';
import type { VentureAgentConsumer } from '@/types/ventureQube';

export interface VentureHandoffPayload {
  agentType: VentureAgentConsumer;
  agentId?: string;
  venturePublicRef: string;
  ventureName: string;
  stage: string;
  ventureConfidence: number | null;
  responsibility: string;
  deliverables: string[];
  successMetrics: string[];
  /** Execution phases relevant to the handoff (objectives + deliverables). */
  executionPhases: Array<{ phaseName: string; objectives: string[]; deliverables: string[] }>;
}

export interface BlueprintHandoffResult {
  ok: boolean;
  error?: string;
  receiptId?: string | null;
  payloads: VentureHandoffPayload[];
}

export async function handoffVentureBlueprint(input: {
  personaId: string;
  ventureId: string;
  /** Optional subset of agents; defaults to every assignment in the layer. */
  targets?: VentureAgentConsumer[];
}): Promise<BlueprintHandoffResult> {
  const venture = await getVentureQube(input.personaId, input.ventureId);
  if (!venture) return { ok: false, error: 'venture not found', payloads: [] };

  const { layers } = venture;
  const assignments = layers.delegation.assignments;
  const wanted = input.targets;

  const executionPhases = layers.execution.phases.map((p) => ({
    phaseName: p.phaseName,
    objectives: p.objectives,
    deliverables: p.deliverables,
  }));

  const selected = assignments.filter(
    (a) => !wanted || wanted.includes(a.agentType),
  );

  const payloads: VentureHandoffPayload[] = selected.map((a) => ({
    agentType: a.agentType,
    agentId: a.agentId,
    venturePublicRef: venture.venturePublicRef,
    ventureName: venture.name,
    stage: venture.stage,
    ventureConfidence: venture.ventureConfidence,
    responsibility: a.responsibility,
    deliverables: a.deliverables,
    successMetrics: a.successMetrics ?? [],
    executionPhases,
  }));

  if (payloads.length === 0) {
    return {
      ok: false,
      error: 'no agent assignments to hand off — add assignments to the Delegation layer first',
      payloads: [],
    };
  }

  // DVN-anchored provenance receipt (T2-safe refs only).
  let receiptId: string | null = null;
  try {
    const receipt = await createActivityReceipt({
      personaId: input.personaId,
      activeCartridge: 'venture-lab',
      actionType: 'venture_blueprint_handoff',
      summary: `Venture Blueprint handed to ${payloads.map((p) => p.agentType).join(', ')} (${venture.name})`,
      iqubesUsed: venture.iqubeId ? [venture.iqubeId] : [],
      contextShared: ['venture-blueprint'],
      agentsInvoked: payloads.map((p) => p.agentType),
    });
    receiptId = receipt?.id ?? null;
  } catch {
    /* receipt is best-effort; the handoff payloads still return */
  }

  return { ok: true, receiptId, payloads };
}
