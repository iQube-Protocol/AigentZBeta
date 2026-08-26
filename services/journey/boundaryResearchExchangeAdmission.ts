/**
 * boundaryResearchExchangeAdmission.ts — the OCSGA bridge admission boundary
 * (operator directive, 2026-08-26, "structural fix" pass — root-caused from
 * a live audit of Ian's persona `29d22f83-a3cc-49d9-90be-a39391e9d8ae`).
 *
 * ROOT CAUSE THIS FILE CLOSES: a persona can hold a real, correctly-scoped,
 * active Research Lab grant (`access_grants.access_domain='research-lab'`,
 * `allowed_experiments` containing a Research Lab workspace id like
 * 'ocsga-boundary-research') and STILL never reach the substantive part of
 * the OCSGA journey, because `services/journey/ianJourneyState.ts` resolves
 * create-deposit/freeze/sign readiness exclusively from an existing
 * Reciprocal Artifact Exchange (RAX) row — and nothing in the codebase ever
 * turned "holds the CAS grant" into "is a party on a RAX exchange". The two
 * admission systems (CAS `access_grants`, RAX `reciprocal_exchanges`) were
 * structurally disconnected. `getBoundaryResearchReadableExperiments`
 * (services/passport/participationAccess.ts) already existed, was already
 * correctly implemented and tested, and had ZERO production call sites —
 * this file is what finally calls it.
 *
 * WHAT THIS FILE IS: the admission BOUNDARY, called once per read at the
 * edge (the route/adapter that resolves Ian's journey state), never from
 * inside the pure resolver. `resolveJourneyState` stays pure; `ianJourneyState`
 * stays a read-only evidence assembler. This file is the one place a CAS
 * grant is translated into RAX membership, and it is the ONLY thing that
 * writes a `reciprocal_exchanges` row on this path — never a hidden write
 * buried in state resolution.
 *
 * SEMANTICS (idempotent, in priority order):
 *   1. Verify the caller holds a USABLE Citizen Passport (the same canonical
 *      read services/identity/passportPrincipal.ts already provides) and a
 *      resolvable persona.
 *   2. Verify an active `research-lab` grant whose scope reaches
 *      `workspaceId` — via `getBoundaryResearchReadableExperiments`, the
 *      existing, tested, previously-dead resolver. No grant reaching this
 *      workspace => no exchange is provisioned (never a new invitation,
 *      never a second Passport, never IRL OS).
 *   3. If this persona already sits on an exchange tagged to this workspace
 *      (as either party), return it UNCHANGED — the idempotency guarantee.
 *   4. Else, if a JOINABLE canonical exchange for this workspace exists (an
 *      open counterparty slot, in a state `inviteCounterparty` accepts),
 *      bind this persona to it as the counterparty — minting and
 *      immediately consuming a fresh invite code server-side through the
 *      EXISTING `inviteCounterparty`/`joinExchange` primitives, so a second
 *      admitted grant-holder joins the SAME collaboration rather than
 *      getting an isolated one. A human never sees or types this code.
 *   5. Else, create a NEW exchange via the EXISTING `createExchange`
 *      primitive, this persona as initiator, tagged to the workspace via
 *      `parentExperimentId` (a stable, pre-existing text field — not a new
 *      column, not a second tagging mechanism).
 *
 * This module never mutates `access_grants` or the Passport — grant/Passport
 * data is read-only input here, exactly as it should be (repairing a
 * correctly-scoped grant would be the wrong fix; the grant was never wrong).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getBoundaryResearchReadableExperiments } from '@/services/passport/participationAccess';
import { isPassportUsable, loadUsableCitizenPassportForAuthProfile } from '@/services/identity/passportPrincipal';
import { getResearchWorkspace } from '@/services/research/researchWorkspace';
import {
  createExchange,
  inviteCounterparty,
  joinExchange,
  listExchangesByParentExperiment,
  resolveMembership,
} from '@/services/research/reciprocalExchange';
import type { ReciprocalExchangeRecord } from '@/types/reciprocalExchange';

/** The one workspace this admission boundary is wired for today — Ian's
 *  OCSGA / Boundary Research collaboration (services/research/
 *  researchWorkspace.ts's `ocsga-boundary-research` entry). Exported so
 *  every call site (the state route, the MCP navigator adapter) names the
 *  SAME workspace id rather than each hand-copying the string. */
export const OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID = 'ocsga-boundary-research';

export type BoundaryResearchAdmissionRefusalReason =
  | 'no-persona'
  | 'passport-unresolved'
  | 'passport-unusable'
  | 'not-admitted'
  | 'error';

export type EnsureBoundaryResearchExchangeMembershipResult =
  | { ok: true; exchangeId: string; created: boolean; role: 'initiator' | 'counterparty' }
  | { ok: false; reason: BoundaryResearchAdmissionRefusalReason; error?: string };

