/**
 * Share Pack — recipient/purpose-specific delivery manifests (spec §5.6,
 * §7.4, §14, §16.6).
 *
 * Phase 1 delivery channel: email only. Reuses the SAME live Mailjet REST
 * endpoint/credentials services/campaign/adapters/mailjetAdapter.ts already
 * sends through (MAILJET_API_KEY/MAILJET_SECRET_KEY/MAILJET_FROM_EMAIL/
 * MAILJET_FROM_NAME) — but calls it directly with a one-off TextPart/
 * HTMLPart body (mirroring that file's own `sendBccSummary` helper) rather
 * than through `mailjetAdapter.send()`, whose ChannelPayload/TemplateID
 * shape is built for campaign batch sends against `nakamoto_knyt_personas`
 * recipients and per-sequence Mailjet templates — it does not fit a single
 * named recipient with a free-form message + governed asset links. This is
 * a second CALL SITE against the same Mailjet endpoint/credentials, not a
 * second email service (the file's own sendBccSummary already establishes
 * that pattern for a non-templated, single-purpose send).
 *
 * Governed links (spec §4.7/§15.3): every SharePackItem gets an
 * access_token; the email body links to /api/locker/share/[token], never a
 * raw storage URL — mirroring CLAUDE.md's Gated Content proxy discipline.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import type {
  SharePack, SharePackItem, DeliveryChannel, DeliveryMode, AuthorizationState, PeerResult,
} from '@/types/locker';

const MAILJET_API_URL = 'https://api.mailjet.com/v3.1/send';

function admin() {
  const client = getSupabaseServer();
  if (!client) throw new Error('Supabase configuration missing for Share Pack service');
  return client;
}

// ─────────────────────────────────────────────────────────────────────────
// Row <-> domain mapping.
// ─────────────────────────────────────────────────────────────────────────

interface PackRow {
  id: string;
  title: string;
  purpose: string;
  owner_persona_id: string;
  recipient_refs: string[] | null;
  source_roomqube_ids: string[] | null;
  delivery_channel: DeliveryChannel;
  message_draft: string | null;
  access_policy: Record<string, unknown> | null;
  authorization_state: AuthorizationState;
  approved_by_persona_id: string | null;
  approved_at: string | null;
  communication_receipt_id: string | null;
  created_at: string;
  sent_at: string | null;
}

function rowToPack(row: PackRow): SharePack {
  return {
    id: row.id,
    title: row.title,
    purpose: row.purpose,
    ownerPersonaId: row.owner_persona_id,
    recipientRefs: row.recipient_refs ?? [],
    sourceRoomQubeIds: row.source_roomqube_ids ?? [],
    deliveryChannel: row.delivery_channel,
    messageDraft: row.message_draft,
    accessPolicy: row.access_policy ?? {},
    authorizationState: row.authorization_state,
    approvedByPersonaId: row.approved_by_persona_id,
    approvedAt: row.approved_at,
    communicationReceiptId: row.communication_receipt_id,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  };
}

interface ItemRow {
  id: string;
  share_pack_id: string;
  asset_id: string;
  pinned_version_asset_id: string | null;
  rendition_id: string | null;
  delivery_mode: DeliveryMode;
  resolved_hash: string | null;
  display_order: number;
  access_token: string;
}

function rowToItem(row: ItemRow): SharePackItem {
  return {
    id: row.id,
    sharePackId: row.share_pack_id,
    assetId: row.asset_id,
    pinnedVersionAssetId: row.pinned_version_asset_id,
    renditionId: row.rendition_id,
    deliveryMode: row.delivery_mode,
    resolvedHash: row.resolved_hash,
    order: row.display_order,
    accessToken: row.access_token,
  };
}

async function assertOwnsPack(
  db: ReturnType<typeof getSupabaseServer>,
  sharePackId: string,
  callerPersonaId: string,
): Promise<PeerResult<PackRow>> {
  if (!db) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await db.from('share_packs').select('*').eq('id', sharePackId).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'share pack not found', code: 'not_found' };
  const row = data as PackRow;
  if (row.owner_persona_id !== callerPersonaId) {
    return { ok: false, error: 'caller does not own this share pack', code: 'forbidden' };
  }
  return { ok: true, value: row };
}

// ─────────────────────────────────────────────────────────────────────────
// Compose (spec §14.1, §16.6 composeSharePack).
// ─────────────────────────────────────────────────────────────────────────

export interface ComposeSharePackInput {
  ownerPersonaId: string;
  title: string;
  purpose?: string;
  recipientRefs: string[];
  sourceRoomQubeIds?: string[];
  deliveryChannel?: DeliveryChannel;
  messageDraft?: string;
  items: Array<{ assetId: string; deliveryMode?: DeliveryMode }>;
}

export async function composeSharePack(input: ComposeSharePackInput): Promise<PeerResult<SharePack>> {
  if (!input.ownerPersonaId) return { ok: false, error: 'ownerPersonaId required' };
  if (!input.title.trim()) return { ok: false, error: 'title required' };
  if (input.recipientRefs.length === 0) return { ok: false, error: 'at least one recipient is required' };
  if (input.items.length === 0) return { ok: false, error: 'at least one asset is required' };

  const db = admin();
  const { data, error } = await db
    .from('share_packs')
    .insert({
      title: input.title.trim(),
      purpose: input.purpose ?? '',
      owner_persona_id: input.ownerPersonaId,
      recipient_refs: input.recipientRefs,
      source_roomqube_ids: input.sourceRoomQubeIds ?? [],
      delivery_channel: input.deliveryChannel ?? 'email',
      message_draft: input.messageDraft ?? null,
      authorization_state: 'draft',
    })
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'insert failed' };
  const pack = rowToPack(data as PackRow);

  const { error: itemsErr } = await db.from('share_pack_items').insert(
    input.items.map((item, index) => ({
      share_pack_id: pack.id,
      asset_id: item.assetId,
      delivery_mode: item.deliveryMode ?? 'link',
      display_order: index,
    })),
  );
  if (itemsErr) return { ok: false, error: itemsErr.message };

  await createActivityReceipt({
    personaId: input.ownerPersonaId,
    activeCartridge: 'locker',
    actionType: 'locker_share_pack_composed',
    summary: `Composed Share Pack "${pack.title}" for ${input.recipientRefs.length} recipient(s)`,
    artifactsCreated: [pack.id],
  }).catch((err) => console.warn('[Locker] composeSharePack receipt failed (non-fatal):', err instanceof Error ? err.message : err));

  return { ok: true, value: pack };
}

export interface ResolvedSharePack {
  pack: SharePack;
  items: SharePackItem[];
}

/** spec §14.2 approval preview — exact recipients, assets/versions,
 *  delivery modes, before anything is ever sent. */
