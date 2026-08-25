/**
 * QubeTalk Communications Membrane — PublicationQube (§4.6/§14).
 *
 * One canonical publishing act; per-channel projections live in
 * qubetalk_publication_projections. Never models external channels as
 * unrelated source documents (§4.6's publication invariant) — every projection references the SAME
 * publication_id. Channel projection actually reaching 'published' only
 * happens for a transport the capability registry marks supported/restricted
 * (transportRegistry.ts) — this build has exactly one such transport
 * ('qubetalk-native'), so external projections are created in 'pending' and
 * stay there honestly rather than being faked as published (N11).
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { transportHasCapability } from '@/services/qubetalk/transportRegistry';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { emitQubeTalkEvent } from '@/services/qubetalk/events';
import type { QubeTalkPublication, QubeTalkPublicationProjection, QubeTalkPublicationStatus, QubeTalkProjectionStatus } from '@/types/qubetalk';
import type { PeerResult } from '@/services/qubetalk/peerChannel';

const PUBLICATIONS = 'qubetalk_publications';
const PROJECTIONS = 'qubetalk_publication_projections';

function rowToPublication(row: Record<string, unknown>): QubeTalkPublication {
  return {
    id: String(row.id),
    authorRef: String(row.author_ref),
    personaLabel: (row.persona_label as string | null) ?? null,
    agentRef: (row.agent_ref as string | null) ?? null,
    sourceContentRef: (row.source_content_ref as string | null) ?? null,
    title: String(row.title),
    status: row.status as QubeTalkPublicationStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToProjection(row: Record<string, unknown>): QubeTalkPublicationProjection {
  return {
    id: String(row.id),
    publicationId: String(row.publication_id),
    channel: String(row.channel),
    externalPublicationId: (row.external_publication_id as string | null) ?? null,
    projectionStatus: row.projection_status as QubeTalkProjectionStatus,
    url: (row.url as string | null) ?? null,
    publishedAt: (row.published_at as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

export async function createPublication(
  authorRef: string,
  input: { title: string; sourceContentRef?: string | null; personaLabel?: string | null; agentRef?: string | null },
): Promise<PeerResult<QubeTalkPublication>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin
    .from(PUBLICATIONS)
    .insert({
      author_ref: authorRef,
      title: input.title,
      source_content_ref: input.sourceContentRef ?? null,
      persona_label: input.personaLabel ?? null,
      agent_ref: input.agentRef ?? null,
    })
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToPublication(data as Record<string, unknown>) };
}

/**
 * `actingPersonaId` (T0) is required so the consequential receipt below can
 * actually be written — `publication.authorRef` is a one-way T2 reference by
 * design and cannot be reversed back into a personaId (that's the point of
 * it), so the caller (who already resolved the acting persona via the
 * spine) must supply it explicitly.
 */
export async function setPublicationStatus(
  publicationId: string,
  status: QubeTalkPublicationStatus,
  actingPersonaId: string,
): Promise<PeerResult<QubeTalkPublication>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin
    .from(PUBLICATIONS)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', publicationId)
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  const publication = rowToPublication(data as Record<string, unknown>);

  if (status === 'published' || status === 'withdrawn') {
    await createActivityReceipt({
      personaId: actingPersonaId,
      activeCartridge: 'qubetalk',
      actionType: status === 'published' ? 'qubetalk_publication_published' : 'qubetalk_publication_withdrawn',
      summary: `Publication ${publicationId.slice(0, 8)} ${status}`,
      contextShared: [`publication:${publicationId}`],
    }).catch((err) => console.warn('[QubeTalk] publication receipt write failed (non-fatal):', err instanceof Error ? err.message : err));
    void emitQubeTalkEvent(status === 'published' ? 'publication.published' : 'publication.reshared', publication.authorRef, { publicationId });
  }
  return { ok: true, value: publication };
}

/**
 * Register (or update) a per-channel projection. `channel` support is
 * checked against the registry — an unsupported channel is created as
 * 'pending' and never silently promoted to 'published' (N11); only the
 * native transport actually completes this today.
 */
export async function addChannelProjection(
  publicationId: string,
  channel: string,
  input: { externalPublicationId?: string | null; url?: string | null } = {},
): Promise<PeerResult<QubeTalkPublicationProjection>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const supportState = transportHasCapability(channel, 'post.publish');
  const projectionStatus: QubeTalkProjectionStatus = supportState === 'supported' ? 'publishing' : 'pending';

  const { data, error } = await admin
    .from(PROJECTIONS)
    .upsert(
      {
        publication_id: publicationId,
        channel,
        external_publication_id: input.externalPublicationId ?? null,
        url: input.url ?? null,
        projection_status: projectionStatus,
      },
      { onConflict: 'publication_id,channel' },
    )
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToProjection(data as Record<string, unknown>) };
}

export async function listProjections(publicationId: string): Promise<PeerResult<QubeTalkPublicationProjection[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin.from(PROJECTIONS).select('*').eq('publication_id', publicationId).order('created_at', { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: (data ?? []).map((r) => rowToProjection(r as Record<string, unknown>)) };
}

export async function getPublication(publicationId: string): Promise<PeerResult<QubeTalkPublication>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin.from(PUBLICATIONS).select('*').eq('id', publicationId).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'publication not found', code: 'not_found' };
  return { ok: true, value: rowToPublication(data as Record<string, unknown>) };
}
