/**
 * QubeTalk Communications Membrane — EngagementQube (§14).
 *
 * Comments/replies/mentions/quotes/reactions on a PublicationQube projection.
 * Feeds back through participant resolution into RelationshipQube (P13) —
 * `recordEngagement` resolves the author the SAME way ingestion.ts resolves
 * an inbound message's sender (exact endpoint match only, never a
 * display-name merge, N4), and `convertToConversation` is how "publishing
 * becomes conversation" (§14's own example) actually happens: it creates a
 * DYADIC/PUBLIC_THREAD conversation and links the engagement to it, without
 * ever copying the engagement into a second row (P2).
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveParticipantByEndpoint, createParticipant } from '@/services/qubetalk/participants';
import { createConversation } from '@/services/qubetalk/conversations';
import { emitQubeTalkEvent } from '@/services/qubetalk/events';
import type {
  QubeTalkEngagement,
  QubeTalkEngagementType,
  QubeTalkEngagementState,
  QubeTalkConversationTopology,
  QubeTalkEndpointPlatform,
} from '@/types/qubetalk';
import type { PeerResult } from '@/services/qubetalk/peerChannel';

const ENGAGEMENTS = 'qubetalk_engagements';

function rowToEngagement(row: Record<string, unknown>): QubeTalkEngagement {
  return {
    id: String(row.id),
    publicationProjectionId: String(row.publication_projection_id),
    engagementType: row.engagement_type as QubeTalkEngagementType,
    externalEngagementId: (row.external_engagement_id as string | null) ?? null,
    authorParticipantId: (row.author_participant_id as string | null) ?? null,
    authorRawHandle: (row.author_raw_handle as string | null) ?? null,
    body: (row.body as string | null) ?? null,
    state: row.state as QubeTalkEngagementState,
    convertedConversationId: (row.converted_conversation_id as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

/**
 * Record an inbound engagement, resolving its author where evidence is
 * sufficient (an exact endpoint match against the publication owner's own
 * directory) — otherwise the engagement is recorded with `authorRawHandle`
 * only and no participant link, never a guess (N4).
 */
export async function recordEngagement(
  publicationOwnerPersonaId: string,
  publicationProjectionId: string,
  input: {
    engagementType: QubeTalkEngagementType;
    externalEngagementId?: string | null;
    authorPlatform: QubeTalkEndpointPlatform;
    authorHandle: string;
    authorDisplayName: string;
    body?: string | null;
  },
): Promise<PeerResult<QubeTalkEngagement>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const resolved = await resolveParticipantByEndpoint(admin, publicationOwnerPersonaId, input.authorPlatform, input.authorHandle);
  if (!resolved.ok) return resolved;
  let participantId: string | null = resolved.value?.id ?? null;
  if (!participantId) {
    // Sufficient evidence to at least start tracking this correspondent —
    // but still unresolved until an operator confirms the endpoint (§3).
    const created = await createParticipant(publicationOwnerPersonaId, { displayName: input.authorDisplayName });
    if (created.ok) {
      participantId = created.value.id;
      await admin.from('qubetalk_participant_endpoints').insert({
        participant_id: participantId,
        platform: input.authorPlatform,
        endpoint_ref: input.authorHandle,
        confidence: 'unresolved',
      });
    }
  }

  const { data, error } = await admin
    .from(ENGAGEMENTS)
    .insert({
      publication_projection_id: publicationProjectionId,
      engagement_type: input.engagementType,
      external_engagement_id: input.externalEngagementId ?? null,
      author_participant_id: participantId,
      author_raw_handle: input.authorHandle,
      body: input.body ?? null,
    })
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  const engagement = rowToEngagement(data as Record<string, unknown>);
  void emitQubeTalkEvent('publication.engaged', resolved.value?.principalRef ?? input.authorHandle, { publicationProjectionId, engagementType: input.engagementType });
  return { ok: true, value: engagement };
}

export async function setEngagementState(engagementId: string, state: QubeTalkEngagementState): Promise<PeerResult<QubeTalkEngagement>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin.from(ENGAGEMENTS).update({ state }).eq('id', engagementId).select('*').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToEngagement(data as Record<string, unknown>) };
}

/**
 * "This is how publishing becomes conversation" (§14) — creates a new
 * conversation and links this ONE engagement row to it (state transitions to
 * 'converted_to_conversation'). Never duplicates the engagement into a
 * message row; a reply INTO that conversation is a separate, ordinary
 * MessageQube send, using the returned conversationId.
 */
export async function convertEngagementToConversation(
  engagementId: string,
  topology: QubeTalkConversationTopology = 'public_thread',
): Promise<PeerResult<{ engagement: QubeTalkEngagement; conversationId: string }>> {
  const conversation = await createConversation({ topology });
  if (!conversation.ok) return conversation;

  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin
    .from(ENGAGEMENTS)
    .update({ state: 'converted_to_conversation', converted_conversation_id: conversation.value.id })
    .eq('id', engagementId)
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: { engagement: rowToEngagement(data as Record<string, unknown>), conversationId: conversation.value.id } };
}

export async function listEngagementsForProjection(publicationProjectionId: string): Promise<PeerResult<QubeTalkEngagement[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin.from(ENGAGEMENTS).select('*').eq('publication_projection_id', publicationProjectionId).order('created_at', { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: (data ?? []).map((r) => rowToEngagement(r as Record<string, unknown>)) };
}
