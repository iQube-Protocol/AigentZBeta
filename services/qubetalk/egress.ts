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
import { postDiscordMessages } from '@/services/qubetalk/transports/discordTransport';

export interface OutboundSendRequest {
  /** T0 — resolved by the spine at the calling route; never a raw fetch. */
  callerPersonaId: string;
  /** The EXISTING passport_peer_channels.id — the relationship this send
   *  belongs to. Egress never sends outside a relationship the caller owns. */
  channelId: string;
  /** A transport id from transportRegistry.ts (e.g. 'qubetalk-native', 'discord'). */
  transport: string;
  body: string;
  /** Transport-specific destination the adapter needs. Discord requires the
   *  target channel id explicitly — this build does not resolve it from
   *  ContactGraph/participant endpoints (out of scope; see closeout). */
  destination?: { discordChannelId?: string };
  /** Present only when an Agent — not the principal directly — is the actual
   *  author of this send. Gated by agentPolicy.ts's agentMaySend BEFORE the
   *  transport is ever called (P8/P9/P10). */
  actingAgentRootDid?: string | null;
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
  }

  const conversation = await resolveConversation({ relationshipChannelId: req.channelId, topology: 'dyadic' });
  if (!conversation.ok) return conversation;

  if (req.transport === 'qubetalk-native') {
    const sent = await postMessage(req.callerPersonaId, req.channelId, {
      body: req.body,
      conversationId: conversation.value.id,
    });
    if (!sent.ok) return sent;
    await touchConversationActivity(conversation.value.id);
    await recordInteraction(req.channelId);
    return {
      ok: true,
      value: { messageId: sent.value.id, transport: 'qubetalk-native', deliveryState: 'delivered', externalMessageId: null },
    };
  }

  if (req.transport === 'discord') {
    const discordChannelId = req.destination?.discordChannelId;
    if (!discordChannelId) {
      return { ok: false, error: 'destination.discordChannelId is required to send via Discord', code: 'missing_destination' };
    }

    // The SAME bot-token gate app/api/messenger/dispatch/route.ts has always
    // enforced — preserved exactly, not loosened or removed.
    const botToken = (process.env.DISCORD_BOT_TOKEN || '').trim();
    let deliveryState: 'delivered' | 'failed' = 'failed';
    let externalMessageId: string | null = null;
    let sendError: string | undefined;

    if (!botToken) {
      sendError = 'Missing DISCORD_BOT_TOKEN. Configure it to enable live Discord dispatch.';
    } else {
      try {
        const posted = await postDiscordMessages({
          channelId: discordChannelId,
          botToken,
          content: req.body,
        });
        if (posted.messageIds.length > 0) {
          deliveryState = 'delivered';
          externalMessageId = posted.messageIds[0];
        } else {
          sendError = 'Discord accepted no message content (empty after trim)';
        }
      } catch (err) {
        sendError = err instanceof Error ? err.message : 'Discord send failed';
      }
    }

    // Record the REAL outcome on the message row regardless of success or
    // failure — a failed send is still persisted, honestly marked 'failed',
    // never silently reported as delivered (§4.5's idempotency key only
    // gets set when Discord actually returned a message id).
    const inserted = await postMessage(req.callerPersonaId, req.channelId, {
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
    await recordInteraction(req.channelId);

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
