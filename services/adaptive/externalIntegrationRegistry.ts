/**
 * External Experience Integration registry (operator ruling, 2026-08-27,
 * Differ FS pilot reconciliation) — provider-neutral, added independently of
 * whether Q7 (Differ's real authentication/transport shape) is ever settled.
 *
 * This closes the open-redirect defect the Differ FS pilot review found
 * (`issueNativeActionHandoff` accepted any syntactically valid `http(s)`
 * `returnUrl`) without guessing at an authentication model. It is a
 * REGISTRY, not a transport implementation: every integration declares WHAT
 * it may reach (return origins, journeys, capabilities) independently of HOW
 * it authenticates, which is the deliberately unresolved `transportMode`
 * field.
 *
 * `ApplicationProjectionManifest`/`disposition` answers "can this CAPABILITY
 * ever be rendered/executed/handed-off to anyone." This registry answers a
 * narrower question: "may THIS PARTICULAR integration reach this journey /
 * this capability / this return origin at all." A capability with
 * `nativeHandoffAllowed: true` is not reachable by an integration whose own
 * `allowedCapabilities` omits it — Runtime's exclusion from the Differ pilot
 * is enforced HERE, not by lying about Runtime's disposition.
 */

export type ExternalIntegrationTransportMode = 'hosted-browser' | 'server-integration' | 'unresolved';

/** Structural subset of `ExperienceProjection` this module filters — kept
 *  local (not importing `types/adaptiveExperience`) to avoid a dependency
 *  cycle risk between the registry and the projection contract; the shape
 *  is a plain structural match, not a re-declaration of meaning. */
export interface FilterableProjection {
  surfaces: Array<{ capabilityId: string }>;
  primaryAction?: { capabilityId: string } | null;
  secondaryActions?: Array<{ capabilityId: string }>;
}

export interface ExternalExperienceIntegration {
  integrationId: string;
  providerId: string;
  applicationId: string;
  enabled: boolean;
  allowedReturnOrigins: string[];
  allowedJourneys: string[];
  allowedCapabilities: string[];
  /**
   * DELIBERATELY left `'unresolved'` for Differ (Q7, open per the Phase-0
   * audit's own addendum): the audit found Differ is a hosting/observation
   * platform, not a conventional API/SDK caller — meaning a browser running
   * INSIDE Differ's hosting might be the same authenticated user session
   * (`'hosted-browser'`), or a separate server-side scan/analysis process
   * might call on the user's behalf (`'server-integration'`), or both, or
   * neither. Do not set this to a specific mode for Differ without a
   * verified answer from Differ's own team — a wrong guess here would harden
   * an authentication model for a transport that doesn't correspond to how
   * Differ actually works.
   */
  transportMode: ExternalIntegrationTransportMode;
}

/**
 * The Differ Financial Services pilot's own registration. `enabled: false`
 * and `transportMode: 'unresolved'` are the honest, load-bearing defaults —
 * flipping either requires the operator to have actually settled Q7, never
 * a code change made "because the pilot needs to work."
 */
export const DIFFER_FINANCIAL_SERVICES_INTEGRATION: ExternalExperienceIntegration = {
  integrationId: 'differ-fs-pilot',
  providerId: 'differ',
  applicationId: 'financial-services-journey-spine',
  enabled: false,
  // Empty on purpose — no return origin has been registered because no
  // transport/hosting relationship with Differ has been verified yet. An
  // empty allowlist can never match a caller-supplied returnUrl, so
  // `issueNativeActionHandoff`'s allowlist check fails closed exactly as
  // hard as `enabled: false` does — belt and suspenders, not redundant
  // (a future operator toggling `enabled: true` without also registering a
  // real origin still can't be exploited as an open redirect).
  allowedReturnOrigins: [],
  allowedJourneys: ['horizen-moneypenny-admission'],
  // Runtime is deliberately absent — pilot policy, not a manifest-level ban.
  // See applicationProjectionManifest.ts's MONEYPENNY_SERVICE_ROUTES header.
  allowedCapabilities: ['moneypenny.mode-chooser', 'moneypenny.advisor', 'moneypenny.architect'],
  transportMode: 'unresolved',
};

const REGISTRY: readonly ExternalExperienceIntegration[] = [DIFFER_FINANCIAL_SERVICES_INTEGRATION];

/** `null` when no integration is registered under this id — never a default. */
export function resolveExternalExperienceIntegration(integrationId: string): ExternalExperienceIntegration | null {
  return REGISTRY.find((i) => i.integrationId === integrationId) ?? null;
}

/**
 * True only when the integration exists, is enabled, and the origin of
 * `returnUrl` exactly matches one of its registered origins. Fails closed on
 * every other condition — an unparseable URL, an unregistered integration, a
 * disabled one, or an origin absent from the allowlist are all `false`, never
 * a best-effort partial match.
 */
export function isReturnUrlAllowedForIntegration(integrationId: string, returnUrl: string): boolean {
  const integration = resolveExternalExperienceIntegration(integrationId);
  if (!integration || !integration.enabled) return false;
  let origin: string;
  try {
    origin = new URL(returnUrl).origin;
  } catch {
    return false;
  }
  return integration.allowedReturnOrigins.includes(origin);
}

export function isJourneyAllowedForIntegration(integrationId: string, journeyId: string): boolean {
  const integration = resolveExternalExperienceIntegration(integrationId);
  return Boolean(integration?.enabled && integration.allowedJourneys.includes(journeyId));
}

export function isCapabilityAllowedForIntegration(integrationId: string, capabilityId: string): boolean {
  const integration = resolveExternalExperienceIntegration(integrationId);
  return Boolean(integration?.enabled && integration.allowedCapabilities.includes(capabilityId));
}

/**
 * Strips any surface/action whose capability is not on the integration's own
 * `allowedCapabilities` — applied to the OUTGOING projection response, never
 * to the internal projection `buildExternalExperienceProjection` builds
 * (that composition seam stays integration-unaware by design; see its own
 * header). Without this, an integration excluded from a capability (Runtime,
 * for this pilot) would still SEE it offered with `handoffOffered: true` in
 * the projection JSON, even though a subsequent handoff request for it would
 * be refused — a confusing "shown then denied" leak, not a real exclusion.
 * `<T extends FilterableProjection>` so a caller's more specific projection
 * type is returned as itself, not widened to the local structural type.
 */
export function filterProjectionForIntegration<T extends FilterableProjection>(integrationId: string, projection: T): T {
  const allowed = (id: string) => isCapabilityAllowedForIntegration(integrationId, id);
  return {
    ...projection,
    surfaces: projection.surfaces.filter((s) => allowed(s.capabilityId)),
    primaryAction: projection.primaryAction && allowed(projection.primaryAction.capabilityId) ? projection.primaryAction : null,
    secondaryActions: (projection.secondaryActions ?? []).filter((a) => allowed(a.capabilityId)),
  };
}
