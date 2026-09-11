/** Exchange deposits projected as private ContentQubes by reference. */
import { createClient } from '@supabase/supabase-js';
import type { CanonicalIQubeInternalRecord, IQubeIdMapEntry } from '@/types/registry-canonical';
import type { AdapterHydrateOpts, AdapterListFilter, AdapterListResult, RegistryPrimitiveAdapter } from './types';
const client = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
export const exchangeArtifactQubeAdapter: RegistryPrimitiveAdapter = {
  primitive_type: 'ContentQube', sources: ['exchange_artifact'],
  async hydrate(entry: IQubeIdMapEntry, opts: AdapterHydrateOpts = {}): Promise<CanonicalIQubeInternalRecord | null> {
    if (entry.source !== 'exchange_artifact' || !opts.allowPrivate) return null;
    const { data: a } = await client().from('exchange_artifacts').select('id,exchange_id,title,description,artifact_class,version,content_hash,storage_reference,pending_principal_attestation,deposited_at').eq('id', entry.source_id).maybeSingle();
    if (!a) return null;
    return { iqube_id: entry.iqube_id, primitive_type: 'ContentQube', instance_type: 'instance', display_name: String(a.title),
      display_description: String(a.description ?? `${a.artifact_class} held by a reciprocal exchange`), source_resource_id: String(a.id), source_system: 'exchange_artifact',
      meta_qube_id: '', creator_identity_state: 'pseudonymous', origin: 'native', internal_lifecycle: a.pending_principal_attestation ? 'review_pending' : 'published',
      surface_lifecycle: 'wip', canonicalization_status: 'wip', wip_supabase_only: true, visibility_state: 'private', gating: ['persona', 'custom'],
      access_policy_id: `reciprocal-exchange:${a.exchange_id}`, required_credentials: ['exchange-party'], mint_status: a.storage_reference ? 'minted' : 'unminted', instance_model: 'singleton',
      dvn_receipt_index: { receipt_count: 0 }, cartridge_bindings: ['irl', 'ocsga', 'boundary-research'], card_url: `/api/iqubes/${entry.iqube_id}/card`,
      version: String(a.content_hash ?? a.version), created_at: String(a.deposited_at), updated_at: entry.updated_at };
  },
  async list(filter: AdapterListFilter = {}): Promise<AdapterListResult> { let q = client().from('iqube_id_map').select('*').eq('source', 'exchange_artifact'); if (filter.limit) q = q.limit(filter.limit); const { data } = await q; return { entries: (data ?? []) as IQubeIdMapEntry[] }; },
};
