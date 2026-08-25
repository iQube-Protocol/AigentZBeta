/**
 * QubeTalk Communications Membrane — canonical domain types (2026-08-25).
 *
 * codexes/packs/agentiq/updates/2026-08-25_qubetalk-communications-membrane-domain-spec-v0.2.md
 *
 * These types describe the domain objects EXTENDING the existing Phase 1
 * peer-exchange primitive (services/qubetalk/peerChannel.ts,
 * passport_peer_channels / passport_peer_messages / passport_peer_shared_artifacts)
 * — never a parallel schema. `PeerChannel`/`PeerMessage`/`RightsEnvelope` are
 * still defined in `peerChannel.ts` and are NOT redeclared here; a
 * RelationshipQube (below) is a companion projection over an existing
 * `PeerChannel`, not a replacement for it.
 *
 * T0/T2 discipline (unchanged from Phase 1): every ref field here is a Polity
 * Public Reference (`personaPublicRef` — sha256/16-hex) or an internal row
 * id, never a raw persona UUID. `ownerPersonaId` fields are the ONE
 * exception — deliberately T0, matching `reciprocal_exchanges.initiator_persona_id`
 * (an owner-scoped row under service-role-only RLS, never client-read; see
 * the migration's own header comment for the reasoning).
 */

import { CAPABILITY_PROJECTION_PROFILES, type CapabilityProjectionProfile } from '@/types/capabilityProjection';

// ─── ParticipantQube (§3) ──────────────────────────────────────────────────

export const QUBETALK_ENDPOINT_PLATFORMS = [
  'metame', 'email', 'whatsapp', 'telegram', 'signal', 'linkedin', 'discord', 'x', 'sms',
] as const;
export type QubeTalkEndpointPlatform = (typeof QUBETALK_ENDPOINT_PLATFORMS)[number];

export const QUBETALK_GROUP_PLATFORMS = [
  'metame', 'whatsapp', 'discord', 'telegram', 'signal',
] as const;
export type QubeTalkGroupPlatform = (typeof QUBETALK_GROUP_PLATFORMS)[number];

/** Explicit confidence tier (§3) — never collapsed to a boolean "verified". */
export const QUBETALK_ENDPOINT_CONFIDENCE = [
  'verified', 'user_confirmed', 'high_confidence', 'tentative', 'unresolved',
] as const;
export type QubeTalkEndpointConfidence = (typeof QUBETALK_ENDPOINT_CONFIDENCE)[number];

