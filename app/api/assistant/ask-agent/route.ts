/**
 * POST /api/assistant/ask-agent
 *
 * Aigent Me Phase 5 — Specialist Routing.
 * Per PRD v0.2 §12 (Ask specialist agent), §5.4 (alpha multi-agent
 * coordination), and §11 (SpecialistAgent Request / Response shapes).
 *
 * Body:
 *   {
 *     specialistId: 'marketa' | 'quill' | 'kn0w1' | 'aigent-z' | 'aigent-c';
 *     intentId?: string;     // when set, builds context from the queued IntentQube
 *     prompt?: string;       // freeform user prompt
 *     cartridge?: string;    // override; defaults to intent or 'metame'
 *   }
 *
 * Response: SpecialistResponse (services/agents/specialistRouter.ts).
 *
 * Privacy:
 *   - personaId from the spine, never read from body.
 *   - Context packet redacts T0 identifiers before reaching the router.
 *   - BlakQube payload never reaches the specialist — only the meta slice
 *     of the user's ExperienceQube is sent.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getExperienceQube } from '@/services/iqube/experienceQube';
import { getIntentQube } from '@/services/iqube/intentQube';
import {
  askSpecialist,
  type SpecialistId,
  type SpecialistContext,
} from '@/services/agents/specialistRouter';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { runPreflightGather } from '@/services/capabilities/preflight';

export const dynamic = 'force-dynamic';

const VALID_SPECIALISTS: SpecialistId[] = ['marketa', 'quill', 'kn0w1', 'aigent-z', 'aigent-c', 'aigent-nakamoto', 'moneypenny', 'metaye'];

/**
 * Aliases that map short / alternate names back onto the canonical
 * specialist id. Lets callers send 'nakamoto' or 'satoshi' for Aigent
 * Nakamoto without changing the type union.
 */
const SPECIALIST_ALIASES: Record<string, SpecialistId> = {
  nakamoto: 'aigent-nakamoto',
  'aigent-satoshi': 'aigent-nakamoto',
  satoshi: 'aigent-nakamoto',
  'money-penny': 'moneypenny',
  'aigent-moneypenny': 'moneypenny',
  metaye: 'metaye',
  'metayé': 'metaye',
  'aigent-metaye': 'metaye',
};

function resolveSpecialistId(value: unknown): SpecialistId | null {
  if (typeof value !== 'string') return null;
  const lowered = value.toLowerCase();
  if ((VALID_SPECIALISTS as string[]).includes(lowered)) return lowered as SpecialistId;
  return SPECIALIST_ALIASES[lowered] ?? null;
}


interface PostBody {
  specialistId?: string;
  intentId?: string;
  prompt?: string;
  cartridge?: string;
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
  const resolvedSpecialistId = resolveSpecialistId(body.specialistId);
  if (!resolvedSpecialistId) {
    return NextResponse.json(
      {
        error: 'invalid-specialist',
        detail:
          `specialistId must be one of: ${VALID_SPECIALISTS.join(', ')} ` +
          `(aliases: ${Object.keys(SPECIALIST_ALIASES).join(', ')})`,
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    // Build the bounded context packet. The router never sees raw BlakQube
    // values — only the meta slice of the persona's ExperienceQube.
    const qube = await getExperienceQube(context.personaId);
    let intentName = body.prompt?.trim() || 'a general consultation';
    let intentRationale: string | null = null;
    let activeCartridge = body.cartridge || qube?.meta.activeCartridges[0] || 'metame';

    if (body.intentId) {
      const intent = await getIntentQube(body.intentId);
      if (intent) {
        intentName = intent.intentName;
        intentRationale = intent.rationale;
        activeCartridge = intent.activeCartridge || activeCartridge;
      }
    }

    // Capability Gateway — Pattern A pre-flight gather. Enrichment only:
    // any deny / adapter failure / throw returns null and the request
    // proceeds with the original rationale.
    const preflight = await runPreflightGather({
      persona: context,
      surfaceId: resolvedSpecialistId,
      query: intentName,
      cartridge: activeCartridge,
      intentId: body.intentId ?? null,
    });
    const enrichedRationale = preflight
      ? `Pre-flight gather (workOrder=${preflight.workOrderId}): ${preflight.summary}` +
        (intentRationale ? `\n\n${intentRationale}` : '')
      : intentRationale;

    const specialistContext: SpecialistContext = {
      activeCartridge,
      experienceName: qube?.meta.experienceName ?? null,
      experienceType: qube?.meta.experienceType ?? 'venture_building',
      primaryGoal: qube?.meta.primaryGoal ?? null,
      currentStage: qube?.meta.currentStage ?? 'setup',
      activeCartridges: qube?.meta.activeCartridges ?? ['metame'],
      intentName,
      intentRationale: enrichedRationale,
      ...(body.prompt ? { userPrompt: body.prompt } : {}),
    };

    const response = await askSpecialist({
      specialistId: resolvedSpecialistId,
      context: specialistContext,
    });

    // Emit a 'specialist_consulted' receipt. Best-effort; non-fatal.
    await createActivityReceipt({
      personaId: context.personaId,
      intentId: body.intentId ?? null,
      activeCartridge,
      actionType: 'specialist_consulted',
      summary: `Consulted ${response.specialistLabel}: ${response.title}`,
      agentsInvoked: ['aigent-me', resolvedSpecialistId],
      toolsUsed: [response.source === 'llm' ? 'openai' : 'template'],
      iqubesUsed: ['PersonaQube', 'ExperienceQube', 'IntentQube'],
      contextShared: ['intent-summary', 'experience-meta-slice'],
    }).catch(() => undefined);

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/ask-agent] failed: ${msg}`);
    return NextResponse.json(
      { error: 'ask-agent-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
