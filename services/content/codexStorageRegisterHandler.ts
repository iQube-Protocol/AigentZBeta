/**
 * codexStorageRegisterHandler — the shared core of
 * `POST /api/admin/codex/storage/register` (2026-09-02 authorization
 * repair). Extracted so the route can be gated by `requireAdminPersona`
 * without entangling the auth check with the (already substantial)
 * register/encrypt-at-register logic. Unlike upload-asset, this route has
 * exactly one caller class (CodexUploadModal.tsx, this app and
 * apps/theqriptopian-web's copy — both already send a real Supabase bearer
 * token when signed in) — no Threshold in-process caller exists for this
 * path, so no second entry point is needed here.
 */

import { createClient } from '@supabase/supabase-js';
import {
  encryptBuffer,
  ivToBase64,
  authTagToBase64,
  isEncryptionConfigured,
} from '@/services/content/encryption';

const BUCKET = 'content-media';

// Phase 2.3 — encrypt-at-register inline. Files larger than this are
// rejected with a clear error pointing at the streaming-upload Phase
// 2.3 v2 follow-up. 5MB is well under the Lambda 6MB body limit, with
// headroom for the response payload.
const INLINE_ENCRYPT_MAX_BYTES = 5 * 1024 * 1024;

export class CodexStorageRegisterError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function getSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function encryptInPlace(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  bucket: string,
  path: string,
  masterId: string,
): Promise<{ iv: string; authTag: string; keyId: string }> {
  const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(path);
  if (dlErr || !blob) {
    throw new CodexStorageRegisterError(`Encrypt-at-register: download failed: ${dlErr?.message || 'no data'}`, 500);
  }
  const plaintext = Buffer.from(await blob.arrayBuffer());
  if (plaintext.byteLength > INLINE_ENCRYPT_MAX_BYTES) {
    throw new CodexStorageRegisterError(
      `File is ${plaintext.byteLength} bytes; inline encryption supports up to ${INLINE_ENCRYPT_MAX_BYTES} bytes. ` +
        'Streaming-upload encryption ships in Phase 2.3 v2.',
      400,
    );
  }
  const enc = encryptBuffer(plaintext, { masterId });
  const { error: upErr } = await supabase.storage.from(bucket).upload(path, enc.ciphertext, {
    upsert: true,
    contentType: 'application/octet-stream',
  });
  if (upErr) {
    throw new CodexStorageRegisterError(`Encrypt-at-register: re-upload failed: ${upErr.message}`, 500);
  }
  return { iv: ivToBase64(enc.iv), authTag: authTagToBase64(enc.authTag), keyId: enc.keyId };
}

export interface CodexStorageRegisterInput {
  path: string;
  bucket?: string;
  category: string;
  title: string;
  series?: string;
  seriesScope?: string;
  episodeNumber?: number | null;
  assetKind?: string;
  contentType?: string;
  editionTier?: string;
  rarityTier?: string;
  variantName?: string;
  mimeType?: string;
  fileSize?: number;
  displayMode?: string;
  isShareable?: boolean;
  recommendedTask?: string;
  editionMax?: number;
  randomWeight?: number;
}

