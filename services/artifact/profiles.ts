/**
 * Artifact Runtime — profile registry (CFS-025 Phase 1).
 *
 * A profile CONFIGURES the runtime's output (which ConstitutionalObject kind a
 * constitutional-tier run produces, which review gates run, which verifier, how
 * it distributes) — it NEVER adds, removes, or reorders a lifecycle stage
 * (types/artifactRuntime.ts §4). Adding a profile must not change AR: the runtime
 * reads this table, it does not branch on profile id.
 *
 * This is the ONE authoritative home for profile configuration — both `classify`
 * (to read `defaultClass` / whether a profile is inherently canonical) and
 * `runArtifact` (to pick the object kind + ratification gate) consume it. No fork.
 *
 * `defaultClass` is only the tier an artifact of this profile TYPICALLY matures
 * to (a hint) — never a floor. Classification is still per-invocation
 * (see classify.ts); a `policy` can be drafted disposably and a `research`
 * paper can stay operational until it is promoted.
 *
 * Isomorphic: pure data, no I/O. Object kinds are all valid
 * `ConstitutionalObjectKind`s (types/constitutionalObject.ts §1). Where the
 * object model has no exact kind for a profile (e.g. `agreement`,
 * `presentation`, `investor-deck`, `multimedia`) we map to the closest existing
 * kind and note it — extending the object-model kind union is a separate,
 * contract-owning change, not AR's to make.
 */

import type { ArtifactProfile, ArtifactProfileId } from '@/types/artifactRuntime';

/**
 * The Phase-1 profile configurations. Order mirrors ARTIFACT_PROFILES. Every
 * entry is honest about its Phase-1 verifier/distribution being a named stub the
 * runtime records as `skipped` evidence until the real verifier ships.
 */
export const ARTIFACT_PROFILE_REGISTRY: Record<ArtifactProfileId, ArtifactProfile> = {
  standard: {
    id: 'standard',
    objectKind: 'specification',
    defaultClass: 'constitutional',
    reviewGates: ['editorial', 'normative-consistency'],
    verifier: 'standard-conformance', // Phase-1 stub
    distribution: 'registry-publication', // Phase-1 stub
    ratificationRequired: true,
  },
  'white-paper': {
    id: 'white-paper',
    objectKind: 'publication',
    defaultClass: 'operational',
    reviewGates: ['editorial'],
    verifier: 'citation-check', // Phase-1 stub
    distribution: 'publications', // Phase-1 stub
    ratificationRequired: false,
  },
  research: {
    // The CFS-025 Phase-2 pilot profile (IRL experiment → paper). Already on the
    // unified writeLifecycleReceipt → createActivityReceipt path.
    id: 'research',
    objectKind: 'research_finding',
    defaultClass: 'constitutional',
    reviewGates: ['peer-review', 'evidence-sufficiency'],
    verifier: 'research-evidence', // Phase-1 stub
    distribution: 'publications', // Phase-1 stub
    ratificationRequired: true,
  },
  software: {
    id: 'software',
    objectKind: 'repository',
    defaultClass: 'operational',
    reviewGates: ['code-review'],
    verifier: 'ci', // Phase-1 stub
    distribution: 'release-packaging', // Phase-1 stub
    ratificationRequired: false,
  },
  agreement: {
    // No exact `agreement` kind in the object model — mapped to `document`.
    id: 'agreement',
    objectKind: 'document',
    defaultClass: 'constitutional',
    reviewGates: ['counterparty-review', 'legal'],
    verifier: 'terms-consistency', // Phase-1 stub
    distribution: 'party-delivery', // Phase-1 stub
    ratificationRequired: true,
  },
  presentation: {
    id: 'presentation',
    objectKind: 'document', // no `presentation` kind — mapped to document
    defaultClass: 'operational',
    reviewGates: ['editorial'],
    verifier: 'none',
    distribution: 'export', // Phase-1 stub
    ratificationRequired: false,
  },
  book: {
    id: 'book',
    objectKind: 'publication',
    defaultClass: 'operational',
    reviewGates: ['editorial'],
    verifier: 'none',
    distribution: 'publications', // Phase-1 stub
    ratificationRequired: false,
  },
  'investor-deck': {
    id: 'investor-deck',
    objectKind: 'document', // no `deck` kind — mapped to document
    defaultClass: 'operational',
    reviewGates: ['editorial'],
    verifier: 'none',
    distribution: 'export', // Phase-1 stub
    ratificationRequired: false,
  },
  api: {
    id: 'api',
    objectKind: 'specification',
    defaultClass: 'operational',
    reviewGates: ['schema-review'],
    verifier: 'schema-lint', // Phase-1 stub
    distribution: 'documentation', // Phase-1 stub
    ratificationRequired: false,
  },
  documentation: {
    id: 'documentation',
    objectKind: 'document',
    defaultClass: 'operational',
    reviewGates: ['editorial'],
    verifier: 'none',
    distribution: 'documentation', // Phase-1 stub
    ratificationRequired: false,
  },
  policy: {
    id: 'policy',
    objectKind: 'policy',
    defaultClass: 'constitutional',
    reviewGates: ['policy-review', 'invariant-consistency'],
    verifier: 'policy-conformance', // Phase-1 stub
    distribution: 'registry-publication', // Phase-1 stub
    ratificationRequired: true,
  },
  multimedia: {
    id: 'multimedia',
    objectKind: 'document', // no `multimedia` kind — mapped to document
    defaultClass: 'operational',
    reviewGates: ['editorial'],
    verifier: 'none',
    distribution: 'export', // Phase-1 stub
    ratificationRequired: false,
  },
};

/** Resolve a profile's configuration. Pure; throws on an unknown profile id so a
 *  typo never silently defaults to a canonical output. */
export function resolveProfile(profile: ArtifactProfileId): ArtifactProfile {
  const config = ARTIFACT_PROFILE_REGISTRY[profile];
  if (!config) {
    throw new Error(`unknown artifact profile '${profile}' — not in ARTIFACT_PROFILE_REGISTRY`);
  }
  return config;
}
