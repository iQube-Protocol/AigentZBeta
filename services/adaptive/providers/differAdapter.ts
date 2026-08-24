/**
 * Differ provider adapter — SPEC-AEE-001 §11's "provider verification gate".
 *
 * Phase 0 forensic audit (codexes/packs/agentiq/updates/
 * 2026-08-24_aee-differ-phase0-audit-financial-services.md §0) found ZERO
 * verified Differ integration surface anywhere in this repository: no SDK
 * dependency, no environment configuration, no credentials, no API client.
 *
 * Per the spec's own instruction: "If no suitable stable API exists,
 * implement the provider interface + a truthful disabled/unavailable Differ
 * adapter and keep the native provider operational. Do not invent an API."
 *
 * This file is exactly that and nothing more. It does NOT contain any
 * Differ-specific request/response mapping, authentication, or capability
 * assumption — there is nothing verified to map. Every method fails closed
 * to "unavailable" honestly rather than silently no-opping or fabricating a
 * plausible-looking response.
 *
 * When an operator supplies real Differ API/SDK access, this file is the
 * ONLY place that should change to begin verification (SPEC-AEE-001 §11:
 * "The adapter owns: authentication; provider-specific request mapping;
 * provider-specific response parsing; timeouts/retries; capability
 * negotiation..."). Until then, callers MUST treat every response from this
 * adapter as "not available" and fall back to the native provider
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
  'No verified Differ API/SDK integration exists in this codebase (Phase 0 audit, 2026-08-24). ' +
  'This adapter has not invented or assumed any Differ capability. Provide real API/SDK access ' +
  'and update this file to begin verification before enabling any capability below.';

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
