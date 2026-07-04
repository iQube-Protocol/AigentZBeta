/**
 * Invariant Service — persistence layer (CFS-003a).
 *
 * The ONLY module that reads/writes the invariant substrate tables
 * (invariants, invariant_contexts, invariant_edges, ontology_classes).
 * Every other surface consumes the Invariant Service exports
 * (services/invariants/index.ts) — never these tables directly.
 *
 * Server-only.
 *
 * T0 rule: creator_persona_id is written on insert but NEVER mapped onto
 * the returned records. The mappers in this file are the enforcement
 * point — see tests/invariant-substrate.test.ts.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type {
  InvariantConfidenceBasis,
  InvariantContextRecord,
  InvariantEdgeRecord,
  InvariantEdgeType,
  InvariantNamespace,
  InvariantRecord,
  InvariantSemanticType,
  InvariantStatus,
  OntologyClassRecord,
} from '@/types/invariants';

function asRecordObj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// ─────────────────────────────────────────────────────────────────────────
// Row → record mappers. creator_persona_id is intentionally never read.
// ─────────────────────────────────────────────────────────────────────────

export function mapInvariantRow(row: Record<string, unknown>): InvariantRecord {
  return {
    id: String(row.id),
    seedId: (row.seed_id as string) ?? null,
    statement: String(row.statement),
    namespace: row.namespace as InvariantNamespace,
    ontologyClassId: (row.ontology_class_id as string) ?? null,
    semanticType: (row.semantic_type as InvariantSemanticType) ?? null,
    status: row.status as InvariantStatus,
    confidence: Number(row.confidence),
    confidenceBasis: row.confidence_basis as InvariantConfidenceBasis,
    standing: Number(row.standing ?? 0),
    reach: Number(row.reach ?? 0),
    timesValidated: Number(row.times_validated ?? 0),
    timesContradicted: Number(row.times_contradicted ?? 0),
    timesReferenced: Number(row.times_referenced ?? 0),
    timesUsed: Number(row.times_used ?? 0),
    version: Number(row.version ?? 1),
    supersedesId: (row.supersedes_id as string) ?? null,
    ratifiedSource: (row.ratified_source as string) ?? null,
    provenance: asRecordObj(row.provenance),
    reasoningProvenance: asRecordObj(row.reasoning_provenance),
    creatorAliasCommitment: (row.creator_alias_commitment as string) ?? null,
    dvnReceiptId: (row.dvn_receipt_id as string) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapContextRow(row: Record<string, unknown>): InvariantContextRecord {
  return {
    id: String(row.id),
    invariantId: String(row.invariant_id),
    domain: String(row.domain),
    interpretation: (row.interpretation as string) ?? null,
    applicabilityConditions: row.applicability_conditions
      ? asRecordObj(row.applicability_conditions)
      : null,
    retrievalTags: Array.isArray(row.retrieval_tags) ? (row.retrieval_tags as string[]) : [],
    createdAt: String(row.created_at),
  };
}

export function mapEdgeRow(row: Record<string, unknown>): InvariantEdgeRecord {
  return {
    id: String(row.id),
    fromInvariantId: String(row.from_invariant_id),
    toInvariantId: String(row.to_invariant_id),
    edgeType: row.edge_type as InvariantEdgeType,
    weight: Number(row.weight ?? 1),
    contextId: (row.context_id as string) ?? null,
    rationale: (row.rationale as string) ?? null,
    provenance: asRecordObj(row.provenance),
    reasoningProvenance: asRecordObj(row.reasoning_provenance),
    dvnReceiptId: (row.dvn_receipt_id as string) ?? null,
    createdAt: String(row.created_at),
  };
}

export function mapOntologyClassRow(row: Record<string, unknown>): OntologyClassRecord {
  return {
    id: String(row.id),
    namespace: row.namespace as InvariantNamespace,
    slug: String(row.slug),
    name: String(row.name),
    parentId: (row.parent_id as string) ?? null,
    semanticType: (row.semantic_type as InvariantSemanticType) ?? null,
    description: (row.description as string) ?? null,
    status: (row.status as 'active' | 'deprecated') ?? 'active',
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function requireClient() {
  const client = getSupabaseServer();
  if (!client) throw new Error('invariant store: Supabase server client unavailable');
  return client;
}

// ─────────────────────────────────────────────────────────────────────────
// Invariants
// ─────────────────────────────────────────────────────────────────────────

export interface CreateInvariantInput {
  statement: string;
  namespace: InvariantNamespace;
  ontologyClassId?: string | null;
  semanticType?: InvariantSemanticType | null;
  seedId?: string | null;
  status?: InvariantStatus;
  confidence?: number;
  confidenceBasis?: InvariantConfidenceBasis;
  ratifiedSource?: string | null;
  provenance?: Record<string, unknown>;
  reasoningProvenance?: Record<string, unknown>;
  /** T0 — written to the row, never returned. */
  creatorPersonaId?: string | null;
  creatorAliasCommitment?: string | null;
  supersedesId?: string | null;
}

