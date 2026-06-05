/**
 * GET /api/assistant/receipts
 *
 * Aigent Me Phase 6/7 — Activity receipt list.
 * Per PRD v0.2 §11 (ActivityReceipt) and §12.
 *
 * Query params (all optional):
 *   ?limit=20          // 1..100, default 20
 *   ?cartridge=knyt    // filter to one cartridge
 *   ?actionType=...    // comma-separated list
 *
 * Returns the receipt list scoped to the active persona. Persona resolved
 * from spine; never read from query.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  listActivityReceiptsForPersona,
  type ActivityActionType,
  type ActivityReceiptRecord,
} from '@/services/receipts/activityReceiptService';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

/**
 * Batch-look-up parentIntentId for every receipt that has an intentId.
 * Reads the rationale sentinel on `nbe_plans` (where IntentQubes live)
 * and extracts parentIntentId — single query for all distinct ids.
 */
async function enrichWithParentIntentIds(
  receipts: ActivityReceiptRecord[],
  personaId: string,
): Promise<ActivityReceiptRecord[]> {
  const intentIds = Array.from(
    new Set(receipts.map((r) => r.intentId).filter((id): id is string => !!id)),
  );
  if (intentIds.length === 0) return receipts;
  const admin = getSupabaseServer();
  if (!admin) return receipts;
  const { data, error } = await admin
    .from('nbe_plans')
    .select('id, rationale')
    .eq('persona_id', personaId)
    .in('id', intentIds);
  if (error || !data) return receipts;
  const parentByIntent = new Map<string, string | null>();
  const SENTINEL = '__intent_qube_v1__:';
  for (const row of data as Array<{ id: string; rationale: string | null }>) {
    let parent: string | null = null;
    if (row.rationale && row.rationale.startsWith(SENTINEL)) {
      try {
        const extras = JSON.parse(row.rationale.slice(SENTINEL.length)) as {
          parentIntentId?: string | null;
        };
        parent = extras.parentIntentId ?? null;
      } catch {
        parent = null;
      }
    }
    parentByIntent.set(row.id, parent);
  }
  return receipts.map((r) => ({
    ...r,
    parentIntentId: r.intentId ? parentByIntent.get(r.intentId) ?? null : null,
  }));
}

/**
 * T1-safe display label for the active persona. Never returns the
 * persona id, root DiD, or any other T0 identifier. Mirrors the bootstrap
 * route's readPersonaPresentation helper so the receipts surface can
 * display "Acting persona: <displayLabel>" without leaking spine state.
 */
async function readPersonaDisplayLabel(personaId: string): Promise<string | null> {
  try {
    const admin = getSupabaseServer();
    if (!admin) return null;
    const { data } = await admin
      .from('personas')
      .select('display_name')
      .eq('id', personaId)
      .maybeSingle();
    const label = (data as { display_name?: string } | null)?.display_name;
    return typeof label === 'string' && label.trim().length > 0 ? label.trim() : null;
  } catch {
    return null;
  }
}

export const dynamic = 'force-dynamic';

const VALID_ACTION_TYPES = new Set<ActivityActionType>([
  'intent_queued',
  'specialist_consulted',
  'artifact_created',
  'artifact_sent',
  'approval_granted',
  'approval_rejected',
  'experience_model_updated',
  'session_started',
  'session_completed',
]);

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const url = request.nextUrl;
  const limitRaw = url.searchParams.get('limit');
  const cartridge = url.searchParams.get('cartridge') ?? undefined;
  const actionTypesRaw = url.searchParams.get('actionType');

  const limit =
    limitRaw && /^\d+$/.test(limitRaw)
      ? Math.min(Math.max(Number(limitRaw), 1), 100)
      : 20;

  const actionTypes: ActivityActionType[] | undefined = actionTypesRaw
    ? (actionTypesRaw
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is ActivityActionType =>
          VALID_ACTION_TYPES.has(s as ActivityActionType),
        ))
    : undefined;

  try {
    const [receipts, personaDisplayLabel] = await Promise.all([
      listActivityReceiptsForPersona(context.personaId, {
        limit,
        ...(cartridge ? { cartridge } : {}),
        ...(actionTypes && actionTypes.length > 0 ? { actionTypes } : {}),
      }),
      readPersonaDisplayLabel(context.personaId),
    ]);

    // Enrich receipts with parentIntentId so myLedger can group child
    // intent receipts UNDER their parent capsule instead of spawning
    // orphan capsules at the top level. Required by the Content Capsule
    // Containment golden rule (CLAUDE.md): derivative content from a
    // capsule must render inside that capsule.
    const enriched = await enrichWithParentIntentIds(receipts, context.personaId);

    // personaDisplayLabel is T1 only. personaId, authProfileId, and any
    // root DiD are never serialised by this endpoint.
    return NextResponse.json(
      {
        receipts: enriched,
        count: enriched.length,
        personaDisplayLabel,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/receipts] list failed: ${msg}`);
    return NextResponse.json(
      { error: 'receipts-list-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