export async function previewSharePack(sharePackId: string, callerPersonaId: string): Promise<PeerResult<ResolvedSharePack>> {
  const db = admin();
  const owned = await assertOwnsPack(db, sharePackId, callerPersonaId);
  if (!owned.ok) return owned;
  const { data, error } = await db.from('share_pack_items').select('*').eq('share_pack_id', sharePackId).order('display_order', { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: { pack: rowToPack(owned.value), items: ((data as ItemRow[] | null) ?? []).map(rowToItem) } };
}

// ─────────────────────────────────────────────────────────────────────────
// Approve — resolves every follow-current placement and PINS the exact
// version/rendition at this moment (spec §14.3 steps 1-2, §4.5). Once
// approved, later "current" changes never rewrite this pack (acceptance #27).
// ─────────────────────────────────────────────────────────────────────────

export async function approveSharePack(sharePackId: string, callerPersonaId: string): Promise<PeerResult<SharePack>> {
  const db = admin();
  const owned = await assertOwnsPack(db, sharePackId, callerPersonaId);
  if (!owned.ok) return owned;
  if (owned.value.authorization_state !== 'draft' && owned.value.authorization_state !== 'proposed') {
    return { ok: false, error: `cannot approve a share pack in state '${owned.value.authorization_state}'`, code: 'invalid_state' };
  }

  const { data: itemRows, error: itemsErr } = await db.from('share_pack_items').select('*').eq('share_pack_id', sharePackId);
  if (itemsErr) return { ok: false, error: itemsErr.message };

  // Confidential-asset gate (spec §12.2/acceptance #28): approving IS the
  // human authorization step for sharing a confidential/restricted asset
  // outside the platform — refuse if any item's asset carries a sensitivity
  // that requires an explicit sharing_status of 'approved-to-share'.
  for (const item of (itemRows as ItemRow[] | null) ?? []) {
    const { data: assetRow } = await db.from('asset_records').select('sensitivity, sharing_status').eq('id', item.asset_id).maybeSingle();
    const asset = assetRow as { sensitivity: string | null; sharing_status: string } | null;
    if (asset && (asset.sensitivity === 'restricted' || asset.sensitivity === 'legal' || asset.sensitivity === 'financial') && asset.sharing_status !== 'approved-to-share') {
      return {
        ok: false,
        error: `asset ${item.asset_id} is '${asset.sensitivity}' and not marked approved-to-share — mark it approved-to-share before sending`,
        code: 'authority_required',
      };
    }
  }

  // Pin: for each item, resolve the asset's CURRENT version-family member
  // and its primary rendition, right now.
  for (const item of (itemRows as ItemRow[] | null) ?? []) {
    const { data: assetRow } = await db.from('asset_records').select('version_family_id').eq('id', item.asset_id).maybeSingle();
    const familyId = (assetRow as { version_family_id: string } | null)?.version_family_id;
    let pinnedAssetId = item.asset_id;
    if (familyId) {
      const { data: currentRow } = await db
        .from('asset_records')
        .select('id')
        .eq('version_family_id', familyId)
        .eq('lifecycle_status', 'current')
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (currentRow) pinnedAssetId = (currentRow as { id: string }).id;
    }
    const { data: renditionRow } = await db
      .from('asset_renditions')
      .select('id, content_hash')
      .eq('asset_id', pinnedAssetId)
      .eq('is_primary', true)
      .maybeSingle();
    const rendition = renditionRow as { id: string; content_hash: string | null } | null;
    await db
      .from('share_pack_items')
      .update({
        pinned_version_asset_id: pinnedAssetId,
        rendition_id: rendition?.id ?? null,
        resolved_hash: rendition?.content_hash ?? null,
      })
      .eq('id', item.id);
  }

  const { data, error } = await db
    .from('share_packs')
    .update({ authorization_state: 'approved', approved_by_persona_id: callerPersonaId, approved_at: new Date().toISOString() })
    .eq('id', sharePackId)
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'update failed' };

  await createActivityReceipt({
    personaId: callerPersonaId,
    activeCartridge: 'locker',
    actionType: 'locker_share_pack_approved',
    summary: `Approved Share Pack "${owned.value.title}" — versions pinned`,
    artifactsCreated: [sharePackId],
    approvalsGranted: [sharePackId],
  }).catch((err) => console.warn('[Locker] approveSharePack receipt failed (non-fatal):', err instanceof Error ? err.message : err));

  return { ok: true, value: rowToPack(data as PackRow) };
}

