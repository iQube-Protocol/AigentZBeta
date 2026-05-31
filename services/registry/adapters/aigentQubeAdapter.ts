/**
 * AigentQube primitive adapter.
 *
 * Wraps services/iqube/legibility/sources/aigentQubeSource.ts. The
 * legibility source reads RUNTIME_AGENT_IDS + a hand-curated profile
 * map for 5 canonical aigents (aigent-me, aigent-marketa, aigent-kn0w1,
 * aigent-moneypenny, aigent-nakamoto).
 *
 * Iqube_id strategy: code-only source — synthetic UUIDs via
 * syntheticIQubeId('code:aigentQubeSource', runtime_id). Replaced when
 * legibility fast-follow #3 promotes AigentQubes to aigent_qubes table.
 *
 * Stage 7 extends this adapter with the KNYT framework governance block
 * (rights / constraints / obligations + root_agent_id + deployment_id +
 * trust_band). For Stage 2 we emit a minimal CanonicalAigentBlock with
 * defaults — payment_authority is NULL per PRD v1.1 §B.6 default.
 */

import { createClient } from '@supabase/supabase-js';

import {
  getAigentQubeSource,
  listAigentQubeSources,
} from '@/services/iqube/legibility/sources/aigentQubeSource';

import type {
  CanonicalIQubeInternalRecord,
  IQubeIdMapEntry,
  CanonicalAigentBlock,
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

/**
 * Stage 2 default governance block — minimal rights / no constraints /
 * no obligations beyond the default receipt requirement. Stage 7
 * extends with KNYT framework §10/§11/§12/§14 governance (root_agent_id,
 * trust_band, charter, prohibited_actions, etc.) populated from the
 * future aigent_qubes DB table.
 *
 * payment_authority defaults to NULL per PRD v1.1 §B.6. Non-null requires
 * canonization-queue approval; until the queue lands in Stage 8, all
 * AigentQubes ship with no spend authority.
 */
function defaultGovernance(runtimeId: string): CanonicalAigentBlock {
  return {
    root_agent_id: runtimeId, // Stage 7: derive from aigent_qubes.root_agent_id
    deployment_id: undefined,
    persona_alias_commitment: undefined,

    charter_accepted: false, // Stage 7: aigent_qubes.charter_accepted
    charter_version: '0.0',
    trust_band: 0,

    governance: {
      rights: {
        allowed_actions: ['discover', 'read_meta', 'read_summary', 'cite'],
        cartridge_scopes: [],
        tool_scopes: [],
        data_scopes: [],
        payment_authority: undefined, // Default NULL per v1.1 §B.6
      },
      constraints: {
        prohibited_actions: ['mint_derivative', 'fork', 'revoke_access'],
        prohibited_cartridges: [],
        must_disclose_as_agent: true,
        identifiability_floor: 'semi_anonymous',
        requires_human_approval: ['mint_derivative', 'fork', 'revoke_access'],
      },
      obligations: {
        receipt_required_for: ['mint_derivative', 'revoke_access'],
        charter_accepted: false,
        charter_version: '0.0',
        trust_band: 0,
      },
      revocation: {
        revocable_by: ['platform_admin'],
        revocation_receipt_required: true,
      },
    },
  };
}

export const aigentQubeAdapter: RegistryPrimitiveAdapter = {
  primitive_type: 'AigentQube',
  sources: ['code:aigentQubeSource', 'registry_asset'],

  async hydrate(
    entry: IQubeIdMapEntry,
    _opts: AdapterHydrateOpts = {},
  ): Promise<CanonicalIQubeInternalRecord | null> {
    if (entry.source !== 'code:aigentQubeSource' && entry.source !== 'registry_asset') return null;

    if (entry.source === 'code:aigentQubeSource') {
      const src = getAigentQubeSource(entry.source_id);
      if (!src) return null;
      const aigent = defaultGovernance(entry.source_id);

      // Surface MCP/A2A/runtime URLs from the legibility source.
      aigent.supported_interfaces = src.supported_interfaces;

      return {
        iqube_id: entry.iqube_id,
        primitive_type: 'AigentQube',
        instance_type: 'instance',

        meta_qube_id: '',
        blak_qube_id: undefined,
        token_qube_id: undefined,

        creator_identity_state: src.creator_identity_state,
        origin: 'native',

        internal_lifecycle: 'published',
        surface_lifecycle: 'canonized',
        canonicalization_status: 'canonized',
        wip_supabase_only: false,
        visibility_state: src.visibility_state,

        gating: src.gating,

        mint_status: 'unminted',
        instance_model: 'singleton',

        aigent,

        dvn_receipt_index: { receipt_count: 0 },
        cartridge_bindings: src.tags?.filter(Boolean) ?? [],
        card_url: `/api/iqubes/${entry.iqube_id}/card`,

        version: '1.0',
        created_at: src.created_at ?? new Date().toISOString(),
        updated_at: src.updated_at ?? new Date().toISOString(),
      };
    }

    // registry_asset path — DB-backed AigentQube (4 rows per Stage 0 audit)
    const sb = client();
    const { data } = await sb
      .from('registry_assets')
      .select('*')
      .eq('asset_id', entry.source_id)
      .maybeSingle();
    if (!data) return null;
    const row = data as any;
    const aigent = defaultGovernance(row.asset_id);

    return {
      iqube_id: entry.iqube_id,
      primitive_type: 'AigentQube',
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

      aigent,

      dvn_receipt_index: { receipt_count: 0 },
      cartridge_bindings: [],
      card_url: `/api/iqubes/${entry.iqube_id}/card`,

      version: row.version ?? '1.0',
      created_at: row.created_at ?? new Date().toISOString(),
      updated_at: row.updated_at ?? new Date().toISOString(),
    };
  },

  async list(_filter?: AdapterListFilter): Promise<AdapterListResult> {
    const sb = client();
    const entries: IQubeIdMapEntry[] = [];

    // 1. Code-only AigentQubes from RUNTIME_AGENT_IDS — synthetic UUIDs
    const codeAigents = listAigentQubeSources();
    for (const src of codeAigents) {
      entries.push({
        iqube_id: syntheticIQubeId('code:aigentQubeSource', src.iqube_id),
        source: 'code:aigentQubeSource',
        source_id: src.iqube_id,
        primitive_type: 'AigentQube',
        synthetic: true,
        created_at: src.created_at ?? new Date().toISOString(),
        updated_at: src.updated_at ?? new Date().toISOString(),
      });
    }

    // 2. DB-backed AigentQubes from registry_assets
    const { data } = await sb
      .from('iqube_id_map')
      .select('*')
      .eq('source', 'registry_asset')
      .eq('primitive_type', 'AigentQube');
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
