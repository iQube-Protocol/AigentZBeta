/**
 * Invariant Service — collections (CFS-001 §1, Level 2).
 *
 * A coherent, named set of related Level-1 invariants. Still graph-native;
 * the collection is a lightweight grouping, not a publication (that is the
 * InvariantQube, Level 3 — see publish.ts).
 *
 * Server-only. Part of the canonical Invariant Service; nothing outside
 * services/invariants reads these tables directly.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type {
  InvariantCollectionMember,
  InvariantCollectionRecord,
  InvariantNamespace,
} from '@/types/invariants';

function requireClient() {
  const client = getSupabaseServer();
  if (!client) throw new Error('invariant collections: Supabase server client unavailable');
  return client;
}

function mapCollectionRow(row: Record<string, unknown>): InvariantCollectionRecord {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    namespace: (row.namespace as InvariantNamespace) ?? null,
    description: (row.description as string) ?? null,
    status: (row.status as 'active' | 'archived') ?? 'active',
    curatorAliasCommitment: (row.curator_alias_commitment as string) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export interface CreateCollectionInput {
  name: string;
  slug?: string;
  namespace?: InvariantNamespace | null;
  description?: string | null;
  /** T0 — written to the row, never returned. */
  curatorPersonaId?: string | null;
  curatorAliasCommitment?: string | null;
  memberInvariantIds?: string[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function createCollection(
  input: CreateCollectionInput,
): Promise<InvariantCollectionRecord> {
  const client = requireClient();
  const { data, error } = await client
    .from('invariant_collections')
    .insert({
      name: input.name,
      slug: input.slug ?? slugify(input.name),
      namespace: input.namespace ?? null,
      description: input.description ?? null,
      curator_persona_id: input.curatorPersonaId ?? null,
      curator_alias_commitment: input.curatorAliasCommitment ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`collection insert failed: ${error.message}`);
  const collection = mapCollectionRow(data as Record<string, unknown>);

  if (input.memberInvariantIds && input.memberInvariantIds.length > 0) {
    await addMembers(collection.id, input.memberInvariantIds);
  }
  return collection;
}

export async function getCollection(id: string): Promise<InvariantCollectionRecord | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('invariant_collections')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`collection read failed: ${error.message}`);
  return data ? mapCollectionRow(data as Record<string, unknown>) : null;
}

export async function listCollections(
  namespace?: InvariantNamespace,
): Promise<InvariantCollectionRecord[]> {
  const client = requireClient();
  let query = client.from('invariant_collections').select('*').eq('status', 'active');
  if (namespace) query = query.eq('namespace', namespace);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(`collection list failed: ${error.message}`);
  return (data ?? []).map((r) => mapCollectionRow(r as Record<string, unknown>));
}

export async function addMembers(collectionId: string, invariantIds: string[]): Promise<void> {
  if (invariantIds.length === 0) return;
  const client = requireClient();
  const rows = invariantIds.map((invariantId, index) => ({
    collection_id: collectionId,
    invariant_id: invariantId,
    position: index,
  }));
  const { error } = await client
    .from('invariant_collection_members')
    .upsert(rows, { onConflict: 'collection_id,invariant_id' });
  if (error) throw new Error(`collection member upsert failed: ${error.message}`);
}

export async function removeMember(collectionId: string, invariantId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('invariant_collection_members')
    .delete()
    .eq('collection_id', collectionId)
    .eq('invariant_id', invariantId);
  if (error) throw new Error(`collection member delete failed: ${error.message}`);
}

export async function listMembers(collectionId: string): Promise<InvariantCollectionMember[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('invariant_collection_members')
    .select('invariant_id, position')
    .eq('collection_id', collectionId)
    .order('position', { ascending: true });
  if (error) throw new Error(`collection member list failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    invariantId: String(r.invariant_id),
    position: Number(r.position ?? 0),
  }));
}
