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
 *   ?agentsInvoked=... // comma-separated agent ids — narrows to receipts
 *                       // naming ANY of these agents as a subject (overlap
 *                       // match against agents_invoked, via
 *                       // listActivityReceiptsForPersona's existing
 *                       // agentsInvoked option). Added 2026-08-08: without
 *                       // this, a caller filtering only by actionType gets
 *                       // EVERY agent's receipts of that type the acting
 *                       // persona has ever written — e.g. Nakamoto's
 *                       // horizen_agent_registered receipt rendering as
 *                       // MoneyPenny's Register evidence, because both were
 *                       // registered by the same operator persona. See
 *                       // components/journey/StageReceiptsDrawer.tsx.
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
 * Batch-enrich every receipt with parentIntentId (direct parent) and
 * rootIntentId (root ancestor) by walking the nbe_plans rationale chain.
 *
 * Walks up to 2 levels so grandchild receipts (depth 2) resolve to the
 * origin root. We issue at most 2 DB queries: one for the direct
 * intentIds, one for any parent-level intentIds not yet fetched.
 *
 * rootIntentId is used by myLedger to fold ALL generations of a chain
 * into one capsule (Content Capsule Containment golden rule, CLAUDE.md).
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

  const SENTINEL = '__intent_qube_v1__:';
  function extractParent(rationale: string | null): string | null {
    if (!rationale || !rationale.startsWith(SENTINEL)) return null;
    try {
      const extras = JSON.parse(rationale.slice(SENTINEL.length)) as {
        parentIntentId?: string | null;
      };
      return extras.parentIntentId ?? null;
    } catch {
      return null;
    }
  }

  // Level-1: direct intentIds from receipts.
  const { data: level1, error: e1 } = await admin
    .from('nbe_plans')
    .select('id, rationale')
    .eq('persona_id', personaId)
    .in('id', intentIds);
  if (e1 || !level1) return receipts;

  const parentByIntent = new Map<string, string | null>();
  for (const row of level1 as Array<{ id: string; rationale: string | null }>) {
    parentByIntent.set(row.id, extractParent(row.rationale));
  }

  // Level-2: parent intentIds not already fetched — resolves grandparents
  // so grandchild receipts can map to the root ancestor.
  const parentIds = Array.from(
    new Set(
      [...parentByIntent.values()].filter((id): id is string => !!id && !parentByIntent.has(id)),
    ),
  );
  const grandparentByIntent = new Map<string, string | null>();
  if (parentIds.length > 0) {
    const { data: level2 } = await admin
      .from('nbe_plans')
      .select('id, rationale')
      .eq('persona_id', personaId)
      .in('id', parentIds);
    for (const row of (level2 ?? []) as Array<{ id: string; rationale: string | null }>) {
      grandparentByIntent.set(row.id, extractParent(row.rationale));
    }
  }

  // Walk the chain to find the root (highest ancestor with no parent).
  function findRoot(intentId: string): string | null {
    const parent = parentByIntent.get(intentId);
    if (!parent) return null; // intentId is already the root
    const grandparent =
      grandparentByIntent.get(parent) ?? parentByIntent.get(parent) ?? null;
    if (!grandparent) return parent; // parent is the root
    return grandparent; // grandparent is the root
  }

  return receipts.map((r) => ({
    ...r,
    parentIntentId: r.intentId ? (parentByIntent.get(r.intentId) ?? null) : null,
    rootIntentId: r.intentId ? findRoot(r.intentId) : null,
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
  // Guided Journey Runtime evidence drawers (components/journey/
  // StageReceiptsDrawer.tsx, 2026-07-31) — the Register/Verify/Claim
  // stages' own receiptTypes (services/journey/horizenMoneyPennyJourney.ts).
  // This filter is an allowlist of what a caller may FILTER BY, never an
  // access gate (persona_id scoping above is the real gate) — so adding a
  // type here is safe and additive, never a security change.
  'agent_card_discovered',
  'horizen_agent_registered',
  'horizen_pulse_authorized',
  'horizen_pnl_transparency_enabled',
  'agent_card_enriched',
  'agent_control_proven',
  'marketa_eligibility_recommended',
  'marketa_eligibility_assessed',
  'marketa_eligibility_refused',
  'marketa_eligibility_quarantined',
  // Wallet Signing Topology, Register vertical slice (operator ruling
  // 2026-08-01) — the five ceremony-step receipts named in
  // horizenMoneyPennyJourney.ts's Register stage `receiptTypes`. Omitted
  // here when they shipped, so StageReceiptsDrawer's query silently dropped
  // every one of them while the journey's own state resolution (which reads
  // `activity_receipts` directly, with no allowlist) showed the ceremony
  // progressing correctly — "no receipts recorded for this stage" even
  // though the receipts existed.
  'principal_registration_mandate_signed',
  'agent_registry_transaction_signed',
  'horizen_registration_submitted',
  'horizen_registration_confirmed',
  'agent_registry_binding_recorded',
  // The SAME drift, found on every OTHER Horizen-MoneyPenny journey stage
  // when auditing the Register-stage gap above (2026-08-08) — each of these
  // is named in a stage's `receiptTypes` in horizenMoneyPennyJourney.ts but
  // was never added here, so StageReceiptsDrawer would show "no receipts
  // recorded" for Passport, Delegate, aigentMe, Ratify's agreement receipts,
  // Deploy, and Standing too, for the identical reason. Third occurrence of
  // this allowlist-drift defect class overall; see
  // tests/assistant-receipts-action-type-allowlist-parity.test.ts, which now
  // asserts EVERY receiptTypes entry across the journey definition is
  // present here so a fourth occurrence fails the build instead of shipping.
  'operator_passport_validated',
  'agent_sponsorship_recorded',
  'passport_issued',
  'agent_delegate_passport_issued',
  // Constitutional State Model Correction (2026-08-11) — the Activate
  // stage's own receipt. See services/journey/agentRegistryActivation.ts.
  'agent_registry_activated',
  'agent_delegated',
  'finance_authoritative_execution',
  'aigentme_activated',
  'experienceqube_focus_disposition_recorded',
  'journey_completed',
  'agreement_formed',
  'agreement_authorized',
  'capability_registered',
  'standing_accrued',
  // Orient stage (Threshold Journey — Orient + Consequence Fork, 2026-08-09)
  // — the acknowledgment/legacy-precedent receipt named in
  // horizenMoneyPennyJourney.ts's Orient stage `receiptTypes`.
  'orientation_ritual_completed',
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
  const agentsInvokedRaw = url.searchParams.get('agentsInvoked');
  const idsRaw = url.searchParams.get('ids');

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
  // No allowlist here, unlike actionType — agent ids are not a closed,
  // access-relevant vocabulary (persona_id scoping above is the real gate),
  // and an unrecognised id simply matches nothing rather than needing one.
  const agentsInvoked: string[] | undefined = agentsInvokedRaw
    ? agentsInvokedRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  // Hydrate an EXACT, caller-named set of receipt ids (CFS-055 coherence
  // pass, 2026-08-10) — for a client consuming a canonical POSIT projection's
  // own receiptRefs, never a fresh type/agent search. Persona-scoped like
  // every other filter here.
  const ids: string[] | undefined = idsRaw
    ? idsRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;

  try {
    const [receipts, personaDisplayLabel] = await Promise.all([
      listActivityReceiptsForPersona(context.personaId, {
        limit,
        ...(cartridge ? { cartridge } : {}),
        ...(actionTypes && actionTypes.length > 0 ? { actionTypes } : {}),
        ...(agentsInvoked && agentsInvoked.length > 0 ? { agentsInvoked } : {}),
        ...(ids && ids.length > 0 ? { ids } : {}),
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
