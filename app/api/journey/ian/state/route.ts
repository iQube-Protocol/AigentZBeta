/**
 * GET /api/journey/ian/state
 *
 * Resolve Ian Boundary Research journey state. Serves as the authoritative
 * state resolver for all Ian-related UI components (JourneyRunSurface, the
 * diagnostic viewer).
 *
 * NOT gated on auth — mirrors app/api/journey/knyts-bridge/state/route.ts's
 * own pattern exactly (2026-08-24 first-touch pass): an unauthenticated
 * caller is not a 401 here. ORIENT is deliberately browsable signed-out (the
 * invitation's first-touch orientation), so `getActivePersona` returning
 * null simply means every persona-scoped evidence lookup is skipped and
 * every stage's evidence stays honestly missing — never fabricated, never a
 * refused response. Only the stage ACTS that write evidence (e.g.
 * /api/journey/ian/orient/acknowledge) require real auth; reading state
 * never does.
 *
 * SPEC-JS-001 §9: Pure, deterministic, no I/O (except required platform
 * fetches). Journey Guidance Principle: a stage is COMPLETE only when every
 * completionEvidence field is present and truthy in the authoritative
 * platform state — never from client navigation or a click.
 *
 * Evidence sources — all real, none fabricated (2026-08-24 surgical pass,
 * replacing the Stage 4 TODO placeholder):
 *   - orient / passport: real activity receipts
 *     (orientation_ritual_completed / passport_issued — both existing,
 *     valid ActivityActionType values).
 *   - delegation-establish: services/delegation/delegationGrantStore.ts's
 *     `hasActiveDelegation` — the real delegation ledger. Optional; absence
 *     never blocks (JS-LAW-002).
 *   - create-deposit / freeze-attestation-ready / freeze-attestation /
 *     exchange-ready / exchange-complete / research-active: the real
 *     Reciprocal Artifact Exchange service (services/research/
 *     reciprocalExchange.ts, PRD-IRL-AX-001) — `listMyExchanges` +
 *     `getExchangeView`. `freeze-attestation-ready` is a presentational-only
 *     stage ("no action, only acknowledgment" per its own description) with
 *     no distinct backing capability, so it derives from the SAME deposit
 *     fact as create-deposit rather than fabricating a separate ceremony.
 *     `research-active` derives from the same `hasCrossed` fact as
 *     exchange-complete (PHASE_CROSS's own completion condition IS reciprocal
 *     exchange completion; research-active's receipt names the identical
 *     constitutional fact, not a second ceremony).
 *
 * Known gap (named, not silently worked around): a persona with more than
 * one concurrent Reciprocal Artifact Exchange would need explicit scoping
 * (e.g. by researchSpaceId) to pick "the" OCSGA collaboration — not needed
 * for Ian's current single-collaboration case. `listMyExchanges` returns the
 * most recently created exchange when more than one exists; see
 * `evidenceGaps` in the response for a live report of any resolution gap
 * encountered on a given request.
 *
 * OCSGA EARLY INVITATION ENTRY (2026-08-25) — `activeExchangeId` already
 * resolved this way for the exchange stages (above) is ALSO the "has this
 * participant associated a collaboration invitation" signal
 * IanOrientationPanel's early Orient-stage invite field and
 * IanJourneyTab.resolveSurfaceProps's Establish Presence routing decision
 * both consume — `listMyExchanges` matches EITHER party
 * (initiator_persona_id OR counterparty_persona_id), and a fresh OCSGA
 * participant has no self-service way to become an initiator (no "create
 * exchange" affordance in IRLExchangeTab's participant-facing landing
 * state), so a non-null value here reliably means "an invitation was
 * associated" for the actual OCSGA flow. `citizenPassportUsable` is a
 * SEPARATE, additional field: the same canonical Citizen Passport read
 * app/api/journey/moneypenny-horizen/state/route.ts already uses
 * (services/identity/passportPrincipal.ts), so the routing decision never
 * conflates "has an invite" with "holds a Citizen Passport" — the whole
 * point of the constitutional distinction this entry point exists to
 * preserve.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { JourneyRuntimeState } from '@/types/journey';
import { resolveJourneyState } from '@/services/journey/resolveJourneyState';
import type { AuthoritativePlatformState as JourneyAuthState } from '@/services/journey/resolveJourneyState';
import { assembleInteractionContext } from '@/services/journey/interactionContextAssembly';
import { IAN_BOUNDARY_RESEARCH_JOURNEY } from '@/services/journey/ianBoundaryResearchJourney';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { listActivityReceiptsForPersona } from '@/services/receipts/activityReceiptService';
import { hasActiveDelegation } from '@/services/delegation/delegationGrantStore';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { listMyExchanges, getExchangeView } from '@/services/research/reciprocalExchange';
import { hasCrossed } from '@/types/reciprocalExchange';
import { isPassportUsable, loadUsableCitizenPassportForAuthProfile } from '@/services/identity/passportPrincipal';

export const dynamic = 'force-dynamic';

interface AuthoritativeStateResult {
  state: JourneyAuthState;
  /** Honest gap reports — never silently substituted with fabricated truth. */
  evidenceGaps: string[];
  activeExchangeId: string | null;
  /**
   * OCSGA early invitation entry (2026-08-25) — the SAME canonical Citizen
   * Passport read app/api/journey/moneypenny-horizen/state/route.ts already
   * uses, never re-derived from `passport_issued` receipts (that receipt
   * type does not distinguish a Citizen from an Agent Passport — see
   * types/journey.ts's `citizenPassportUsable` doc comment).
   */
  citizenPassportUsable: boolean;
}

