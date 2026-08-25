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
import { agentMaySend } from '@/services/qubetalk/agentPolicy';
import { postDiscordMessages, resolveDiscordChannelReference } from '@/services/qubetalk/transports/discordTransport';
import { personaPublicRef } from '@/services/identity/personaReferences';
import type { QubeTalkPublication, QubeTalkPublicationProjection, QubeTalkPublicationStatus, QubeTalkProjectionStatus } from '@/types/qubetalk';
import type { PeerResult } from '@/services/qubetalk/peerChannel';

const PUBLICATIONS = 'qubetalk_publications';
const PROJECTIONS = 'qubetalk_publication_projections';

/** Ownership-checked read — every mutating route calls this first so a
 *  caller can only see/act on their OWN publications (author_ref must match
 *  their own Polity Public Reference). */
export async function getOwnedPublication(callerPersonaId: string, publicationId: string): Promise<PeerResult<QubeTalkPublication>> {
  const result = await getPublication(publicationId);
  if (!result.ok) return result;
  if (result.value.authorRef !== personaPublicRef(callerPersonaId)) {
    return { ok: false, error: 'publication not found', code: 'not_found' };
  }
  return result;
}

function rowToPublication(row: Record<string, unknown>): QubeTalkPublication {
  return {
    id: String(row.id),
    authorRef: String(row.author_ref),
    personaLabel: (row.persona_label as string | null) ?? null,
    agentRef: (row.agent_ref as string | null) ?? null,
    sourceContentRef: (row.source_content_ref as string | null) ?? null,
    title: String(row.title),
    body: (row.body as string | null) ?? null,
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
    destinationRef: (row.destination_ref as string | null) ?? null,
    externalPublicationId: (row.external_publication_id as string | null) ?? null,
    projectionStatus: row.projection_status as QubeTalkProjectionStatus,
    url: (row.url as string | null) ?? null,
    publishedAt: (row.published_at as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

export async function createPublication(
  authorRef: string,
  input: { title: string; body?: string | null; sourceContentRef?: string | null; personaLabel?: string | null; agentRef?: string | null },
): Promise<PeerResult<QubeTalkPublication>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin
    .from(PUBLICATIONS)
    .insert({
      author_ref: authorRef,
      title: input.title,
      body: input.body ?? null,
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
  input: { destinationRef?: string | null; externalPublicationId?: string | null; url?: string | null } = {},
): Promise<PeerResult<QubeTalkPublicationProjection>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  // 'pending' regardless of capability state — creating a projection never
  // implies it has been sent; only publishAllProjections/publishProjection
  // (below) actually dispatches to a transport and can move it to
  // 'published'/'failed'. A capability check here would only tell us
  // whether an eventual publish attempt COULD succeed, which is not this
  // function's job to decide (N11: never silently promote).
  const { data, error } = await admin
    .from(PROJECTIONS)
    .upsert(
      {
        publication_id: publicationId,
        channel,
        destination_ref: input.destinationRef ?? null,
        external_publication_id: input.externalPublicationId ?? null,
        url: input.url ?? null,
        projection_status: 'pending' satisfies QubeTalkProjectionStatus,
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

export interface PublishOneResult {
  projectionId: string;
  channel: string;
  outcome: 'published' | 'failed';
  externalPublicationId: string | null;
  url: string | null;
  error?: string;
}

/**
 * Execute ONE pending projection — the piece the schema declared
 * (20260930040000) but nothing ever ran: resolve capability, dispatch to
 * the transport, and honestly record the outcome. Never silently promotes a
 * projection to 'published' without actually calling the transport (N11) —
 * an unsupported channel is a clean 'failed' outcome with a named reason,
 * exactly like an unresolvable destination or a transport-level error.
 *
 * `actingAgentRootDid` mirrors egress.ts's Agent-authority gate exactly
 * (§10/P9/P10): an Agent may only publish under an active BOUNDED grant
 * scoped to this channel — resolved and enforced BEFORE the transport is
 * ever touched, never after.
 */
export async function publishProjection(
  callerPersonaId: string,
  projectionId: string,
  actingAgentRootDid?: string | null,
): Promise<PeerResult<PublishOneResult>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const { data: projectionRow, error: projectionError } = await admin.from(PROJECTIONS).select('*').eq('id', projectionId).maybeSingle();
  if (projectionError) return { ok: false, error: projectionError.message };
  if (!projectionRow) return { ok: false, error: 'projection not found', code: 'not_found' };
  const projection = rowToProjection(projectionRow as Record<string, unknown>);

  const publicationResult = await getPublication(projection.publicationId);
  if (!publicationResult.ok) return publicationResult;
  const publication = publicationResult.value;

  if (actingAgentRootDid) {
    const allowed = await agentMaySend(callerPersonaId, { transport: projection.channel }, actingAgentRootDid);
    if (!allowed.ok) return allowed;
    if (!allowed.value) {
      return { ok: false, error: 'Agent is not authorized to publish on this channel (no active BOUNDED grant)', code: 'agent_not_authorized' };
    }
  }

  const supportState = transportHasCapability(projection.channel, 'post.publish');
  let outcome: 'published' | 'failed' = 'failed';
  let externalPublicationId: string | null = null;
  let url: string | null = null;
  let failureReason: string | undefined;

  if (supportState === 'unsupported') {
    failureReason = `transport '${projection.channel}' does not support publishing (N11)`;
  } else if (projection.channel === 'discord') {
    if (!projection.destinationRef) {
      failureReason = 'no destination_ref set for this Discord projection';
    } else {
      const channelId = await resolveDiscordChannelReference(projection.destinationRef);
      if (!channelId) {
        failureReason = `could not resolve destination_ref '${projection.destinationRef}' to a real Discord channel`;
      } else {
        const botToken = (process.env.DISCORD_BOT_TOKEN || '').trim();
        if (!botToken) {
          failureReason = 'Missing DISCORD_BOT_TOKEN. Configure it to enable live Discord publishing.';
        } else {
          try {
            const posted = await postDiscordMessages({
              channelId,
              botToken,
              content: publication.body || publication.title,
              embed: {
                title: publication.title,
                description: publication.body || undefined,
              },
            });
            if (posted.messageIds.length > 0) {
              outcome = 'published';
              externalPublicationId = posted.messageIds[0];
              // No url: constructing a discord.com/channels/{guild}/{channel}/{message}
              // link needs the guild id, which this projection never has —
              // never fabricate a link that might be wrong (honesty over
              // completeness).
            } else {
              failureReason = 'Discord accepted no message content (empty after trim)';
            }
          } catch (err) {
            failureReason = err instanceof Error ? err.message : 'Discord publish failed';
          }
        }
      }
    }
  } else {
    failureReason = `transport '${projection.channel}' is not wired for publishing yet`;
  }

  const { data: updated, error: updateError } = await admin
    .from(PROJECTIONS)
    .update({
      projection_status: outcome satisfies QubeTalkProjectionStatus,
      external_publication_id: externalPublicationId,
      url,
      published_at: outcome === 'published' ? new Date().toISOString() : null,
    })
    .eq('id', projectionId)
    .select('*')
    .single();
  if (updateError) return { ok: false, error: updateError.message };
  const finalProjection = rowToProjection(updated as Record<string, unknown>);

  await createActivityReceipt({
    personaId: callerPersonaId,
    activeCartridge: 'qubetalk',
    actionType: outcome === 'published' ? 'qubetalk_publication_projection_published' : 'qubetalk_publication_projection_failed',
    summary: `Publication ${publication.id.slice(0, 8)} projection to ${projection.channel} ${outcome}`,
    contextShared: [`publication:${publication.id}`, `channel:${projection.channel}`],
  }).catch((err) => console.warn('[QubeTalk] projection receipt write failed (non-fatal):', err instanceof Error ? err.message : err));

  return {
    ok: true,
    value: {
      projectionId: finalProjection.id,
      channel: finalProjection.channel,
      outcome,
      externalPublicationId: finalProjection.externalPublicationId,
      url: finalProjection.url,
      error: failureReason,
    },
  };
}

/**
 * Execute every 'pending' projection for a publication, then aggregate the
 * publication's own status per §6's partial-success rule: all succeeded ->
 * 'published' (via setPublicationStatus, which also fires the publication-
 * level receipt/event); all failed -> 'failed'; a mix -> 'partially_published'
 * (a status transition setPublicationStatus itself never fires a receipt
 * for — only 'published'/'withdrawn' are receipt-worthy at the aggregate
 * level; each projection's own success/failure already got its own receipt
 * above).
 */
export async function publishAllProjections(
  callerPersonaId: string,
  publicationId: string,
  actingAgentRootDid?: string | null,
): Promise<PeerResult<{ results: PublishOneResult[]; publication: QubeTalkPublication }>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const { data: pendingRows, error: pendingError } = await admin
    .from(PROJECTIONS)
    .select('id')
    .eq('publication_id', publicationId)
    .eq('projection_status', 'pending');
  if (pendingError) return { ok: false, error: pendingError.message };

  const results: PublishOneResult[] = [];
  for (const row of pendingRows ?? []) {
    const result = await publishProjection(callerPersonaId, String((row as { id: string }).id), actingAgentRootDid);
    if (!result.ok) return result;
    results.push(result.value);
  }

  const allProjections = await listProjections(publicationId);
  if (!allProjections.ok) return allProjections;
  const outcomes = allProjections.value.map((p) => p.projectionStatus);
  const anyPublished = outcomes.some((s) => s === 'published');
  const anyFailed = outcomes.some((s) => s === 'failed');
  const aggregateStatus: QubeTalkPublicationStatus = anyPublished && anyFailed
    ? 'partially_published'
    : anyPublished
      ? 'published'
      : 'failed';

  const updated = await setPublicationStatus(publicationId, aggregateStatus, callerPersonaId);
  if (!updated.ok) return updated;

  return { ok: true, value: { results, publication: updated.value } };
}
