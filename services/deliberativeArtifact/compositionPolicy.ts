/**
 * Composition Policy — registry and resolver for artifact composition modes.
 *
 * Determines whether each artifact type generates directly or requires
 * a deliberation phase first.
 */

import type { ArtifactCompositionPolicy, CompositionMode } from '@/types/deliberativeArtifact';

// ─── Policy Catalogue ────────────────────────────────────────────────────────

const COMPOSITION_POLICIES: Record<string, ArtifactCompositionPolicy> = {
  // Direct composition (no deliberation)
  'google-doc': {
    artifactType: 'google-doc',
    compositionMode: 'direct',
    evidenceMode: 'none',
  },
  'gmail-draft': {
    artifactType: 'gmail-draft',
    compositionMode: 'direct',
    evidenceMode: 'none',
  },
  'calendar-block': {
    artifactType: 'calendar-block',
    compositionMode: 'direct',
    evidenceMode: 'none',
  },
  'sheet': {
    artifactType: 'sheet',
    compositionMode: 'direct',
    evidenceMode: 'none',
  },
  'slides': {
    artifactType: 'slides',
    compositionMode: 'direct',
    evidenceMode: 'none',
  },

  // Deliberative composition (requires brief phase)
  'venture-report': {
    artifactType: 'venture-report',
    compositionMode: 'deliberative',
    evidenceMode: 'platform-native',
    approvalGate: 'brief-before-draft',
    deliberationTemplate: 'venture-report-brief',
  },
  'venture-reintroduction': {
    artifactType: 'venture-reintroduction',
    compositionMode: 'deliberative',
    evidenceMode: 'platform-native',
    approvalGate: 'brief-before-draft',
    deliberationTemplate: 'venture-reintroduction-brief',
  },
};

// ─── Resolver ───────────────────────────────────────────────────────────────

/**
 * Resolve the composition policy for an artifact type.
 * Returns 'direct' for unknown types (safe default).
 */
export function resolveCompositionPolicy(
  artifactType: string
): ArtifactCompositionPolicy {
  const policy = COMPOSITION_POLICIES[artifactType];
  if (policy) {
    return policy;
  }

  // Unknown types default to direct composition
  return {
    artifactType,
    compositionMode: 'direct',
    evidenceMode: 'none',
  };
}

/**
 * Check if an artifact type requires deliberation.
 */
export function requiresDeliberation(artifactType: string): boolean {
  const policy = resolveCompositionPolicy(artifactType);
  return policy.compositionMode === 'deliberative';
}

/**
 * Check if an artifact type is known (has an explicit policy entry).
 */
export function isKnownArtifactType(artifactType: string): boolean {
  return artifactType in COMPOSITION_POLICIES;
}

/**
 * List all artifact types that require deliberation.
 */
export function listDeliberativeArtifactTypes(): string[] {
  return Object.values(COMPOSITION_POLICIES)
    .filter((p) => p.compositionMode === 'deliberative')
    .map((p) => p.artifactType);
}
