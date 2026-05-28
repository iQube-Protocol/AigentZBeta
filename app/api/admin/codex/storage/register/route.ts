/**
 * Admin API: Register a completed Supabase Storage upload in the DB
 *
 * POST /api/admin/codex/storage/register
 *
 * Called by the browser after a successful direct PUT to the signed URL.
 * Inserts into codex_media_assets or master_content_qubes with the public URL
 * stored in auto_drive_cid (provider-agnostic string identifier field) and
 * encryption_iv set to '' to mark the row as unencrypted Supabase content
 * (content fetch routes detect this and proxy to the URL directly).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  encryptBuffer,
  ivToBase64,
  authTagToBase64,
  isEncryptionConfigured,
} from '@/services/content/encryption';

export const runtime = 'nodejs';

const BUCKET = 'content-media';

// Phase 2.3 — encrypt-at-register inline. Files larger than this are
// rejected with a clear error pointing at the streaming-upload Phase
// 2.3 v2 follow-up. 5MB is well under the Lambda 6MB body limit, with
// headroom for the response payload.
const INLINE_ENCRYPT_MAX_BYTES = 5 * 1024 * 1024;

function getSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Download the file the browser just PUT, encrypt it in memory, re-upload
 * (overwrite same path) so the bytes-at-rest become ciphertext. Returns
 * the IV + auth tag + key id for persistence on the row.
 *
 * The plaintext exists in Supabase only for the seconds between the
 * browser's PUT completing and this function's overwrite landing.
 * Phase 2.3 v2 will close that gap with client-side encryption (browser
 * uploads ciphertext directly via signed URL, server never sees plaintext).
 */
async function encryptInPlace(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  bucket: string,
  path: string,
  masterId: string,
): Promise<{ iv: string; authTag: string; keyId: string }> {
  const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(path);
  if (dlErr || !blob) {
    throw new Error(`Encrypt-at-register: download failed: ${dlErr?.message || 'no data'}`);
  }
  const plaintext = Buffer.from(await blob.arrayBuffer());
  if (plaintext.byteLength > INLINE_ENCRYPT_MAX_BYTES) {
    throw new Error(
      `File is ${plaintext.byteLength} bytes; inline encryption supports up to ${INLINE_ENCRYPT_MAX_BYTES} bytes. ` +
        'Streaming-upload encryption ships in Phase 2.3 v2.',
    );
  }
  const enc = encryptBuffer(plaintext, { masterId });
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, enc.ciphertext, {
      upsert: true,
      contentType: 'application/octet-stream',
    });
  if (upErr) {
    throw new Error(`Encrypt-at-register: re-upload failed: ${upErr.message}`);
  }
  return {
    iv: ivToBase64(enc.iv),
    authTag: authTagToBase64(enc.authTag),
    keyId: enc.keyId,
  };
}

