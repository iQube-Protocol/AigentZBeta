/**
 * Differ provider adapter — SPEC-AEE-001 §11's "provider verification gate".
 *
 * Phase 0 forensic audit (codexes/packs/agentiq/updates/
 * 2026-08-24_aee-differ-phase0-audit-financial-services.md §0) found ZERO
 * verified Differ integration surface anywhere in this repository: no SDK
 * dependency, no environment configuration, no credentials, no API client.
 * That finding still stands.
 *
 * ADDENDUM (2026-08-24, same day, see the audit doc's own "Vendor
 * clarification" section): Differ's team clarified that Differ is not
 * primarily an API/SDK provider — it is a hosting-and-observation platform
 * (an initial compatibility SCAN, then a hosted runtime that injects
 * analytics, observes usage, and generates recommendations held in an
 * approval queue with auto-apply optionally OFF). This does not change
 * anything in THIS file: there is still no verified scan result, no hosted
 * relationship, and no capability to honestly report as available. It only
 * changes what "verification" will look like when it happens — see
 * `2026-08-24_differ-scan-package-v1-financial-services.md` for the bounded
 * code slice prepared for that scan, and the corrected roadmap language:
 * "Differ integration proceeds through scan -> hosted compatibility
 * assessment -> bounded hosted observation/recommendation mode. API/SDK
 * integration is not assumed or required."
 *
 * Per the parent spec's own instruction: "If no suitable stable API exists,
 * implement the provider interface + a truthful disabled/unavailable Differ
 * adapter and keep the native provider operational. Do not invent an API."
 *
 * This file is exactly that and nothing more. It does NOT contain any
 * Differ-specific request/response mapping, authentication, or capability
 * assumption — there is nothing verified to map. Every method fails closed
 * to "unavailable" honestly rather than silently no-opping or fabricating a
 * plausible-looking response. It is NOT forced to impersonate scan/hosting
 * capability merely because Differ's real product shape is now understood —
 * "understood" is not "verified".
 *
 * When a real Differ scan result and/or hosted-observation relationship
 * exists, this file is the place to begin representing it (still behind the
 * same `capabilities()`/`project()`/`health()` shape — a hosted
 * recommendation queue maps to `project()` returning Differ's proposed
 * projection for postflight validation, not to a different interface).
 * Until then, callers MUST treat every response from this adapter as "not
 * available" and fall back to the native provider
 * (services/adaptive/nativeProvider.ts) — see
 * services/adaptive/adaptiveExperienceEngine.ts for that fallback wiring.
 */

import type {
  AdaptiveExperienceProvider,
  ProviderCapabilityManifest,
  ProviderHealth,
  ProviderProjectionRequest,
  ProviderProjectionResponse,
} from '@/types/adaptiveExperience';

export const DIFFER_PROVIDER_ID = 'differ';

const UNAVAILABLE_REASON =
  'No verified Differ scan result or hosted-observation relationship exists for this codebase yet ' +
  '(Phase 0 audit + vendor-clarification addendum, 2026-08-24). Differ is a hosting/observation ' +
  'platform (scan -> compatibility assessment -> bounded hosted observation), not an API/SDK — ' +
  'this adapter has not invented or assumed any capability either way. See ' +
  '2026-08-24_differ-scan-package-v1-financial-services.md for the prepared scan scope.';

export class DifferUnavailableError extends Error {
  constructor() {
    super(UNAVAILABLE_REASON);
    this.name = 'DifferUnavailableError';
  }
}

export const differAdapter: AdaptiveExperienceProvider = {
  id: DIFFER_PROVIDER_ID,

  async capabilities(): Promise<ProviderCapabilityManifest> {
    // Every field below is honestly false/[] — see file header. This is not
    // a placeholder pending future work; it is the accurate current state.
    return {
      providerId: DIFFER_PROVIDER_ID,
      canRender: false,
      canHost: false,
      canComposeComponents: false,
      canResolveRoutes: false,
      canPersistPresentationState: false,
      supportedProjectionLevels: [],
      supportedSurfaceTypes: [],
      dataBoundary: 'provider-stateful',
      verified: false,
      unavailableReason: UNAVAILABLE_REASON,
    };
  },

  async project(_input: ProviderProjectionRequest): Promise<ProviderProjectionResponse> {
    // MUST throw rather than return a fabricated projection. The caller
    // (adaptiveExperienceEngine.ts) is required to catch this and fall back
    // to the native provider — this is the "Differ failure -> native
    // deterministic projection" rule (SPEC-AEE-001 §16), exercised
    // deliberately by "unavailable" rather than by a network timeout.
    throw new DifferUnavailableError();
  },

  async health(): Promise<ProviderHealth> {
    return { available: false, reason: UNAVAILABLE_REASON };
  },
};
