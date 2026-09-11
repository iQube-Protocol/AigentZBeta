/**
 * Application Projection Manifest v0.1 — Financial Services slice
 * (SPEC-AEE-001A §4).
 *
 * "The manifest is not the canonical route database. It is an externally
 * safe projection of platform topology." Built directly from the Phase 0
 * audit (codexes/packs/agentiq/updates/
 * 2026-08-24_aee-differ-phase0-audit-financial-services.md §2-4) — every
 * entry here traces to an audited stage/surface, nothing invented.
 *
 * `hostRefs.differ` is intentionally omitted everywhere: no Differ host is
 * verified (Phase 0 audit §0). Only `hostRefs.native` is populated. Adding a
 * `differ` hostRef to any entry below is exactly the kind of "invented API"
 * SPEC-AEE-001 §11 forbids until real verification exists — do not add one
 * speculatively.
 */

export type SurfaceResidencyClass =
  | 'NATIVE_ONLY'
  | 'NATIVE_PREFERRED'
  | 'HYBRID_ALLOWED'
  | 'EXTERNAL_RENDER_ALLOWED'
  | 'EXTERNAL_HOST_ALLOWED';

export interface ProjectedRouteRefV01 {
  routeId: string;
  /** The journey stage id this route/surface corresponds to. */
  stageId: string;
  hostRefs: { native?: string };
  surfaceRef: string;
  residency: SurfaceResidencyClass;
  /** Why this residency was assigned — traces to the audit table row. */
  rationale: string;
  /**
   * Present only when this route's journey has a registered metaMe
   * Catalogue destination (services/journey/catalogueDestinationHelper.ts)
   * — read-only signal for AEE; never a route/truth AEE owns.
   */
  operateDestination?: { catalogueItemId: string; defaultTab: string; availableModes?: string[] };
}

export const FINANCIAL_SERVICES_JOURNEY_ROUTES: ProjectedRouteRefV01[] = [
  { routeId: 'fs.register', stageId: 'register', hostRefs: { native: 'register-agent-panel' }, surfaceRef: 'register-agent-panel', residency: 'NATIVE_ONLY', rationale: 'Wallet-mediated registration ceremony — principal mandate signature.' },
  { routeId: 'fs.claim', stageId: 'claim', hostRefs: { native: 'marketa-eligibility-view' }, surfaceRef: 'marketa-eligibility-view', residency: 'NATIVE_ONLY', rationale: 'Cryptographic wallet-control proof.' },
  { routeId: 'fs.orient', stageId: 'orient', hostRefs: { native: 'orientation-panel' }, surfaceRef: 'orientation-panel', residency: 'EXTERNAL_RENDER_ALLOWED', rationale: 'Explanatory/orientation framing is read-mostly; the acknowledgment POST stays native.' },
  { routeId: 'fs.passport', stageId: 'passport', hostRefs: { native: 'venture-participate-apply' }, surfaceRef: 'venture-participate-apply', residency: 'NATIVE_ONLY', rationale: 'Personhood/Passport issuance — SPEC-AEE-001A §8 named example.' },
  { routeId: 'fs.activate', stageId: 'activate', hostRefs: { native: 'venture-participate-standing' }, surfaceRef: 'venture-participate-standing', residency: 'EXTERNAL_RENDER_ALLOWED', rationale: 'Derived registry-activation fact, read-only display.' },
  { routeId: 'fs.delegate', stageId: 'delegate', hostRefs: { native: 'venture-participate-delegation' }, surfaceRef: 'venture-participate-delegation', residency: 'NATIVE_ONLY', rationale: 'Principal-only delegation grant establishes the authority envelope.' },
  { routeId: 'fs.operate', stageId: 'aigentme', hostRefs: { native: 'aigentme-welcome' }, surfaceRef: 'aigentme-welcome', residency: 'NATIVE_PREFERRED', rationale: 'Dense Operate stage — deferred to a later, separately-scoped audit per SPEC-AEE-001A §10 scope boundary.', operateDestination: { catalogueItemId: 'moneypenny', defaultTab: 'home', availableModes: ['advisor', 'architect', 'runtime'] } },
  { routeId: 'fs.verify.primary', stageId: 'verify', hostRefs: { native: 'constitutional-agreement-ratify' }, surfaceRef: 'constitutional-agreement-ratify', residency: 'NATIVE_ONLY', rationale: 'The constitutional agreement authorization act itself.' },
  { routeId: 'fs.verify.secondary', stageId: 'verify', hostRefs: { native: 'pulse-transparency-toggle' }, surfaceRef: 'pulse-transparency-toggle', residency: 'EXTERNAL_RENDER_ALLOWED', rationale: 'Read-only Pulse/P&L transparency enrichment, never authority-bearing.' },
  { routeId: 'fs.standing', stageId: 'standing', hostRefs: { native: 'venture-participate-standing-only' }, surfaceRef: 'venture-participate-standing-only', residency: 'EXTERNAL_RENDER_ALLOWED', rationale: 'Pure read-only observed Standing state.' },
];

