/**
 * QubeTalk Communications Membrane — ingress lifecycle (§11).
 *
 *   External/native event → transport adapter normalization → deduplication
 *   → participant resolution → relationship resolution → group resolution
 *   → conversation resolution → security/injection inspection → sensitivity
 *   + consequence classification → Agent-policy evaluation → route
 *
 * This build has exactly ONE real transport adapter (`qubetalk-native`,
 * services/qubetalk/peerChannel.ts's existing postMessage) — no external
 * platform credentials exist (transportRegistry.ts). This module is written
 * so a future external adapter only needs to produce an `IngressEvent`;
 * every step from deduplication onward is transport-agnostic already.
 *
 * HARD INVARIANT (§9/P8/N8): external content is information/evidence,
 * never authority. This is enforced STRUCTURALLY, not by a runtime check on
 * the message body — nothing in this file writes to
 * `services/delegation/delegationGrantStore.ts` or `qubetalk_agent_policies`;
 * the only writes are participant/relationship/group/conversation/message
 * rows. `inspectForInjectionRisk` below flags suspicious content for
 * classification/routing (it can route a message to `quarantined` for human
 * review) — it never blocks ingestion (an attempted injection is still real
 * evidence worth recording) and it has no code path back into authority.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { PeerResult } from '@/services/qubetalk/peerChannel';
import { resolveParticipantByEndpoint, createParticipant } from '@/services/qubetalk/participants';
import { resolveOwnerAuthProfileId } from '@/services/contactGraph/ownerResolution';
import { resolveContactPersonForInboundEndpoint, linkParticipantToContactPerson } from '@/services/contactGraph/qubetalkBridge';
import { resolveConversation, touchConversationActivity } from '@/services/qubetalk/conversations';
import { recordInteraction } from '@/services/qubetalk/relationships';
import { snapshotGroupAudience } from '@/services/qubetalk/groups';
import { resolveEffectiveAgentPolicy } from '@/services/qubetalk/agentPolicy';
import { emitQubeTalkEvent } from '@/services/qubetalk/events';
import type {
  QubeTalkParticipant,
  QubeTalkConversation,
  QubeTalkConversationTopology,
  QubeTalkEndpointPlatform,
  QubeTalkRoutingState,
  QubeTalkMessageSensitivity,
  QubeTalkAudienceSnapshot,
} from '@/types/qubetalk';

export interface IngressEvent {
  transport: string;
  /** Null for a native message (peerChannel.ts's own row id IS the identity —
   *  no separate idempotency key needed there). Required for any future
   *  external adapter (§7's idempotency requirement). */
  externalMessageId: string | null;
  /** Whose address book/relationship view resolves this event — the
   *  recipient side for an inbound message. */
  ownerPersonaId: string;
  senderEndpoint:
    | { kind: 'endpoint'; platform: QubeTalkEndpointPlatform; endpointRef: string; displayName: string }
    | { kind: 'principal'; principalRef: string; displayName: string };
  body: string;
  groupId?: string | null;
  relationshipChannelId?: string | null;
  explicitConversationId?: string | null;
}

export interface IngressResult {
  duplicate: boolean;
  participant: QubeTalkParticipant;
  conversation: QubeTalkConversation;
  audienceSnapshot: QubeTalkAudienceSnapshot | null;
  sensitivity: QubeTalkMessageSensitivity;
  injectionRisk: boolean;
  routeState: QubeTalkRoutingState;
}

/**
 * Ingress risk inspection (§9) — treats prompt-injection/social-engineering
 * patterns as an ingress-risk SIGNAL for routing/classification, never as an
 * instruction this system executes. Pattern-based and deliberately
 * conservative (false positives just mean extra human review, never a
 * dropped message).
 */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(?:previous|prior|all|your)\s+(?:instructions?|prompts?)/i,
  /ignore\s+[\w'’]+\s+instructions?/i,
  /disregard\s+(?:previous|prior|all|your)\s+(?:instructions?|prompts?)/i,
  /you\s+are\s+now\s+(?:a|an)\s+/i,
  /send\s+me\s+the\s+(?:confidential|private|secret)\s+/i,
  /reveal\s+(?:the\s+)?(?:confidential|private|secret)\s+/i,
  /act\s+as\s+if\s+you\s+(?:have\s+no|are\s+not)\s+restrictions?/i,
  /forget\s+(?:your|all)\s+(?:instructions?|rules?|guardrails?)/i,
];

