/**
 * QubeTalk Communications Membrane — egress lifecycle (§12), the outbound
 * counterpart to `ingestion.ts`'s §11 inbound pipeline:
 *
 *   Ownership check → transport known? → transport supports sending? →
 *   Agent-authority gate (agentPolicy.ts, BEFORE any transport call) →
 *   conversation resolution → dispatch through the transport adapter →
 *   record the REAL outcome on the MessageQube row → (on success) emit a
 *   communications event + a consequential receipt for an Agent-authored send.
 *
 * This is the seam that promotes a transport from "catalogued in
 * transportRegistry.ts" to "an actual code path QubeTalk sends through"
 * (§25.F). Today it wires exactly one external transport — Discord
 * (`services/qubetalk/transports/discordTransport.ts`, the same Discord
 * REST calls `app/api/messenger/dispatch/route.ts` already used) — plus the
 * existing native transport, both through ONE function so neither path can
 * silently diverge from the other's policy gating.
 *
 * "Constitutionally dumb" adapter discipline (§16): this module is where
 * Agent authority, capability support, and consequence classification are
 * DECIDED. `discordTransport.ts` itself decides none of that — it only
 * knows how to call Discord's REST API. Never move a decision from here
 * into the transport module, and never let a caller skip this module to
 * reach a transport adapter directly.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { loadOwnedChannel, postMessage, peerCommitment, type PeerResult } from '@/services/qubetalk/peerChannel';
import { getTransportDescriptor, transportHasCapability } from '@/services/qubetalk/transportRegistry';
import { agentMaySend } from '@/services/qubetalk/agentPolicy';
import { resolveConversation, touchConversationActivity } from '@/services/qubetalk/conversations';
import { recordInteraction } from '@/services/qubetalk/relationships';
import { emitQubeTalkEvent } from '@/services/qubetalk/events';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { resolveDiscordChannelReference, sendDiscordContent } from '@/services/qubetalk/transports/discordTransport';
import { resolveOwnerAuthProfileId } from '@/services/contactGraph/ownerResolution';
import { getContactEndpointById } from '@/services/contactGraph/contactEndpoints';
import { evaluateDisclosure, type DisclosureContextItem } from '@/services/qubetalk/disclosurePolicy';

export interface OutboundSendRequest {
  /** T0 — resolved by the spine at the calling route; never a raw fetch. */
  callerPersonaId: string;
  /** The EXISTING passport_peer_channels.id — the relationship this send
   *  belongs to. Egress never sends outside a relationship the caller owns. */
  channelId: string;
  /** A transport id from transportRegistry.ts (e.g. 'qubetalk-native', 'discord'). */
  transport: string;
  body: string;
  /** Human message type (QUBETALK_HUMAN_MESSAGE_TYPES) — defaults to
   *  'message' via postMessage's own default when omitted. */
  type?: string;
  /**
   * Transport-specific destination the adapter needs. `contactEndpointId` is
   * the PREFERRED form — a caller (composer UI) passes the id of a
   * ContactGraph endpoint the caller (`req.callerPersonaId`) actually owns;
   * this module resolves it server-side (ownership-checked via
   * `getContactEndpointById`) to the transport-specific identifier, so a
   * client can never forge a destination it doesn't hold. `discordChannelId`
   * remains as a direct/legacy form for callers that already have a raw
   * Discord channel id (e.g. the existing tenant-runtime dispatch route).
   * If BOTH the resolved endpoint's identifier and an explicit
   * `discordChannelId` are absent/unresolvable, egress returns a clear
   * failure — it NEVER silently substitutes a different channel/endpoint.
   */
  destination?: { discordChannelId?: string; contactEndpointId?: string };
  /** Present only when an Agent — not the principal directly — is the actual
   *  author of this send. Gated by agentPolicy.ts's agentMaySend BEFORE the
   *  transport is ever called (P8/P9/P10). */
  actingAgentRootDid?: string | null;
  /**
   * Present only for an Agent-composed draft that cites specific prior
   * context items (messages/notes) with known sensitivity/origin audience —
   * e.g. a summary drawn from another conversation. When set (together with
   * `actingAgentRootDid`), egress runs disclosurePolicy.ts's
   * `evaluateDisclosure` against this channel's two-principal audience
   * BEFORE the transport is invoked; any excluded item denies the send
   * outright (§6/§8: "context may inform, audience constrains disclosure").
   * Never checked for a human-authored send — the human IS the disclosure
   * authority for their own words.
   */
  sourceContext?: DisclosureContextItem[];
}

