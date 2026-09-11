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

import { randomUUID } from 'crypto';

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  createIntentQube,
  type IntentQubeRecord,
  type SpecialistAgentId,
} from '@/services/iqube/intentQube';
import { NBE_CATALOGUE } from '@/services/orchestration/nbeCatalog';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { resolveOntology, citeResolvedConcepts } from '@/services/constitutional/ontologyResolver';
import { getInvariantsBySeedIds } from '@/services/invariants/store';
import {
  ACTIVATION_CATALOG,
  type ActivationAction,
} from '@/data/activation-catalog';
import type { ActiveCartridgeSlug } from '@/services/iqube/experienceQube';

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

/**
 * Shape used by the intent-create flow downstream. Both the static
 * NBE catalogue entries AND activation-driven actions resolve into
 * this shape so the rest of the route stays agnostic to source.
 */
interface ResolvedCandidate {
  id: string;
  label: string;
  rationale: string;
  cartridge: ActiveCartridgeSlug;
  approvalRequired: boolean;
  specialist: SpecialistAgentId | null;
  suggestedArtifact: string | null;
}

function resolveCandidate(nbeId: string): ResolvedCandidate | null {
  // Static catalogue first — fast path, no parsing.
  const fromCatalogue = NBE_CATALOGUE.find((c) => c.id === nbeId);
  if (fromCatalogue) {
    return {
      id: fromCatalogue.id,
      label: fromCatalogue.label,
      rationale: fromCatalogue.rationale,
      cartridge: fromCatalogue.cartridge,
      approvalRequired: fromCatalogue.approvalRequired,
      specialist: (fromCatalogue.specialist ?? null) as SpecialistAgentId | null,
      suggestedArtifact: fromCatalogue.suggestedArtifact ?? null,
    };
  }
  // Activation-driven: `activation:<activationId>:<action>`. Look up
  // the matching entry in ACTIVATION_CATALOG + the action declared on
  // it. Returns null if either lookup misses; the caller surfaces a
  // 400 with a clear hint about the expected shape.
  const m = nbeId.match(/^activation:([^:]+):(.+)$/);
  if (!m) return null;
  const [, activationId, actionKey] = m;
  const entry = ACTIVATION_CATALOG.find((e) => e.id === activationId);
  if (!entry) return null;
  const action: ActivationAction | undefined = (entry.actions ?? []).find((a) => a.action === actionKey);
  if (!action) return null;
  // ActivationCatalogEntry.sourceCartridge is `ActiveCartridgeSlug | 'metame'`
  // — both are valid for IntentQube's activeCartridge field.
  const cartridge = entry.sourceCartridge as ActiveCartridgeSlug;
  return {
    id: nbeId,
    label: action.label,
    rationale: action.rationale,
    cartridge,
    approvalRequired: !!action.approvalRequired,
    specialist: (action.specialist ?? null) as SpecialistAgentId | null,
    suggestedArtifact: null,
  };
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

  // Two id namespaces are valid:
  //   1) Static catalogue ids (e.g. 'metame.update-experience-goals') —
  //      resolved against NBE_CATALOGUE as before.
  //   2) Phase 2 B.2 activation-driven ids (e.g.
  //      'activation:mycanvas:draft-canvas-entry') — resolved against
  //      ACTIVATION_CATALOG entries. The cockpit's Recommended row
  //      surfaces these IDs whenever the persona has the originating
  //      activation switched on.
  const candidate = resolveCandidate(body.nbeId);
  if (!candidate) {
    return NextResponse.json(
      {
        error: 'unknown-nbeId',
        detail: `nbeId '${body.nbeId}' is not in the catalogue. Valid static ids: ${NBE_CATALOGUE.map((c) => c.id).join(', ')}. Activation-driven ids must use the pattern 'activation:<activationId>:<action>' and reference a known activation + action.`,
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

    // Emit one specialist_invoked event per non-aigentMe target agent.
    // Makes "Aigent Z will liaise with Marketa" pill copy backed by a
    // real orchestration_events row that the workbench timeline can
    // surface. Fire-and-forget — never blocks intent creation latency.
    // T0 fields (persona_id, etc.) intentionally not in metadata.
    const specialists = intent.targetAgents.filter((a) => a !== 'aigent-me');
    for (const specialist of specialists) {
      void emitOrchestrationEvent({
        event_id: randomUUID(),
        event_type: 'specialist_invoked',
        from_role: 'aigent-z',
        to_role: 'guide-agent',
        reason: intent.intentName,
        journey_stage: 'first',
        active_cartridge: intent.activeCartridge,
        active_codex: null,
        receipt_eligible: true,
        timestamp: intent.createdAt,
        metadata: {
          intent_id: intent.id,
          intent_name: intent.intentName,
          intent_type: intent.intentType,
          specialist,
          target_agents: intent.targetAgents,
          nbe_id: body.nbeId,
        },
      });
    }

    // Canonical Ontology (CFS-015): resolve the intent's operator-facing
    // text against canon. Enrichment-only — any failure yields null and
    // the queue proceeds unresolved.
    const resolution = await resolveOntology(
      `${intent.intentName}\n${body.rationale || candidate.rationale}`,
    ).catch(() => null);

    // CFS-008 §2 — the governing invariant rows for concepts resolved in
    // this intent's text, mapped seed-id → DB row id for the receipt's
    // invariantsUsed instrumentation. Best-effort: any failure (or an
    // empty resolution) omits the field entirely — never an empty array.
    let invariantsUsed: string[] | null = null;
    if (resolution) {
      const seedIds = Array.from(
        new Set(resolution.resolvedTerms.flatMap((t) => t.invariantIds)),
      );
      if (seedIds.length > 0) {
        invariantsUsed = await getInvariantsBySeedIds(seedIds)
          .then((rows) => (rows.length > 0 ? rows.map((r) => r.id) : null))
          .catch(() => null);
      }
    }

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
      ...(invariantsUsed ? { invariantsUsed } : {}),
      contextShared: ['nbe-catalogue-entry'],
      approvalsGranted: candidate.approvalRequired ? [] : [intent.id],
    }).catch(() => undefined);

    // Reach citation (Law XII) for the resolved concepts' governing
    // invariants — fire-and-forget, never blocks the queue response.
    if (resolution) void citeResolvedConcepts(resolution).catch(() => {});

    const queueMessage = candidate.approvalRequired
      ? 'Queued for aigentMe — approval required before any external action.'
      : candidate.rationale
        ? candidate.rationale
        : `${candidate.label} — queued as an internal action.`;

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
