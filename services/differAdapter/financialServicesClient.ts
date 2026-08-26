/**
 * financialServicesClient.ts — the Differ × Financial Services Bridge pilot,
 * part 6/7: the adapter Differ's OWN codebase imports.
 *
 * This module is deliberately self-contained (no `@/...` internal repo
 * imports, no dependency on this codebase's own modules) — it is the
 * CHECKED-IN EXAMPLE CONSUMER for an external integration whose codebase is
 * not present in this repo/session, per the operator's instruction: "If the
 * Differ codebase is not present in this repo/session, produce a checked-in
 * interface/example consumer rather than inventing an inaccessible
 * integration." Differ copies this file (or the two wire contracts it
 * documents) into its own codebase; it is not imported by anything else in
 * THIS repo.
 *
 * Hard rules this adapter enforces on Differ's behalf (never violate these
 * when extending this file):
 *   1. Fetch and validate `schemaVersion` before rendering anything.
 *   2. Render ONLY services/actions present in the projection's own
 *      `nextActions` — never construct a capability/route/surface locally.
 *   3. Request a handoff ONLY for an `actionRef` already present in the
 *      last-fetched `nextActions`.
 *   4. Navigate to the metaMe URL the handoff endpoint returns — never build
 *      or guess a metaMe URL directly.
 *   5. On return from metaMe, REFETCH the projection. The `outcome` query
 *      param metaMe may append to the return URL is NEVER treated as
 *      completion — it is read only to decide WHEN to refetch, never to set
 *      any local "completed" flag.
 *   6. Keep NO authoritative local journey cursor. Every render derives
 *      directly from the most recently fetched `FinancialServicesProjection`
 *      — there is no separate "what stage is the user on" variable this
 *      module maintains between fetches.
 */

// ── Wire types — mirror app/api/public/financial-services/projection/route.ts
//    and app/api/financial-services/handoffs/route.ts's JSON contracts
//    exactly. Kept local (not imported) because this file ships into a
//    codebase that does not have this repo's `@/types` available. ─────────

export type FinancialServiceStageStatus = 'complete' | 'ready' | 'blocked' | 'unknown';

export interface FinancialServicesProjectionStage {
  id: string;
  label: string;
  status: FinancialServiceStageStatus;
  explanation: string;
}

export type FinancialServiceProviderMode = 'ADVISOR' | 'ARCHITECT' | 'RUNTIME';

export interface FinancialServicesProjectionService {
  serviceRef: string;
  label: string;
  provider: 'moneypenny';
  mode: FinancialServiceProviderMode;
  availability: 'available' | 'unavailable' | 'unknown';
}

export interface FinancialServicesProjectionNextAction {
  actionRef: string;
  label: string;
  capabilityRef: string;
  nativeSurfaceRef: string;
  handoffEligible: boolean;
}

export interface FinancialServicesProjection {
  schemaVersion: string;
  projectionId: string;
  generatedAt: string;
  expiresAt: string;
  journey: {
    id: string;
    currentStageId: string | null;
    stages: FinancialServicesProjectionStage[];
  };
  services: FinancialServicesProjectionService[];
  nextActions: FinancialServicesProjectionNextAction[];
}

export const EXPECTED_PROJECTION_SCHEMA_VERSION = 'fs-differ-projection/v1';

export interface FinancialServicesClientConfig {
  /** metaMe origin, e.g. 'https://dev-beta.aigentz.me'. Differ supplies this — never hardcoded here. */
  metaMeOrigin: string;
  /** Differ's integration key, sent as `x-differ-integration-key`. Server-side secret — never bundled into a browser build. */
  integrationApiKey: string;
  /**
   * The T1 persona session token metaMe issued when it linked the user out
   * to Differ (the same `?pst=` mechanism `utils/codex-nav.ts::buildCodexUrl`
   * uses for every other cross-surface identity propagation in this
   * codebase). Differ forwards it verbatim — it never inspects, decodes, or
   * derives a personaId from it.
   */
  personaSessionToken: string;
}

export class FinancialServicesClientError extends Error {
  constructor(message: string, public readonly status?: number, public readonly reason?: string) {
    super(message);
    this.name = 'FinancialServicesClientError';
  }
}

