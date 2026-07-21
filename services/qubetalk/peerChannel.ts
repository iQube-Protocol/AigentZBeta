/**
 * QubeTalk Peer Exchange — Phase 1, Increment 1.
 *
 * Personhood-bound PEER channels + typed human messages between two INDEPENDENT
 * principals (PRD §2a option A — a NEW surface distinct from the tenant
 * `qubetalk_channels` and the holder<->delegate `passport_qubetalk_channels`).
 * (PRD: codexes/packs/agentiq/updates/2026-07-20_prd-qubetalk-peer-exchange.md)
 *
 * Constitutional discipline:
 *   - A channel belongs to two PRINCIPALS, identified by their Polity Public
 *     Reference (`personaPublicRef` — sha256/16-hex, T2-safe). Raw persona
 *     UUIDs / T0 data NEVER enter these rows; the creator only ever holds the
 *     counterparty's public reference.
 *   - Membership is by principal ref; only a participant may read/post.
 *   - Agents are NOT modelled here (Phase 3); locker sharing + receipts are
 *     later increments and reuse existing platform organs.
 *
 * All functions take the caller's T0 `personaId` (resolved by the spine at the
 * route) and derive the caller's public ref internally — the UUID never leaves.
 */

import { createHash } from 'crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { addLockerItemForPersona } from '@/services/passport/lockerItems';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

/** Human message types admitted in Phase 1 (PRD §5 "Human communication"). */
export const QUBETALK_HUMAN_MESSAGE_TYPES = [
  'message',
  'question',
  'response',
  'acknowledgement',
  'introduction',
] as const;
export type QubeTalkHumanMessageType = (typeof QUBETALK_HUMAN_MESSAGE_TYPES)[number];

export interface PeerChannel {
  id: string;
  principalARef: string;
  principalBRef: string;
  createdByRef: string;
  status: 'active' | 'revoked';
  createdAt: string;
  /** The OTHER principal's ref, relative to the caller. */
  counterpartyRef: string;
  /**
   * The caller's OWN private nickname for this channel/counterparty (what the
   * caller calls the other side). Per-side: only the side that set it sees it.
   * Never enters receipts/DVN/chain — local peer naming, not a T0/T2 field.
   */
  counterpartyLabel: string | null;
}

export interface PeerMessage {
  id: string;
  channelId: string;
  senderRef: string;
  type: string;
  body: string;
  createdAt: string;
  /** True when the caller sent this message. */
  mine: boolean;
}

export type PeerResult<T> = { ok: true; value: T } | { ok: false; error: string; code?: string };

const CHANNELS = 'passport_peer_channels';
const MESSAGES = 'passport_peer_messages';
const SHARED = 'passport_peer_shared_artifacts';
const MISSING = 'passport_peer_channels';

/**
 * Rights envelope (PRD §6) — per shared artifact. Enforced server-side (a later
 * increment gates locker-copy / agent-inference on these). Conservative
 * defaults: viewable, nothing else, until the sharer explicitly grants.
 */
export interface RightsEnvelope {
  view: boolean;
  download: boolean;
  copyToLocker: boolean;
  annotate: boolean;
  revise: boolean;
  reshare: boolean;
  agentInference: boolean;
  confidentialNda: boolean;
}

export const DEFAULT_RIGHTS: RightsEnvelope = {
  view: true,
  download: false,
  copyToLocker: false,
  annotate: false,
  revise: false,
  reshare: false,
  agentInference: false,
  confidentialNda: false,
};

/** Coerce an untrusted rights object to the full envelope (conservative). */
export function normalizeRights(input: unknown): RightsEnvelope {
  const src = (input ?? {}) as Record<string, unknown>;
  const b = (k: keyof RightsEnvelope) => (typeof src[k] === 'boolean' ? (src[k] as boolean) : DEFAULT_RIGHTS[k]);
  return {
    view: b('view'),
    download: b('download'),
    copyToLocker: b('copyToLocker'),
    annotate: b('annotate'),
    revise: b('revise'),
    reshare: b('reshare'),
    agentInference: b('agentInference'),
    confidentialNda: b('confidentialNda'),
  };
}

export const SHARE_RELATIONSHIPS = [
  'artifact_share',
  'submitted_for_review',
  'responds_to',
  'reviews',
  'revises',
  'supersedes',
  'annotates',
  'accepts',
  'rejects',
] as const;
export type ShareRelationship = (typeof SHARE_RELATIONSHIPS)[number];

