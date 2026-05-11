/**
 * POST /api/assistant/intent
 *
 * Aigent Me Phase 3.5 — make NBE cards executable.
 * Per PRD v0.2 §11 (AssistantTask + IntentQube data objects) and §5.4
 * (alpha multi-agent model — coordination, not autonomous action).
 *
 * Body:
 *   {
 *     nbeId: string;        // a catalogue id from services/orchestration/nbeCatalog.ts
 *     cartridge?: string;   // optional override; defaults to the NBE's home cartridge
 *     rationale?: string;   // optional free-text note from the user
 *   }
 *
 * Behavior:
 *   - Validates that `nbeId` is in the static NBE catalogue.
 *   - Creates an IntentQube row scoped to the active persona.
 *   - The IntentQube starts at status 'in_progress' with approvalRequired
 *     inherited from the catalogue entry. Phase 6 wires the approval gate
 *     before any consequential external action runs.
 *   - Phase 5 picks up these rows to route specialists (Marketa / Quill /
 *     Kn0w1) and execute the NBE.
 *
 * Privacy:
 *   - personaId resolved from the spine; never read from the body.
 *   - Response surfaces only T1 fields from the IntentQube record.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  createIntentQube,
  type IntentQubeRecord,
  type SpecialistAgentId,
} from '@/services/iqube/intentQube';
import { NBE_CATALOGUE } from '@/services/orchestration/nbeCatalog';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';

interface PostBody {
  nbeId?: string;
  cartridge?: string;
  rationale?: string;
}

interface IntentApiSurface {
  intentId: string;
  intentName: string;
  status: IntentQubeRecord['status'];
  cartridge: string;
  approvalRequired: boolean;
  targetAgents: SpecialistAgentId[];
  allowedTools: IntentQubeRecord['allowedTools'];
  createdAt: string;
  /** Brief copy the welcome surface renders after the click. */
  queueMessage: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid-json' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const body = (raw && typeof raw === 'object' ? raw : {}) as PostBody;
  if (!body.nbeId || typeof body.nbeId !== 'string') {
    return NextResponse.json(
      { error: 'missing-nbeId' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const candidate = NBE_CATALOGUE.find((c) => c.id === body.nbeId);
  if (!candidate) {
    return NextResponse.json(
      {
        error: 'unknown-nbeId',
        detail: `nbeId '${body.nbeId}' is not in the catalogue. Valid ids: ${NBE_CATALOGUE.map((c) => c.id).join(', ')}`,
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Map catalogue type-hints to IntentQube intent types.
  const intentType = candidate.suggestedArtifact
    ? 'create_artifact'
    : candidate.specialist
      ? 'ask_specialist'
      : 'move_forward';

  // Specialists the IntentQube may route to. Aigent Me is always the
  // coordinator; an explicit specialist (Marketa / Quill / Kn0w1) is added
  // when the NBE declares one.
  const targetAgents: SpecialistAgentId[] = ['aigent-me'];
  if (candidate.specialist) targetAgents.push(candidate.specialist);

  try {
    const intent = await createIntentQube({
      personaId: context.personaId,
      intentName: candidate.label,
      intentType,
      activeCartridge: body.cartridge || candidate.cartridge,
      targetAgents,
      allowedTools: [], // Phase 6 populates this based on the artifact type.
      approvalRequired: candidate.approvalRequired,
      rationale: body.rationale || candidate.rationale,
    });

    // Emit an activity receipt. Best-effort — if the migration hasn't run
    // yet, the helper logs and returns null without breaking the route.
    await createActivityReceipt({
      personaId: context.personaId,
      intentId: intent.id,
      activeCartridge: intent.activeCartridge,
      actionType: 'intent_queued',
      summary: `Queued: ${intent.intentName}`,
      agentsInvoked: intent.targetAgents,
      toolsUsed: [],
      iqubesUsed: ['PersonaQube', 'ExperienceQube', 'IntentQube'],
      contextShared: ['nbe-catalogue-entry'],
      approvalsGranted: candidate.approvalRequired ? [] : [intent.id],
    }).catch(() => undefined);

    const queueMessage = candidate.approvalRequired
      ? 'Queued for Aigent Me — approval required before any external action.'
      : candidate.specialist
        ? `Queued for Aigent Me — will coordinate with ${candidate.specialist} when Phase 5 specialist routing lands.`
        : 'Queued for Aigent Me — will execute when Phase 5/6 ship the runtime pipeline.';

    const surface: IntentApiSurface = {
      intentId: intent.id,
      intentName: intent.intentName,
      status: intent.status,
      cartridge: intent.activeCartridge,
      approvalRequired: intent.approvalRequired,
      targetAgents: intent.targetAgents,
      allowedTools: intent.allowedTools,
      createdAt: intent.createdAt,
      queueMessage,
    };

    return NextResponse.json(surface, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/intent] create failed: ${msg}`);
    return NextResponse.json(
      { error: 'intent-create-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
