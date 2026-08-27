/**
 * nativeHandoff.ts — provider-neutral, AEE-owned expiring single-use
 * handoffs from an externally presented `ExperienceProjection` into native
 * custody (operator ruling, 2026-08-27, Differ FS pilot reconciliation:
 * "the handoff should be provider-neutral under services/adaptive/, rather
 * than Financial-Services-specific").
 *
 * This module has NO dependency on `financialServicesObserver.ts` or any
 * other application-specific read — "eligibility should consume the
 * validated ExperienceProjection, not call an FS-specific observer." Every
 * caller supplies a freshly built `{context, projection}` pair (e.g. via
 * `externalExperienceProjection.ts::buildExternalExperienceProjection`) and
 * this module only:
 *   - checks the referenced capability is genuinely offered as a handoff in
 *     THAT projection (`isCapabilityHandoffEligible`);
 *   - checks the requesting integration is registered, enabled, and the
 *     returnUrl/journey/capability are all on ITS OWN allowlist
 *     (services/adaptive/externalIntegrationRegistry.ts);
 *   - persists/redeems the opaque, hashed, single-use row.
 *
 * At REDEMPTION, re-verifying that the capability is STILL eligible requires
 * a fresh projection — which requires an application-specific observer this
 * module must not import. `redeemNativeActionHandoff` therefore takes a
 * caller-supplied `recheckEligible` callback: the FS-specific redeem route
 * builds a fresh projection (via `buildExternalExperienceProjection`) and
 * passes a closure over `isCapabilityHandoffEligible` — the ELIGIBILITY
 * LOGIC stays here (never duplicated per-application), only the PROJECTION
 * BUILD is application-specific and lives at the call site.
 *
 * Reuse audit (carried over from the pilot's own, verified during this
 * reconciliation): `services/access/approvalToken.ts` is stateless/not
 * single-use; `services/threshold/gatewaySession.ts`'s
 * `agent_gateway_sessions` is a heavier OAuth 2.1 DCR+PKCE crossing shape.
 * Neither fits a one-shot navigation link. What IS reused: `sha256`/
 * `newToken` (services/threshold/gatewaySession.ts) and the
 * `.update({...}).eq('status','pending')` atomic single-use consumption
 * pattern `issueHumanAuthorizationCode` already uses.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sha256, newToken } from '@/services/threshold/gatewaySession';
import type { AdaptiveInteractionContext, ExperienceProjection } from '@/types/adaptiveExperience';
import {
  isReturnUrlAllowedForIntegration,
  isCapabilityAllowedForIntegration,
  isJourneyAllowedForIntegration,
  resolveExternalExperienceIntegration,
} from './externalIntegrationRegistry';

const TABLE = 'adaptive_native_handoffs';

/** Short-lived — long enough to click through, short enough to bound replay
 *  (same order of magnitude as `approvalToken.ts`'s 5-minute window). */
const HANDOFF_TTL_SECONDS = 5 * 60;

export interface NativeActionHandoff {
  handoffId: string;
  integrationId: string;
  applicationId: string;
  projectionId: string;
  principalPublicRef: string;
  journeyId: string | null;
  stageId: string | null;
  capabilityId: string;
  nativeSurfaceRef: string;
  returnUrl: string;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
}

/**
 * True only when `capabilityId` is BOTH (a) present in `projection` marked
 * `handoffOffered: true` (as a surface, or as primaryAction/secondaryActions)
 * and (b) the capability's own `disposition.nativeHandoffAllowed` (read from
 * `context.capabilityRefs`) is true. Neither condition alone is sufficient —
 * a provider claiming `handoffOffered` for a capability whose disposition
 * forbids it is exactly what `projectionValidator.ts`'s checks 6-7 already
 * reject upstream, but this function re-checks independently rather than
 * trusting that the projection it was handed already passed validation.
 */
export function isCapabilityHandoffEligible(
  context: AdaptiveInteractionContext,
  projection: ExperienceProjection,
  capabilityId: string,
): boolean {
  const capability = context.capabilityRefs.find((c) => c.capabilityId === capabilityId);
  if (!capability?.disposition.nativeHandoffAllowed) return false;

  const offeredAsSurface = projection.surfaces.some((s) => s.capabilityId === capabilityId && s.handoffOffered);
  const offeredAsPrimary = projection.primaryAction?.capabilityId === capabilityId && projection.primaryAction.handoffOffered;
  const offeredAsSecondary = (projection.secondaryActions ?? []).some(
    (a) => a.capabilityId === capabilityId && a.handoffOffered,
  );
  return Boolean(offeredAsSurface || offeredAsPrimary || offeredAsSecondary);
}

export type IssueHandoffFailureReason =
  | 'store-unavailable'
  | 'invalid-return-url'
  | 'integration-not-registered'
  | 'integration-disabled'
  | 'return-url-not-allowlisted'
  | 'journey-not-allowlisted'
  | 'capability-not-allowlisted'
  | 'capability-not-handoff-eligible'
  | 'write-failed';

export type IssueHandoffResult =
  | { ok: true; handoffId: string; expiresAt: string }
  | { ok: false; reason: IssueHandoffFailureReason; detail: string };