export interface SharedArtifact {
  id: string;
  channelId: string;
  sharedByRef: string;
  artifactType: string;
  artifactId: string;
  title: string;
  locationRef: string | null;
  relationship: string;
  rights: RightsEnvelope;
  createdAt: string;
  openedAt: string | null;
  copiedToLockerAt: string | null;
  /** True when the caller is the sharer. */
  mine: boolean;
}

/**
 * A Polity Public Reference is 16 lowercase hex chars (personaPublicRef); the
 * pairwise `prf_...` form is accepted for forward-compat. NEVER a persona UUID.
 * (Pure — exported for the canary.)
 */
export function isPublicRefLike(s: unknown): s is string {
  return typeof s === 'string' && (/^[0-9a-f]{16}$/.test(s) || /^prf_[0-9a-f]{8,}$/.test(s));
}

/** Order-independent pair key for two principal refs. (Pure — exported for the canary.) */
export function peerPairKey(a: string, b: string): string {
  return a <= b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * T2-safe commitment for an internal QubeTalk UUID (channel / shared-artifact
 * row id). sha256 of a namespaced input, 16-hex — one-way, deterministic,
 * chain-safe. Used so consequential receipts (which flow to the DVN payload)
 * correlate to a channel/artifact WITHOUT carrying a raw UUID. (Pure — exported
 * for the canary.) Mirrors the HMS `hms:locker:<id>` commitment discipline.
 */
export function peerCommitment(namespace: 'channel' | 'artifact', id: string): string {
  return createHash('sha256').update(`qubetalk:${namespace}:${id}`).digest('hex').slice(0, 16);
}

/** Rights the sharer explicitly granted, as a short T2-safe label list. */
function grantedRightLabels(rights: RightsEnvelope): string[] {
  return (Object.keys(rights) as (keyof RightsEnvelope)[]).filter((k) => rights[k] === true);
}

/**
 * Write a consequential peer-exchange receipt (best-effort — a receipt failure
 * never breaks the underlying act). The receipt + its DVN payload carry ONLY
 * T2-safe references: the caller's persona is hashed by the receipt/DVN layer,
 * the counterparty appears as its Polity Public Reference, and channel/artifact
 * appear as sha256/16 commitments. No raw UUIDs.
 */
async function writePeerReceipt(
  callerPersonaId: string,
  actionType: 'qubetalk_artifact_shared' | 'qubetalk_artifact_opened' | 'qubetalk_artifact_copied',
  args: { channelId: string; counterpartyRef: string; artifactRowId: string; artifactType: string; summary: string; rights?: RightsEnvelope },
): Promise<void> {
  try {
    await createActivityReceipt({
      personaId: callerPersonaId,
      activeCartridge: 'qubetalk',
      actionType,
      summary: args.summary.slice(0, 1000),
      // contextShared = category labels only; each token here is T2-safe.
      contextShared: [
        `channel:${peerCommitment('channel', args.channelId)}`,
        `artifact:${peerCommitment('artifact', args.artifactRowId)}`,
        `counterparty:${args.counterpartyRef}`,
        `type:${args.artifactType}`,
        ...(args.rights ? [`rights:${grantedRightLabels(args.rights).join('+') || 'view'}`] : []),
      ],
    });
  } catch (err) {
    // Provenance is best-effort; the peer act already succeeded and persisted.
    console.warn('[QubeTalk] receipt write failed (non-fatal):', err instanceof Error ? err.message : err);
  }
}

function rowToChannel(row: Record<string, unknown>, myRef: string): PeerChannel {
  const a = String(row.principal_a_ref);
  const b = String(row.principal_b_ref);
  const iAmA = a === myRef;
  // My own private label for this channel lives on my side's column.
  const myLabel = iAmA ? (row.principal_a_label as string | null) : (row.principal_b_label as string | null);
  return {
    id: String(row.id),
    principalARef: a,
    principalBRef: b,
    createdByRef: String(row.created_by_ref),
    status: (row.status as PeerChannel['status']) ?? 'active',
    createdAt: String(row.created_at),
    counterpartyRef: iAmA ? b : a,
    counterpartyLabel: (myLabel ?? null) || null,
  };
}

/**
 * Create (or return the existing) peer channel between the caller and a
 * counterparty principal, identified by the counterparty's Polity Public
 * Reference. Idempotent per unordered pair (unique `pair_key`).
 */
export async function createOrGetChannel(
  callerPersonaId: string,
  counterpartyRef: string,
): Promise<PeerResult<PeerChannel>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const myRef = personaPublicRef(callerPersonaId);
  if (!isPublicRefLike(counterpartyRef)) {
    return { ok: false, error: 'counterpartyRef must be a Polity Public Reference (never a raw UUID)', code: 'bad_ref' };
  }
  if (counterpartyRef === myRef) {
    return { ok: false, error: 'cannot open a channel with yourself', code: 'self_channel' };
  }

  const pairKey = peerPairKey(myRef, counterpartyRef);

  const existing = await admin.from(CHANNELS).select('*').eq('pair_key', pairKey).maybeSingle();
  if (existing.data) return { ok: true, value: rowToChannel(existing.data as Record<string, unknown>, myRef) };

  const insert = await admin
    .from(CHANNELS)
    .insert({ principal_a_ref: myRef, principal_b_ref: counterpartyRef, created_by_ref: myRef })
    .select('*')
    .single();
  if (insert.error) {
    // A concurrent create may have won the unique(pair_key) race — re-read.
    if (insert.error.code === '23505') {
      const retry = await admin.from(CHANNELS).select('*').eq('pair_key', pairKey).maybeSingle();
      if (retry.data) return { ok: true, value: rowToChannel(retry.data as Record<string, unknown>, myRef) };
    }
    if (insert.error.message.includes(MISSING)) {
      return { ok: false, code: 'migration_pending', error: 'peer-channel tables not provisioned — apply 20260805000000.' };
    }
    return { ok: false, error: insert.error.message };
  }
  return { ok: true, value: rowToChannel(insert.data as Record<string, unknown>, myRef) };
}

