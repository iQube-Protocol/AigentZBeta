/**
 * Ian Boundary Research journey — authoritative state assembly, extracted
 * (2026-08-26) from `app/api/journey/ian/state/route.ts`'s own inline
 * `fetchAuthoritativePlatformState` so it has ONE callable home rather than
 * being trapped inside a route handler. The route becomes a thin wrapper
 * around this function; behaviour is unchanged.
 *
 * Why this needed to move: the Threshold MCP gateway (services/threshold/)
 * resolves identity from a bearer token — via `resolvePersonaIdByPublicRef`,
 * never a browser `NextRequest`/cookie session — so it cannot call the route
 * handler directly, but it CAN call this personaId/authProfileId-parameterized
 * function exactly as the route itself does (services/threshold/
 * constitutionalNavigator.ts is the consumer). Extending, not duplicating
 * (inv.engineering.036/037): there is still exactly one place that assembles
 * Ian's journey evidence.
 */

import type { AuthoritativePlatformState as JourneyAuthState } from '@/services/journey/resolveJourneyState';
import { listActivityReceiptsForPersona } from '@/services/receipts/activityReceiptService';
import { hasActiveDelegation } from '@/services/delegation/delegationGrantStore';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { listMyExchanges, getExchangeView } from '@/services/research/reciprocalExchange';
import { hasCrossed } from '@/types/reciprocalExchange';
import { isPassportUsable, loadUsableCitizenPassportForAuthProfile } from '@/services/identity/passportPrincipal';

export interface IanAuthoritativeStateResult {
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
  /**
   * OCSGA Presence recognition fix (2026-08-27) — the recognized Passport's
   * class and T2-safe public reference, threaded through ONLY when
   * `citizenPassportUsable` is true, so a recognized-state UI (e.g.
   * PassportBureauApplyTab's "you already hold a Passport" banner) can name
   * WHAT was recognized without re-deriving it and without ever exposing the
   * raw Passport UUID. `null` when no usable Citizen Passport was found.
   */
  citizenPassportClass: string | null;
  citizenPassportRef: string | null;
}

export async function fetchIanAuthoritativePlatformState(
  personaId: string | null,
  authProfileId: string | null,
): Promise<IanAuthoritativeStateResult> {
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
      citizenPassportClass: null,
      citizenPassportRef: null,
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
  let citizenPassportClass: string | null = null;
  let citizenPassportRef: string | null = null;

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
      if (citizenPassportUsable && credential.ok) {
        citizenPassportClass = credential.passport.passportClass;
        citizenPassportRef = credential.passport.personaPublicRef ?? null;
      }
    }
  }

  /*
   * OCSGA Presence recognition fix (2026-08-27, root-caused from a live
   * "Acting as Aigent Z" audit — see codexes/packs/agentiq/updates for the
   * full trace). `hasReceiptType('passport_issued')` is scoped to THIS
   * `personaId` alone: it is true only for the persona that itself claimed a
   * Passport. A Passport belongs to personhood, a level BENEATH persona
   * (services/identity/passportPrincipal.ts's header) — when the ACTIVE
   * persona is an agent persona (e.g. Aigent Z) acting for a human principal
   * who already claimed a Citizen Passport under their OWN persona, that
   * receipt was written for the human's persona, never Aigent Z's, so the
   * receipt-only check reported "not yet established" for a genuinely
   * established Presence and re-offered the class-selection wizard from
   * scratch (the defect this fix closes).
   *
   * `citizenPassportUsable` is already resolved the CORRECT way — by
   * authProfileId, walking every persona the caller's auth account owns
   * (services/identity/passportPrincipal.ts's `loadUsableCitizenPassportForAuthProfile`,
   * the same principal-first direction RES-2026-08-15-PASSPORT-PRINCIPAL-
   * FIRST-SUPERSESSION-001 established: never persona-upward, never a second
   * per-persona requirement). OR-ing it in here means Presence is satisfied
   * by EITHER evidence — the direct receipt (the common case: a human
   * claiming their own Passport under their own persona) OR the
   * authProfile-wide Citizen Passport fact (the agent-acting-for-principal
   * case) — never by an invite alone (canary 4 below still holds:
   * `activeExchangeId`/`listMyExchanges` are never consulted here).
   *
   * This does NOT invent a second Citizen Passport for the agent persona,
   * and does NOT treat delegation as presence (CI-2026-08-15-PRESENCE-
   * LADDER-NOT-AGENCY-001) — it resolves the SAME Passport the principal
   * already claimed, through the principal's own owner chain, exactly as
   * CLAUDE.md's Identity & Access Spine requires.
   */
  const state: JourneyAuthState = {
    stages: {
      orient: { orientation_ritual_completed: hasReceiptType('orientation_ritual_completed') },
      passport: { passport_issued: hasReceiptType('passport_issued') || citizenPassportUsable },
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

  return { state, evidenceGaps, activeExchangeId, citizenPassportUsable, citizenPassportClass, citizenPassportRef };
}
