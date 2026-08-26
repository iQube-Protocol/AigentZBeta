/**
 * nativeActionHandoff.ts — the Differ × Financial Services Bridge pilot,
 * part 4: expiring, single-use handoffs from Differ's projection into an
 * EXACT, EXISTING native metaMe surface.
 *
 * Reuse audit (per the operator's "reuse an existing safe expiring-
 * capability/handoff primitive if one genuinely fits" instruction):
 *   - `services/access/approvalToken.ts` — a stateless, HMAC-signed 5-minute
 *     token. Close in spirit (short TTL, single-purpose) but NOT single-use:
 *     it is re-verified from its own signature every time, with no persisted
 *     "already consumed" record — replaying the same token twice both
 *     succeed. Does not fit "real replay protection."
 *   - `services/accessGateway/humanSession.ts` /
 *     `services/threshold/gatewaySession.ts` (`agent_gateway_sessions`) — a
 *     genuinely single-use, persisted, atomically-consumed handshake
 *     (pending -> authorized -> active), and the closest real fit. Not
 *     reused directly: it is shaped for an OAuth 2.1 DCR + PKCE CROSSING
 *     that mints an ongoing scoped BEARER SESSION for repeated API access —
 *     a materially different, heavier contract than "one opaque, one-shot
 *     navigation link that is spent once and then dead." Forcing this
 *     pilot's concept into that table (no PKCE verifier, no client registry
 *     entry, no ongoing bearer) would be the shape-mismatch CLAUDE.md's
 *     "Extend, Don't Duplicate" warns against — reusing a system because it
 *     is nearby, not because it fits.
 *   - What IS reused: the exact same low-level primitives and idempotency-
 *     guard technique — `sha256`/`newToken` (services/threshold/gatewaySession.ts)
 *     for opaque-token generation and hashed-at-rest storage, and the
 *     `.update({...}).eq('status', 'pending')` atomic single-use consumption
 *     pattern `issueHumanAuthorizationCode` already uses.
 *
 * Eligibility is NEVER trusted from the caller. Both `issueNativeActionHandoff`
 * and `redeemNativeActionHandoff` re-derive `nextActions` from a FRESH call to
 * `resolveFinancialServicesProjection` — the same pure observer the projection
 * endpoint uses — so a client can never hand this module a capabilityRef,
 * nativeSurfaceRef, or journeyId of its own choosing; only `actionRef`
 * (matched against a live, server-computed nextActions entry) and `returnUrl`
 * ever come from the caller.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sha256, newToken } from '@/services/threshold/gatewaySession';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { issuePersonaSessionToken } from '@/services/identity/personaSessionToken';
import { resolveJourneyOperatorDestination } from '@/services/journey/catalogueDestinationHelper';
import {
  resolveFinancialServicesProjection,
  type FinancialServicesPrincipal,
} from '@/services/financialServices/financialServicesObserver';

const TABLE = 'financial_service_native_handoffs';

/** Short-lived — long enough to click through, short enough to bound replay
 *  (same order of magnitude as `approvalToken.ts`'s 5-minute window). */
const HANDOFF_TTL_SECONDS = 5 * 60;