/** List every channel the caller is a principal of, newest first. */
export async function listChannelsForCaller(callerPersonaId: string): Promise<PeerResult<PeerChannel[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const myRef = personaPublicRef(callerPersonaId);
  const { data, error } = await admin
    .from(CHANNELS)
    .select('*')
    .or(`principal_a_ref.eq.${myRef},principal_b_ref.eq.${myRef}`)
    .order('created_at', { ascending: false });
  if (error) {
    if (error.message.includes(MISSING)) return { ok: false, code: 'migration_pending', error: 'peer-channel tables not provisioned — apply 20260805000000.' };
    return { ok: false, error: error.message };
  }
  return { ok: true, value: (data ?? []).map((r) => rowToChannel(r as Record<string, unknown>, myRef)) };
}

/**
 * Set (or clear) the caller's OWN private nickname for a channel — the name they
 * use to distinguish this counterparty from others. Per-side: writes only the
 * caller's own label column, so it is never visible to the counterparty and
 * never enters receipts/DVN/chain. Pass an empty/whitespace label to clear it.
 */
export async function setChannelLabel(
  callerPersonaId: string,
  channelId: string,
  label: string,
): Promise<PeerResult<PeerChannel>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const myRef = personaPublicRef(callerPersonaId);

  const channel = await loadOwnedChannel(admin, channelId, myRef);
  if (!channel) return { ok: false, error: 'channel not found or caller is not a principal', code: 'not_found' };

  const trimmed = label.trim().slice(0, 80);
  const column = channel.principalARef === myRef ? 'principal_a_label' : 'principal_b_label';
  const { data, error } = await admin
    .from(CHANNELS)
    .update({ [column]: trimmed || null })
    .eq('id', channelId)
    .select('*')
    .single();
  if (error) {
    if (error.message.includes('principal_a_label') || error.message.includes('principal_b_label')) {
      return { ok: false, code: 'migration_pending', error: 'channel labels not provisioned — apply 20260805200000.' };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, value: rowToChannel(data as Record<string, unknown>, myRef) };
}

/** Verify the caller is a principal of the channel; returns the channel or null. */
async function loadOwnedChannel(admin: SupabaseClient, channelId: string, myRef: string): Promise<PeerChannel | null> {
  const { data } = await admin.from(CHANNELS).select('*').eq('id', channelId).maybeSingle();
  if (!data) return null;
  const a = String(data.principal_a_ref);
  const b = String(data.principal_b_ref);
  if (a !== myRef && b !== myRef) return null;
  return rowToChannel(data as Record<string, unknown>, myRef);
}

