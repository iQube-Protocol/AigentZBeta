/**
 * DataQube primitive adapter.
 *
 * Handles two source paths:
 *   1. code:liquidui-template — the 20 LiquidUI template seeds that
 *      Stage 1 C1 reclassified from LiquidUITemplateArchetypeQube to
 *      DataQube + metaExtras.category='ui_template_archetype'. Source
 *      of record is app/api/registry/templates/store.ts; iqube_ids are
 *      synthetic.
 *   2. registry_asset — DB-backed DataQube records from registry_assets
 *      (1 row per Stage 0 audit Deliverable 1).
 *
 * No legibility-side source exists for DataQubes yet; this adapter
 * builds the canonical record directly. When DataQubes get their own
 * legibility source (legibility fast-follow), this adapter delegates.
 */

import { createClient } from '@supabase/supabase-js';

import type {
  CanonicalIQubeInternalRecord,
  IQubeIdMapEntry,
} from '@/types/registry-canonical';

import type {
  RegistryPrimitiveAdapter,
  AdapterHydrateOpts,
  AdapterListFilter,
  AdapterListResult,
} from './types';
import { syntheticIQubeId } from './types';

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export const dataQubeAdapter: RegistryPrimitiveAdapter = {
  primitive_type: 'DataQube',
  sources: ['registry_asset', 'code:liquidui-template'],

  async hydrate(
    entry: IQubeIdMapEntry,
    _opts: AdapterHydrateOpts = {},
  ): Promise<CanonicalIQubeInternalRecord | null> {
    if (entry.source === 'code:liquidui-template') {
      // Read from the in-memory template store. Importing the store
      // dynamically to avoid coupling at module load.
      const { getStore } = await import('@/app/api/registry/templates/store');
      const template = getStore().find((t) => t.id === entry.source_id);
      if (!template) return null;

      const isUiArchetype = (template.metaExtras ?? []).some(
        (x) => x?.k === 'category' && x?.v === 'ui_template_archetype',
      );

      return {
        iqube_id: entry.iqube_id,
        primitive_type: 'DataQube',
        instance_type: 'template',

        meta_qube_id: '',
        blak_qube_id: undefined,
        token_qube_id: undefined,

        creator_identity_state: 'pseudonymous',
        origin: 'native',

        internal_lifecycle: 'published',
        surface_lifecycle: 'canonized',
        canonicalization_status: 'canonized',
        wip_supabase_only: false,
        visibility_state: 'public',

        gating: ['open'],

        mint_status: 'unminted',
        instance_model: 'singleton',

        dvn_receipt_index: { receipt_count: 0 },
        cartridge_bindings: isUiArchetype ? ['liquidui'] : [],
        card_url: `/api/iqubes/${entry.iqube_id}/card`,

        version: template.version ?? '1.0',
        created_at: template.createdAt ?? new Date().toISOString(),
        updated_at: template.createdAt ?? new Date().toISOString(),
      };
    }

    if (entry.source === 'registry_asset') {
      const sb = client();
      const { data } = await sb
        .from('registry_assets')
        .select('*')
        .eq('asset_id', entry.source_id)
        .maybeSingle();
      if (!data) return null;
      const row = data as any;

      return {
        iqube_id: entry.iqube_id,
        primitive_type: 'DataQube',
        instance_type: 'instance',

        meta_qube_id: '',
        blak_qube_id: undefined,
        token_qube_id: undefined,

        creator_identity_state: 'pseudonymous',
        origin: 'ingested',
        ingestion_intake_id: row.intake_id ?? undefined,

        internal_lifecycle: (row.internal_lifecycle as any) ?? 'published',
        surface_lifecycle: (row.surface_lifecycle as any) ?? 'canonized',
        canonicalization_status: 'canonized',
        wip_supabase_only: false,
        visibility_state: 'public',

        gating: ['open'],

        mint_status: 'unminted',
        instance_model: 'singleton',

        dvn_receipt_index: { receipt_count: 0 },
        cartridge_bindings: [],
        card_url: `/api/iqubes/${entry.iqube_id}/card`,

        version: row.version ?? '1.0',
        created_at: row.created_at ?? new Date().toISOString(),
        updated_at: row.updated_at ?? new Date().toISOString(),
      };
    }

    return null;
  },

  async list(_filter?: AdapterListFilter): Promise<AdapterListResult> {
    const sb = client();
    const entries: IQubeIdMapEntry[] = [];

    // 1. LiquidUI template seeds (20 records, Stage 1 C1)
    const { getStore } = await import('@/app/api/registry/templates/store');
    const templates = getStore().filter((t) =>
      (t.metaExtras ?? []).some((x) => x?.k === 'category' && x?.v === 'ui_template_archetype'),
    );
    for (const t of templates) {
      entries.push({
        iqube_id: syntheticIQubeId('code:liquidui-template', t.id),
        source: 'code:liquidui-template',
        source_id: t.id,
        primitive_type: 'DataQube',
        legacy_primitive_type: 'LiquidUITemplateArchetypeQube',
        synthetic: true,
        created_at: t.createdAt ?? new Date().toISOString(),
        updated_at: t.createdAt ?? new Date().toISOString(),
      });
    }

    // 2. DB-backed DataQubes from registry_assets
    const { data } = await sb
      .from('iqube_id_map')
      .select('*')
      .eq('source', 'registry_asset')
      .eq('primitive_type', 'DataQube');
    for (const row of data ?? []) {
      entries.push({
        iqube_id: (row as any).iqube_id,
        source: (row as any).source,
        source_id: (row as any).source_id,
        primitive_type: (row as any).primitive_type,
        legacy_primitive_type: (row as any).legacy_primitive_type ?? undefined,
        synthetic: (row as any).synthetic,
        notes: (row as any).notes ?? undefined,
        created_at: (row as any).created_at,
        updated_at: (row as any).updated_at,
      });
    }

    return { entries };
  },
};
