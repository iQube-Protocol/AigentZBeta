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

import type { AdaptiveCapabilityDisposition, CapabilityProjectionRef } from '@/types/adaptiveExperience';

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
  /**
   * The enforced three-permission disposition (operator ruling, 2026-08-27).
   * `residency` above is the human-legible audit classification; `disposition`
   * is what `projectionValidator.ts` actually reads and enforces. The two
   * must agree in spirit but are NOT mechanically derived from one another —
   * see this file's header: NATIVE_ONLY does not imply nativeHandoffAllowed:
   * false, it is a genuinely independent decision per capability.
   */
  disposition: AdaptiveCapabilityDisposition;
  /** Why this residency was assigned — traces to the audit table row. */
  rationale: string;
  /**
   * Present only when this route's journey has a registered metaMe
   * Catalogue destination (services/journey/catalogueDestinationHelper.ts)
   * — read-only signal for AEE; never a route/truth AEE owns.
   */
  operateDestination?: { catalogueItemId: string; defaultTab: string; availableModes?: string[] };
}

// NATIVE_ONLY stages that are principal/authority-bearing ceremonies still
// carry `nativeHandoffAllowed: true` — an external presentation reaching
// them is exactly what the native-handoff mechanism is FOR (operator ruling,
// 2026-08-27). The Operate stage (`fs.operate`) is the one exception: its
// own residency note says the audit itself is deferred/out of scope, so no
// handoff claim is made for it either — absence of scope, not a ban.
export const FINANCIAL_SERVICES_JOURNEY_ROUTES: ProjectedRouteRefV01[] = [
  { routeId: 'fs.register', stageId: 'register', hostRefs: { native: 'register-agent-panel' }, surfaceRef: 'register-agent-panel', residency: 'NATIVE_ONLY', disposition: { externalRenderAllowed: false, externalExecuteAllowed: false, nativeHandoffAllowed: true }, rationale: 'Wallet-mediated registration ceremony — principal mandate signature.' },
  { routeId: 'fs.claim', stageId: 'claim', hostRefs: { native: 'marketa-eligibility-view' }, surfaceRef: 'marketa-eligibility-view', residency: 'NATIVE_ONLY', disposition: { externalRenderAllowed: false, externalExecuteAllowed: false, nativeHandoffAllowed: true }, rationale: 'Cryptographic wallet-control proof.' },
  { routeId: 'fs.orient', stageId: 'orient', hostRefs: { native: 'orientation-panel' }, surfaceRef: 'orientation-panel', residency: 'EXTERNAL_RENDER_ALLOWED', disposition: { externalRenderAllowed: true, externalExecuteAllowed: false, nativeHandoffAllowed: true }, rationale: 'Explanatory/orientation framing is read-mostly; the acknowledgment POST stays native.' },
  { routeId: 'fs.passport', stageId: 'passport', hostRefs: { native: 'venture-participate-apply' }, surfaceRef: 'venture-participate-apply', residency: 'NATIVE_ONLY', disposition: { externalRenderAllowed: false, externalExecuteAllowed: false, nativeHandoffAllowed: true }, rationale: 'Personhood/Passport issuance — SPEC-AEE-001A §8 named example.' },
  { routeId: 'fs.activate', stageId: 'activate', hostRefs: { native: 'venture-participate-standing' }, surfaceRef: 'venture-participate-standing', residency: 'EXTERNAL_RENDER_ALLOWED', disposition: { externalRenderAllowed: true, externalExecuteAllowed: false, nativeHandoffAllowed: true }, rationale: 'Derived registry-activation fact, read-only display.' },
  { routeId: 'fs.delegate', stageId: 'delegate', hostRefs: { native: 'venture-participate-delegation' }, surfaceRef: 'venture-participate-delegation', residency: 'NATIVE_ONLY', disposition: { externalRenderAllowed: false, externalExecuteAllowed: false, nativeHandoffAllowed: true }, rationale: 'Principal-only delegation grant establishes the authority envelope.' },
  { routeId: 'fs.operate', stageId: 'aigentme', hostRefs: { native: 'aigentme-welcome' }, surfaceRef: 'aigentme-welcome', residency: 'NATIVE_PREFERRED', disposition: { externalRenderAllowed: false, externalExecuteAllowed: false, nativeHandoffAllowed: false }, rationale: 'Dense Operate stage — deferred to a later, separately-scoped audit per SPEC-AEE-001A §10 scope boundary; no handoff claim made while out of scope.', operateDestination: { catalogueItemId: 'moneypenny', defaultTab: 'moneypenny-orchestration', availableModes: ['advisor', 'architect', 'runtime'] } },
  { routeId: 'fs.verify.primary', stageId: 'verify', hostRefs: { native: 'constitutional-agreement-ratify' }, surfaceRef: 'constitutional-agreement-ratify', residency: 'NATIVE_ONLY', disposition: { externalRenderAllowed: false, externalExecuteAllowed: false, nativeHandoffAllowed: true }, rationale: 'The constitutional agreement authorization act itself.' },
  { routeId: 'fs.verify.secondary', stageId: 'verify', hostRefs: { native: 'pulse-transparency-toggle' }, surfaceRef: 'pulse-transparency-toggle', residency: 'EXTERNAL_RENDER_ALLOWED', disposition: { externalRenderAllowed: true, externalExecuteAllowed: false, nativeHandoffAllowed: true }, rationale: 'Read-only Pulse/P&L transparency enrichment, never authority-bearing.' },
  { routeId: 'fs.standing', stageId: 'standing', hostRefs: { native: 'venture-participate-standing-only' }, surfaceRef: 'venture-participate-standing-only', residency: 'EXTERNAL_RENDER_ALLOWED', disposition: { externalRenderAllowed: true, externalExecuteAllowed: false, nativeHandoffAllowed: true }, rationale: 'Pure read-only observed Standing state.' },
];