/** Post a typed human message to a channel the caller is a principal of. */
export async function postMessage(
  callerPersonaId: string,
  channelId: string,
  input: { type?: string; body: string },
): Promise<PeerResult<PeerMessage>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const myRef = personaPublicRef(callerPersonaId);

  const channel = await loadOwnedChannel(admin, channelId, myRef);
  if (!channel) return { ok: false, error: 'channel not found or caller is not a principal', code: 'not_found' };
  if (channel.status !== 'active') return { ok: false, error: 'channel is revoked', code: 'revoked' };

  const type = (input.type ?? 'message') as string;
  if (!QUBETALK_HUMAN_MESSAGE_TYPES.includes(type as QubeTalkHumanMessageType)) {
    return { ok: false, error: `type '${type}' is not permitted in Phase 1 (human types only)`, code: 'bad_type' };
  }
  const body = (input.body ?? '').trim();
  if (!body) return { ok: false, error: 'message body is required', code: 'empty' };

  const insert = await admin
    .from(MESSAGES)
    .insert({ channel_id: channelId, sender_ref: myRef, type, body })
    .select('*')
    .single();
  if (insert.error) return { ok: false, error: insert.error.message };
  const row = insert.data as Record<string, unknown>;
  return {
    ok: true,
    value: {
      id: String(row.id),
      channelId: String(row.channel_id),
      senderRef: String(row.sender_ref),
      type: String(row.type),
      body: String(row.body),
      createdAt: String(row.created_at),
      mine: true,
    },
  };
}

/** List messages for a channel the caller is a principal of, oldest first. */
export async function listMessages(
  callerPersonaId: string,
  channelId: string,
  limit = 200,
): Promise<PeerResult<PeerMessage[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const myRef = personaPublicRef(callerPersonaId);

  const channel = await loadOwnedChannel(admin, channelId, myRef);
  if (!channel) return { ok: false, error: 'channel not found or caller is not a principal', code: 'not_found' };

  const { data, error } = await admin
    .from(MESSAGES)
    .select('*')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 500));
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    value: (data ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      const senderRef = String(row.sender_ref);
      return {
        id: String(row.id),
        channelId: String(row.channel_id),
        senderRef,
        type: String(row.type),
        body: String(row.body),
        createdAt: String(row.created_at),
        mine: senderRef === myRef,
      };
    }),
  };
}

function rowToSharedArtifact(row: Record<string, unknown>, myRef: string): SharedArtifact {
  const sharedByRef = String(row.shared_by_ref);
  return {
    id: String(row.id),
    channelId: String(row.channel_id),
    sharedByRef,
    artifactType: String(row.artifact_type),
    artifactId: String(row.artifact_id),
    title: String(row.title ?? ''),
    locationRef: (row.location_ref as string | null) ?? null,
    relationship: String(row.relationship ?? 'artifact_share'),
    rights: normalizeRights(row.rights),
    createdAt: String(row.created_at),
    openedAt: (row.opened_at as string | null) ?? null,
    copiedToLockerAt: (row.copied_to_locker_at as string | null) ?? null,
    mine: sharedByRef === myRef,
  };
}

/**
 * Share an artifact REFERENCE (+ rights envelope) into a channel the caller is a
 * principal of. This is not a byte copy — it attaches a provenance-bearing
 * reference the counterparty can view; locker materialisation is a later
 * increment gated by `rights.copyToLocker`.
 */
export async function shareArtifact(
  callerPersonaId: string,
  channelId: string,
  input: {
    artifactType: string;
    artifactId: string;
    title?: string;
    locationRef?: string | null;
    relationship?: string;
    rights?: unknown;
  },
): Promise<PeerResult<SharedArtifact>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const myRef = personaPublicRef(callerPersonaId);

  const channel = await loadOwnedChannel(admin, channelId, myRef);
  if (!channel) return { ok: false, error: 'channel not found or caller is not a principal', code: 'not_found' };
  if (channel.status !== 'active') return { ok: false, error: 'channel is revoked', code: 'revoked' };

  const artifactType = (input.artifactType ?? '').trim();
  const artifactId = (input.artifactId ?? '').trim();
  if (!artifactType || !artifactId) {
    return { ok: false, error: 'artifactType and artifactId are required', code: 'bad_artifact' };
  }
  const relationship = (input.relationship ?? 'artifact_share') as string;
  if (!SHARE_RELATIONSHIPS.includes(relationship as ShareRelationship)) {
    return { ok: false, error: `relationship '${relationship}' is not recognised`, code: 'bad_relationship' };
  }

  const insert = await admin
    .from(SHARED)
    .insert({
      channel_id: channelId,
      shared_by_ref: myRef,
      artifact_type: artifactType,
      artifact_id: artifactId,
      title: (input.title ?? '').trim(),
      location_ref: input.locationRef ? String(input.locationRef).trim() : null,
      relationship,
      rights: normalizeRights(input.rights),
    })
    .select('*')
    .single();
  if (insert.error) {
    if (insert.error.message.includes(SHARED)) {
      return { ok: false, code: 'migration_pending', error: 'peer shared-artifact table not provisioned — apply 20260805100000.' };
    }
    return { ok: false, error: insert.error.message };
  }
  const shared = rowToSharedArtifact(insert.data as Record<string, unknown>, myRef);
  await writePeerReceipt(callerPersonaId, 'qubetalk_artifact_shared', {
    channelId,
    counterpartyRef: channel.counterpartyRef,
    artifactRowId: shared.id,
    artifactType: shared.artifactType,
    rights: shared.rights,
    summary: `Shared ${shared.artifactType}${shared.title ? ` "${shared.title}"` : ''} into a QubeTalk peer channel (${shared.relationship})`,
  });
  return { ok: true, value: shared };
}

