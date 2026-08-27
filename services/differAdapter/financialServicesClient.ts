/**
 * financialServicesClient.ts — the checked-in EXAMPLE consumer Differ's own
 * codebase would import (operator ruling, 2026-08-27, Differ FS pilot
 * reconciliation — retyped against AEE's `ExperienceProjection`, transport
 * deliberately left unresolved).
 *
 * Deliberately self-contained (no `@/...` internal repo imports) — Differ
 * copies this file (or the wire contracts it documents) into its own
 * codebase; nothing else in THIS repo imports it.
 *
 * ── STATUS: NOT YET USABLE (Q7 unresolved) ──────────────────────────────
 *
 * `metaMeOrigin`/`fetchFinancialServicesProjection` etc. below describe the
 * SHAPE of the contract, not a working integration. The server-side route
 * they call answers 503 to every request today
 * (services/adaptive/externalIntegrationRegistry.ts's `differ-fs-pilot`
 * entry is `enabled: false`) because how Differ actually authenticates as
 * an approved integration is not yet known — the Phase-0 audit found Differ
 * is a hosting/observation platform, not a conventional API/SDK caller, so
 * a browser running inside Differ's hosting might reuse the SAME
 * authenticated user session (`transportMode: 'hosted-browser'`) rather
 * than this file's shared-secret-header model. DO NOT configure a shared
 * secret for this client, and do not treat `integrationApiKey` below as the
 * settled architecture — it is a placeholder for the
 * `transportMode: 'server-integration'` case ONLY, kept unimplemented
 * (never sent) until an operator confirms which transport mode is real.
 *
 * Hard rules this adapter enforces on Differ's behalf (never violate these
 * when extending this file):
 *   1. Fetch and validate the response shape before rendering anything.
 *   2. Render ONLY capabilities present in the projection's own `surfaces`/
 *      `primaryAction`/`secondaryActions` — never construct a capability/
 *      route/surface locally.
 *   3. Request a handoff ONLY for a `capabilityId` already present in the
 *      last-fetched projection, and only when it was marked
 *      `handoffOffered: true`.
 *   4. Navigate to the metaMe URL the handoff endpoint returns — never build
 *      or guess a metaMe URL directly.
 *   5. On return from metaMe, REFETCH the projection. The `outcome` query
 *      param metaMe may append to the return URL is NEVER treated as
 *      completion — it is read only to decide WHEN to refetch, never to set
 *      any local "completed" flag.
 *   6. Keep NO authoritative local journey cursor. Every render derives
 *      directly from the most recently fetched projection — there is no
 *      separate "what stage is the user on" variable this module maintains
 *      between fetches.
 */

// ── Wire types — mirror app/api/adaptive/financial-services/projection/route.ts
//    and app/api/adaptive/financial-services/handoffs/route.ts's JSON
//    contracts exactly. Kept local (not imported) because this file ships
//    into a codebase that does not have this repo's `@/types` available. ──

export type ExperienceProjectionLevel = 0 | 1 | 2 | 3;

export interface ExperienceProjectionActionRef {
  capabilityId: string;
  label: string;
  surfaceRef?: string;
  /** True = requesting a handoff for this action is valid; false/absent =
   *  this action, if offered at all, is a direct native-render/execute the
   *  metaMe host itself handles — never something Differ requests a
   *  handoff for. */
  handoffOffered?: boolean;
}

export interface ExperienceProjectionSurface {
  capabilityId: string;
  surfaceType: 'component' | 'modal' | 'route' | 'cartridge-tab' | 'embed' | 'companion-action';
  hostRef?: string;
  emphasis?: 'primary' | 'secondary' | 'suppressed';
  handoffOffered?: boolean;
}

export interface FinancialServicesExperienceProjection {
  projectionId: string;
  provider: string;
  level: ExperienceProjectionLevel;
  journeyRef: string | null;
  primaryAction: ExperienceProjectionActionRef | null;
  secondaryActions: ExperienceProjectionActionRef[];
  layout: { mode: 'linear' | 'dag' | 'graph'; density: 'compact' | 'normal' | 'detailed' };
  surfaces: ExperienceProjectionSurface[];
  fallback: boolean;
  expiresAt: string | null;
}

export interface FinancialServicesClientConfig {
  /** metaMe origin, e.g. 'https://dev-beta.aigentz.me'. Differ supplies this — never hardcoded here. */
  metaMeOrigin: string;
  /**
   * UNRESOLVED (Q7) — see this file's header. Left as an optional field so
   * the wire shape is documented, but this client NEVER sends it as a
   * header today; there is no settled transport to send it over.
   */
  integrationApiKey?: string;
  /**
   * The T1 persona session token metaMe issued when it linked the user out
   * to Differ (the same `?pst=` mechanism `utils/codex-nav.ts::buildCodexUrl`
   * uses for every other cross-surface identity propagation in this
   * codebase) — relevant ONLY under `transportMode: 'hosted-browser'`,
   * where the SAME authenticated session Differ hosts already carries this.
   * Under `transportMode: 'server-integration'` a different mechanism would
   * be needed; under `'unresolved'` (today's actual state), neither path is
   * live.
   */
  personaSessionToken?: string;
}