export async function insertInvariant(input: CreateInvariantInput): Promise<InvariantRecord> {
  const client = requireClient();
  const { data, error } = await client
    .from('invariants')
    .insert({
      statement: input.statement,
      namespace: input.namespace,
      ontology_class_id: input.ontologyClassId ?? null,
      semantic_type: input.semanticType ?? null,
      seed_id: input.seedId ?? null,
      status: input.status ?? 'draft',
      confidence: input.confidence ?? 0.3,
      confidence_basis: input.confidenceBasis ?? 'unknown',
      ratified_source: input.ratifiedSource ?? null,
      provenance: input.provenance ?? {},
      reasoning_provenance: input.reasoningProvenance ?? {},
      creator_persona_id: input.creatorPersonaId ?? null,
      creator_alias_commitment: input.creatorAliasCommitment ?? null,
      supersedes_id: input.supersedesId ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`invariant insert failed: ${error.message}`);
  return mapInvariantRow(data as Record<string, unknown>);
}

export async function getInvariantById(id: string): Promise<InvariantRecord | null> {
  const client = requireClient();
  const { data, error } = await client.from('invariants').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`invariant read failed: ${error.message}`);
  return data ? mapInvariantRow(data as Record<string, unknown>) : null;
}

export async function getInvariantsByIds(ids: string[]): Promise<InvariantRecord[]> {
  if (ids.length === 0) return [];
  const client = requireClient();
  const { data, error } = await client.from('invariants').select('*').in('id', ids);
  if (error) throw new Error(`invariant batch read failed: ${error.message}`);
  return (data ?? []).map((r) => mapInvariantRow(r as Record<string, unknown>));
}

export interface ListInvariantsFilter {
  namespace?: InvariantNamespace;
  status?: InvariantStatus | InvariantStatus[];
  ontologyClassId?: string;
  /** Filter to invariants having a context in this domain. */
  domain?: string;
  /** Case-insensitive substring match on statement. */
  q?: string;
  limit?: number;
}

export async function listInvariants(filter: ListInvariantsFilter = {}): Promise<InvariantRecord[]> {
  const client = requireClient();
  let invariantIds: string[] | null = null;

  if (filter.domain) {
    const { data: ctxRows, error: ctxError } = await client
      .from('invariant_contexts')
      .select('invariant_id')
      .eq('domain', filter.domain);
    if (ctxError) throw new Error(`context filter failed: ${ctxError.message}`);
    invariantIds = [...new Set((ctxRows ?? []).map((r) => String(r.invariant_id)))];
    if (invariantIds.length === 0) return [];
  }

  let query = client.from('invariants').select('*');
  if (filter.namespace) query = query.eq('namespace', filter.namespace);
  if (filter.status) {
    query = Array.isArray(filter.status)
      ? query.in('status', filter.status)
      : query.eq('status', filter.status);
  }
  if (filter.ontologyClassId) query = query.eq('ontology_class_id', filter.ontologyClassId);
  if (filter.q) query = query.ilike('statement', `%${filter.q}%`);
  if (invariantIds) query = query.in('id', invariantIds);
  query = query
    .order('standing', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(Math.min(filter.limit ?? 100, 500));

  const { data, error } = await query;
  if (error) throw new Error(`invariant list failed: ${error.message}`);
  return (data ?? []).map((r) => mapInvariantRow(r as Record<string, unknown>));
}

export async function updateInvariant(
  id: string,
  patch: Record<string, unknown>,
): Promise<InvariantRecord> {
  const client = requireClient();
  const { data, error } = await client
    .from('invariants')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`invariant update failed: ${error.message}`);
  return mapInvariantRow(data as Record<string, unknown>);
}

// ─────────────────────────────────────────────────────────────────────────
// Contexts
// ─────────────────────────────────────────────────────────────────────────

export interface AddContextInput {
  invariantId: string;
  domain: string;
  interpretation?: string | null;
  applicabilityConditions?: Record<string, unknown> | null;
  retrievalTags?: string[];
}

export async function upsertContext(input: AddContextInput): Promise<InvariantContextRecord> {
  const client = requireClient();
  const { data, error } = await client
    .from('invariant_contexts')
    .upsert(
      {
        invariant_id: input.invariantId,
        domain: input.domain,
        interpretation: input.interpretation ?? null,
        applicability_conditions: input.applicabilityConditions ?? null,
        retrieval_tags: input.retrievalTags ?? [],
      },
      { onConflict: 'invariant_id,domain' },
    )
    .select()
    .single();
  if (error) throw new Error(`context upsert failed: ${error.message}`);
  return mapContextRow(data as Record<string, unknown>);
}

export async function listContexts(invariantId: string): Promise<InvariantContextRecord[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('invariant_contexts')
    .select('*')
    .eq('invariant_id', invariantId);
  if (error) throw new Error(`context list failed: ${error.message}`);
  return (data ?? []).map((r) => mapContextRow(r as Record<string, unknown>));
}