/** List artifacts shared into a channel the caller is a principal of, newest first. */
export async function listSharedArtifacts(
  callerPersonaId: string,
  channelId: string,
): Promise<PeerResult<SharedArtifact[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const myRef = personaPublicRef(callerPersonaId);

  const channel = await loadOwnedChannel(admin, channelId, myRef);
  if (!channel) return { ok: false, error: 'channel not found or caller is not a principal', code: 'not_found' };

  const { data, error } = await admin
    .from(SHARED)
    .select('*')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false });
  if (error) {
    if (error.message.includes(SHARED)) return { ok: false, code: 'migration_pending', error: 'peer shared-artifact table not provisioned — apply 20260805100000.' };
    return { ok: false, error: error.message };
  }
  return { ok: true, value: (data ?? []).map((r) => rowToSharedArtifact(r as Record<string, unknown>, myRef)) };
}

/**
 * Mark a shared artifact as OPENED by the recipient (a recipient-pull act — the
 * sharer opening their own share is not consequential and is a no-op receipt).
 * Idempotent: `opened_at` is stamped once; the consequential `opened` receipt is
 * written only on the first open.
 */
export async function markArtifactOpened(
  callerPersonaId: string,
  channelId: string,
  artifactId: string,
): Promise<PeerResult<SharedArtifact>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const myRef = personaPublicRef(callerPersonaId);

  const channel = await loadOwnedChannel(admin, channelId, myRef);
  if (!channel) return { ok: false, error: 'channel not found or caller is not a principal', code: 'not_found' };

  const { data: row, error: loadErr } = await admin
    .from(SHARED)
    .select('*')
    .eq('id', artifactId)
    .eq('channel_id', channelId)
    .maybeSingle();
  if (loadErr) {
    if (loadErr.message.includes(SHARED)) return { ok: false, code: 'migration_pending', error: 'peer shared-artifact table not provisioned — apply 20260805100000.' };
    return { ok: false, error: loadErr.message };
  }
  if (!row) return { ok: false, error: 'shared artifact not found in this channel', code: 'not_found' };

  const shared = rowToSharedArtifact(row as Record<string, unknown>, myRef);
  // The sharer viewing their own share is not a consequential "opened" event.
  if (shared.mine) return { ok: true, value: shared };
  // Already opened → idempotent, no second receipt.
  if (shared.openedAt) return { ok: true, value: shared };

  const stamp = await admin
    .from(SHARED)
    .update({ opened_at: new Date().toISOString() })
    .eq('id', artifactId)
    .eq('channel_id', channelId)
    .is('opened_at', null)
    .select('*')
    .maybeSingle();
  const stampedRow = (stamp.data as Record<string, unknown> | null) ?? { ...row, opened_at: new Date().toISOString() };

  await writePeerReceipt(callerPersonaId, 'qubetalk_artifact_opened', {
    channelId,
    counterpartyRef: channel.counterpartyRef,
    artifactRowId: shared.id,
    artifactType: shared.artifactType,
    summary: `Opened ${shared.artifactType}${shared.title ? ` "${shared.title}"` : ''} shared into a QubeTalk peer channel`,
  });

  return { ok: true, value: rowToSharedArtifact(stampedRow, myRef) };
}

export interface CopiedToLocker {
  artifact: SharedArtifact;
  lockerItemId: string;
  lockerDisplayName: string;
  storageMode: string;
  note?: string;
}