export interface NativeActionHandoff {
  handoffId: string;
  projectionId: string;
  principalPublicRef: string;
  journeyId: string;
  stageId: string | null;
  actionRef: string;
  capabilityRef: string;
  nativeSurfaceRef: string;
  returnUrl: string;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export type IssueHandoffFailureReason =
  | 'store-unavailable'
  | 'invalid-return-url'
  | 'action-not-eligible'
  | 'write-failed';

export type IssueHandoffResult =
  | { ok: true; handoffId: string; expiresAt: string }
  | { ok: false; reason: IssueHandoffFailureReason; detail: string };

function isValidAbsoluteUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Issue a handoff for `actionRef`. Re-derives the current projection
 * server-side and refuses (`action-not-eligible`) unless a `nextActions`
 * entry for this EXACT `actionRef` is currently `handoffEligible: true` —
 * `capabilityRef`/`nativeSurfaceRef`/`journeyId`/`stageId` are all taken from
 * that server-computed entry, never from the caller.
 */
export async function issueNativeActionHandoff(
  admin: SupabaseClient,
  principal: FinancialServicesPrincipal,
  input: { actionRef: string; returnUrl: string; projectionRef?: string | null },
): Promise<IssueHandoffResult> {
  if (!isValidAbsoluteUrl(input.returnUrl)) {
    return { ok: false, reason: 'invalid-return-url', detail: 'returnUrl must be an absolute http(s) URL.' };
  }

  const projection = await resolveFinancialServicesProjection(admin, principal);
  const eligible = projection.nextActions.find(
    (a) => a.actionRef === input.actionRef && a.handoffEligible === true,
  );
  if (!eligible) {
    return {
      ok: false,
      reason: 'action-not-eligible',
      detail: `'${input.actionRef}' is not currently a handoff-eligible next action.`,
    };
  }

  const handoffId = `fshoff_${newToken(24)}`;
  const nowMs = Date.now();
  const expiresAt = new Date(nowMs + HANDOFF_TTL_SECONDS * 1000).toISOString();

  const { error } = await admin.from(TABLE).insert({
    handoff_id_hash: sha256(handoffId),
    status: 'pending',
    principal_public_ref: personaPublicRef(principal.personaId),
    journey_id: projection.journey.id,
    stage_id: projection.journey.currentStageId,
    action_ref: eligible.actionRef,
    capability_ref: eligible.capabilityRef,
    native_surface_ref: eligible.nativeSurfaceRef,
    projection_ref: input.projectionRef ?? projection.projectionId,
    return_url: input.returnUrl,
    expires_at: expiresAt,
  });

  if (error) {
    return { ok: false, reason: 'write-failed', detail: error.message };
  }

  return { ok: true, handoffId, expiresAt };
}

export type RedeemHandoffFailureReason =
  | 'store-unavailable'
  | 'not-found'
  | 'expired'
  | 'already-used'
  | 'principal-mismatch'
  | 'action-no-longer-eligible'
  | 'consume-race-lost';

export type RedeemHandoffResult =
  | {
      ok: true;
      journeyId: string;
      stageId: string | null;
      actionRef: string;
      capabilityRef: string;
      nativeSurfaceRef: string;
      /**
       * The exact, ready-to-open embed URL for the registered native
       * surface — resolved through `resolveJourneyOperatorDestination`
       * (the SAME catalogue/journey destination machinery the observer
       * uses), never hand-assembled. `null` only if that destination no
       * longer resolves at redemption time (should not happen given the
       * eligibility recheck above, but never silently guessed).
       */
      route: string | null;
      returnUrl: string;
    }
  | { ok: false; reason: RedeemHandoffFailureReason; detail: string };

/**
 * Redeem a presented handoffId for the CURRENTLY signed-in principal.
 * Atomically consumes the row (a concurrent second redemption of the same
 * handoffId loses the race and gets `consume-race-lost`, never a second
 * success) — never marks it used before every check has passed, and never
 * executes anything itself; the caller (the landing route) decides what to
 * do with a successful result.
 */
export async function redeemNativeActionHandoff(
  admin: SupabaseClient,
  presentedHandoffId: string,
  principal: FinancialServicesPrincipal,
): Promise<RedeemHandoffResult> {
  const hash = sha256(presentedHandoffId);
  const { data: row, error: readErr } = await admin
    .from(TABLE)
    .select(
      'id, status, principal_public_ref, journey_id, stage_id, action_ref, capability_ref, native_surface_ref, return_url, expires_at',
    )
    .eq('handoff_id_hash', hash)
    .maybeSingle();

  if (readErr) return { ok: false, reason: 'store-unavailable', detail: readErr.message };
  if (!row) return { ok: false, reason: 'not-found', detail: 'No handoff matches the presented id.' };
  if (row.status !== 'pending') {
    return { ok: false, reason: 'already-used', detail: `handoff status is '${row.status}', not pending.` };
  }
  if (new Date(row.expires_at as string).getTime() <= Date.now()) {
    return { ok: false, reason: 'expired', detail: 'handoff has expired.' };
  }

  // ── Re-resolve current authority (never trust the row's own stored
  //    principal as still valid without comparing against WHO IS SIGNED IN
  //    NOW). A persona switch since issuance invalidates the handoff. ──────
  const currentPrincipalRef = personaPublicRef(principal.personaId);
  if (currentPrincipalRef !== row.principal_public_ref) {
    return { ok: false, reason: 'principal-mismatch', detail: 'The signed-in principal has changed since this handoff was issued.' };
  }

  // ── Re-check eligibility fresh — authoritative state may have advanced
  //    (Passport revoked, catalogue destination no longer resolving, etc.)
  //    since issuance. ───────────────────────────────────────────────────
  const projection = await resolveFinancialServicesProjection(admin, principal);
  const stillEligible = projection.nextActions.find(
    (a) => a.actionRef === row.action_ref && a.handoffEligible === true,
  );
  if (!stillEligible) {
    return { ok: false, reason: 'action-no-longer-eligible', detail: `'${row.action_ref}' is no longer a handoff-eligible next action.` };
  }

  // ── Atomic single-use consumption — the SAME idempotency-guard shape
  //    `issueHumanAuthorizationCode` uses: only a row still `pending` at
  //    UPDATE time flips; a concurrent second redemption sees zero rows
  //    updated and reports `consume-race-lost`, never a second success. ───
  const { data: updated, error: updateErr } = await admin
    .from(TABLE)
    .update({ status: 'consumed', used_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('id');

  if (updateErr) return { ok: false, reason: 'store-unavailable', detail: updateErr.message };
  if (!updated || updated.length === 0) {
    return { ok: false, reason: 'consume-race-lost', detail: 'handoff was consumed by a concurrent request.' };
  }

  // ── Resolve the exact, ready-to-open embed URL through the SAME
  //    catalogue/journey destination machinery the observer used to decide
  //    eligibility — never hand-assembled, never a second mechanism. A
  //    freshly-minted, short-lived personaSessionToken is embedded so the
  //    destination embed authenticates as the SAME principal that just
  //    redeemed the handoff (never a raw personaId in the URL). ───────────
  let route: string | null = null;
  try {
    const pst = issuePersonaSessionToken({
      personaId: principal.personaId,
      authProfileId: principal.authProfileId,
      ttlSeconds: 300,
    });
    const destination = resolveJourneyOperatorDestination({
      journeyId: row.journey_id as string,
      participantState: { citizenPassportUsable: true }, // re-checked above via stillEligible
      navOptions: { personaSessionToken: pst.token },
    });
    route = destination.valid ? destination.operatorDestination.route : null;
  } catch {
    route = null;
  }

  return {
    ok: true,
    journeyId: row.journey_id as string,
    stageId: (row.stage_id as string | null) ?? null,
    actionRef: row.action_ref as string,
    capabilityRef: row.capability_ref as string,
    nativeSurfaceRef: row.native_surface_ref as string,
    route,
    returnUrl: row.return_url as string,
  };
}