// ─────────────────────────────────────────────────────────────────────────
// Send (spec §14.3 steps 4-6, §14.4 communication receipt). Email channel
// only for Phase 1 — 'qubetalk' delivery (post into a RoomQube conversation)
// is schema-ready but deferred, see the Phase 1 closeout.
// ─────────────────────────────────────────────────────────────────────────

function basicAuth(): string {
  const key = process.env.MAILJET_API_KEY ?? '';
  const secret = process.env.MAILJET_SECRET_KEY ?? '';
  return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
}

function buildEmailBody(pack: SharePack, items: SharePackItem[], appUrl: string): { text: string; html: string } {
  const lines = items.map((it) => `- ${appUrl}/api/locker/share/${it.accessToken}`);
  const text = `${pack.messageDraft ?? ''}\n\n${lines.join('\n')}`.trim();
  const html = `<p>${(pack.messageDraft ?? '').replace(/\n/g, '<br/>')}</p><ul>${items
    .map((it) => `<li><a href="${appUrl}/api/locker/share/${it.accessToken}">View item</a></li>`)
    .join('')}</ul>`;
  return { text, html };
}

export async function sendSharePack(sharePackId: string, callerPersonaId: string): Promise<PeerResult<SharePack>> {
  const db = admin();
  const owned = await assertOwnsPack(db, sharePackId, callerPersonaId);
  if (!owned.ok) return owned;
  if (owned.value.authorization_state !== 'approved') {
    return { ok: false, error: `share pack must be 'approved' before sending (currently '${owned.value.authorization_state}')`, code: 'invalid_state' };
  }
  if (owned.value.delivery_channel !== 'email') {
    return { ok: false, error: `delivery channel '${owned.value.delivery_channel}' is not implemented in Phase 1 — only 'email' sends`, code: 'channel_not_implemented' };
  }

  const { data: itemRows, error: itemsErr } = await db.from('share_pack_items').select('*').eq('share_pack_id', sharePackId);
  if (itemsErr) return { ok: false, error: itemsErr.message };
  const items = ((itemRows as ItemRow[] | null) ?? []).map(rowToItem);

  const apiKey = process.env.MAILJET_API_KEY;
  const secretKey = process.env.MAILJET_SECRET_KEY;
  const fromEmail = process.env.MAILJET_FROM_EMAIL;
  const fromName = process.env.MAILJET_FROM_NAME ?? 'metaMe Locker';
  if (!apiKey || !secretKey) return { ok: false, error: 'MAILJET_API_KEY / MAILJET_SECRET_KEY not configured' };
  if (!fromEmail) return { ok: false, error: 'MAILJET_FROM_EMAIL not configured' };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://dev-beta.aigentz.me';
  const pack = rowToPack(owned.value);
  const { text, html } = buildEmailBody(pack, items, appUrl);

  const res = await fetch(MAILJET_API_URL, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Messages: pack.recipientRefs.map((email) => ({
        From: { Email: fromEmail, Name: fromName },
        To: [{ Email: email }],
        Subject: pack.title,
        TextPart: text,
        HTMLPart: html,
      })),
    }),
  });

  const deliveryOutcome = res.ok ? 'delivered' : 'failed';
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    return { ok: false, error: `Mailjet send failed (HTTP ${res.status}): ${bodyText.slice(0, 300)}` };
  }

  const receipt = await createActivityReceipt({
    personaId: callerPersonaId,
    activeCartridge: 'locker',
    actionType: 'locker_share_pack_sent',
    summary: `Sent Share Pack "${pack.title}" to ${pack.recipientRefs.length} recipient(s) via email`,
    artifactsCreated: [sharePackId, ...items.map((i) => i.assetId)],
    contextShared: [`delivery:${deliveryOutcome}`, `channel:email`],
  }).catch((err) => {
    console.warn('[Locker] sendSharePack receipt failed (non-fatal):', err instanceof Error ? err.message : err);
    return null;
  });

  const { data, error } = await db
    .from('share_packs')
    .update({
      authorization_state: 'sent',
      sent_at: new Date().toISOString(),
      communication_receipt_id: receipt?.id ?? null,
    })
    .eq('id', sharePackId)
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'update failed' };
  return { ok: true, value: rowToPack(data as PackRow) };
}

