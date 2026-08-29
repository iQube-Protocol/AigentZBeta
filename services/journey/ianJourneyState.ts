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

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthoritativePlatformState as JourneyAuthState } from '@/services/journey/resolveJourneyState';
import {
  listActivityReceiptsForPersona,
  listActivityReceiptsForPersonas,
} from '@/services/receipts/activityReceiptService';
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

/**
 * Principal-identity enforcement for the orientation ritual (2026-08-29,
 * "harden principal-only orientation before asking Ian to acknowledge").
 *
 * ROOT CAUSE THIS CLOSES: `app/api/journey/ian/orient/acknowledge/route.ts`
 * previously wrote `orientation_ritual_completed` under WHICHEVER persona
 * `getActivePersona(request)` returned, with no check that this persona was
 * actually capable of being a constitutional principal. Live inspection
 * (Bug C investigation) found Ian's own orientation receipt attributed to
 * `25ebf4ca…` — his bound aigentMe agent's OWN persona row
 * (`personas.type = 'AigentMe'`), not his human "Ian Andrew McCoy" persona
 * (`personas.type = 'PersonaQube'`) — because that agent persona happened
 * to be the browser's active persona at the moment he clicked Acknowledge.
 * Orientation is constitutionally principal-only (SPEC-JS-001 §14.4 Phase A
 * never offers it as delegable; delegation is introduced only from Phase B,
 * scoped to artifact handling) — this is a principal-IDENTITY enforcement
 * defect, not an evidence-resolution question, so the fix lives here, at
 * the write path, not in resolveJourneyState.ts or ianJourneyState's own
 * evidence assembly above.
 *
 * Two independent, fail-closed checks, evaluated in order of specificity:
 *
 * 1. WRONG PRINCIPAL — if this auth profile already has a persona bound as
 *    a party (initiator or counterparty) on a Reciprocal Artifact Exchange,
 *    THAT persona is the canonical principal for this journey/exchange, and
 *    the acting persona must be exactly it. Catches a sibling persona under
 *    the SAME auth profile (the agent's own persona row included) acting in
 *    place of the one the exchange is actually bound to — the exact defect
 *    that produced Ian's misattributed receipt.
 * 2. NOT A PRINCIPAL-TYPE PERSONA — before any exchange exists to bind a
 *    specific principal (a fresh, pre-invitation visitor), the acting
 *    persona's own `personas.type` must be `'PersonaQube'` (the canonical
 *    human/citizen persona type — see types/persona.ts) — never `'AigentMe'`,
 *    `'AgentDelegate'`, or any other agent-kind type. An agent-kind persona
 *    can never be a constitutional principal, exchange-bound or not.
 *
 * NEVER silently substitutes the principal, NEVER manufactures delegated
 * provenance (no `agentsInvoked` entry is invented here — see the route:
 * a refused attempt writes nothing at all), and NEVER touches the old
 * misattributed receipt — confirming/repairing/copying it is out of scope
 * for this identity-enforcement fix.
 *
 * CANONICAL RULE, TWO CALL SITES (2026-08-29, Implementation Singularity —
 * inv.constitutional.361/362, appendix-a_canonical-invariants.md). This is
 * the ONE function that decides "does personaId count as the constitutional
 * principal for this authProfileId's journey" — never re-derived elsewhere:
 *
 *   - WRITE: app/api/journey/ian/orient/acknowledge/route.ts calls this with
 *     the ACTING persona, before writing a new receipt.
 *   - READ: resolveOrientationEvidence (below) calls this with the persona
 *     OWNING an existing orientation_ritual_completed receipt, before
 *     trusting that receipt as evidence the journey's Orient stage is
 *     satisfied. Closes the gap where a bare persona-scoped
 *     `hasReceiptType` read let Ian's constitutionally invalid,
 *     aigentMe-attributed receipt mark Orient COMPLETE — which shadowed the
 *     Orientation UI (including the write gate above) from ever being
 *     reachable, for whichever persona his browser had active.
 *
 * Read and write may reach different verdicts (a receipt can exist under a
 * persona that would currently be refused at write time), but both ask this
 * SAME function the SAME question. Never fork a second, slightly different
 * definition of who counts as principal.
 */
export type OrientationPrincipalGateResult =
  | { ok: true }
  | { ok: false; reason: 'wrong-principal'; expectedPersonaId: string; expectedDisplayName: string | null }
  | { ok: false; reason: 'not-principal-type' };

