import type { SupabaseClient } from '@supabase/supabase-js';
import type { ScopedSession } from './gatewaySession';
import { getExchangeStateForMcp } from './mcpConstitutionalActs';
import { resolveExchangeArtifactRegistryReference } from './exchangeArtifactRegistryReference';

/**
 * Enrich an already-authorized exchange projection with the canonical Registry
 * namespace mapping. This never widens disclosure: it only runs after
 * getExchangeStateForMcp has produced the caller-safe exchange view, and only
 * for artifact ids that are already present in that view.
 */
export async function getExchangeStateWithRegistryReferences(
  admin: SupabaseClient,
  session: ScopedSession,
) {
  const state = await getExchangeStateForMcp(admin, session);
  if (!state.ok) return state;

  const yourArtifact = state.view.yourArtifact;
  const counterpartyArtifact = state.view.counterpartyArtifact;

  const [yourRegistryReference, counterpartyRegistryReference] = await Promise.all([
    yourArtifact?.id
      ? resolveExchangeArtifactRegistryReference(admin, yourArtifact.id)
      : Promise.resolve(null),
    counterpartyArtifact?.id
      ? resolveExchangeArtifactRegistryReference(admin, counterpartyArtifact.id)
      : Promise.resolve(null),
  ]);

  return {
    ...state,
    view: {
      ...state.view,
      yourArtifact: yourArtifact
        ? { ...yourArtifact, registryReference: yourRegistryReference }
        : null,
      counterpartyArtifact: counterpartyArtifact
        ? { ...counterpartyArtifact, registryReference: counterpartyRegistryReference }
        : null,
    },
    namespaceSemantics: {
      exchangeArtifactId: 'Reciprocal Exchange artifact namespace',
      iqubeId: 'canonical iQube Registry namespace',
      mappingAuthority: 'iqube_id_map(source=exchange_artifact, source_id=artifactId)',
      note: 'Identifiers are intentionally not interchangeable. Registry visibility and payload authorization remain separate decisions.',
    },
  };
}