export async function revokeSharePack(sharePackId: string, callerPersonaId: string): Promise<PeerResult<SharePack>> {
  const db = admin();
  const owned = await assertOwnsPack(db, sharePackId, callerPersonaId);
  if (!owned.ok) return owned;
  const { data, error } = await db.from('share_packs').update({ authorization_state: 'revoked' }).eq('id', sharePackId).select('*').single();
  if (error || !data) return { ok: false, error: error?.message ?? 'update failed' };
  return { ok: true, value: rowToPack(data as PackRow) };
}

export async function listSharePacks(ownerPersonaId: string): Promise<PeerResult<SharePack[]>> {
  if (!ownerPersonaId) return { ok: false, error: 'ownerPersonaId required' };
  const db = admin();
  const { data, error } = await db.from('share_packs').select('*').eq('owner_persona_id', ownerPersonaId).order('created_at', { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: ((data as PackRow[] | null) ?? []).map(rowToPack) };
}

/** Governed-link resolution for /api/locker/share/[token] — spec §15.3.
 *  Never returns a raw storage URL for a revoked/expired/unsent pack. */
export async function resolveShareLink(token: string): Promise<PeerResult<{ publicUrl: string; assetTitle: string }>> {
  const db = admin();
  const { data: itemRow, error: itemErr } = await db.from('share_pack_items').select('*').eq('access_token', token).maybeSingle();
  if (itemErr) return { ok: false, error: itemErr.message };
  if (!itemRow) return { ok: false, error: 'link not found', code: 'not_found' };
  const item = itemRow as ItemRow;

  const { data: packRow, error: packErr } = await db.from('share_packs').select('*').eq('id', item.share_pack_id).maybeSingle();
  if (packErr) return { ok: false, error: packErr.message };
  if (!packRow) return { ok: false, error: 'share pack not found', code: 'not_found' };
  const pack = packRow as PackRow;
  if (pack.authorization_state === 'revoked') return { ok: false, error: 'this link has been revoked', code: 'revoked' };
  if (pack.authorization_state === 'expired') return { ok: false, error: 'this link has expired', code: 'expired' };
  if (pack.authorization_state !== 'sent') return { ok: false, error: 'this link is not active', code: 'not_sent' };

  if (!item.rendition_id) return { ok: false, error: 'no rendition resolved for this item', code: 'not_found' };
  const { data: renditionRow, error: rErr } = await db.from('asset_renditions').select('public_url, storage_uri').eq('id', item.rendition_id).maybeSingle();
  if (rErr) return { ok: false, error: rErr.message };
  const rendition = renditionRow as { public_url: string | null; storage_uri: string } | null;
  if (!rendition?.public_url) return { ok: false, error: 'no accessible URL for this rendition', code: 'not_found' };

  const { data: assetRow } = await db.from('asset_records').select('title').eq('id', item.pinned_version_asset_id ?? item.asset_id).maybeSingle();

  return { ok: true, value: { publicUrl: rendition.public_url, assetTitle: (assetRow as { title: string } | null)?.title ?? 'Shared asset' } };
}