/**
 * Materialise a shared artifact into the RECIPIENT's locker (a recipient-pull
 * action: only the counterparty — never the sharer — copies into their own
 * vault; the caller's UUID is known from their own auth). Gated on
 * `rights.copyToLocker`. Idempotent: a second call returns the existing copy.
 *
 * What lands in the locker is a **provenance manifest** (the artifact reference,
 * its channel, the sharer's public ref, the granted rights) — not the artifact
 * bytes. Byte materialisation is deferred so gated-content exposure rules are
 * never bypassed here; the manifest is the auditable record that the recipient
 * accepted the share into their vault under the stated rights.
 */
export async function copyToLocker(
  callerPersonaId: string,
  channelId: string,
  artifactId: string,
): Promise<PeerResult<CopiedToLocker>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const myRef = personaPublicRef(callerPersonaId);

  const channel = await loadOwnedChannel(admin, channelId, myRef);
  if (!channel) return { ok: false, error: 'channel not found or caller is not a principal', code: 'not_found' };

  const { data: row, error: loadErr } = await admin
    .from(SHARED)
    .select('*')
    .eq('id', artifactId)
    .eq('channel_id', channelId)
    .maybeSingle();
  if (loadErr) {
    if (loadErr.message.includes(SHARED)) return { ok: false, code: 'migration_pending', error: 'peer shared-artifact table not provisioned — apply 20260805100000.' };
    return { ok: false, error: loadErr.message };
  }
  if (!row) return { ok: false, error: 'shared artifact not found in this channel', code: 'not_found' };

  const shared = rowToSharedArtifact(row as Record<string, unknown>, myRef);

  // The sharer cannot copy their own share into a locker via this path — it is a
  // recipient acceptance action.
  if (shared.mine) return { ok: false, error: 'the sharer cannot copy their own share; this is a recipient action', code: 'forbidden' };
  if (!shared.rights.copyToLocker) {
    return { ok: false, error: 'copy-to-locker was not granted for this artifact', code: 'not_granted' };
  }

  // Idempotent — a prior copy is returned, not duplicated.
  if (shared.copiedToLockerAt) {
    return {
      ok: true,
      value: {
        artifact: shared,
        lockerItemId: '',
        lockerDisplayName: shared.title || shared.artifactType,
        storageMode: 'existing',
        note: 'already copied to locker',
      },
    };
  }

  const manifest = {
    kind: 'qubetalk_shared_artifact_manifest',
    version: 1,
    channelId,
    sharedArtifactId: shared.id,
    artifactType: shared.artifactType,
    artifactId: shared.artifactId,
    title: shared.title,
    locationRef: shared.locationRef,
    relationship: shared.relationship,
    sharedByRef: shared.sharedByRef,
    acceptedByRef: myRef,
    rights: shared.rights,
    sharedAt: shared.createdAt,
  };

  const displayName = shared.title?.trim() || `${shared.artifactType} (via QubeTalk)`;
  const added = await addLockerItemForPersona(callerPersonaId, {
    displayName,
    contentType: 'application/vnd.qubetalk.shared-artifact+json',
    plaintext: JSON.stringify(manifest, null, 2),
    // The recipient may re-export the manifest of what they accepted; the
    // rights envelope still governs the underlying artifact bytes.
    downloadable: shared.rights.download === true,
  });
  if (!added.ok) return { ok: false, error: added.error, code: added.code };

  const stamp = await admin
    .from(SHARED)
    .update({ copied_to_locker_at: new Date().toISOString() })
    .eq('id', artifactId)
    .eq('channel_id', channelId)
    .is('copied_to_locker_at', null)
    .select('*')
    .maybeSingle();
  const stampedRow = (stamp.data as Record<string, unknown> | null) ?? { ...row, copied_to_locker_at: new Date().toISOString() };

  await writePeerReceipt(callerPersonaId, 'qubetalk_artifact_copied', {
    channelId,
    counterpartyRef: channel.counterpartyRef,
    artifactRowId: shared.id,
    artifactType: shared.artifactType,
    rights: shared.rights,
    summary: `Copied ${shared.artifactType}${shared.title ? ` "${shared.title}"` : ''} from a QubeTalk peer channel into own locker`,
  });

  return {
    ok: true,
    value: {
      artifact: rowToSharedArtifact(stampedRow, myRef),
      lockerItemId: added.item.itemId,
      lockerDisplayName: added.item.displayName,
      storageMode: added.item.storageMode,
      note: added.note,
    },
  };
}

/** The caller's own Polity Public Reference — the handle a counterparty needs. */
export function callerPublicRef(callerPersonaId: string): string {
  return personaPublicRef(callerPersonaId);
}