/** A JOINABLE canonical exchange for this workspace: an open counterparty
 *  slot (`counterpartyPersonaId` null), not this persona's own exchange, and
 *  in a status `inviteCounterparty` itself accepts (A_DEPOSITED or INVITED —
 *  enforced again inside that primitive; checked here only to pick the right
 *  candidate, never duplicating that enforcement). Oldest first (from
 *  `listExchangesByParentExperiment`), so the first participant's exchange
 *  is the one later admitted grant-holders join. */
function findJoinableCanonicalExchange(
  exchanges: ReciprocalExchangeRecord[],
  personaId: string,
): ReciprocalExchangeRecord | null {
  return (
    exchanges.find(
      (ex) =>
        !ex.counterpartyPersonaId &&
        ex.initiatorPersonaId !== personaId &&
        (ex.status === 'A_DEPOSITED' || ex.status === 'INVITED'),
    ) ?? null
  );
}

/**
 * Ensure `personaId` — already verified to hold a usable Passport and an
 * active `research-lab` grant scoped to `workspaceId` — has the Reciprocal
 * Artifact Exchange membership their grant entitles them to. Read-mostly
 * and idempotent: a repeated call after the first provisioning returns the
 * SAME exchange, never a duplicate (SEMANTICS §3 above).
 *
 * `authProfileId` may be null (e.g. not yet resolved) — that reads as
 * `passport-unresolved`, never a fabricated pass.
 */
export async function ensureBoundaryResearchExchangeMembership(
  admin: SupabaseClient,
  input: { personaId: string | null; authProfileId: string | null; workspaceId: string },
): Promise<EnsureBoundaryResearchExchangeMembershipResult> {
  const { personaId, authProfileId, workspaceId } = input;
  if (!personaId) return { ok: false, reason: 'no-persona' };
  if (!authProfileId) return { ok: false, reason: 'passport-unresolved' };

  // 1. Passport — the SAME canonical read every other OCSGA-adjacent surface uses.
  const credential = await loadUsableCitizenPassportForAuthProfile(admin, authProfileId);
  if (!credential.ok || !isPassportUsable(credential.passport)) {
    return { ok: false, reason: 'passport-unusable' };
  }

  // 2. Grant scope — the previously-dead, now-wired production resolver.
  const readable = await getBoundaryResearchReadableExperiments(admin, personaId);
  const admitted = readable === 'all' || readable.has(workspaceId);
  if (!admitted) return { ok: false, reason: 'not-admitted' };

  const existingForWorkspace = await listExchangesByParentExperiment(admin, workspaceId);
  if (!existingForWorkspace.ok) return { ok: false, reason: 'error', error: existingForWorkspace.error };

  // 3. Already a party — idempotent no-op.
  const own = existingForWorkspace.exchanges.find((ex) => resolveMembership(ex, personaId) !== null);
  if (own) {
    return {
      ok: true,
      exchangeId: own.id,
      created: false,
      role: own.initiatorPersonaId === personaId ? 'initiator' : 'counterparty',
    };
  }

  // 4. A joinable canonical exchange — bind as counterparty via the EXISTING
  //    invite+join primitives, minted and consumed here, server-side, so no
  //    human ever sees or types the code.
  const joinable = findJoinableCanonicalExchange(existingForWorkspace.exchanges, personaId);
  if (joinable) {
    const invite = await inviteCounterparty(admin, { exchangeId: joinable.id, personaId: joinable.initiatorPersonaId });
    if (invite.ok) {
      const joined = await joinExchange(admin, { exchangeId: joinable.id, rawCode: invite.rawCode, personaId });
      if (joined.ok) return { ok: true, exchangeId: joined.exchange.id, created: false, role: 'counterparty' };
    }
    // A join race (another admission call bound the slot first) is not an
    // error — fall through to provisioning this persona's own exchange
    // rather than blocking admission on a lost race.
  }

  // 5. No existing membership, nothing joinable — provision this persona's
  //    own exchange via the EXISTING createExchange primitive, tagged to the
  //    workspace so the next admitted grant-holder can find and join it.
  const workspace = getResearchWorkspace(workspaceId);
  const title = workspace?.title ?? workspaceId;
  const purpose = workspace?.description ?? `Boundary Research collaboration — ${workspaceId}`;
  const created = await createExchange(admin, {
    initiatorPersonaId: personaId,
    title,
    purpose,
    permittedPurpose: purpose,
    parentExperimentId: workspaceId,
  });
  if (!created.ok) return { ok: false, reason: 'error', error: created.error };
  return { ok: true, exchangeId: created.exchange.id, created: true, role: 'initiator' };
}