export interface OutboundSendResult {
  messageId: string;
  transport: string;
  deliveryState: 'delivered' | 'failed';
  externalMessageId: string | null;
  /** Populated only when deliveryState === 'failed'. */
  error?: string;
}

/**
 * Resolve a Discord send destination. PREFERS `contactEndpointId` — fetched
 * ownership-checked (a caller can only resolve a handle THEY hold), then
 * turned into a real Discord channel id: directly if it's already a
 * snowflake, or by resolving an invite code through Discord's public
 * invite endpoint otherwise. Falls back to a raw `discordChannelId` for
 * legacy/direct callers. NEVER silently substitutes a different channel —
 * an unresolvable endpoint is a clear failure (N-transport-substitution),
 * not a fallback to some other destination.
 */
async function resolveDiscordDestination(
  callerPersonaId: string,
  destination: OutboundSendRequest['destination'],
): Promise<PeerResult<string>> {
  if (destination?.contactEndpointId) {
    const owner = await resolveOwnerAuthProfileId(callerPersonaId);
    if (!owner.ok) return owner;
    const endpoint = await getContactEndpointById(owner.value, destination.contactEndpointId);
    if (!endpoint.ok) return endpoint;
    if (endpoint.value.platform !== 'discord') {
      return { ok: false, error: `endpoint is a '${endpoint.value.platform}' handle, not Discord`, code: 'endpoint_platform_mismatch' };
    }
    const identifier = endpoint.value.normalizedIdentifier;
    const resolved = await resolveDiscordChannelReference(identifier);
    if (resolved) return { ok: true, value: resolved };
    return {
      ok: false,
      error: `could not resolve the Discord endpoint '${identifier}' to a real channel — it is neither a channel id nor a resolvable invite`,
      code: 'endpoint_unresolvable',
    };
  }

  if (destination?.discordChannelId) return { ok: true, value: destination.discordChannelId };

  return { ok: false, error: 'destination.contactEndpointId or destination.discordChannelId is required to send via Discord', code: 'missing_destination' };
}

/**
 * The ONE outbound send path for QubeTalk. Every transport — native or
 * external — flows through the same ownership check, the same Agent-policy
 * gate, and the same conversation resolution before anything is dispatched.
 */