export async function resolveOrientationPrincipalGate(
  admin: SupabaseClient,
  input: { personaId: string; authProfileId: string },
): Promise<OrientationPrincipalGateResult> {
  // 1. Every persona this auth profile owns — the search space for "is a
  //    SIBLING of the acting persona already the exchange's bound principal".
  const { data: siblingRows } = await admin
    .from('personas')
    .select('id')
    .eq('auth_profile_id', input.authProfileId);
  const siblingIds = (siblingRows ?? [])
    .map((r) => (r as { id?: unknown }).id)
    .filter((id): id is string => typeof id === 'string');

  if (siblingIds.length > 0) {
    const idList = siblingIds.join(',');
    const { data: exchangeRows } = await admin
      .from('reciprocal_exchanges')
      .select('initiator_persona_id, counterparty_persona_id')
      .or(`initiator_persona_id.in.(${idList}),counterparty_persona_id.in.(${idList})`)
      .order('created_at', { ascending: false })
      .limit(1);
    const exchange = (exchangeRows ?? [])[0] as
      | { initiator_persona_id: string | null; counterparty_persona_id: string | null }
      | undefined;
    if (exchange) {
      const expectedPersonaId =
        [exchange.initiator_persona_id, exchange.counterparty_persona_id].find(
          (id): id is string => typeof id === 'string' && siblingIds.includes(id),
        ) ?? null;
      if (expectedPersonaId && expectedPersonaId !== input.personaId) {
        const { data: expectedRow } = await admin
          .from('personas')
          .select('display_name')
          .eq('id', expectedPersonaId)
          .maybeSingle();
        return {
          ok: false,
          reason: 'wrong-principal',
          expectedPersonaId,
          expectedDisplayName: (expectedRow as { display_name?: string | null } | null)?.display_name ?? null,
        };
      }
    }
  }

  // 2. No exchange-bound principal to compare against yet — the acting
  //    persona itself must still be a principal-capable (PersonaQube) type.
  const { data: actingRow } = await admin
    .from('personas')
    .select('type')
    .eq('id', input.personaId)
    .maybeSingle();
  const actingType = (actingRow as { type?: string | null } | null)?.type ?? null;
  if (actingType !== 'PersonaQube') {
    return { ok: false, reason: 'not-principal-type' };
  }

  return { ok: true };
}

export interface OrientationEvidenceResult {
  complete: boolean;
  /** The specific receipt id that satisfied evidence, or null if none did. */
  receiptId: string | null;
}

/**
 * Principal-aware Orientation evidence resolution — the READ-side half of
 * the 2026-08-29 fix (`resolveOrientationPrincipalGate` above is the WRITE
 * side; see that function's own doc comment for why these must ask the
 * same question).
 *
 * ROOT CAUSE THIS CLOSES: the prior read was a bare
 * `hasReceiptType('orientation_ritual_completed')` scoped only to whichever
 * persona the caller's browser currently has active — no principal-type or
 * exchange-binding check at all. Ian's real, constitutionally invalid
 * aigentMe-attributed receipt therefore satisfied Orient for that exact
 * persona, which shadowed the Orientation/Acknowledge UI from ever
 * rendering (the resolver believed Orient was already complete), making the
 * hardened write gate unreachable in practice.
 *
 * This widens the SEARCH (every persona under the same auth profile may
 * hold the deciding receipt — a receipt is persona-scoped, and the valid
 * one may not belong to whichever persona happens to be active right now)
 * but never widens WHO COUNTS (each candidate receipt's owning persona is
 * still run through the exact same `resolveOrientationPrincipalGate` the
 * write path uses — an agent-kind sibling's own receipt is refused exactly
 * as it would be refused at write time).
 *
 * Never deletes, rewrites, or reassigns any receipt — a persona whose
 * receipt fails the gate simply does not count as evidence; the row is
 * untouched.
 */