export class FinancialServicesClientError extends Error {
  constructor(message: string, public readonly status?: number, public readonly reason?: string) {
    super(message);
    this.name = 'FinancialServicesClientError';
  }
}

async function authedFetch(config: FinancialServicesClientConfig, path: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(path, config.metaMeOrigin);
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) };
  // Deliberately NOT attaching any integrationApiKey/pst header here — see
  // this file's header. When Q7 is resolved, the correct attachment (or
  // "use the ambient session cookie because this code runs inside Differ's
  // hosted browser") gets added here, never assumed in advance.
  return fetch(url.toString(), { ...init, headers, cache: 'no-store' });
}

/** Fetch and validate the projection shape. */
export async function fetchFinancialServicesProjection(
  config: FinancialServicesClientConfig,
): Promise<FinancialServicesExperienceProjection> {
  const res = await authedFetch(config, '/api/adaptive/financial-services/projection');
  const body = (await res.json().catch(() => null)) as ({ ok: boolean; error?: string } & Partial<FinancialServicesExperienceProjection>) | null;
  if (!res.ok || !body?.ok) {
    throw new FinancialServicesClientError(body?.error ?? `Projection fetch failed (HTTP ${res.status})`, res.status);
  }
  if (!body.projectionId || !body.layout || !Array.isArray(body.surfaces)) {
    throw new FinancialServicesClientError('Projection response is missing required fields — do not render an incomplete shape.');
  }
  return body as FinancialServicesExperienceProjection;
}

export interface RequestedHandoff {
  handoffId: string;
  expiresAt: string;
}

/**
 * Request a handoff for `capabilityId`. `capabilityId` MUST be one already
 * present in `projection.surfaces` (or `primaryAction`/`secondaryActions`)
 * with `handoffOffered: true` — this function enforces that locally, in
 * addition to metaMe's own server-side recheck.
 */
export async function requestNativeActionHandoff(
  config: FinancialServicesClientConfig,
  projection: FinancialServicesExperienceProjection,
  capabilityId: string,
  returnUrl: string,
): Promise<RequestedHandoff> {
  const offeredAsSurface = projection.surfaces.some((s) => s.capabilityId === capabilityId && s.handoffOffered);
  const offeredAsPrimary = projection.primaryAction?.capabilityId === capabilityId && projection.primaryAction.handoffOffered;
  const offeredAsSecondary = projection.secondaryActions.some((a) => a.capabilityId === capabilityId && a.handoffOffered);
  if (!offeredAsSurface && !offeredAsPrimary && !offeredAsSecondary) {
    throw new FinancialServicesClientError(
      `'${capabilityId}' is not a handoff-offered capability in the last-fetched projection — refetch before requesting a handoff.`,
    );
  }

  const res = await authedFetch(config, '/api/adaptive/financial-services/handoffs', {
    method: 'POST',
    body: JSON.stringify({ capabilityId, returnUrl }),
  });
  const body = (await res.json().catch(() => null)) as { ok: boolean; error?: string; reason?: string; handoffId?: string; expiresAt?: string } | null;
  if (!res.ok || !body?.ok || !body.handoffId || !body.expiresAt) {
    throw new FinancialServicesClientError(body?.error ?? `Handoff issuance failed (HTTP ${res.status})`, res.status, body?.reason);
  }
  return { handoffId: body.handoffId, expiresAt: body.expiresAt };
}

/** The exact URL Differ should navigate the browser to for a requested handoff. */
export function buildNativeHandoffUrl(config: FinancialServicesClientConfig, handoffId: string): string {
  return new URL(`/handoff/financial-services/${encodeURIComponent(handoffId)}`, config.metaMeOrigin).toString();
}

/**
 * The completion callback contract metaMe's landing page appends to
 * `returnUrl`. THIS IS NOT COMPLETION EVIDENCE — `outcome` is read only to
 * decide whether/when to refetch the projection below; Differ's UI must
 * never flip a capability to "complete" from this value alone.
 */
export interface NativeActionCallback {
  handoffId: string;
  outcome: 'native-act-finished' | 'cancelled';
}

export function parseNativeActionCallback(returnUrlSearchParams: URLSearchParams): NativeActionCallback | null {
  const handoffId = returnUrlSearchParams.get('handoffId');
  const outcome = returnUrlSearchParams.get('outcome');
  if (!handoffId || (outcome !== 'native-act-finished' && outcome !== 'cancelled')) return null;
  return { handoffId, outcome };
}

/**
 * The ONLY thing that may advance Differ's UI: a freshly refetched
 * projection, compared against the one that prompted the handoff.
 */
export async function refetchAfterReturn(
  config: FinancialServicesClientConfig,
  priorProjection: FinancialServicesExperienceProjection,
): Promise<{ refreshed: FinancialServicesExperienceProjection; changed: boolean }> {
  const refreshed = await fetchFinancialServicesProjection(config);
  const changed = JSON.stringify(refreshed.surfaces) !== JSON.stringify(priorProjection.surfaces);
  return { refreshed, changed };
}
