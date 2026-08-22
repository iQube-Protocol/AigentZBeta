import { NextResponse } from 'next/server';
import { createAutoDriveApi } from '@autonomys/auto-drive';
import { NetworkId } from '@autonomys/auto-utils';
import sharp from 'sharp';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { unwrapKeyWithMasterKey, decryptContent } from '@/server/services/encryptionService';
import { assertValidImageDerivative as assertValidDerivative } from '@/server/services/imageDerivativeValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BUCKET = 'content-media';
const PREFIX = 'qriptopian/essay-covers';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: 'supabase-unavailable' }, { status: 500 });

  const { data: asset, error: assetError } = await supabase
    .from('codex_media_assets')
    .select('id,auto_drive_cid,mime_type,file_size,encryption_iv,encryption_auth_tag,token_qube_id,status,is_shareable')
    .eq('id', id)
    .eq('status', 'active')
    .maybeSingle();

  if (assetError) return NextResponse.json({ error: assetError.message }, { status: 500 });
  if (!asset) return NextResponse.json({ error: 'asset-not-found' }, { status: 404 });
  if (!asset.is_shareable) return NextResponse.json({ error: 'asset-not-shareable' }, { status: 403 });

  const objectPath = `${PREFIX}/${asset.id}.webp`;
  const { data: existing } = await supabase.storage.from(BUCKET).list(PREFIX, {
    search: `${asset.id}.webp`,
    limit: 5,
  });

  if (existing?.some((entry) => entry.name === `${asset.id}.webp`)) {
    // A filename match is not validity. Download and re-validate the cached
    // derivative itself before trusting it — a prior implementation could
    // have cached a truncated/gray-filled render, and a stale object must
    // never outrank a fresh, validated one.
    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
    try {
      const cachedResp = await fetch(publicData.publicUrl, { cache: 'no-store' });
      if (cachedResp.ok) {
        const cachedBytes = Buffer.from(await cachedResp.arrayBuffer());
        await assertValidDerivative(cachedBytes);
        return NextResponse.redirect(publicData.publicUrl, 307);
      }
      console.error('[QriptopianEssayCover] cached derivative fetch failed', id, cachedResp.status);
    } catch (error) {
      console.error('[QriptopianEssayCover] cached derivative invalid, purging', id, error instanceof Error ? error.message : error);
    }
    // Invalid or unreachable — remove it so this and any concurrent request
    // regenerates from canonical source rather than re-serving corruption.
    await supabase.storage.from(BUCKET).remove([objectPath]);
  }

  if (!asset.auto_drive_cid || !asset.encryption_iv || !asset.encryption_auth_tag || !asset.token_qube_id) {
    return NextResponse.json({ error: 'asset-incomplete' }, { status: 409 });
  }

  const { data: token, error: tokenError } = await supabase
    .from('iq_token_qubes')
    .select('key_ciphertext,key_wrapping_alg')
    .eq('id', asset.token_qube_id)
    .maybeSingle();

  if (tokenError) return NextResponse.json({ error: tokenError.message }, { status: 500 });
  if (!token?.key_ciphertext || !token?.key_wrapping_alg) {
    return NextResponse.json({ error: 'asset-key-not-found' }, { status: 404 });
  }

  const apiKey = process.env.AUTONOMYS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'autonomys-unavailable' }, { status: 503 });

  try {
    const api = createAutoDriveApi({ apiKey, network: NetworkId.MAINNET });
    const stream = await api.downloadFile(asset.auto_drive_cid);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const ciphertext = Buffer.concat(chunks);

    const key = unwrapKeyWithMasterKey({
      keyCiphertext: token.key_ciphertext,
      wrappingAlgorithm: token.key_wrapping_alg,
    });
    const plaintext = decryptContent({
      ciphertext,
      iv: asset.encryption_iv,
      authTag: asset.encryption_auth_tag,
      key,
    });

    if (asset.file_size != null && Number(asset.file_size) !== plaintext.length) {
      return NextResponse.json({
        error: 'asset-size-mismatch',
        expected: Number(asset.file_size),
        actual: plaintext.length,
      }, { status: 502 });
    }

    // Decode + re-encode the full image. This validates the source and produces
    // a compact browser-safe derivative instead of proxying the original binary.
    const derivative = await sharp(plaintext, { failOn: 'error' })
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    // Re-open the derivative we are about to publish and validate it exactly
    // as we would a cached one — a truncated canonical download can produce
    // a structurally valid WebP with a corrupt (e.g. flat-filled) raster.
    await assertValidDerivative(derivative);

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(
      objectPath,
      new Uint8Array(derivative),
      {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: true,
      },
    );
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
    return NextResponse.redirect(publicData.publicUrl, 307);
  } catch (error) {
    console.error('[QriptopianEssayCover] derivative failed', id, error);
    return NextResponse.json({
      error: 'cover-derivative-failed',
      detail: error instanceof Error ? error.message : String(error),
    }, { status: 502 });
  }
}