export async function resolveOrientationEvidence(
  admin: SupabaseClient | null,
  input: { personaId: string; authProfileId: string | null },
): Promise<OrientationEvidenceResult> {
  if (!admin) {
    // No DB — cannot verify principal attribution, so a bare unverifiable
    // receipt must not be trusted. Honestly incomplete, never fabricated.
    return { complete: false, receiptId: null };
  }
  if (!input.authProfileId) {
    // No auth profile resolved yet — cannot determine siblings or run the
    // canonical gate (which requires one). Same fail-closed posture.
    return { complete: false, receiptId: null };
  }

  // Every persona under this auth profile is a candidate — the receipt
  // that decides Orient may belong to a sibling other than whichever
  // persona is currently active.
  const { data: siblingRows } = await admin
    .from('personas')
    .select('id')
    .eq('auth_profile_id', input.authProfileId);
  const siblingIds = (siblingRows ?? [])
    .map((r) => (r as { id?: unknown }).id)
    .filter((id): id is string => typeof id === 'string');
  const candidatePersonaIds = siblingIds.length > 0 ? siblingIds : [input.personaId];

  const receipts = await listActivityReceiptsForPersonas(candidatePersonaIds, {
    actionTypes: ['orientation_ritual_completed'],
    limit: 20,
  });
  if (receipts.length === 0) return { complete: false, receiptId: null };

  // Newest first (listActivityReceiptsForPersonas orders by created_at
  // descending) — the first receipt whose OWNING persona passes the
  // canonical principal gate is the evidence. A receipt whose persona
  // fails (delegated agent, unrelated sibling) is skipped, never repaired.
  for (const { record, personaId: receiptPersonaId } of receipts) {
    const gate = await resolveOrientationPrincipalGate(admin, {
      personaId: receiptPersonaId,
      authProfileId: input.authProfileId,
    });
    if (gate.ok) return { complete: true, receiptId: record.id };
  }
  return { complete: false, receiptId: null };
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

  // passport_issued stays a bare active-persona-scoped read (Presence
  // evidence semantics are explicitly out of scope for this fix — see
  // codexes/packs/agentiq/updates/2026-08-29_ocsga-orientation-read-path-principal-gate.md).
  const receipts = await listActivityReceiptsForPersona(personaId, {
    actionTypes: ['passport_issued'],
    limit: 20,
  });
  const hasReceiptType = (type: string) => receipts.some((r) => r.actionType === type);
  const receiptIdsFor = (type: string) => receipts.filter((r) => r.actionType === type).map((r) => r.id);

  const delegationActive = await hasActiveDelegation(personaId).catch(() => false);

  let yourDeposited = false;
  let yourPendingPrincipalAttestation = false;
  let yourFrozen = false;
  let yourSigned = false;
  let crossed = false;
  let activeExchangeId: string | null = null;
  let citizenPassportUsable = false;
  let citizenPassportClass: string | null = null;
  let citizenPassportRef: string | null = null;

  const admin = getSupabaseServer();

  // Orient evidence — principal-aware (2026-08-29). Resolved regardless of
  // whether `admin` is available; resolveOrientationEvidence itself fails
  // closed (incomplete, never fabricated) when it is not.
  const orientationEvidence = await resolveOrientationEvidence(admin, { personaId, authProfileId });
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
        yourPendingPrincipalAttestation = Boolean(view.view.yourArtifact?.pendingPrincipalAttestation);
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
      orient: { orientation_ritual_completed: orientationEvidence.complete },
      passport: { passport_issued: hasReceiptType('passport_issued') || citizenPassportUsable },
      'delegation-establish': { delegation_active: delegationActive },
      'create-deposit': { iqube_created: yourDeposited, content_deposited: yourDeposited },
      /*
       * OCSGA Bridge projection fix (2026-08-29). This previously read
       * `attestation_ready_acknowledged: yourDeposited` — treating "an
       * artifact exists" as equivalent to "ready for freeze attestation",
       * with no regard for whether the artifact was operator-registered on
       * the principal's behalf and still awaits their own confirmation
       * (confirmOperatorAssistedArtifact, services/research/
       * reciprocalExchange.ts — the ONLY way pendingPrincipalAttestation
       * ever clears). For Ian's OCSGA exchange the v1.3 artifact was
       * registered operator-assisted; this treated him as already past the
       * confirmation step he had never taken. Deposited-and-not-pending
       * mirrors the ordinary (non-operator-assisted) deposit path exactly,
       * since a self-deposited artifact is never pending — this changes
       * nothing for that path.
       */
      'freeze-attestation-ready': { attestation_ready_acknowledged: yourDeposited && !yourPendingPrincipalAttestation },
      'freeze-attestation': { artifact_freeze_initiated: yourFrozen, freeze_signatures_collected: yourFrozen },
      'exchange-ready': { exchange_instrument_signed: yourSigned },
      'exchange-complete': { reciprocal_exchange_completed: crossed },
      'research-active': { boundary_research_access_active: crossed },
    },
    receiptRefs: {
      // The single receipt that satisfied the canonical principal gate —
      // never every persona-scoped receipt that merely exists (a refused
      // sibling/agent receipt is not evidence and must not be cited as if
      // it were).
      orientation_ritual_completed: orientationEvidence.receiptId ? [orientationEvidence.receiptId] : [],
      passport_issued: receiptIdsFor('passport_issued'),
    },
  };

  return { state, evidenceGaps, activeExchangeId, citizenPassportUsable, citizenPassportClass, citizenPassportRef };
}
