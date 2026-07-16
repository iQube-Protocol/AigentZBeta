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
import { groundReasoning } from '@/services/invariants/engine';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

/**
 * Build the validated-invariant grounding slice for a specialist consultation
 * (CFS-006 §2). Context-domain-scoped first (the active cartridges), falling
 * back to the platform's highest-standing validated knowledge so the slice is
 * never empty on a seeded substrate. Enrichment-only: any failure yields an
 * empty slice and the consultation proceeds ungrounded (never breaks the ask).
 *
 * This path only GROUNDS — it does not record usage/Reach. A specialist
 * consult is advisory, not an execution; CFS-008 §2 scopes reuse-count to
 * executions, which the consequence runner (executeApproved) records.
 */
async function buildSpecialistInvariantSlice(
  domains: string[],
): Promise<{ packetSlice: SpecialistContext['invariantSlice']; invariantIds: string[] }> {
  try {
    // CFS-035 Phase 1 — grounded through the engine's Reasoning face (groundReasoning)
    // rather than a hand-rolled slice, so every grounded surface shares one seam.
    const scoped = domains.length
      ? (await groundReasoning({ domains, limit: 8 })).slice
      : null;
    const slice = scoped && scoped.items.length > 0
      ? scoped
      : (await groundReasoning({ limit: 8 })).slice;
    return {
      // Packet slice cites by seedId (UUIDs are stripped by the router's
      // redaction net); the raw ids stay server-side for the receipt's
      // CFS-008 invariantsUsed instrumentation.
      packetSlice: slice.items.map((i) => ({
        seedId: i.seedId,
        statement: i.statement,
        namespace: i.namespace,
      })),
      invariantIds: slice.citedIds,
    };
  } catch (err) {
    console.error('[ask-agent] invariant slice build failed (non-fatal)', err);
    return { packetSlice: undefined, invariantIds: [] };
  }
}

// ─── Contact context injection ───────────────────────────────────────────────
// When the user's prompt mentions a person, company, or contacts-related
// keyword, query persona_contacts and prepend a data block to the rationale
// so the LLM answers with real data instead of claiming it has no access.

const CONTACT_INTENT_RE = /\b(contact|contacts|email|phone|reach|who\s+is|find.*person|people|colleague|team|organisation|organization|company|firm|crm)\b/i;
// Matches "how many", "hw many", "how mny", "count", "total", "number of"
const CONTACT_COUNT_RE = /\b(h\w*\s+m\w+|count|total|number\s+of)\b.*\b(contact|contacts|people|crm)\b|\b(contact|contacts|crm)\b.*\b(h\w*\s+m\w+|count|total)\b/i;
// Words that survive the strip but are not useful contact search terms
const FILLER_WORDS = new Set(['many', 'some', 'all', 'much', 'more', 'give', 'have', 'show', 'list', 'tell', 'much', 'few', 'any']);