async function authedFetch(config: FinancialServicesClientConfig, path: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(path, config.metaMeOrigin);
  url.searchParams.set('pst', config.personaSessionToken);
  return fetch(url.toString(), {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      'x-differ-integration-key': config.integrationApiKey,
      'x-persona-session-token': config.personaSessionToken,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
}

/**
 * Fetch and validate the projection. Rejects if `schemaVersion` does not
 * match — a version mismatch is a contract change Differ must not silently
 * render around.
 */
export async function fetchFinancialServicesProjection(
  config: FinancialServicesClientConfig,
): Promise<FinancialServicesProjection> {
  const res = await authedFetch(config, '/api/public/financial-services/projection');
  const body = (await res.json().catch(() => null)) as ({ ok: boolean; error?: string } & Partial<FinancialServicesProjection>) | null;
  if (!res.ok || !body?.ok) {
    throw new FinancialServicesClientError(body?.error ?? `Projection fetch failed (HTTP ${res.status})`, res.status);
  }
  if (body.schemaVersion !== EXPECTED_PROJECTION_SCHEMA_VERSION) {
    throw new FinancialServicesClientError(
      `Unexpected projection schemaVersion '${body.schemaVersion}' (expected '${EXPECTED_PROJECTION_SCHEMA_VERSION}'). Do not render — the contract may have changed.`,
    );
  }
  return body as FinancialServicesProjection;
}

export interface RequestedHandoff {
  handoffId: string;
  expiresAt: string;
}

/**
 * Request a handoff for `actionRef`. `actionRef` MUST be one already present
 * in `projection.nextActions` with `handoffEligible: true` — this function
 * enforces that locally (never sends a request for an action Differ itself
 * did not just observe as eligible) in addition to metaMe's own server-side
 * recheck.
 */
export async function requestNativeActionHandoff(
  config: FinancialServicesClientConfig,
  projection: FinancialServicesProjection,
  actionRef: string,
  returnUrl: string,
): Promise<RequestedHandoff> {
  const eligible = projection.nextActions.find((a) => a.actionRef === actionRef && a.handoffEligible);
  if (!eligible) {
    throw new FinancialServicesClientError(
      `'${actionRef}' is not a handoff-eligible action in the last-fetched projection — refetch before requesting a handoff.`,
    );
  }

  const res = await authedFetch(config, '/api/financial-services/handoffs', {
    method: 'POST',
    body: JSON.stringify({ actionRef, returnUrl, projectionId: projection.projectionId }),
  });
  const body = (await res.json().catch(() => null)) as { ok: boolean; error?: string; reason?: string; handoffId?: string; expiresAt?: string } | null;
  if (!res.ok || !body?.ok || !body.handoffId || !body.expiresAt) {
    throw new FinancialServicesClientError(body?.error ?? `Handoff issuance failed (HTTP ${res.status})`, res.status, body?.reason);
  }
  return { handoffId: body.handoffId, expiresAt: body.expiresAt };
}

/**
 * The exact URL Differ should navigate the browser to for a requested
 * handoff. Differ never builds a metaMe URL any other way.
 */
export function buildNativeHandoffUrl(config: FinancialServicesClientConfig, handoffId: string): string {
  return new URL(`/handoff/financial-services/${encodeURIComponent(handoffId)}`, config.metaMeOrigin).toString();
}

/**
 * The completion callback contract metaMe's landing page appends to
 * `returnUrl`. THIS IS NOT COMPLETION EVIDENCE — `outcome` is read only to
 * decide whether/when to refetch the projection below; Differ's UI must
 * never flip a stage to "complete" from this value alone.
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
 * projection, compared against the one that prompted the handoff. Returns
 * whether canonical state actually changed — Differ renders from
 * `refreshed` either way, but this flag is a convenience for "did anything
 * happen" UI (a toast, a highlight), never a substitute for re-deriving the
 * UI from `refreshed` itself.
 */
export async function refetchAfterReturn(
  config: FinancialServicesClientConfig,
  priorProjection: FinancialServicesProjection,
): Promise<{ refreshed: FinancialServicesProjection; changed: boolean }> {
  const refreshed = await fetchFinancialServicesProjection(config);
  const changed = JSON.stringify(refreshed.journey.stages) !== JSON.stringify(priorProjection.journey.stages);
  return { refreshed, changed };
}