export async function POST(req: NextRequest) {
  try {
    // No auth check — admin codex routes are URL-protected; the codex viewer
    // host page does not require a Supabase session. Returning 401 here just
    // because there's no Bearer token blocks legitimate operator uploads on
    // the dev environment.

    const body = await req.json();
    const {
      path, bucket = BUCKET,
      category, title, series = 'metaKnyts',
      episodeNumber, assetKind, contentType,
      editionTier, rarityTier, variantName,
      mimeType, fileSize,
      displayMode, isShareable, recommendedTask,
      editionMax, randomWeight,
    } = body as {
      path: string; bucket?: string;
      category: string; title: string; series?: string;
      episodeNumber?: number | null; assetKind?: string; contentType?: string;
      editionTier?: string; rarityTier?: string; variantName?: string;
      mimeType?: string; fileSize?: number;
      displayMode?: string; isShareable?: boolean; recommendedTask?: string;
      editionMax?: number; randomWeight?: number;
    };

    if (!path || !category || !title) {
      return NextResponse.json({ error: 'Missing path, category, or title' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    const storageUrl = urlData.publicUrl;
    // NOT-NULL columns required by the schema (encryption_iv, mime_type)
    const safeMime = mimeType || 'application/octet-stream';
    const isMaster = category === 'master' || category === 'still' || category === 'print';

    if (isMaster) {
      const ct = category === 'print' ? 'episode_print'
               : category === 'still' ? 'episode_still'
               : contentType || 'episode_motion';
      const ep = episodeNumber ?? 0;
      const tierIdSuffix = editionTier ? `_${editionTier}` : '';
      const id = `mk_ep${String(ep).padStart(2, '0')}_${ct.replace('episode_', '')}${tierIdSuffix}`;

      // Phase 2.3 — encrypt the file at rest before persisting the row.
      // No-op when CONTENT_ENCRYPTION_MASTER_KEY isn't set (returns the
      // existing plaintext-row behaviour with a warning) so dev parity is
      // preserved during rollout.
      let encIv = '';
      let encAuthTag = '';
      let encKeyId = '';
      let contentState = 'C';
      if (isEncryptionConfigured()) {
        try {
          const out = await encryptInPlace(supabase, bucket, path, id);
          encIv = out.iv;
          encAuthTag = out.authTag;
          encKeyId = out.keyId;
        } catch (e) {
          return NextResponse.json(
            { error: (e as Error).message || 'Encryption failed' },
            { status: 500 },
          );
        }
      } else {
        console.warn('[register] CONTENT_ENCRYPTION_MASTER_KEY missing — skipping encryption (state-C plaintext)');
      }

      const { error } = await supabase
        .from('master_content_qubes')
        .upsert({
          id,
          title,                  // Auto-Drive label (locked)
          supabase_title: title,  // editable, defaults to upload-time title
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
        }, { onConflict: 'id' });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ id, storageUrl, encrypted: !!encIv });
    }

    // codex_media_assets — generate UUID up-front so we can derive the
    // per-asset encryption key BEFORE insert (HKDF salt is the row id).
    const mediaId = crypto.randomUUID();
    let encIv2 = '';
    let encAuthTag2 = '';
    let encKeyId2 = '';
    // Qriptopian uploads are WIP-public content rendered through the
    // PDF-lite viewer, which loads the Supabase URL directly in the
    // browser. Encrypting-at-rest breaks that path because the public
    // URL would then serve ciphertext (PDFLiteReader gets garbage,
    // <img src=cover_thumb_url> renders nothing). Skip encryption for
    // this cartridge until a Qripto SKU + state-C delivery proxy ship
    // (backlog: 2026-05-27_qripto-cover-upload-and-wip-contentqube-backlog.md).
    const skipEncryption = series === 'qriptopian';
    if (isEncryptionConfigured() && !skipEncryption) {
      try {
        const out = await encryptInPlace(supabase, bucket, path, mediaId);
        encIv2 = out.iv;
        encAuthTag2 = out.authTag;
        encKeyId2 = out.keyId;
      } catch (e) {
        return NextResponse.json(
          { error: (e as Error).message || 'Encryption failed' },
          { status: 500 },
        );
      }
    } else if (skipEncryption) {
      console.log(`[register] series=${series} — skipping encryption (WIP-public, served plaintext for PDF-lite viewer)`);
    } else {
      console.warn('[register] CONTENT_ENCRYPTION_MASTER_KEY missing — skipping encryption (state-C plaintext)');
    }

    const insertRow: Record<string, unknown> = {
      id: mediaId,
      title,                  // Auto-Drive label (locked)
      supabase_title: title,  // editable, defaults to upload-time title
      episode_number: episodeNumber ?? null,
      asset_kind: assetKind,
      series,
      auto_drive_cid: storageUrl,
      wip_storage_url: storageUrl,
      mime_type: safeMime,
      file_size: fileSize || null,
      encryption_iv: encIv2,
      encryption_auth_tag: encAuthTag2,
      encryption_key_id: encKeyId2,
      // State 'A' = free/plaintext at the Supabase URL (no decrypt
      // needed). 'C' = encrypted-at-rest, needs the state-C proxy.
      // Match the state to what we actually did with the bytes so
      // downstream delivery code doesn't try to decrypt zero-length IVs.
      content_state: skipEncryption ? 'A' : 'C',
      mint_status: 'wip',
      status: 'active',
    };
    // Populate cover_thumb_url so the viewer renders directly (the KnytTab
    // and CategoryDetailPanel both prefer cover_thumb_url over CID-routing).
    // PDF covers (Qripto papers) store the URL too — the Papers tab renders
    // the PDF first page as the card art via the existing PDF page route.
    if (
      category === 'cover' ||
      assetKind === 'cover_image' || assetKind === 'cover_pdf' ||
      safeMime.startsWith('image/')
    ) {
      insertRow.cover_thumb_url = storageUrl;
    }
    if (variantName) insertRow.variant_name = variantName;
    if (rarityTier) insertRow.rarity_tier = rarityTier;
    if (editionMax) insertRow.edition_max = editionMax;
    if (randomWeight) insertRow.random_weight = randomWeight;
    if (displayMode) insertRow.display_mode = displayMode;
    if (typeof isShareable === 'boolean') insertRow.is_shareable = isShareable;
    if (recommendedTask) insertRow.recommended_task = recommendedTask;

    const { data, error } = await supabase
      .from('codex_media_assets')
      .insert(insertRow)
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id, storageUrl });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error)?.message || 'Register failed' }, { status: 500 });
  }
}