// ─────────────────────────────────────────────────────────────────────────
// Edges
// ─────────────────────────────────────────────────────────────────────────

export interface AddEdgeInput {
  fromInvariantId: string;
  toInvariantId: string;
  edgeType: InvariantEdgeType;
  weight?: number;
  contextId?: string | null;
  rationale?: string | null;
  provenance?: Record<string, unknown>;
  reasoningProvenance?: Record<string, unknown>;
}

export async function insertEdge(input: AddEdgeInput): Promise<InvariantEdgeRecord> {
  const client = requireClient();
  const { data, error } = await client
    .from('invariant_edges')
    .insert({
      from_invariant_id: input.fromInvariantId,
      to_invariant_id: input.toInvariantId,
      edge_type: input.edgeType,
      weight: input.weight ?? 1,
      context_id: input.contextId ?? null,
      rationale: input.rationale ?? null,
      provenance: input.provenance ?? {},
      reasoning_provenance: input.reasoningProvenance ?? {},
    })
    .select()
    .single();
  if (error) throw new Error(`edge insert failed: ${error.message}`);
  return mapEdgeRow(data as Record<string, unknown>);
}

export async function listEdgesForInvariants(
  ids: string[],
  direction: 'out' | 'in' | 'both',
  edgeTypes?: InvariantEdgeType[],
): Promise<InvariantEdgeRecord[]> {
  if (ids.length === 0) return [];
  const client = requireClient();
  const results: InvariantEdgeRecord[] = [];

  const runQuery = async (column: 'from_invariant_id' | 'to_invariant_id') => {
    let query = client.from('invariant_edges').select('*').in(column, ids);
    if (edgeTypes && edgeTypes.length > 0) query = query.in('edge_type', edgeTypes);
    const { data, error } = await query;
    if (error) throw new Error(`edge list failed: ${error.message}`);
    results.push(...(data ?? []).map((r) => mapEdgeRow(r as Record<string, unknown>)));
  };

  if (direction === 'out' || direction === 'both') await runQuery('from_invariant_id');
  if (direction === 'in' || direction === 'both') await runQuery('to_invariant_id');

  // Dedup (an edge between two in-set nodes appears in both sweeps).
  const seen = new Set<string>();
  return results.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

export async function updateEdgeEndpoints(
  edgeId: string,
  patch: { from_invariant_id?: string; to_invariant_id?: string },
): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('invariant_edges').update(patch).eq('id', edgeId);
  if (error) throw new Error(`edge update failed: ${error.message}`);
}

export async function deleteEdge(edgeId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('invariant_edges').delete().eq('id', edgeId);
  if (error) throw new Error(`edge delete failed: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────
// Ontology classes
// ─────────────────────────────────────────────────────────────────────────

export interface CreateOntologyClassInput {
  namespace: InvariantNamespace;
  slug: string;
  name: string;
  parentId?: string | null;
  semanticType?: InvariantSemanticType | null;
  description?: string | null;
}

export async function upsertOntologyClass(
  input: CreateOntologyClassInput,
): Promise<OntologyClassRecord> {
  const client = requireClient();
  const { data, error } = await client
    .from('ontology_classes')
    .upsert(
      {
        namespace: input.namespace,
        slug: input.slug,
        name: input.name,
        parent_id: input.parentId ?? null,
        semantic_type: input.semanticType ?? null,
        description: input.description ?? null,
      },
      { onConflict: 'slug' },
    )
    .select()
    .single();
  if (error) throw new Error(`ontology class upsert failed: ${error.message}`);
  return mapOntologyClassRow(data as Record<string, unknown>);
}

export async function listOntologyClasses(
  namespace?: InvariantNamespace,
): Promise<OntologyClassRecord[]> {
  const client = requireClient();
  let query = client.from('ontology_classes').select('*').eq('status', 'active');
  if (namespace) query = query.eq('namespace', namespace);
  const { data, error } = await query.order('namespace').order('slug');
  if (error) throw new Error(`ontology class list failed: ${error.message}`);
  return (data ?? []).map((r) => mapOntologyClassRow(r as Record<string, unknown>));
}

/**
 * Canon version stamp (CFS-006 §3 / CFS-008 §5) — the max updated_at across
 * the knowledge-bearing statuses. Canonical objects change only by
 * supersession, so this stamp changes iff the canon changed; it is the
 * invalidation key for knowledge-initialization manifests.
 */
export async function getCanonVersionStamp(): Promise<string> {
  const client = requireClient();
  const { data, error } = await client
    .from('invariants')
    .select('updated_at')
    .in('status', ['canonical', 'validated'])
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`canon version stamp failed: ${error.message}`);
  const stamp = data?.[0]?.updated_at;
  return stamp ? String(stamp) : 'empty-canon';
}
