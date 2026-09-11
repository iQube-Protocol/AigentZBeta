import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * T2-safe bridge from an already-disclosed Reciprocal Exchange artifact id to
 * its canonical iQube Registry identifier.
 *
 * This is a lookup only. It never derives one namespace from the other and it
 * never changes payload authorization. The canonical mapping remains the
 * `iqube_id_map` row written by the Registry spine (`source=exchange_artifact`,
 * `source_id=<artifact id>`).
 */
export type ExchangeArtifactRegistryReference =
  | {
      availability: 'registered';
      iqubeId: string;
      metadataInterface: 'get_accessible_iqube';
      payloadInterface: 'read_accessible_iqube_text';
      payloadAccess: 'separately-authorized';
    }
  | {
      availability: 'not-registered';
      iqubeId: null;
      metadataInterface: null;
      payloadInterface: null;
      payloadAccess: 'not-addressable-through-iqube-interface';
    }
  | {
      availability: 'registry-unavailable';
      iqubeId: null;
      metadataInterface: null;
      payloadInterface: null;
      payloadAccess: 'unknown';
    };

export async function resolveExchangeArtifactRegistryReference(
  admin: SupabaseClient,
  artifactId: string,
): Promise<ExchangeArtifactRegistryReference> {
  const { data, error } = await admin
    .from('iqube_id_map')
    .select('iqube_id')
    .eq('source', 'exchange_artifact')
    .eq('source_id', artifactId)
    .maybeSingle();

  if (error) {
    return {
      availability: 'registry-unavailable',
      iqubeId: null,
      metadataInterface: null,
      payloadInterface: null,
      payloadAccess: 'unknown',
    };
  }

  const iqubeId = (data as { iqube_id?: unknown } | null)?.iqube_id;
  if (typeof iqubeId !== 'string' || !iqubeId.trim()) {
    return {
      availability: 'not-registered',
      iqubeId: null,
      metadataInterface: null,
      payloadInterface: null,
      payloadAccess: 'not-addressable-through-iqube-interface',
    };
  }

  return {
    availability: 'registered',
    iqubeId,
    metadataInterface: 'get_accessible_iqube',
    payloadInterface: 'read_accessible_iqube_text',
    payloadAccess: 'separately-authorized',
  };
}
