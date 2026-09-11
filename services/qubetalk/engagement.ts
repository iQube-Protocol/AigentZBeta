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
import { linkParticipantToContactPerson, resolveContactPersonForInboundEndpoint } from '@/services/contactGraph/qubetalkBridge';
import { resolveOwnerAuthProfileId } from '@/services/contactGraph/ownerResolution';
import { createConversation } from '@/services/qubetalk/conversations';
import { emitQubeTalkEvent } from '@/services/qubetalk/events';
import { getOwnedPublication } from '@/services/qubetalk/publications';
import { personaPublicRef } from '@/services/identity/personaReferences';
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
 * sufficient — first against the publication owner's OWN QubeTalk directory
 * (exact endpoint match), then against ContactGraph (the platform-wide
 * contact-resolution capability QubeTalk references, never forks — the SAME
 * two-step fallback services/qubetalk/ingestion.ts already uses for an
 * inbound message's sender). If neither resolves, the engagement is
 * recorded with `authorRawHandle` only and no participant link — never a
 * guess (N4). Idempotent: a duplicate webhook/poll delivery of the SAME
 * `externalEngagementId` for this projection upserts onto the existing row
 * rather than creating a second one (partial unique index,
 * 20260930070000).
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
  let principalRef: string | null = resolved.value?.principalRef ?? null;

  if (!participantId) {
    // Not in QubeTalk's own directory yet — ask ContactGraph before
    // creating a blank unresolved participant, mirroring ingestion.ts's
    // inbound-message resolution exactly (never a second, divergent bridge
    // implementation).
    let contactMatch: { contactPersonId: string; contactPersonaId: string; contactEndpointId: string; displayName: string } | null = null;
    const owner = await resolveOwnerAuthProfileId(publicationOwnerPersonaId);
    if (owner.ok) {
      const contactResolved = await resolveContactPersonForInboundEndpoint(owner.value, input.authorPlatform, input.authorHandle);
      if (contactResolved.ok) contactMatch = contactResolved.value;
    }

    const created = await createParticipant(publicationOwnerPersonaId, { displayName: contactMatch?.displayName || input.authorDisplayName });
    if (created.ok) {
      participantId = created.value.id;
      await admin.from('qubetalk_participant_endpoints').insert({
        participant_id: participantId,
        platform: input.authorPlatform,
        endpoint_ref: input.authorHandle,
        // A ContactGraph match is real, if not owner-confirmed-within-
        // QubeTalk, evidence — stronger than a bare unresolved observation
        // but never claimed as 'verified' (that stays a deliberate act).
        confidence: contactMatch ? 'high_confidence' : 'unresolved',
        contact_persona_id: contactMatch?.contactPersonaId ?? null,
        contact_endpoint_id: contactMatch?.contactEndpointId ?? null,
      });
      if (contactMatch && owner.ok) {
        const linked = await linkParticipantToContactPerson(publicationOwnerPersonaId, owner.value, participantId, contactMatch.contactPersonId);
        if (linked.ok) principalRef = linked.value.principalRef;
      }
    }
  }

  const row = {
    publication_projection_id: publicationProjectionId,
    engagement_type: input.engagementType,
    external_engagement_id: input.externalEngagementId ?? null,
    author_participant_id: participantId,
    author_raw_handle: input.authorHandle,
    body: input.body ?? null,
  };
  // Upsert ONLY when there's a real external id to dedupe against (the
  // idempotency index is partial — WHERE external_engagement_id IS NOT
  // NULL). A manually-recorded engagement has nothing to conflict on, so a
  // plain insert is both correct and avoids relying on Supabase's
  // no-onConflict default (which targets the primary key, never a match on
  // arbitrary columns).
  const { data, error } = input.externalEngagementId
    ? await admin.from(ENGAGEMENTS).upsert(row, { onConflict: 'publication_projection_id,external_engagement_id' }).select('*').single()
    : await admin.from(ENGAGEMENTS).insert(row).select('*').single();
  if (error) return { ok: false, error: error.message };
  const engagement = rowToEngagement(data as Record<string, unknown>);
  void emitQubeTalkEvent('publication.engaged', principalRef ?? input.authorHandle, { publicationProjectionId, engagementType: input.engagementType });
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
  const conversation = await createConversation({ topology, originEngagementId: engagementId });
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

/** Every engagement across every projection of one publication — the read
 *  Runtime's Engagement tab and aigentMe's "show me responses that need me"
 *  both consume (same service function, no separate aggregation). */
export async function listEngagementsForPublication(publicationId: string): Promise<PeerResult<QubeTalkEngagement[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data: projectionRows, error: projectionError } = await admin
    .from('qubetalk_publication_projections')
    .select('id')
    .eq('publication_id', publicationId);
  if (projectionError) return { ok: false, error: projectionError.message };
  const projectionIds = (projectionRows ?? []).map((r) => String((r as { id: string }).id));
  if (projectionIds.length === 0) return { ok: true, value: [] };

  const { data, error } = await admin
    .from(ENGAGEMENTS)
    .select('*')
    .in('publication_projection_id', projectionIds)
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: (data ?? []).map((r) => rowToEngagement(r as Record<string, unknown>)) };
}

/** Every engagement across EVERY publication the caller owns — "show me
 *  responses that need me" (aigentMe's own §10 phrasing). Optionally
 *  filtered to one triage state. */
export async function listEngagementsForOwner(
  callerPersonaId: string,
  filterState?: QubeTalkEngagementState,
): Promise<PeerResult<QubeTalkEngagement[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const myRef = personaPublicRef(callerPersonaId);
  const { data: publicationRows, error: publicationError } = await admin.from('qubetalk_publications').select('id').eq('author_ref', myRef);
  if (publicationError) return { ok: false, error: publicationError.message };
  const publicationIds = (publicationRows ?? []).map((r) => String((r as { id: string }).id));
  if (publicationIds.length === 0) return { ok: true, value: [] };

  const { data: projectionRows, error: projectionError } = await admin
    .from('qubetalk_publication_projections')
    .select('id')
    .in('publication_id', publicationIds);
  if (projectionError) return { ok: false, error: projectionError.message };
  const projectionIds = (projectionRows ?? []).map((r) => String((r as { id: string }).id));
  if (projectionIds.length === 0) return { ok: true, value: [] };

  let query = admin.from(ENGAGEMENTS).select('*').in('publication_projection_id', projectionIds);
  if (filterState) query = query.eq('state', filterState);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: (data ?? []).map((r) => rowToEngagement(r as Record<string, unknown>)) };
}

/** Ownership-checked read — resolves engagement -> projection -> publication
 *  and confirms the caller authored that publication, so a caller can only
 *  read/act on engagements under their OWN publications. */
export async function getOwnedEngagement(callerPersonaId: string, engagementId: string): Promise<PeerResult<QubeTalkEngagement>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin.from(ENGAGEMENTS).select('*').eq('id', engagementId).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'engagement not found', code: 'not_found' };
  const engagement = rowToEngagement(data as Record<string, unknown>);

  const { data: projectionRow, error: projectionError } = await admin
    .from('qubetalk_publication_projections')
    .select('publication_id')
    .eq('id', engagement.publicationProjectionId)
    .maybeSingle();
  if (projectionError) return { ok: false, error: projectionError.message };
  if (!projectionRow) return { ok: false, error: 'engagement not found', code: 'not_found' };

  const owned = await getOwnedPublication(callerPersonaId, String((projectionRow as { publication_id: string }).publication_id));
  if (!owned.ok) return { ok: false, error: 'engagement not found', code: 'not_found' };

  return { ok: true, value: engagement };
}