async function fetchAuthoritativePlatformState(
  personaId: string | null,
  authProfileId: string | null,
): Promise<AuthoritativeStateResult> {
  const evidenceGaps: string[] = [];

  if (!personaId) {
    evidenceGaps.push(
      'No signed-in persona yet — every stage past Orient stays honestly not-yet-started until sign-in resolves.',
    );
    return {
      state: { stages: {}, receiptRefs: {} },
      evidenceGaps,
      activeExchangeId: null,
      citizenPassportUsable: false,
    };
  }

  const receipts = await listActivityReceiptsForPersona(personaId, {
    actionTypes: ['orientation_ritual_completed', 'passport_issued'],
    limit: 20,
  });
  const hasReceiptType = (type: string) => receipts.some((r) => r.actionType === type);
  const receiptIdsFor = (type: string) => receipts.filter((r) => r.actionType === type).map((r) => r.id);

  const delegationActive = await hasActiveDelegation(personaId).catch(() => false);

  let yourDeposited = false;
  let yourFrozen = false;
  let yourSigned = false;
  let crossed = false;
  let activeExchangeId: string | null = null;
  let citizenPassportUsable = false;

  const admin = getSupabaseServer();
  if (!admin) {
    evidenceGaps.push(
      'Supabase server client unavailable — cannot resolve Reciprocal Artifact Exchange state; deposit/freeze/sign/cross stages read as not-yet-established, not fabricated.',
    );
  } else {
    const mine = await listMyExchanges(admin, personaId);
    if (!mine.ok) {
      evidenceGaps.push(`listMyExchanges failed: ${mine.error}`);
    } else if (mine.exchanges.length === 0) {
      evidenceGaps.push(
        'No Reciprocal Artifact Exchange record exists yet for this persona — deposit/freeze/sign/cross stages are honestly not-yet-started, not a fabricated gate.',
      );
    } else {
      if (mine.exchanges.length > 1) {
        evidenceGaps.push(
          `Persona participates in ${mine.exchanges.length} Reciprocal Artifact Exchanges — using the most recent (${mine.exchanges[0].id}). Multi-exchange scoping is a known follow-on gap, not needed for the current single-collaboration case.`,
        );
      }
      const exchange = mine.exchanges[0];
      activeExchangeId = exchange.id;
      const view = await getExchangeView(admin, { exchangeId: exchange.id, personaId });
      if (!view.ok) {
        evidenceGaps.push(`getExchangeView failed: ${view.error}`);
      } else {
        yourDeposited = view.view.yourArtifact !== null;
        yourFrozen = Boolean(view.view.yourArtifact?.frozen);
        yourSigned = Boolean(view.view.yourArtifact?.signed);
        crossed = hasCrossed(view.view.exchange.status);
      }
    }

    // OCSGA early invitation entry (2026-08-25) — the SAME canonical Citizen
    // Passport read Horizen's own state route uses, never the coarser
    // `passport_issued` receipt (which does not distinguish a Citizen from
    // an Agent Passport). Skipped honestly (stays false, no gap noise for
    // the common case) when the caller has no authProfileId yet.
    if (authProfileId) {
      const credential = await loadUsableCitizenPassportForAuthProfile(admin, authProfileId);
      citizenPassportUsable = credential.ok && isPassportUsable(credential.passport);
    }
  }

  const state: JourneyAuthState = {
    stages: {
      orient: { orientation_ritual_completed: hasReceiptType('orientation_ritual_completed') },
      passport: { passport_issued: hasReceiptType('passport_issued') },
      'delegation-establish': { delegation_active: delegationActive },
      'create-deposit': { iqube_created: yourDeposited, content_deposited: yourDeposited },
      'freeze-attestation-ready': { attestation_ready_acknowledged: yourDeposited },
      'freeze-attestation': { artifact_freeze_initiated: yourFrozen, freeze_signatures_collected: yourFrozen },
      'exchange-ready': { exchange_instrument_signed: yourSigned },
      'exchange-complete': { reciprocal_exchange_completed: crossed },
      'research-active': { boundary_research_access_active: crossed },
    },
    receiptRefs: {
      orientation_ritual_completed: receiptIdsFor('orientation_ritual_completed'),
      passport_issued: receiptIdsFor('passport_issued'),
    },
  };

  return { state, evidenceGaps, activeExchangeId, citizenPassportUsable };
}

