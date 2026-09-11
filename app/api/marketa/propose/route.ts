/**
 * POST /api/marketa/propose — Marketa's generalized brief intake.
 *
 * Per AGENTIQ_INTENT_CHAINS_SPEC.md §7 + audit finding: this is the
 * missing intake the operator's audit surfaced. The audit found
 * /api/marketa/partner-pack/propose exists but is KNYT-scoped, and
 * /api/connectors/execute only handles email send. There was no
 * general "submit-brief-for-proposal" intake.
 *
 * This route accepts a brief artifact reference, drafts a proposal
 * (v1: stub — creates a placeholder proposal artifact row + returns
 * the id; the actual LLM-driven generation is the canonical Marketa
 * follow-on), and emits a `proposal_drafted` orchestration event
 * carrying the new proposal_artifact_id so the intent-chain advancer
 * progresses the chain to the next step.
 *
 * Auth:
 *   - X-Chain-Orchestrator-Token (server-to-server from the advancer's
 *     advanceRpcStep) — the canonical chain-driven flow
 *   - OR a signed-in admin/partner via getActivePersona — for manual
 *     ops + future direct-call clients
 *
 * Body:
 *   {
 *     brief_artifact_id: string,    // required — the source brief
 *     chain_id?: string,            // required when called from a chain
 *     step_id?: string,             // required when called from a chain
 *     initiated_by_alias_commitment?: string,   // T2 — passes through to receipt
 *     // additional context fields (recipient, etc.) — surface through to event
 *     [k: string]: unknown,
 *   }
 *
 * Returns:
 *   {
 *     proposal_artifact_id: string,
 *     brief_artifact_id: string,
 *     chain_id: string | null,
 *     stub: true,                   // present until LLM generation lands
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';
import { sanitizeReceiptMetadata } from '@/services/orchestration/sanitizeReceiptMetadata';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProposeBody {
  brief_artifact_id?: string;
  chain_id?: string;
  step_id?: string;
  initiated_by_alias_commitment?: string;
  [k: string]: unknown;
}

export async function POST(request: NextRequest) {
  // Auth — dual path
  const orchestratorTokenHeader = request.headers.get('x-chain-orchestrator-token') ?? '';
  const expectedOrchestratorToken = process.env.ORCHESTRATOR_SERVICE_TOKEN ?? '';
  const isOrchestratorCall =
    expectedOrchestratorToken.length > 0 && orchestratorTokenHeader === expectedOrchestratorToken;

  let actor_alias_commitment: string | undefined;
  if (!isOrchestratorCall) {
    const persona = await getActivePersona(request);
    if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    if (!persona.cartridgeFlags?.isAdmin && !persona.cartridgeFlags?.isPartner) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    actor_alias_commitment = persona.cohortMemberships?.[0];
  }

  let body: ProposeBody;
  try {
    body = (await request.json()) as ProposeBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.brief_artifact_id || typeof body.brief_artifact_id !== 'string') {
    return NextResponse.json({ error: 'brief_artifact_id_required' }, { status: 400 });
  }

  const chain_id = body.chain_id ?? null;
  const step_id = body.step_id ?? null;
  const proposal_artifact_id = `marketa-proposal-${randomUUID()}`;
  const now = new Date().toISOString();

  // v1 stub — persist a marker row. The actual LLM-driven proposal
  // generation is the canonical Marketa follow-on workstream; this
  // record is the surface the chain advancer expects.
  //
  // We store this in a lightweight `marketa_proposals` table if it
  // exists; otherwise we skip the persist + still emit the event so
  // the chain progresses (audit trail intact via orchestration_events).
  const sb = getSupabaseServer();
  if (sb) {
    try {
      await sb.from('marketa_proposals').insert({
        proposal_artifact_id,
        brief_artifact_id: body.brief_artifact_id,
        chain_id,
        step_id,
        status: 'drafted',
        drafted_at: now,
        stub: true,
      } as never);
    } catch {
      // Table may not exist in dev yet — skip persistence in stub mode.
      // The orchestration_events row IS the durable record for v1.
    }
  }

  // Emit proposal_drafted — this is the event that advances the chain
  // (chain.current_step.rpc.expected_outcome_event_type = 'proposal_drafted').
  // metadata.chain_id correlates back to the chain instance.
  void emitOrchestrationEvent({
    event_id: randomUUID(),
    event_type: 'proposal_drafted',
    from_role: 'guide-agent',
    to_role: 'aigent-z',
    reason: 'marketa_proposal_draft',
    journey_stage: 'prospect',
    active_cartridge: null,
    active_codex: null,
    receipt_eligible: true,
    timestamp: now,
    metadata: sanitizeReceiptMetadata({
      chain_id,
      step_id,
      proposal_artifact_id,
      brief_artifact_id: body.brief_artifact_id,
      actor_alias_commitment: actor_alias_commitment ?? body.initiated_by_alias_commitment,
      stub: true,
    }),
  });

  return NextResponse.json({
    proposal_artifact_id,
    brief_artifact_id: body.brief_artifact_id,
    chain_id,
    stub: true,
  });
}