export async function handleCodexStorageRegister(
  body: CodexStorageRegisterInput,
): Promise<{ id: string; storageUrl: string; encrypted?: boolean }> {
  const {
    path, bucket = BUCKET,
    category, title, series = 'metaKnyts',
    seriesScope,
    episodeNumber, assetKind, contentType,
    editionTier, rarityTier, variantName,
    mimeType, fileSize,
    displayMode, isShareable, recommendedTask,
    editionMax, randomWeight,
  } = body;

  if (!path || !category || !title) {
    throw new CodexStorageRegisterError('Missing path, category, or title', 400);
  }

  const supabase = getSupabaseServiceClient();
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  const storageUrl = urlData.publicUrl;
  const safeMime = mimeType || 'application/octet-stream';
  const isMaster = category === 'master' || category === 'still' || category === 'print';

  if (isMaster) {
    const ct = category === 'print' ? 'episode_print' : category === 'still' ? 'episode_still' : contentType || 'episode_motion';
    const ep = episodeNumber ?? 0;
    const tierIdSuffix = editionTier ? `_${editionTier}` : '';
    const id = `mk_ep${String(ep).padStart(2, '0')}_${ct.replace('episode_', '')}${tierIdSuffix}`;

    let encIv = '';
    let encAuthTag = '';
    let encKeyId = '';
    let contentState = 'C';
    if (isEncryptionConfigured()) {
      const out = await encryptInPlace(supabase, bucket, path, id);
      encIv = out.iv;
      encAuthTag = out.authTag;
      encKeyId = out.keyId;
    } else {
      console.warn('[register] CONTENT_ENCRYPTION_MASTER_KEY missing — skipping encryption (state-C plaintext)');
    }

    const { error } = await supabase
      .from('master_content_qubes')
      .upsert(
        {
          id,
          title,
          supabase_title: title,
          episode_number: ep,
          content_type: ct,
          series,
          edition_tier: editionTier || null,
          auto_drive_cid: storageUrl,
          wip_storage_url: storageUrl,
          mime_type: safeMime,
          file_size: fileSize || null,
          encryption_iv: encIv,
          encryption_auth_tag: encAuthTag,
          encryption_key_id: encKeyId,
          content_state: contentState,
          mint_status: 'wip',
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
    if (error) throw new CodexStorageRegisterError(error.message, 500);
    return { id, storageUrl, encrypted: !!encIv };
  }

  const mediaId = crypto.randomUUID();
  let encIv2 = '';
  let encAuthTag2 = '';
  let encKeyId2 = '';
  // 'bridge' (2026-09-02, QRP-BRIDGE-ADMIN A2 asset picker): CI/KNYTS bridge
  // media (video/poster/infographic) is served directly by <video>/<img> to
  // UNAUTHENTICATED visitors on a public marketing page — encrypting it in
  // place would leave `storageUrl` pointing at an undecryptable blob, the
  // same "WIP-public, served plaintext" reasoning 'qriptopian' already gets.
  const skipEncryption = series === 'qriptopian' || series === 'bridge';
  if (isEncryptionConfigured() && !skipEncryption) {
    const out = await encryptInPlace(supabase, bucket, path, mediaId);
    encIv2 = out.iv;
    encAuthTag2 = out.authTag;
    encKeyId2 = out.keyId;
  } else if (skipEncryption) {
    console.log(`[register] series=${series} — skipping encryption (WIP-public, served plaintext for PDF-lite viewer)`);
  } else {
    console.warn('[register] CONTENT_ENCRYPTION_MASTER_KEY missing — skipping encryption (state-C plaintext)');
  }

  const insertRow: Record<string, unknown> = {
    id: mediaId,
    title,
    supabase_title: title,
    episode_number: episodeNumber ?? null,
    asset_kind: assetKind,
    series,
    series_scope: seriesScope || null,
    auto_drive_cid: storageUrl,
    wip_storage_url: storageUrl,
    mime_type: safeMime,
    file_size: fileSize || null,
    encryption_iv: encIv2,
    encryption_auth_tag: encAuthTag2,
    encryption_key_id: encKeyId2,
    content_state: skipEncryption ? 'A' : 'C',
    mint_status: 'wip',
    status: 'active',
  };
  if (category === 'cover' || assetKind === 'cover_image' || assetKind === 'cover_pdf' || safeMime.startsWith('image/')) {
    insertRow.cover_thumb_url = storageUrl;
  }
  if (variantName) insertRow.variant_name = variantName;
  if (rarityTier) insertRow.rarity_tier = rarityTier;
  if (editionMax) insertRow.edition_max = editionMax;
  if (randomWeight) insertRow.random_weight = randomWeight;
  if (displayMode) insertRow.display_mode = displayMode;
  if (typeof isShareable === 'boolean') insertRow.is_shareable = isShareable;
  if (recommendedTask) insertRow.recommended_task = recommendedTask;

  const { data, error } = await supabase.from('codex_media_assets').insert(insertRow).select('id').single();
  if (error) throw new CodexStorageRegisterError(error.message, 500);
  return { id: data.id, storageUrl };
}