export async function sendMessageThroughTransport(
  req: OutboundSendRequest,
): Promise<PeerResult<OutboundSendResult>> {
  const descriptor = getTransportDescriptor(req.transport);
  if (!descriptor) {
    return { ok: false, error: `unknown transport '${req.transport}'`, code: 'unknown_transport' };
  }

  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const myRef = personaPublicRef(req.callerPersonaId);
  const channel = await loadOwnedChannel(admin, req.channelId, myRef);
  if (!channel) return { ok: false, error: 'channel not found or caller is not a principal', code: 'not_found' };
  if (channel.status !== 'active') return { ok: false, error: 'channel is revoked', code: 'revoked' };

  // group.send covers both a Discord channel post and the native transport's
  // own dm/group capability today — see transportRegistry.ts's own
  // documentation of why 'qubetalk-native' and 'discord' both carry it.
  const sendCapability = transportHasCapability(req.transport, 'group.send');
  if (sendCapability === 'unsupported') {
    return { ok: false, error: `transport '${req.transport}' does not support sending (N11)`, code: 'transport_unsupported' };
  }

  // Agent-authority gate — resolved BEFORE the transport is ever touched.
  // This is the exact same check `qubetalk_message_agent_sent` fires only
  // after passing (§10/P9/P10) — an Agent with no active bounded grant is
  // denied here, never at the Discord API boundary.
  if (req.actingAgentRootDid) {
    const allowed = await agentMaySend(
      req.callerPersonaId,
      { transport: req.transport, relationship: req.channelId },
      req.actingAgentRootDid,
    );
    if (!allowed.ok) return allowed;
    if (!allowed.value) {
      return {
        ok: false,
        error: 'Agent is not authorized to send on this relationship (no active BOUNDED grant)',
        code: 'agent_not_authorized',
      };
    }

    // Disclosure gate — §6/§8: context may inform, audience constrains
    // disclosure. Only meaningful for an Agent-composed draft that names the
    // specific context items it drew from (sourceContext); a human-authored
    // send is never checked here (the human is their own disclosure
    // authority). This channel's audience is exactly its two principals.
    if (req.sourceContext && req.sourceContext.length > 0) {
      const { excludedContext } = evaluateDisclosure({
        availableContext: req.sourceContext,
        destinationAudienceParticipantIds: [myRef, channel.counterpartyRef],
      });
      if (excludedContext.length > 0) {
        return {
          ok: false,
          error: `disclosure denied — ${excludedContext.length} context item(s) are not permissible for this destination audience`,
          code: 'disclosure_denied',
        };
      }
    }
  }

  const conversation = await resolveConversation({ anchor: { kind: 'peer-channel', channelId: req.channelId }, topology: 'dyadic' });
  if (!conversation.ok) return conversation;

  if (req.transport === 'qubetalk-native') {
    const sent = await postMessage(req.callerPersonaId, req.channelId, {
      type: req.type,
      body: req.body,
      conversationId: conversation.value.id,
    });
    if (!sent.ok) return sent;
    await touchConversationActivity(conversation.value.id);
    await recordInteraction({ kind: 'peer-channel', channelId: req.channelId });
    return {
      ok: true,
      value: { messageId: sent.value.id, transport: 'qubetalk-native', deliveryState: 'delivered', externalMessageId: null },
    };
  }

  if (req.transport === 'discord') {
    const resolvedDestination = await resolveDiscordDestination(req.callerPersonaId, req.destination);
    if (!resolvedDestination.ok) return resolvedDestination;
    const discordChannelId = resolvedDestination.value;

    // The SAME bot-token gate app/api/messenger/dispatch/route.ts has always
    // enforced — preserved exactly (now via discordTransport.ts's shared
    // sendDiscordContent, the same wrapper offplatformRelationships.ts's
    // postOffplatformMessage uses, so both send paths apply the gate and
    // the "attempt, then record the REAL outcome" discipline identically).
    const outcome = await sendDiscordContent(discordChannelId, req.body);
    const deliveryState = outcome.deliveryState;
    const externalMessageId = outcome.externalMessageId;
    const sendError = outcome.error;

    // Record the REAL outcome on the message row regardless of success or
    // failure — a failed send is still persisted, honestly marked 'failed',
    // never silently reported as delivered (§4.5's idempotency key only
    // gets set when Discord actually returned a message id).
    const inserted = await postMessage(req.callerPersonaId, req.channelId, {
      type: req.type,
      body: req.body,
      transport: 'discord',
      direction: 'outbound',
      externalMessageId,
      deliveryState,
      actingAgentRef: req.actingAgentRootDid ?? null,
      consequence: 'consequential',
      conversationId: conversation.value.id,
    });
    if (!inserted.ok) return inserted;

    if (deliveryState === 'failed') {
      return {
        ok: true,
        value: { messageId: inserted.value.id, transport: 'discord', deliveryState: 'failed', externalMessageId: null, error: sendError },
      };
    }

    await touchConversationActivity(conversation.value.id);
    await recordInteraction({ kind: 'peer-channel', channelId: req.channelId });

    if (req.actingAgentRootDid) {
      await createActivityReceipt({
        personaId: req.callerPersonaId,
        activeCartridge: 'qubetalk',
        actionType: 'qubetalk_message_agent_sent',
        summary: 'Agent sent a QubeTalk message via the Discord transport',
        contextShared: [`channel:${peerCommitment('channel', req.channelId)}`, 'transport:discord'],
      }).catch((err) => console.warn('[QubeTalk] egress receipt write failed (non-fatal):', err instanceof Error ? err.message : err));
    }
    void emitQubeTalkEvent('message.sent', channel.counterpartyRef, { transport: 'discord', channelId: req.channelId });

    return {
      ok: true,
      value: { messageId: inserted.value.id, transport: 'discord', deliveryState: 'delivered', externalMessageId },
    };
  }

  return { ok: false, error: `transport '${req.transport}' is not wired for sending yet`, code: 'transport_not_wired' };
}
