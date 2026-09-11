/**
 * Invariant Service — InvariantQube composition & publication (CFS-003 §5,
 * CFS-004 §3, CFS-005). Turns a validated collection (Level 2) into a
 * published, registry-registered package of compressed expertise (Level 3).
 *
 * Staged registration (CFS-004 §3 Stage 1, the VentureQube precedent):
 *   iqube_id_map row → primitive_type='DataQube', source='triad_meta',
 *   metadata.kind='invariant_bundle'. Promotion to a first-class
 *   InvariantQube primitive is a later canonization (Stage 2).
 *
 * Server-only.
 */

import { createHash } from 'crypto';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createMetaQube } from '@/server/services/iqRegistryService';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import type {
  InvariantEdgeRecord,
  InvariantQubeManifest,
  InvariantQubeRecord,
  InvariantRecord,
} from '@/types/invariants';
import { getCollection, listMembers } from './collections';
import { getInvariantsByIds, listContexts, listEdgesForInvariants } from './store';

// ─────────────────────────────────────────────────────────────────────────
// Pure aggregation (CFS-003 §5) — unit-testable, no I/O.
// ─────────────────────────────────────────────────────────────────────────

/** Weakest-link: a bundle is only as confident as its least-confident member. */
export function aggregateConfidence(memberConfidences: number[]): number {
  if (memberConfidences.length === 0) return 0;
  return Math.round(Math.min(...memberConfidences) * 1000) / 1000;
}

/** Bundle standing derives from its members: the mean of member standings. */
export function aggregateStanding(memberStandings: number[]): number {
  if (memberStandings.length === 0) return 0;
  const mean = memberStandings.reduce((a, b) => a + b, 0) / memberStandings.length;
  return Math.round(mean * 10) / 10;
}

export interface CoherenceResult {
  coherent: boolean;
  conflicts: { fromInvariantId: string; toInvariantId: string }[];
}

/**
 * A bundle is coherent iff no `contradicts` edge exists between two of its
 * members (CFS-003 §5 step 3).
 */
export function checkCoherence(
  memberIds: string[],
  edges: InvariantEdgeRecord[],
): CoherenceResult {
  const memberSet = new Set(memberIds);
  const conflicts = edges
    .filter(
      (e) =>
        e.edgeType === 'contradicts' &&
        memberSet.has(e.fromInvariantId) &&
        memberSet.has(e.toInvariantId),
    )
    .map((e) => ({ fromInvariantId: e.fromInvariantId, toInvariantId: e.toInvariantId }));
  return { coherent: conflicts.length === 0, conflicts };
}

// ─────────────────────────────────────────────────────────────────────────
// Manifest composition
// ─────────────────────────────────────────────────────────────────────────

export async function composeManifest(
  memberIds: string[],
): Promise<{ manifest: InvariantQubeManifest; coherence: CoherenceResult }> {
  const members = await getInvariantsByIds(memberIds);
  const memberSet = new Set(memberIds);

  // Internal edges: both endpoints are members.
  const allEdges = await listEdgesForInvariants(memberIds, 'both');
  const internalEdges = allEdges.filter(
    (e) => memberSet.has(e.fromInvariantId) && memberSet.has(e.toInvariantId),
  );

  const coherence = checkCoherence(memberIds, internalEdges);

  // Union of member context domains.
  const contextDomains = new Set<string>();
  for (const member of members) {
    for (const ctx of await listContexts(member.id)) contextDomains.add(ctx.domain);
  }

  const manifest: InvariantQubeManifest = {
    members: members.map((m: InvariantRecord) => ({
      invariantId: m.id,
      statement: m.statement,
      namespace: m.namespace,
      confidence: m.confidence,
      standing: m.standing,
    })),
    internalEdges: internalEdges.map((e) => ({
      fromInvariantId: e.fromInvariantId,
      toInvariantId: e.toInvariantId,
      edgeType: e.edgeType,
    })),
    contexts: [...contextDomains],
    aggregateConfidence: aggregateConfidence(members.map((m) => m.confidence)),
    aggregateStanding: aggregateStanding(members.map((m) => m.standing)),
  };

  return { manifest, coherence };
}

// ─────────────────────────────────────────────────────────────────────────
// Publication
// ─────────────────────────────────────────────────────────────────────────