export interface MoneyPennyServiceProjectionRefV01 {
  serviceId: string;
  providerMode: 'ADVISOR' | 'ARCHITECT' | 'RUNTIME';
  residency: SurfaceResidencyClass;
  rationale: string;
}

export const MONEYPENNY_SERVICE_ROUTES: MoneyPennyServiceProjectionRefV01[] = [
  { serviceId: 'moneypenny.mode-chooser', providerMode: 'ADVISOR', residency: 'EXTERNAL_RENDER_ALLOWED', rationale: 'Discovery/eligibility view — the named first MoneyPenny candidate (SPEC-AEE-001A §13).' },
  { serviceId: 'moneypenny.advisor', providerMode: 'ADVISOR', residency: 'EXTERNAL_RENDER_ALLOWED', rationale: 'INFORMATIONAL, governancePath NONE — cited text output only.' },
  { serviceId: 'moneypenny.architect', providerMode: 'ARCHITECT', residency: 'EXTERNAL_RENDER_ALLOWED', rationale: 'PROPOSAL preview/summary only; full artifact object stays native pending an Object Projection Contract.' },
  { serviceId: 'moneypenny.runtime.constitutional', providerMode: 'RUNTIME', residency: 'NATIVE_ONLY', rationale: 'CONSEQUENTIAL execution — explicitly excluded from this pass per spec instruction.' },
  { serviceId: 'moneypenny.runtime', providerMode: 'RUNTIME', residency: 'NATIVE_ONLY', rationale: 'CONSEQUENTIAL, highest sensitivity — VELA-001 attestation-gated execution.' },
];

export interface ApplicationProjectionManifestV01 {
  manifestVersion: '0.1.0';
  applicationId: 'financial-services-journey-spine';
  routes: ProjectedRouteRefV01[];
  moneyPennyServices: MoneyPennyServiceProjectionRefV01[];
  /** Honest default until a verified Differ host exists (Phase 0 audit §0). */
  hostPolicy: { nativeOnly: true };
}

export const FINANCIAL_SERVICES_APPLICATION_PROJECTION_MANIFEST: ApplicationProjectionManifestV01 = {
  manifestVersion: '0.1.0',
  applicationId: 'financial-services-journey-spine',
  routes: FINANCIAL_SERVICES_JOURNEY_ROUTES,
  moneyPennyServices: MONEYPENNY_SERVICE_ROUTES,
  hostPolicy: { nativeOnly: true },
};

/** Convenience: the stage ids the audit classified as safe for a
 *  Differ-verified external RENDER (not host) — for use with
 *  services/adaptive/journeySpineAdapter.ts's `nonSensitiveStageIds`. */
export const EXTERNAL_RENDER_ALLOWED_STAGE_IDS: string[] = FINANCIAL_SERVICES_JOURNEY_ROUTES
  .filter((r) => r.residency === 'EXTERNAL_RENDER_ALLOWED')
  .map((r) => r.stageId);