export interface IssueNativeActionHandoffInput {
  integrationId: string;
  applicationId: string;
  context: AdaptiveInteractionContext;
  projection: ExperienceProjection;
  capabilityId: string;
  principalPublicRef: string;
  /** Resolved by the caller from the SAME manifest/context used to build the
   *  projection — this module never resolves a native destination itself. */
  nativeSurfaceRef: string;
  returnUrl: string;
}

function isValidAbsoluteUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function issueNativeActionHandoff(
  admin: SupabaseClient,
  input: IssueNativeActionHandoffInput,
): Promise<IssueHandoffResult> {
  if (!isValidAbsoluteUrl(input.returnUrl)) {
    return { ok: false, reason: 'invalid-return-url', detail: 'returnUrl must be an absolute http(s) URL.' };
  }

  const integration = resolveExternalExperienceIntegration(input.integrationId);
  if (!integration) {
    return { ok: false, reason: 'integration-not-registered', detail: `No integration is registered as '${input.integrationId}'.` };
  }
  if (!integration.enabled) {
    return { ok: false, reason: 'integration-disabled', detail: `Integration '${input.integrationId}' is registered but not enabled.` };
  }
  if (!isReturnUrlAllowedForIntegration(input.integrationId, input.returnUrl)) {
    return { ok: false, reason: 'return-url-not-allowlisted', detail: `returnUrl origin is not on '${input.integrationId}'s allowedReturnOrigins.` };
  }
  const journeyId = input.context.journey?.journeyId ?? null;
  if (journeyId && !isJourneyAllowedForIntegration(input.integrationId, journeyId)) {
    return { ok: false, reason: 'journey-not-allowlisted', detail: `journey '${journeyId}' is not on '${input.integrationId}'s allowedJourneys.` };
  }
  if (!isCapabilityAllowedForIntegration(input.integrationId, input.capabilityId)) {
    return { ok: false, reason: 'capability-not-allowlisted', detail: `capability '${input.capabilityId}' is not on '${input.integrationId}'s allowedCapabilities.` };
  }
  if (!isCapabilityHandoffEligible(input.context, input.projection, input.capabilityId)) {
    return { ok: false, reason: 'capability-not-handoff-eligible', detail: `'${input.capabilityId}' is not currently offered as a handoff-eligible capability in this projection.` };
  }

  const handoffId = `aeehoff_${newToken(24)}`;
  const nowMs = Date.now();
  const expiresAt = new Date(nowMs + HANDOFF_TTL_SECONDS * 1000).toISOString();

  const { error } = await admin.from(TABLE).insert({
    handoff_id_hash: sha256(handoffId),
    status: 'pending',
    integration_id: input.integrationId,
    application_id: input.applicationId,
    projection_id: input.projection.projectionId,
    principal_public_ref: input.principalPublicRef,
    journey_id: journeyId,
    stage_id: input.context.journey?.currentStageId ?? null,
    capability_id: input.capabilityId,
    native_surface_ref: input.nativeSurfaceRef,
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
  | 'capability-no-longer-eligible'
  | 'consume-race-lost';

export type RedeemHandoffResult =
  | {
      ok: true;
      integrationId: string;
      applicationId: string;
      journeyId: string | null;
      stageId: string | null;
      capabilityId: string;
      nativeSurfaceRef: string;
      returnUrl: string;
    }
  | { ok: false; reason: RedeemHandoffFailureReason; detail: string };

/**
 * Redeem a presented handoffId for the CURRENTLY signed-in principal.
 * `recheckEligible` is supplied by the caller — it rebuilds a FRESH
 * projection (application-specific) and calls `isCapabilityHandoffEligible`
 * against it. This module owns the atomic consume; the caller owns proving
 * the capability is STILL eligible right now, not just at issuance.
 */
export async function redeemNativeActionHandoff(
  admin: SupabaseClient,
  presentedHandoffId: string,
  principalPublicRef: string,
  recheckEligible: (journeyId: string | null, stageId: string | null, capabilityId: string) => Promise<boolean>,
): Promise<RedeemHandoffResult> {
  const hash = sha256(presentedHandoffId);
  const { data: row, error: readErr } = await admin
    .from(TABLE)
    .select(
      'id, status, integration_id, application_id, journey_id, stage_id, capability_id, native_surface_ref, return_url, expires_at, principal_public_ref',
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
  if (principalPublicRef !== row.principal_public_ref) {
    return { ok: false, reason: 'principal-mismatch', detail: 'The signed-in principal has changed since this handoff was issued.' };
  }

  const stillEligible = await recheckEligible(
    (row.journey_id as string | null) ?? null,
    (row.stage_id as string | null) ?? null,
    row.capability_id as string,
  );
  if (!stillEligible) {
    return { ok: false, reason: 'capability-no-longer-eligible', detail: `'${row.capability_id}' is no longer a handoff-eligible capability.` };
  }

  // Atomic single-use consumption — only a row still `pending` at UPDATE
  // time flips; a concurrent second redemption sees zero rows updated.
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

  return {
    ok: true,
    integrationId: row.integration_id as string,
    applicationId: row.application_id as string,
    journeyId: (row.journey_id as string | null) ?? null,
    stageId: (row.stage_id as string | null) ?? null,
    capabilityId: row.capability_id as string,
    nativeSurfaceRef: row.native_surface_ref as string,
    returnUrl: row.return_url as string,
  };
}