export interface QubeTalkParticipant {
  id: string;
  /** T0 — whose address book this entry belongs to. Never leaves the server. */
  ownerPersonaId: string;
  /** Polity Public Reference once resolved to a real Passport/persona; null
   *  while unresolved. A participant is NEVER a new identity authority (P6) —
   *  this is a foreign key to personas.public_ref, nothing is minted here. */
  principalRef: string | null;
  displayName: string;
  /** ContactGraph reference (fast-follow, ContactGraph + aigentMe First
   *  Deployment) — set when this participant has been resolved against the
   *  owner's ContactGraph. QubeTalk REFERENCES this resolution; it does not
   *  maintain a competing one (C9/NC10). Null until resolved. */
  contactPersonId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QubeTalkParticipantEndpoint {
  id: string;
  participantId: string;
  platform: QubeTalkEndpointPlatform;
  endpointRef: string;
  confidence: QubeTalkEndpointConfidence;
  confirmedByPersonaId: string | null;
  confirmedAt: string | null;
  /** Which ContactGraph persona/context this specific endpoint belongs to
   *  (e.g. this WhatsApp number is the "Personal" context) — fast-follow
   *  bridge field. Null until resolved. */
  contactPersonaId: string | null;
  createdAt: string;
}

// ─── RelationshipQube (§4) ─────────────────────────────────────────────────

/** A single open loop / commitment entry inside relationship state. Always
 *  traceable to the message(s) it was derived from (P5) — never bare prose. */
export interface QubeTalkRelationshipNote {
  id: string;
  text: string;
  sourceMessageIds: string[];
  createdAt: string;
  resolvedAt?: string | null;
}

export interface QubeTalkRelationshipState {
  /** The EXISTING passport_peer_channels.id this state projects over — the
   *  relationship anchor. Not a new relationship id. */
  channelId: string;
  openLoops: QubeTalkRelationshipNote[];
  commitments: QubeTalkRelationshipNote[];
  memorySummary: string | null;
  memorySummaryUpdatedAt: string | null;
  /** Every message this summary was actually built from — P5/N15: never a
   *  synthesized summary with hidden provenance. */
  memorySourceMessageIds: string[];
  lastInteractionAt: string | null;
  updatedAt: string;
}

// ─── GroupQube (§5) ────────────────────────────────────────────────────────

export interface QubeTalkGroup {
  id: string;
  createdByRef: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface QubeTalkGroupEndpoint {
  id: string;
  groupId: string;
  platform: QubeTalkGroupPlatform;
  externalGroupRef: string;
  connectedAt: string;
}

export interface QubeTalkGroupMembership {
  id: string;
  groupId: string;
  participantId: string;
  joinedAt: string;
  leftAt: string | null;
}

/** Frozen audience — who could see a message AT THE TIME it was sent (§5/P4).
 *  Computed once at ingestion/send time and never recomputed retroactively. */
export interface QubeTalkAudienceSnapshot {
  groupId: string | null;
  participantIds: string[];
  capturedAt: string;
}

// ─── ConversationQube (§6) ─────────────────────────────────────────────────

export const QUBETALK_CONVERSATION_TOPOLOGIES = [
  'dyadic', 'group', 'broadcast', 'fan_in', 'public_thread', 'federated',
] as const;
export type QubeTalkConversationTopology = (typeof QUBETALK_CONVERSATION_TOPOLOGIES)[number];

export interface QubeTalkConversation {
  id: string;
  relationshipChannelId: string | null;
  groupId: string | null;
  topology: QubeTalkConversationTopology;
  title: string | null;
  createdAt: string;
  lastActivityAt: string;
}

// ─── MessageQube contextual bindings (§7) — extends passport_peer_messages ─

export const QUBETALK_MESSAGE_SENSITIVITY = ['standard', 'confidential', 'restricted'] as const;
export type QubeTalkMessageSensitivity = (typeof QUBETALK_MESSAGE_SENSITIVITY)[number];

export const QUBETALK_MESSAGE_CONSEQUENCE = ['conversational', 'operational', 'consequential'] as const;
export type QubeTalkMessageConsequence = (typeof QUBETALK_MESSAGE_CONSEQUENCE)[number];

export const QUBETALK_MESSAGE_DELIVERY_STATE = ['pending', 'delivered', 'failed'] as const;
export type QubeTalkMessageDeliveryState = (typeof QUBETALK_MESSAGE_DELIVERY_STATE)[number];

export const QUBETALK_MESSAGE_DIRECTION = ['inbound', 'outbound'] as const;
export type QubeTalkMessageDirection = (typeof QUBETALK_MESSAGE_DIRECTION)[number];

/** The NEW contextual columns on passport_peer_messages (2026-08-25
 *  migration). Composed with the existing `PeerMessage` shape
 *  (services/qubetalk/peerChannel.ts) at the service layer, never re-declared
 *  as a parallel message type (P2). */
export interface QubeTalkMessageContext {
  conversationId: string | null;
  groupId: string | null;
  transport: string;
  externalMessageId: string | null;
  direction: QubeTalkMessageDirection;
  actingAgentRef: string | null;
  delegationGrantRef: string | null;
  audienceSnapshot: QubeTalkAudienceSnapshot | null;
  classification: string | null;
  sensitivity: QubeTalkMessageSensitivity;
  consequence: QubeTalkMessageConsequence;
  deliveryState: QubeTalkMessageDeliveryState;
}

// ─── PublicationQube / channel projections (§13) ──────────────────────────

export const QUBETALK_PUBLICATION_STATUS = [
  'draft', 'prepared', 'pending_authority', 'pending_approval', 'scheduled',
  'publishing', 'published', 'partially_published', 'failed', 'withdrawn', 'archived',
] as const;
export type QubeTalkPublicationStatus = (typeof QUBETALK_PUBLICATION_STATUS)[number];

export interface QubeTalkPublication {
  id: string;
  authorRef: string;
  personaLabel: string | null;
  agentRef: string | null;
  sourceContentRef: string | null;
  title: string;
  status: QubeTalkPublicationStatus;
  createdAt: string;
  updatedAt: string;
}

export const QUBETALK_PROJECTION_STATUS = ['pending', 'publishing', 'published', 'failed', 'withdrawn'] as const;
export type QubeTalkProjectionStatus = (typeof QUBETALK_PROJECTION_STATUS)[number];

export interface QubeTalkPublicationProjection {
  id: string;
  publicationId: string;
  /** A transport id from the capability registry (services/qubetalk/transportRegistry.ts)
   *  — free text at the schema level (N11: the registry, not this CHECK, is
   *  the source of truth for what's actually supported). */
  channel: string;
  externalPublicationId: string | null;
  projectionStatus: QubeTalkProjectionStatus;
  url: string | null;
  publishedAt: string | null;
  createdAt: string;
}

// ─── EngagementQube (§14) ──────────────────────────────────────────────────

export const QUBETALK_ENGAGEMENT_TYPES = [
  'comment', 'reply', 'mention', 'quote', 'reaction', 'question', 'direct_message_referral', 'reshare',
] as const;
export type QubeTalkEngagementType = (typeof QUBETALK_ENGAGEMENT_TYPES)[number];

export const QUBETALK_ENGAGEMENT_STATES = [
  'ingested', 'resolved_participant', 'triaged', 'needs_user', 'agent_manageable',
  'responded', 'converted_to_conversation', 'closed', 'quarantined',
] as const;
export type QubeTalkEngagementState = (typeof QUBETALK_ENGAGEMENT_STATES)[number];

export interface QubeTalkEngagement {
  id: string;
  publicationProjectionId: string;
  engagementType: QubeTalkEngagementType;
  externalEngagementId: string | null;
  /** Resolved only where evidence is sufficient — NEVER auto-merged off a
   *  display name alone (N4). authorRawHandle is kept regardless, so
   *  provenance survives even after resolution (N15). */
  authorParticipantId: string | null;
  authorRawHandle: string | null;
  body: string | null;
  state: QubeTalkEngagementState;
  convertedConversationId: string | null;
  createdAt: string;
}

// ─── Agent management (§10) ────────────────────────────────────────────────

export const QUBETALK_AGENT_POLICY_MODES = ['manual', 'agent_drafts', 'agent_routine', 'agent_bounded', 'no_agent'] as const;
export type QubeTalkAgentPolicyMode = (typeof QUBETALK_AGENT_POLICY_MODES)[number];

/** Inheritance order, narrowest first — resolveEffectiveAgentPolicy walks
 *  this list and takes the first scope that has an explicit policy set. */
export const QUBETALK_AGENT_POLICY_SCOPES = [
  'transport', 'conversation', 'group', 'relationship', 'participant', 'default',
] as const;
export type QubeTalkAgentPolicyScope = (typeof QUBETALK_AGENT_POLICY_SCOPES)[number];

export interface QubeTalkAgentPolicy {
  id: string;
  ownerPersonaId: string;
  scopeType: QubeTalkAgentPolicyScope;
  /** null only when scopeType === 'default'. */
  scopeRef: string | null;
  mode: QubeTalkAgentPolicyMode;
  /** Required (validated in the service layer) when mode === 'agent_bounded'
   *  — the actual grant lives in services/delegation/delegationGrantStore.ts;
   *  this only names which grant this policy defers to. */
  delegationGrantRef: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Ingress/egress routing (§11/§12) ──────────────────────────────────────

export const QUBETALK_ROUTING_STATES = [
  'needs_user', 'agent_manageable', 'agent_draft', 'digest', 'waiting_follow_up', 'quarantined',
] as const;
export type QubeTalkRoutingState = (typeof QUBETALK_ROUTING_STATES)[number];

// ─── Communications events (§16) ───────────────────────────────────────────

export const QUBETALK_EVENT_TYPES = [
  'message.sent', 'message.received', 'conversation.started', 'conversation.responded',
  'group.participated', 'publication.published', 'publication.shared', 'publication.engaged',
  'publication.reshared', 'comment.responded', 'referral.generated',
] as const;
export type QubeTalkEventType = (typeof QUBETALK_EVENT_TYPES)[number];

export interface QubeTalkEvent {
  id: string;
  eventType: QubeTalkEventType;
  subjectRef: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

// ─── Adapter / capability registry (§15) ───────────────────────────────────

export const QUBETALK_TRANSPORT_CAPABILITIES = [
  'dm.read', 'dm.send', 'group.read', 'group.send', 'history.backfill',
  'post.publish', 'article.publish', 'media.publish', 'comment.read', 'comment.reply',
  'mention.read', 'reaction.read', 'webhook.receive', 'polling.receive',
  'identity.lookup', 'attachment.read', 'attachment.send',
  'post.edit', 'post.delete', 'schedule.publish',
] as const;
export type QubeTalkTransportCapability = (typeof QUBETALK_TRANSPORT_CAPABILITIES)[number];

export const QUBETALK_CAPABILITY_STATES = [
  'supported', 'restricted', 'business_account_only', 'approval_required', 'polling_only', 'unsupported', 'unknown',
] as const;
export type QubeTalkCapabilityState = (typeof QUBETALK_CAPABILITY_STATES)[number];

export interface QubeTalkTransportDescriptor {
  transportId: string;
  label: string;
  capabilities: Partial<Record<QubeTalkTransportCapability, QubeTalkCapabilityState>>;
}

// ─── Surface-independent capability projection (2026-08-25, operator-ratified) ──
//
// "QubeTalk core state, policy, identity/relationship resolution,
// communication memory and transport registry are surface-independent. A
// surface receives only a bounded projection of QubeTalk determined by:
//   principal ∩ persona ∩ surface ∩ requested projection ∩ requested scope
//   ∩ delegation ∩ disclosure policy = visible/invocable QubeTalk capability"
// Runtime, Companion, cartridges, Marketa and future experiences consume
// this contract; none may own or fork QubeTalk state (surface
// non-ownership). Changing interface never creates a new conversation
// (surface continuity) — every profile below reads the SAME
// RelationshipQube/ConversationQube rows; a projection only bounds which of
// them are visible, never rewrites their identity.

/** Same values as CAPABILITY_PROJECTION_PROFILES — kept as its own exported
 *  name so existing QubeTalk callers are unaffected by the ContactGraph
 *  fast-follow's extraction of the shared capability-projection seam. */
export const QUBETALK_PROJECTION_PROFILES = CAPABILITY_PROJECTION_PROFILES;
export type QubeTalkProjectionProfile = CapabilityProjectionProfile;

/**
 * What the requesting surface is asking to see. `'all'` for
 * relationshipChannelIds/groupIds is only ever GRANTED for `profile:
 * 'full'` requested by the owning principal itself (never for 'contextual'
 * — a cartridge scope must always be an explicit, bounded list; see
 * evaluateProjectionScope in services/qubetalk/projection.ts).
 */
export interface QubeTalkProjectionScope {
  relationshipChannelIds?: string[] | 'all';
  groupIds?: string[] | 'all';
  publishing?: boolean;
  engagement?: boolean;
}

export interface QubeTalkProjectionRequest {
  capability: 'qubetalk';
  projection: QubeTalkProjectionProfile;
  scope: QubeTalkProjectionScope;
  /** Which surface is asking (e.g. 'metame-runtime', 'companion',
   *  'cartridge:horizon') — recorded for surface-continuity provenance,
   *  NEVER used to grant additional access (surface non-ownership: a
   *  surface's own identity carries no scope of its own). */
  requestingSurface: string;
  /** Present only when an Agent (not the principal directly) is the actual
   *  requester — further intersects the granted scope with what that
   *  agent's resolved policy permits per relationship/conversation
   *  (reuses agentPolicy.ts's resolveEffectiveAgentPolicy; the delegation
   *  term in the formula above). */
  actingAgentRootDid?: string | null;
}

export interface QubeTalkProjectionRelationshipSummary {
  channelId: string;
  counterpartyDisplayLabel: string;
  lastInteractionAt: string | null;
  openLoopCount: number;
  conversationIds: string[];
}

export interface QubeTalkProjectionGroupSummary {
  groupId: string;
  name: string;
  conversationIds: string[];
}

/** Scope items requested but not granted — always reported explicitly,
 *  never silently dropped (matches disclosurePolicy.ts's own excludedContext
 *  discipline: an exclusion must be visible to the caller, not invisible). */
export interface QubeTalkProjectionDenial {
  relationshipChannelIds: string[];
  groupIds: string[];
  reason: 'not_owned' | 'not_permitted_for_contextual_profile' | 'agent_not_authorized_for_scope';
}

export interface QubeTalkProjectionResult {
  profile: QubeTalkProjectionProfile;
  requestingSurface: string;
  relationships: QubeTalkProjectionRelationshipSummary[];
  groups: QubeTalkProjectionGroupSummary[];
  publishing: boolean;
  engagement: boolean;
  denied: QubeTalkProjectionDenial[];
}