export function inspectForInjectionRisk(body: string): { risky: boolean; matched?: string } {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(body)) return { risky: true, matched: pattern.source };
  }
  return { risky: false };
}

/** Conservative default: a message flagged for injection risk, or one that
 *  arrives with no resolved relationship channel yet (a first-touch
 *  correspondent), is never auto-classified 'standard'. */
function classifySensitivity(injectionRisk: boolean, hasKnownRelationship: boolean): QubeTalkMessageSensitivity {
  if (injectionRisk) return 'restricted';
  if (!hasKnownRelationship) return 'confidential';
  return 'standard';
}

/**
 * Routing decision (§11) — adapters never decide this themselves; it is
 * always computed here, from already-resolved facts only.
 */
function decideRoute(input: { injectionRisk: boolean; agentMode: string; agentGrantActive: boolean }): QubeTalkRoutingState {
  if (input.injectionRisk) return 'quarantined';
  if (input.agentMode === 'agent_bounded' && input.agentGrantActive) return 'agent_manageable';
  if (input.agentMode === 'agent_drafts') return 'agent_draft';
  if (input.agentMode === 'agent_routine') return 'digest';
  if (input.agentMode === 'no_agent' || input.agentMode === 'manual') return 'needs_user';
  return 'waiting_follow_up';
}