export interface MoneyPennyServiceProjectionRefV01 {
  serviceId: string;
  providerMode: 'ADVISOR' | 'ARCHITECT' | 'RUNTIME';
  residency: SurfaceResidencyClass;
  disposition: AdaptiveCapabilityDisposition;
  rationale: string;
}

// The disposition table the operator specified verbatim (2026-08-27):
//   Advisor            render:yes execute:no  handoff:yes (the pilot's own
//                       nextActions already offered Advisor as handoff-eligible)
//   Architect preview   render:yes execute:no  handoff:yes (full artifact)
//   Runtime execution   render:no  execute:no  handoff:true in the GENERAL
//                       AEE model — "potentially yes" — but THIS PILOT never
//                       reaches it because the pilot's own
//                       ExternalExperienceIntegration.allowedCapabilities
//                       allowlist (services/adaptive/
//                       externalIntegrationRegistry.ts) omits both Runtime
//                       serviceIds. The manifest itself does NOT ban Runtime
//                       handoff — that would misrepresent it as universally
//                       ineligible when it is this pilot's policy, not AEE's.
export const MONEYPENNY_SERVICE_ROUTES: MoneyPennyServiceProjectionRefV01[] = [
  { serviceId: 'moneypenny.mode-chooser', providerMode: 'ADVISOR', residency: 'EXTERNAL_RENDER_ALLOWED', disposition: { externalRenderAllowed: true, externalExecuteAllowed: false, nativeHandoffAllowed: true }, rationale: 'Discovery/eligibility view — the named first MoneyPenny candidate (SPEC-AEE-001A §13).' },
  { serviceId: 'moneypenny.advisor', providerMode: 'ADVISOR', residency: 'EXTERNAL_RENDER_ALLOWED', disposition: { externalRenderAllowed: true, externalExecuteAllowed: false, nativeHandoffAllowed: true }, rationale: 'INFORMATIONAL, governancePath NONE — cited text output only.' },
  { serviceId: 'moneypenny.architect', providerMode: 'ARCHITECT', residency: 'EXTERNAL_RENDER_ALLOWED', disposition: { externalRenderAllowed: true, externalExecuteAllowed: false, nativeHandoffAllowed: true }, rationale: 'PROPOSAL preview/summary externally rendered; full artifact reached only via native handoff (Object Projection Contract for the full body still not built).' },
  { serviceId: 'moneypenny.runtime.constitutional', providerMode: 'RUNTIME', residency: 'NATIVE_ONLY', disposition: { externalRenderAllowed: false, externalExecuteAllowed: false, nativeHandoffAllowed: true }, rationale: 'CONSEQUENTIAL execution — never rendered/executed externally. Handoff is permitted in the general AEE model; excluded from THIS pilot by the integration allowlist, not by this disposition.' },
  { serviceId: 'moneypenny.runtime', providerMode: 'RUNTIME', residency: 'NATIVE_ONLY', disposition: { externalRenderAllowed: false, externalExecuteAllowed: false, nativeHandoffAllowed: true }, rationale: 'CONSEQUENTIAL, highest sensitivity — VELA-001 attestation-gated execution. Same handoff/allowlist split as moneypenny.runtime.constitutional.' },
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

// ── Composition helpers (operator ruling, 2026-08-27) — the ONLY place a
// manifest's dispositions are read into a CapabilityProjectionRef[]. A
// composition seam (services/adaptive/externalExperienceProjection.ts) calls
// these; it never re-derives a disposition or route decision itself.

/**
 * Override the generic, conservative default disposition
 * `journeySpineAdapter.ts::buildCapabilityRefsFromJourney` assigns with the
 * audited, per-stage disposition this manifest declares — matched by
 * `stageId`, never a second capabilityId. A stage this manifest has no entry
 * for is left exactly as the generic builder produced it (no manifest data
 * to override with is not the same as "this manifest says render freely").
 */
export function overrideDispositionsFromManifest(
  capabilityRefs: CapabilityProjectionRef[],
  manifest: ApplicationProjectionManifestV01,
): CapabilityProjectionRef[] {
  const byStageId = new Map(manifest.routes.map((r) => [r.stageId, r.disposition] as const));
  return capabilityRefs.map((ref) => {
    const disposition = byStageId.get(ref.capabilityId);
    return disposition ? { ...ref, disposition } : ref;
  });
}

/**
 * The manifest's MoneyPenny services as CapabilityProjectionRefs — these are
 * NOT journey stages (`journeySpineAdapter.ts` has no path to them at all,
 * since `HORIZEN_MONEYPENNY_JOURNEY.stages` never lists Advisor/Architect/
 * Runtime as stages) so they are additive, never an override. All modes
 * share the same native surface — the MoneyPenny orchestration panel the
 * journey's `fs.operate`/Operate destination already resolves to; the mode
 * itself is an in-panel selection, not a distinct route.
 */
export function moneyPennyServiceCapabilityRefs(
  manifest: ApplicationProjectionManifestV01,
  nativeSurfaceRef: string | null,
): CapabilityProjectionRef[] {
  return manifest.moneyPennyServices.map((s) => ({
    capabilityId: s.serviceId,
    label: s.serviceId,
    surfaceTypes: ['cartridge-tab'] as const,
    hostRefs: (nativeSurfaceRef ? { native: nativeSurfaceRef } : {}) as Record<string, string>,
    disposition: s.disposition,
  }));
}
