/**
 * QubeTalk Communications Membrane — transport/capability registry (§16).
 *
 * Adapters are dumb transports; they never decide Agent authority, Standing,
 * rewards, disclosure policy, consequence, or conversation importance (§16) —
 * this registry only declares WHAT a transport can mechanically do, never
 * what it is CONSTITUTIONALLY permitted to do (that's disclosurePolicy.ts +
 * agentPolicy.ts). Capability keys and states use the canonical spec's own
 * literal vocabulary (§16) — singular `comment.read`/`mention.read`/
 * `reaction.read`/`attachment.*`, not the plural forms an earlier
 * reconstruction-from-memory introduced (corrected 2026-08-25).
 *
 * 'qubetalk-native' is the only FULLY supported transport in this build — it
 * is the existing, working peer-exchange primitive
 * (services/qubetalk/peerChannel.ts), adapted into this registry per §16.
 *
 * CORRECTION (2026-08-25, caught by operator review): an earlier version of
 * this file and its accompanying implementation record claimed "no working
 * credentials or integration exist for any external transport." That was
 * wrong for Discord specifically. `app/api/messenger/dispatch/route.ts` +
 * `services/mcp/qubetalkContracts.ts` have a REAL, working, bot-token-gated
 * Discord send path (`postDiscordMessages`, gated on `DISCORD_BOT_TOKEN`,
 * explicitly restricted to "Discord only" for live dispatch) and a public,
 * ungated invite→channel resolver (`resolveDiscordChannelFromInvite`). Both
 * are registered below as 'restricted' rather than 'unsupported' — 'restricted'
 * because (a) sending is gated on an env credential this module cannot
 * confirm is provisioned in any given deployment, and (b) neither capability
 * is yet WIRED into this new domain substrate's adapter contract — that code
 * currently writes to the SEPARATE tenant-runtime `qubetalk_channels` system
 * (services/qubetalk/qubetalkStore.ts), not the RelationshipQube/
 * ConversationQube graph this migration builds. Adapting it into a live
 * transport for the new substrate is deliberately deferred, not attempted in
 * this pass — see the implementation record's "Known limitations" section.
 * Every OTHER external transport remains genuinely 'unsupported': confirmed
 * by audit, not assumed, and N11 forbids claiming otherwise.
 */

import type { QubeTalkTransportCapability, QubeTalkCapabilityState, QubeTalkTransportDescriptor } from '@/types/qubetalk';

const ALL_UNSUPPORTED: Partial<Record<QubeTalkTransportCapability, QubeTalkCapabilityState>> = {
  'dm.read': 'unsupported',
  'dm.send': 'unsupported',
  'group.read': 'unsupported',
  'group.send': 'unsupported',
  'history.backfill': 'unsupported',
  'post.publish': 'unsupported',
  'article.publish': 'unsupported',
  'media.publish': 'unsupported',
  'comment.read': 'unsupported',
  'comment.reply': 'unsupported',
  'mention.read': 'unsupported',
  'reaction.read': 'unsupported',
  'webhook.receive': 'unsupported',
  'polling.receive': 'unsupported',
  'identity.lookup': 'unsupported',
  'attachment.read': 'unsupported',
  'attachment.send': 'unsupported',
  'post.edit': 'unsupported',
  'post.delete': 'unsupported',
  'schedule.publish': 'unsupported',
};

function deferred(transportId: string, label: string): QubeTalkTransportDescriptor {
  return { transportId, label, capabilities: { ...ALL_UNSUPPORTED } };
}

/**
 * The ONE fully supported transport in this build — the existing
 * peer-exchange primitive. `attachment.*` are 'restricted' (not
 * 'supported'): sharing is reference-only
 * (services/qubetalk/peerChannel.ts's shareArtifact/copyToLocker — a
 * rights-gated reference/manifest, never raw bytes), so a full
 * attachment.send/read capability would overstate what actually happens.
 */