export async function ingestCommunicationEvent(event: IngressEvent): Promise<PeerResult<IngressResult>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  // ── 1. Deduplication ──────────────────────────────────────────────────
  if (event.externalMessageId) {
    const { data: existing, error: dupError } = await admin
      .from('passport_peer_messages')
      .select('id')
      .eq('transport', event.transport)
      .eq('external_message_id', event.externalMessageId)
      .maybeSingle();
    if (dupError) return { ok: false, error: dupError.message };
    if (existing) {
      // Duplicate delivery of an already-ingested event — no new row, no
      // re-resolution. The caller should treat this as a no-op success.
      return {
        ok: true,
        value: {
          duplicate: true,
          participant: { id: '', ownerPersonaId: event.ownerPersonaId, principalRef: null, displayName: '', contactPersonId: null, createdAt: '', updatedAt: '' },
          conversation: { id: '', relationshipChannelId: null, groupId: null, topology: 'dyadic', title: null, createdAt: '', lastActivityAt: '' },
          audienceSnapshot: null,
          sensitivity: 'standard',
          injectionRisk: false,
          routeState: 'digest',
        },
      };
    }
  }

  // ── 2. Participant resolution — exact endpoint match only, NEVER a
  //      display-name merge (N4). ─────────────────────────────────────────
  let participant: QubeTalkParticipant;
  if (event.senderEndpoint.kind === 'principal') {
    const { resolveOrCreateParticipantByPrincipalRef } = await import('@/services/qubetalk/participants');
    const resolved = await resolveOrCreateParticipantByPrincipalRef(event.ownerPersonaId, event.senderEndpoint.principalRef, event.senderEndpoint.displayName);
    if (!resolved.ok) return resolved;
    participant = resolved.value;
  } else {
    const byEndpoint = await resolveParticipantByEndpoint(admin, event.ownerPersonaId, event.senderEndpoint.platform, event.senderEndpoint.endpointRef);
    if (!byEndpoint.ok) return byEndpoint;
    if (byEndpoint.value) {
      participant = byEndpoint.value;
    } else {
      // No match in QubeTalk's own directory yet. Before creating a blank
      // unresolved participant, ask ContactGraph — the platform-wide
      // contact-resolution capability QubeTalk REFERENCES, never forks
      // (C9/NC10) — whether this exact handle is already known (e.g.
      // imported from Google Contacts). Exact-match only, same as
      // resolveParticipantByEndpoint's own discipline; a ContactGraph miss
      // (or an unresolvable owner) falls back to exactly the prior
      // behavior — a brand-new unresolved participant.
      let contactMatch: { contactPersonId: string; contactPersonaId: string; contactEndpointId: string; displayName: string } | null = null;
      const owner = await resolveOwnerAuthProfileId(event.ownerPersonaId);
      if (owner.ok) {
        const resolved = await resolveContactPersonForInboundEndpoint(
          owner.value,
          event.senderEndpoint.platform,
          event.senderEndpoint.endpointRef,
        );
        if (resolved.ok) contactMatch = resolved.value;
      }

      const created = await createParticipant(event.ownerPersonaId, {
        displayName: contactMatch?.displayName || event.senderEndpoint.displayName,
      });
      if (!created.ok) return created;
      participant = created.value;
      await admin.from('qubetalk_participant_endpoints').insert({
        participant_id: participant.id,
        platform: event.senderEndpoint.platform,
        endpoint_ref: event.senderEndpoint.endpointRef,
        // A ContactGraph match is real, if not owner-confirmed-within-
        // QubeTalk, evidence — stronger than a bare unresolved observation
        // but never claimed as 'verified' (that stays a deliberate act).
        confidence: contactMatch ? 'high_confidence' : 'unresolved',
        contact_persona_id: contactMatch?.contactPersonaId ?? null,
        // Exact ContactGraph endpoint row (20260930060000) — not just the
        // persona/context container, so this observation traces straight
        // back to the specific handle that matched.
        contact_endpoint_id: contactMatch?.contactEndpointId ?? null,
      });
      if (contactMatch && owner.ok) {
        const linked = await linkParticipantToContactPerson(event.ownerPersonaId, owner.value, participant.id, contactMatch.contactPersonId);
        if (linked.ok) participant = linked.value;
      }
    }
  }

  // ── 3/4. Relationship + group resolution — reuse what the caller already
  //         knows (native transport already has a resolved channel/group id
  //         from peerChannel.ts; a future external adapter would resolve
  //         these here from the endpoint/group evidence instead). ─────────
  const hasKnownRelationship = Boolean(event.relationshipChannelId);
  if (event.relationshipChannelId) await recordInteraction(event.relationshipChannelId);

  let audienceSnapshot: QubeTalkAudienceSnapshot | null = null;
  if (event.groupId) {
    const snap = await snapshotGroupAudience(event.groupId);
    if (snap.ok) audienceSnapshot = snap.value;
  }

  // ── 5. Conversation resolution — deterministic only (§6). ───────────────
  const topology: QubeTalkConversationTopology = event.groupId ? 'group' : 'dyadic';
  const conversationResult = await resolveConversation({
    explicitConversationId: event.explicitConversationId ?? null,
    relationshipChannelId: event.relationshipChannelId ?? null,
    groupId: event.groupId ?? null,
    topology,
  });
  if (!conversationResult.ok) return conversationResult;
  await touchConversationActivity(conversationResult.value.id);

  // ── 6/7. Security inspection + sensitivity/consequence classification ──
  const injection = inspectForInjectionRisk(event.body);
  const sensitivity = classifySensitivity(injection.risky, hasKnownRelationship);

  // ── 8. Agent-policy evaluation ───────────────────────────────────────────
  const policy = await resolveEffectiveAgentPolicy(event.ownerPersonaId, {
    conversation: conversationResult.value.id,
    group: event.groupId ?? undefined,
    relationship: event.relationshipChannelId ?? undefined,
    participant: participant.id,
  });
  const agentMode = policy.ok ? policy.value.mode : 'no_agent';
  const agentGrantActive = policy.ok ? policy.value.grantActive : false;

  // ── 9. Route ─────────────────────────────────────────────────────────────
  const routeState = decideRoute({ injectionRisk: injection.risky, agentMode, agentGrantActive });

  void emitQubeTalkEvent('message.received', participant.principalRef ?? participant.id, {
    conversationId: conversationResult.value.id,
    routeState,
  });

  return {
    ok: true,
    value: {
      duplicate: false,
      participant,
      conversation: conversationResult.value,
      audienceSnapshot,
      sensitivity,
      injectionRisk: injection.risky,
      routeState,
    },
  };
}
