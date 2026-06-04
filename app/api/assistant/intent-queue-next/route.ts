/**
 * POST /api/assistant/intent-queue-next
 *
 * Spawns a child IntentQube from a specialist recommendation on a
 * parent intent. The mechanism that closes the execution loop — each
 * bullet in a specialist response becomes a queued, owner-approvable
 * next action instead of dead text.
 *
 * Flow:
 *   1. Operator clicks "Queue as next action" next to a recommendation
 *      in the chain panel (workspace pill or myLedger card).
 *   2. This route creates a child IntentQube referencing the parent
 *      via parentIntentId in packed rationale (no migration needed).
 *   3. Child intent shows up in Active Intents under its own row,
 *      ready to be expanded + approved like any other intent.
 *   4. When approved, the operator can then dispatch the actual
 *      consultation via the existing ask-agent / advance pipeline.
 *      Each consultation produces new recommendations → loop.
 *
 * Body:
 *   {
 *     parentIntentId: string;
 *     recommendation: string;       // the bullet text from the parent
 *                                   // consultation's response
 *     specialist?: SpecialistAgentId;
 *     cartridge?: string;
 *     intentType?: IntentType;
 *   }
 *
 * Returns: { intentId, parentIntentId, status }
 *
 * Auth: spine-resolved persona must own the parent intent.
 *
 * T0 / privacy: persona_id never leaves the server. Recommendation
 * text is operator-supplied (already in their session); we just store
 * it as the child intent's name + rationale.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  createIntentQube,
  getIntentQube,
  type IntentType,
  type SpecialistAgentId,
} from '@/services/iqube/intentQube';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';

export const dynamic = 'force-dynamic';

const VALID_SPECIALISTS: ReadonlyArray<SpecialistAgentId> = [
  'aigent-me',
  'marketa',
  'quill',
  'kn0w1',
  'aigent-z',
  'aigent-c',
];

interface PostBody {
  parentIntentId?: unknown;
  recommendation?: unknown;
  specialist?: unknown;
  cartridge?: unknown;
  intentType?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ error: 'persona-required' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as PostBody;
  const parentIntentId =
    typeof body.parentIntentId === 'string' ? body.parentIntentId : null;
  const recommendation =
    typeof body.recommendation === 'string' ? body.recommendation.trim() : '';
  const specialistRaw = typeof body.specialist === 'string' ? body.specialist : null;
  const cartridge = typeof body.cartridge === 'string' ? body.cartridge : null;
  const intentTypeRaw = typeof body.intentType === 'string' ? body.intentType : null;

  if (!parentIntentId) {
    return NextResponse.json({ error: 'missing-parentIntentId' }, { status: 400 });
  }
  if (!recommendation || recommendation.length < 3) {
    return NextResponse.json({ error: 'missing-recommendation' }, { status: 400 });
  }

  const parent = await getIntentQube(parentIntentId);
  if (!parent) {
    return NextResponse.json({ error: 'parent-not-found' }, { status: 404 });
  }
  if (parent.personaId !== persona.personaId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Resolve target specialist. If caller supplied one, validate.
  // Otherwise inherit from parent's first non-aigent-me target.
  let specialist: SpecialistAgentId | null = null;
  if (specialistRaw) {
    if (!VALID_SPECIALISTS.includes(specialistRaw as SpecialistAgentId)) {
      return NextResponse.json(
        { error: 'invalid-specialist', allowed: VALID_SPECIALISTS },
        { status: 400 },
      );
    }
    specialist = specialistRaw as SpecialistAgentId;
  } else {
    specialist =
      (parent.targetAgents.find((a) => a !== 'aigent-me') as SpecialistAgentId | undefined) ??
      null;
  }
  const targetAgents: SpecialistAgentId[] = ['aigent-me'];
  if (specialist) targetAgents.push(specialist);

  // Trim recommendation to a reasonable name. Full text goes into rationale.
  const truncatedName =
    recommendation.length > 160 ? recommendation.slice(0, 157) + '…' : recommendation;
  const rationale = `From recommendation on parent intent "${parent.intentName}":\n\n${recommendation}`;

  const validIntentTypes: ReadonlyArray<IntentType> = [
    'create_artifact',
    'ask_specialist',
    'draft_email',
    'schedule',
    'venture_review',
    'brief',
    'move_forward',
    'experience_setup',
  ];
  const intentType: IntentType =
    intentTypeRaw && validIntentTypes.includes(intentTypeRaw as IntentType)
      ? (intentTypeRaw as IntentType)
      : specialist
        ? 'ask_specialist'
        : 'move_forward';

  try {
    const child = await createIntentQube({
      personaId: persona.personaId,
      intentName: truncatedName,
      intentType,
      activeCartridge: cartridge ?? parent.activeCartridge,
      targetAgents,
      allowedTools: [],
      approvalRequired: true,
      rationale,
      parentIntentId,
    });

    // Activity receipt so the parent's chain timeline shows the spawn.
    await createActivityReceipt({
      personaId: persona.personaId,
      intentId: parentIntentId,
      activeCartridge: parent.activeCartridge,
      actionType: 'intent_queued',
      summary: `Queued next action: ${truncatedName}`,
      agentsInvoked: ['aigent-me', ...(specialist ? [specialist] : [])],
      contextShared: ['recommendation-spawn', 'parent-intent'],
    }).catch(() => undefined);

    // Orchestration event so the new child intent's own timeline
    // shows it was born from a parent's recommendation.
    if (specialist) {
      void emitOrchestrationEvent({
        event_id: randomUUID(),
        event_type: 'specialist_invoked',
        from_role: 'aigent-z',
        to_role: 'guide-agent',
        reason: truncatedName,
        journey_stage: 'first',
        active_cartridge: parent.activeCartridge,
        active_codex: null,
        receipt_eligible: true,
        timestamp: child.createdAt,
        metadata: {
          intent_id: child.id,
          intent_name: child.intentName,
          intent_type: child.intentType,
          specialist,
          target_agents: child.targetAgents,
          parent_intent_id: parentIntentId,
          parent_intent_name: parent.intentName,
        },
      });
    }

    return NextResponse.json({
      intentId: child.id,
      parentIntentId,
      status: child.status,
      specialist,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/intent-queue-next] failed: ${msg}`);
    return NextResponse.json(
      { error: 'queue-next-failed', detail: msg },
      { status: 500 },
    );
  }
}