const QUBETALK_NATIVE: QubeTalkTransportDescriptor = {
  transportId: 'qubetalk-native',
  label: 'QubeTalk (native)',
  capabilities: {
    'dm.read': 'supported',
    'dm.send': 'supported',
    'group.read': 'supported',
    'group.send': 'supported',
    'history.backfill': 'supported',
    'identity.lookup': 'supported',
    'attachment.read': 'restricted',
    'attachment.send': 'restricted',
    'post.publish': 'unsupported',
    'article.publish': 'unsupported',
    'media.publish': 'unsupported',
    'comment.read': 'unsupported',
    'comment.reply': 'unsupported',
    'mention.read': 'unsupported',
    'reaction.read': 'unsupported',
    'webhook.receive': 'unsupported',
    'polling.receive': 'unsupported',
    'post.edit': 'unsupported',
    'post.delete': 'unsupported',
    'schedule.publish': 'unsupported',
  },
};

/**
 * Discord is NOT fully deferred — see the header correction above. Verified
 * by reading `app/api/messenger/dispatch/route.ts` directly (not assumed):
 * `postDiscordMessages` posts to a real channel via the real Discord API,
 * gated on `DISCORD_BOT_TOKEN` (group.send), and `resolveDiscordChannelFromInvite`
 * resolves an invite code to a channel id via Discord's public (ungated)
 * invite endpoint — a narrow slice of identity.lookup, not general user/
 * profile lookup, so registered 'restricted' rather than 'supported' to
 * avoid overclaiming. No other Discord capability (dm.*, group.read,
 * history.backfill, comment.*, mention.*, reaction.*, webhook.receive,
 * attachment.*) has verified working code in this repo.
 */
const DISCORD_PARTIAL: QubeTalkTransportDescriptor = {
  transportId: 'discord',
  label: 'Discord',
  capabilities: {
    ...ALL_UNSUPPORTED,
    'group.send': 'restricted',
    'identity.lookup': 'restricted',
  },
};

/**
 * Deferred — no credentials/integration exist in this repo for any of these
 * (verified by audit, not assumed). Each is registered so the capability
 * question has an honest, explicit answer rather than silence, per §16's
 * "otherwise mark external capabilities explicitly unsupported/deferred."
 */
export const QUBETALK_TRANSPORT_REGISTRY: Record<string, QubeTalkTransportDescriptor> = {
  'qubetalk-native': QUBETALK_NATIVE,
  discord: DISCORD_PARTIAL,
  whatsapp: deferred('whatsapp', 'WhatsApp'),
  telegram: deferred('telegram', 'Telegram'),
  signal: deferred('signal', 'Signal'),
  linkedin: deferred('linkedin', 'LinkedIn'),
  x: deferred('x', 'X'),
  email: deferred('email', 'Email'),
  sms: deferred('sms', 'SMS'),
  facebook: deferred('facebook', 'Facebook'),
  instagram: deferred('instagram', 'Instagram'),
  medium: deferred('medium', 'Medium'),
  substack: deferred('substack', 'Substack'),
  qriptopian: deferred('qriptopian', 'Qriptopian'),
};

export function getTransportDescriptor(transportId: string): QubeTalkTransportDescriptor | null {
  return QUBETALK_TRANSPORT_REGISTRY[transportId] ?? null;
}

export function transportHasCapability(
  transportId: string,
  capability: QubeTalkTransportCapability,
): QubeTalkCapabilityState {
  const descriptor = getTransportDescriptor(transportId);
  return descriptor?.capabilities[capability] ?? 'unsupported';
}

/** Every transport currently marked 'supported' or 'restricted' for at least
 *  one capability — the readiness map §25.F asks for at closeout. */
export function listReadyTransports(): string[] {
  return Object.values(QUBETALK_TRANSPORT_REGISTRY)
    .filter((d) => Object.values(d.capabilities).some((s) => s === 'supported' || s === 'restricted'))
    .map((d) => d.transportId);
}