export async function GET(request: NextRequest) {
  try {
    // Not gated on auth — see file header. A signed-out visitor's persona is
    // simply null, and every stage's evidence stays honestly missing.
    const persona = await getActivePersona(request).catch(() => null);
    const personaId = persona?.personaId ?? null;
    const authProfileId = persona?.authProfileId ?? null;

    const { state: authState, evidenceGaps, activeExchangeId, citizenPassportUsable } = await fetchAuthoritativePlatformState(
      personaId,
      authProfileId,
    );

    const journeyState: JourneyRuntimeState = resolveJourneyState(IAN_BOUNDARY_RESEARCH_JOURNEY, authState);

    const interactionContext = assembleInteractionContext(
      IAN_BOUNDARY_RESEARCH_JOURNEY,
      journeyState,
      // Authority for THIS journey is "may this persona participate at all" —
      // Journey Spine never manufactures this; absent a dedicated OCSGA
      // admission gate, every persona (including a not-yet-signed-in
      // visitor, who simply cannot progress past what requires identity) is
      // permitted to view journey state — the same posture the KNYTS/CI
      // Bridge state routes take for their own browsable-signed-out stages.
      { permitted: true },
      undefined,
      undefined,
    );

    // activeExchangeId/citizenPassportUsable folded INTO responseState
    // (2026-08-25, OCSGA early invitation entry) so they survive
    // JourneyRunSurface's `json.state` unwrap and reach resolveSurfaceProps
    // via runtimeState — kept ALSO at the top level below for backward
    // compatibility with any existing consumer reading them there.
    const responseState: JourneyRuntimeState = { ...journeyState, interactionContext, activeExchangeId, citizenPassportUsable };

    // Wrapped under `state` — the shape components/journey/JourneyRunSurface.tsx
    // expects from every journey state route (`json.state as JourneyRuntimeState`).
    return NextResponse.json({
      ok: true,
      state: responseState,
      personaAuthenticated: Boolean(personaId),
      activeExchangeId,
      citizenPassportUsable,
      evidenceGaps,
    });
  } catch (err) {
    console.error('[ian-journey-state]', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to resolve journey state', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