async function maybeInjectContactContext(
  personaId: string,
  prompt: string,
): Promise<string | null> {
  if (!CONTACT_INTENT_RE.test(prompt)) return null;

  try {
    const supabase = getSupabaseServer();

    // Count query — "how many contacts", "total contacts", etc.
    if (CONTACT_COUNT_RE.test(prompt)) {
      const { count } = await supabase
        .from('persona_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('persona_id', personaId);
      return `The user has ${count ?? 0} contacts in their address book (persona_contacts table). Answer their count question directly using this number.`;
    }

    // Extract likely search terms: strip common question words AND contact-domain
    // meta-words (contact, contacts, people, email, phone) that won't appear in
    // any contact record field, which would create impossible AND conditions in FTS.
    const STRIP_WORDS = /\b(contact|contacts|people|person|email|phone|reach|find|show|list|who|what|where|are|is|my|the|a|an|of|from|in|at|for|to|with|crm)\b/gi;
    const q = prompt
      .replace(STRIP_WORDS, ' ')
      .replace(/[^\w\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 2 && !FILLER_WORDS.has(w.toLowerCase()))
      .slice(0, 6)
      .join(' ');

    // No meaningful search term — return total count as context
    if (!q) {
      const { count } = await supabase
        .from('persona_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('persona_id', personaId);
      return `The user has ${count ?? 0} contacts in their address book. Answer their question using this count.`;
    }

    const { data } = await supabase
      .from('persona_contacts')
      .select('display_name, organization, job_title, email, email_2, phone, phone_2, source')
      .eq('persona_id', personaId)
      .textSearch('fts', q.split(/\s+/).map(w => w + ':*').join(' & '), { config: 'english', type: 'plain' })
      .limit(20);

    if (!data || data.length === 0) return null;

    const rows = data.map((c: any) => {
      const parts = [c.display_name];
      if (c.organization) parts.push(`(${c.organization}${c.job_title ? `, ${c.job_title}` : ''})`);
      if (c.email) parts.push(c.email);
      if (c.phone) parts.push(c.phone);
      return parts.filter(Boolean).join(' — ');
    });

    return [
      `Address book results for "${q}" (${rows.length} contact${rows.length !== 1 ? 's' : ''}):`,
      ...rows.map(r => `  • ${r}`),
      '',
      'Use these contacts to answer the user\'s question directly.',
    ].join('\n');
  } catch {
    return null;
  }
}
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { runPreflightGather } from '@/services/capabilities/preflight';

export const dynamic = 'force-dynamic';

const VALID_SPECIALISTS: SpecialistId[] = ['marketa', 'quill', 'kn0w1', 'aigent-z', 'aigent-c', 'aigent-nakamoto', 'moneypenny', 'metaye', 'researcher'];

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
  'research-copilot': 'researcher',
  'aigent-researcher': 'researcher',
  research: 'researcher',
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
  /**
   * Optional hand-off context — set when the operator pivots from one
   * specialist's response to ask another. The route prefixes the
   * intent rationale with a short hand-off note and tags the receipt
   * with `specialist-handoff` in `contextShared` so the thread can
   * surface the pivot.
   */
  handoff?: {
    fromSpecialistId?: string;
    priorTitle?: string;
    priorReceiptId?: string;
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
    // Hand-off prefix — when the operator pivots from one specialist
    // to another, the new consultation lands with a short note so the
    // receiving specialist's prompt frames itself against the prior
    // take rather than from scratch.
    const handoffFromRaw = body.handoff?.fromSpecialistId;
    const handoffFrom = typeof handoffFromRaw === 'string' && (VALID_SPECIALISTS as string[]).includes(handoffFromRaw)
      ? (handoffFromRaw as SpecialistId)
      : null;
    const handoffPriorTitle = typeof body.handoff?.priorTitle === 'string'
      ? body.handoff.priorTitle.trim().slice(0, 200)
      : null;
    const handoffNote = handoffFrom
      ? `Hand-off from ${handoffFrom}${handoffPriorTitle ? ` (prior take: "${handoffPriorTitle}")` : ''}.`
      : null;

    // Inject contact context when the prompt is contact-related
    const lookupQuery = body.prompt?.trim() || intentName;
    const contactContext = await maybeInjectContactContext(context.personaId, lookupQuery).catch(() => null);

    const rationaleParts: string[] = [];
    if (contactContext) rationaleParts.push(contactContext);
    if (preflight) rationaleParts.push(`Pre-flight gather (workOrder=${preflight.workOrderId}): ${preflight.summary}`);
    if (handoffNote) rationaleParts.push(handoffNote);
    if (intentRationale) rationaleParts.push(intentRationale);
    const enrichedRationale = rationaleParts.length > 0 ? rationaleParts.join('\n\n') : intentRationale;

    // Invariant grounding slice (CFS-006 §2) — validated constitutional memory
    // applicable to this consultation, scoped to the active cartridges.
    const groundingDomains = [
      activeCartridge,
      ...(qube?.meta.activeCartridges ?? []),
    ].filter((d, i, a): d is string => Boolean(d) && a.indexOf(d) === i);
    const { packetSlice: invariantSlice, invariantIds: groundingInvariantIds } =
      await buildSpecialistInvariantSlice(groundingDomains);

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
      ...(invariantSlice && invariantSlice.length > 0 ? { invariantSlice } : {}),
    };

    const response = await askSpecialist({
      specialistId: resolvedSpecialistId,
      context: specialistContext,
    });

    // Emit a 'specialist_consulted' receipt. Best-effort; non-fatal.
    // Persists the full SpecialistResponse body so the operator can
    // re-read what the specialist said from any expand surface — the
    // myWorkspace intent panel, the myLedger card, or a future Pill.
    await createActivityReceipt({
      personaId: context.personaId,
      intentId: body.intentId ?? null,
      activeCartridge,
      actionType: 'specialist_consulted',
      summary: `Consulted ${response.specialistLabel}: ${response.title}`,
      agentsInvoked: ['aigent-me', resolvedSpecialistId],
      toolsUsed: [response.source === 'llm' ? 'openai' : 'template'],
      iqubesUsed: ['PersonaQube', 'ExperienceQube', 'IntentQube'],
      // CFS-008 §2 — the invariants this consultation was grounded in.
      // Receipt-side instrumentation only: a consult is advisory, so this
      // does NOT bump usage/Reach (that's reserved for executions).
      invariantsUsed: groundingInvariantIds,
      contextShared: handoffFrom
        ? ['intent-summary', 'experience-meta-slice', 'specialist-handoff']
        : ['intent-summary', 'experience-meta-slice'],
      specialistResponse: {
        title: response.title,
        summary: response.summary,
        recommendations: response.recommendations,
        suggestedArtifacts: response.suggestedArtifacts,
        confidence: response.confidence,
        source: response.source,
      },
    }).catch(() => undefined);

    // Surface the hand-off on the response so the layout can show a
    // "← Marketa" pill on the rendered card without needing to fetch
    // the receipt.
    const handoffMeta = handoffFrom
      ? { handoffFrom: { specialistId: handoffFrom, priorTitle: handoffPriorTitle ?? '' } }
      : {};
    return NextResponse.json(
      {
        ...response,
        ...(preflight ? { preflightContext: preflight } : {}),
        ...handoffMeta,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/ask-agent] failed: ${msg}`);
    return NextResponse.json(
      { error: 'ask-agent-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