function mapInvariantQubeRow(row: Record<string, unknown>): InvariantQubeRecord {
  return {
    id: String(row.id),
    iqubeId: (row.iqube_id as string) ?? null,
    collectionId: (row.collection_id as string) ?? null,
    publicRef: String(row.public_ref),
    title: String(row.title),
    version: Number(row.version ?? 1),
    manifest: (row.manifest as InvariantQubeManifest) ?? {
      members: [],
      internalEdges: [],
      contexts: [],
      aggregateConfidence: 0,
      aggregateStanding: 0,
    },
    aggregateConfidence: Number(row.aggregate_confidence ?? 0),
    aggregateStanding: Number(row.aggregate_standing ?? 0),
    memberCount: Number(row.member_count ?? 0),
    status: (row.status as 'draft' | 'published' | 'superseded') ?? 'draft',
    supersedesId: (row.supersedes_id as string) ?? null,
    creatorAliasCommitment: (row.creator_alias_commitment as string) ?? null,
    dvnReceiptId: (row.dvn_receipt_id as string) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/** Deterministic, one-way T2-safe commitment over the InvariantQube row id. */
export function deriveInvariantQubePublicRef(rowId: string): string {
  return createHash('sha256').update('invariant_qube:' + rowId).digest('hex').slice(0, 16);
}

export interface PublishInvariantQubeInput {
  collectionId: string;
  title?: string;
  actor: { personaId: string; sessionId?: string };
}

export interface PublishInvariantQubeResult {
  invariantQube: InvariantQubeRecord;
  iqubeId: string;
  coherence: CoherenceResult;
}

export async function publishInvariantQube(
  input: PublishInvariantQubeInput,
): Promise<PublishInvariantQubeResult> {
  const client = getSupabaseServer();
  if (!client) throw new Error('publishInvariantQube: Supabase server client unavailable');

  const collection = await getCollection(input.collectionId);
  if (!collection) throw new Error('collection not found');

  const members = await listMembers(input.collectionId);
  if (members.length === 0) throw new Error('cannot publish an empty collection');

  const memberIds = members.map((m) => m.invariantId);
  const { manifest, coherence } = await composeManifest(memberIds);
  if (!coherence.coherent) {
    throw new Error(
      `incoherent: collection contains contradicting members (${coherence.conflicts
        .map((c) => `${c.fromInvariantId}↔${c.toInvariantId}`)
        .join(', ')})`,
    );
  }

  const title = input.title ?? collection.name;

  // 1. Draft InvariantQube row (so we can derive the public ref from its id).
  const { data: draftRow, error: draftErr } = await client
    .from('invariant_qubes')
    .insert({
      collection_id: input.collectionId,
      public_ref: 'pending',
      title,
      manifest,
      aggregate_confidence: manifest.aggregateConfidence,
      aggregate_standing: manifest.aggregateStanding,
      member_count: manifest.members.length,
      status: 'draft',
      creator_persona_id: input.actor.personaId,
    })
    .select()
    .single();
  if (draftErr || !draftRow) throw new Error(`invariant_qube draft failed: ${draftErr?.message}`);
  const rowId = String((draftRow as Record<string, unknown>).id);
  const publicRef = deriveInvariantQubePublicRef(rowId);

  // 2. Public meta record (T2-safe — commitment + counts only, no statements
  //    that might leak proprietary reasoning; the manifest stays in
  //    invariant_qubes under service-role RLS).
  const metaQubeId = await createMetaQube({
    name: `InvariantQube ${publicRef}`,
    slug: `invariantqube-${publicRef}`,
    qubeType: 'DataQube',
    tags: ['invariant', 'invariantqube', 'compressed-expertise'],
    description:
      'InvariantQube — public meta only; the compressed-expertise manifest lives in invariant_qubes under service-role RLS.',
    metadata: {
      kind: 'invariant_bundle',
      invariant_qube_public_ref: publicRef,
      member_count: manifest.members.length,
      aggregate_confidence: manifest.aggregateConfidence,
      aggregate_standing: manifest.aggregateStanding,
      contexts: manifest.contexts,
      visibility: 'public_meta_private_payload',
    },
  });

  // 3. Canonical id-map row — DataQube (Stage 1; VentureQube precedent).
  const { data: mapRow, error: mapErr } = await client
    .from('iqube_id_map')
    .insert({
      source: 'triad_meta',
      source_id: metaQubeId,
      primitive_type: 'DataQube',
      notes: `InvariantQube ${publicRef}`,
    })
    .select('iqube_id')
    .single();
  if (mapErr || !mapRow?.iqube_id) throw new Error(`iqube_id_map insert failed: ${mapErr?.message}`);
  const iqubeId = String(mapRow.iqube_id);

  // 4. Per-persona ownership (persona_id is T0).
  await client
    .from('persona_token_qube_ownership')
    .insert({
      persona_id: input.actor.personaId,
      token_qube_id: `invariant_qube:${publicRef}`,
      iqube_id: iqubeId,
      chain_anchor: { kind: 'invariant_bundle', invariant_qube_public_ref: publicRef },
      source: 'mint',
    })
    .select('ownership_id')
    .maybeSingle();

  // 5. Publication receipt (DVN-anchorable — constitutional memory).
  const receipt = await createActivityReceipt({
    personaId: input.actor.personaId,
    sessionId: input.actor.sessionId,
    actionType: 'invariant_qube_published',
    summary: `InvariantQube published: "${title}" (${manifest.members.length} invariants, standing ${manifest.aggregateStanding})`,
    activeCartridge: 'agentiq',
    iqubesUsed: [iqubeId],
  }).catch((err) => {
    console.error('[invariants] publish receipt failed', err);
    return null;
  });

  // 6. Finalize the InvariantQube row: link registry id, public ref, publish.
  const { data: finalRow, error: finalErr } = await client
    .from('invariant_qubes')
    .update({
      iqube_id: iqubeId,
      public_ref: publicRef,
      status: 'published',
      creator_alias_commitment: publicRef,
      dvn_receipt_id: receipt?.id ?? null,
    })
    .eq('id', rowId)
    .select()
    .single();
  if (finalErr || !finalRow) throw new Error(`invariant_qube finalize failed: ${finalErr?.message}`);

  return {
    invariantQube: mapInvariantQubeRow(finalRow as Record<string, unknown>),
    iqubeId,
    coherence,
  };
}

export async function getInvariantQube(id: string): Promise<InvariantQubeRecord | null> {
  const client = getSupabaseServer();
  if (!client) throw new Error('getInvariantQube: Supabase server client unavailable');
  const { data, error } = await client
    .from('invariant_qubes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`invariant_qube read failed: ${error.message}`);
  return data ? mapInvariantQubeRow(data as Record<string, unknown>) : null;
}

export async function listInvariantQubes(): Promise<InvariantQubeRecord[]> {
  const client = getSupabaseServer();
  if (!client) throw new Error('listInvariantQubes: Supabase server client unavailable');
  const { data, error } = await client
    .from('invariant_qubes')
    .select('*')
    .eq('status', 'published')
    .order('aggregate_standing', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(`invariant_qube list failed: ${error.message}`);
  return (data ?? []).map((r) => mapInvariantQubeRow(r as Record<string, unknown>));
}
