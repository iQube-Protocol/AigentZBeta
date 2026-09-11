/**
 * ToolQube primitive adapter (incl. ConnectorQube via tool_subtype).
 *
 * Wraps services/iqube/legibility/sources/toolQubeSource.ts. The
 * legibility source reads live from openclawCore's in-process tool
 * registry. This adapter adds the canonical fields:
 *   - tool_subtype (skill | connector | workflow | browser)
 *   - wrapper_strategy
 *   - connector block when subtype='connector' (MCP endpoint metadata
 *     surfaced via legibility source's supported_interfaces.mcp)
 *
 * Iqube_id strategy: code-only source (openclawCore) has no DB row, so
 * synthetic UUIDs derived via syntheticIQubeId(). Stable across deploys.
 * Replaced by DB-backed ids when legibility fast-follow #3 promotes
 * ToolQubes to a tool_qubes table.
 *
 * Secret safety (PRD v0.2 §B.11): adapter NEVER reads secrets. The
 * tool record's auth_scheme and (opaque) secret_ref are sourced from
 * the openclawCore tool definition; the actual secret values are
 * resolved by services/registry/invocationGateway.ts at invocation time.
 */

import { createClient } from '@supabase/supabase-js';

import {
  getToolQubeSource,
  listToolQubeSources,
} from '@/services/iqube/legibility/sources/toolQubeSource';

import type {
  CanonicalIQubeInternalRecord,
  IQubeIdMapEntry,
  CanonicalToolBlock,
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
 * Derive tool_subtype + wrapper_strategy from the legibility source's
 * supported_interfaces hints + tags. The legibility source surfaces
 * MCP endpoints via supported_interfaces.mcp; non-MCP tools default to
 * 'skill' wrapper.
 *
 * This is a Stage 2 stopgap. When ToolQubes promote to a tool_qubes DB
 * table (legibility fast-follow #3), tool_subtype + wrapper_strategy
 * become columns and this derivation goes away.
 */
function deriveToolBlock(src: ReturnType<typeof getToolQubeSource>): CanonicalToolBlock | undefined {
  if (!src) return undefined;
  const intfs = src.supported_interfaces ?? {};
  if (intfs.mcp) {
    return {
      tool_subtype: 'connector',
      wrapper_strategy: 'mcp',
      endpoint_url: intfs.mcp,
      transport: 'http', // openclawCore mcp endpoints are http by default; refine when DB-backed
      protocol: 'mcp',
      auth_scheme: 'none', // Real value lives in openclawCore tool config; secret_ref opaque
      secret_ref: undefined, // Set only when the tool config declares a vault reference
    };
  }
  // Default ToolQube: skill wrapper (in-process function call)
  return {
    tool_subtype: 'skill',
    wrapper_strategy: 'skill',
  };
}

export const toolQubeAdapter: RegistryPrimitiveAdapter = {
  primitive_type: 'ToolQube',
  sources: ['code:toolQubeSource', 'registry_asset'],

  async hydrate(
    entry: IQubeIdMapEntry,
    _opts: AdapterHydrateOpts = {},
  ): Promise<CanonicalIQubeInternalRecord | null> {
    // Two source paths:
    //   - code:toolQubeSource → openclawCore runtime lookup
    //   - registry_asset → DB-backed ingestion-factory asset (Stage 1 C4
    //     migrated asset_class → primitive_type=ToolQube + tool_subtype)
    if (entry.source !== 'code:toolQubeSource' && entry.source !== 'registry_asset') return null;

    if (entry.source === 'code:toolQubeSource') {
      const src = getToolQubeSource(entry.source_id);
      if (!src) return null;
      const tool = deriveToolBlock(src);

      return {
        iqube_id: entry.iqube_id,
        primitive_type: 'ToolQube',
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

        mint_status: 'unminted', // Code-only tools don't mint until DB promotion
        instance_model: 'singleton',

        tool,

        dvn_receipt_index: { receipt_count: 0 },
        cartridge_bindings: src.tags?.filter(Boolean) ?? [],
        card_url: `/api/iqubes/${entry.iqube_id}/card`,

        version: '1.0',
        created_at: src.created_at ?? new Date().toISOString(),
        updated_at: src.updated_at ?? new Date().toISOString(),
      };
    }

    // registry_asset path — DB-backed ToolQube (Stage 1 C4 migration
    // populated primitive_type + tool_subtype + wrapper_strategy).
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
      primitive_type: 'ToolQube',
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

      tool: {
        tool_subtype: row.tool_subtype ?? undefined,
        wrapper_strategy: row.wrapper_strategy ?? undefined,
      },

      dvn_receipt_index: { receipt_count: 0 },
      cartridge_bindings: [],
      card_url: `/api/iqubes/${entry.iqube_id}/card`,

      version: row.version ?? '1.0',
      created_at: row.created_at ?? new Date().toISOString(),
      updated_at: row.updated_at ?? new Date().toISOString(),
    };
  },

  async list(_filter?: AdapterListFilter): Promise<AdapterListResult> {
    // Enumerate both source paths (code + DB) for catalog enumeration.
    const sb = client();
    const entries: IQubeIdMapEntry[] = [];

    // 1. Code-only ToolQubes from openclawCore — synthetic UUIDs
    const codeTools = listToolQubeSources();
    for (const src of codeTools) {
      entries.push({
        iqube_id: syntheticIQubeId('code:toolQubeSource', src.iqube_id),
        source: 'code:toolQubeSource',
        source_id: src.iqube_id,
        primitive_type: 'ToolQube',
        synthetic: true,
        created_at: src.created_at ?? new Date().toISOString(),
        updated_at: src.updated_at ?? new Date().toISOString(),
      });
    }

    // 2. DB-backed ToolQubes from registry_assets (Stage 1 C4 reclassified)
    const { data } = await sb
      .from('iqube_id_map')
      .select('*')
      .eq('source', 'registry_asset')
      .eq('primitive_type', 'ToolQube');
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
