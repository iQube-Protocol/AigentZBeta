/**
 * iQube Registry Service
 * 
 * Manages the creation and retrieval of iQube registry entries:
 * - MetaQube: Public metadata
 * - BlakQube: Encrypted payload pointer
 * - TokenQube: Wrapped encryption key
 * 
 * These form the core iQube triad for each piece of content.
 */

import { getSupabaseServer } from '../../app/api/_lib/supabaseServer';

// Helper to get Supabase client with null check
function getSupabase() {
  const client = getSupabaseServer();
  if (!client) {
    throw new Error('Supabase client not available');
  }
  return client;
}

// Types
export interface MetaQubeParams {
  name: string;
  slug: string;
  qubeType: string;
  series?: string;
  episodeNumber?: number;
  tags?: string[];
  description?: string;
  previewUrl?: string;
  metadata?: Record<string, any>;
}

export interface BlakQubeParams {
  cid: string;
  payloadType: string;
  provider: 'autonomys' | 'ipfs' | 'payload-cms';
  encryptionAlg: string;
  iv: string;
  authTag?: string;
  size?: number;
  checksum?: string;
}

export interface TokenQubeParams {
  keyCiphertext: string;
  wrappingAlg: string;
  keyType?: string;
  accessPolicy?: Record<string, any>;
}

export interface MetaQube {
  id: string;
  name: string;
  slug: string;
  qube_type: string;
  series?: string;
  episode_number?: number;
  tags?: string[];
  description?: string;
  preview_url?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface BlakQube {
  id: string;
  payload_pointer: string;
  payload_type: string;
  payload_provider: string;
  payload_size?: number;
  encryption_alg: string;
  encryption_iv: string;
  encryption_auth_tag?: string;
  checksum?: string;
  created_at: string;
}

export interface TokenQube {
  id: string;
  key_ciphertext: string;
  key_wrapping_alg: string;
  key_type?: string;
  access_policy?: Record<string, any>;
  chain_token_id?: number | null;
  chain_id?: number | null;
  chain_tx_hash?: string | null;
  chain_minter?: string | null;
  created_at: string;
}

/**
 * Create a MetaQube (public metadata)
 */
export async function createMetaQube(params: MetaQubeParams): Promise<string> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('iq_meta_qubes')
    .insert({
      name: params.name,
      slug: params.slug,
      qube_type: params.qubeType,
      series: params.series,
      episode_number: params.episodeNumber,
      tags: params.tags || [],
      description: params.description,
      preview_url: params.previewUrl,
      metadata: params.metadata || {},
    })
    .select('id')
    .single();

  if (error) {
    // If slug conflict, try with a unique suffix
    if (error.code === '23505' && error.message.includes('slug')) {
      const uniqueSlug = `${params.slug}-${Date.now()}`;
      const { data: retryData, error: retryError } = await supabase
        .from('iq_meta_qubes')
        .insert({
          name: params.name,
          slug: uniqueSlug,
          qube_type: params.qubeType,
          series: params.series,
          episode_number: params.episodeNumber,
          tags: params.tags || [],
          description: params.description,
          preview_url: params.previewUrl,
          metadata: params.metadata || {},
        })
        .select('id')
        .single();

      if (retryError) {
        throw new Error(`Failed to create MetaQube: ${retryError.message}`);
      }
      return retryData.id;
    }
    throw new Error(`Failed to create MetaQube: ${error.message}`);
  }

  return data.id;
}

/**
 * Create a BlakQube (encrypted payload pointer)
 */
export async function createBlakQube(params: BlakQubeParams): Promise<string> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('iq_blak_qubes')
    .insert({
      payload_pointer: params.cid,
      payload_type: params.payloadType,
      payload_provider: params.provider,
      payload_size: params.size,
      encryption_alg: params.encryptionAlg,
      encryption_iv: params.iv,
      encryption_auth_tag: params.authTag,
      checksum: params.checksum,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create BlakQube: ${error.message}`);
  }

  return data.id;
}

/**
 * Create a TokenQube (wrapped encryption key)
 */
export async function createTokenQube(params: TokenQubeParams): Promise<string> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('iq_token_qubes')
    .insert({
      key_ciphertext: params.keyCiphertext,
      key_wrapping_alg: params.wrappingAlg,
      key_type: params.keyType || 'AES-256',
      access_policy: params.accessPolicy || {},
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create TokenQube: ${error.message}`);
  }

  return data.id;
}

/**
 * Get a MetaQube by ID
 */
export async function getMetaQube(id: string): Promise<MetaQube | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('iq_meta_qubes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get MetaQube: ${error.message}`);
  }

  return data;
}

/**
 * Get a BlakQube by ID
 */
export async function getBlakQube(id: string): Promise<BlakQube | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('iq_blak_qubes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get BlakQube: ${error.message}`);
  }

  return data;
}

/**
 * Get a TokenQube by ID
 */
export async function getTokenQube(id: string): Promise<TokenQube | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('iq_token_qubes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get TokenQube: ${error.message}`);
  }

  return data;
}

/**
 * Record on-chain anchor details after a successful mintQube() call.
 */
export async function updateTokenQubeChainAnchor(
  id: string,
  anchor: { chainTokenId: number; chainId: number; chainTxHash: string; chainMinter: string },
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('iq_token_qubes')
    .update({
      chain_token_id: anchor.chainTokenId,
      chain_id: anchor.chainId,
      chain_tx_hash: anchor.chainTxHash,
      chain_minter: anchor.chainMinter,
    })
    .eq('id', id);
  if (error) throw new Error(`Failed to update TokenQube chain anchor: ${error.message}`);
}

/**
 * Get MetaQubes by series
 */
export async function getMetaQubesBySeries(series: string): Promise<MetaQube[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('iq_meta_qubes')
    .select('*')
    .eq('series', series)
    .order('episode_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to get MetaQubes: ${error.message}`);
  }

  return data || [];
}

/**
 * Get MetaQubes by type
 */
export async function getMetaQubesByType(qubeType: string): Promise<MetaQube[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('iq_meta_qubes')
    .select('*')
    .eq('qube_type', qubeType)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get MetaQubes: ${error.message}`);
  }

  return data || [];
}

/**
 * Search MetaQubes by tags
 */
export async function searchMetaQubesByTags(tags: string[]): Promise<MetaQube[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('iq_meta_qubes')
    .select('*')
    .overlaps('tags', tags)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to search MetaQubes: ${error.message}`);
  }

  return data || [];
}

/**
 * Update MetaQube metadata
 */
export async function updateMetaQube(
  id: string,
  updates: Partial<MetaQubeParams>
): Promise<void> {
  const supabase = getSupabase();

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name) updateData.name = updates.name;
  if (updates.description) updateData.description = updates.description;
  if (updates.tags) updateData.tags = updates.tags;
  if (updates.previewUrl) updateData.preview_url = updates.previewUrl;
  if (updates.metadata) updateData.metadata = updates.metadata;

  const { error } = await supabase
    .from('iq_meta_qubes')
    .update(updateData)
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update MetaQube: ${error.message}`);
  }
}

/**
 * Get complete iQube triad (meta + blak + token) for a content item
 */
export async function getQubeTriad(
  metaQubeId: string,
  blakQubeId: string,
  tokenQubeId: string
): Promise<{
  meta: MetaQube | null;
  blak: BlakQube | null;
  token: TokenQube | null;
}> {
  const [meta, blak, token] = await Promise.all([
    getMetaQube(metaQubeId),
    getBlakQube(blakQubeId),
    getTokenQube(tokenQubeId),
  ]);

  return { meta, blak, token };
}
