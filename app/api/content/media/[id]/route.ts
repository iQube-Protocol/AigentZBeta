import { NextRequest, NextResponse } from 'next/server';
import { createAutoDriveApi } from '@autonomys/auto-drive';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { decryptContent, unwrapKeyWithMasterKey } from '@/server/services/encryptionService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Public delivery surface for canonical codex media assets.
 *
 * The source asset remains the encrypted Autonomys object recorded in
 * codex_media_assets. This route resolves its wrapped content key, downloads the
 * ciphertext, decrypts it server-side, and serves the original media bytes.
 * Public article/essay imagery can therefore use the canonical Autonomys asset
 * without creating a second storage copy.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: 'supabase-unavailable' }, { status: 500 });

  const { data: asset, error: assetError } = await supabase
    .from('codex_media_assets')
    .select('id,auto_drive_cid,mime_type,encryption_iv,encryption_auth_tag,token_qube_id,status')
    .eq('id', id)
    .eq('status', 'active')
    .maybeSingle();

  if (assetError) return NextResponse.json({ error: assetError.message }, { status: 500 });
  if (!asset) return NextResponse.json({ error: 'asset-not-found' }, { status: 404 });
  if (!asset.auto_drive_cid || !asset.token_qube_id || !asset.encryption_iv || !asset.encryption_auth_tag) {
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
    const api = createAutoDriveApi({ apiKey, network: 'mainnet' });
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

    const total = plaintext.length;
    const range = req.headers.get('range');
    const baseHeaders: Record<string, string> = {
      'Content-Type': asset.mime_type || 'application/octet-stream',
      // Keep browser caching modest while this public delivery seam stabilises;
      // the content itself is immutable and remains identified by asset ID/CID.
      'Cache-Control': 'public, max-age=300, must-revalidate',
      'Accept-Ranges': 'bytes',
      'X-Content-Source': 'autonomys',
      'X-Content-CID': asset.auto_drive_cid,
      'X-Content-Type-Options': 'nosniff',
    };

    // Safari/WebKit may request image resources using byte ranges. Returning a
    // full 200 response to a Range request can leave the image decoder with a
    // partially rendered/cached resource. Honour a single bytes range here.
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (!match) {
        return new Response(null, {
          status: 416,
          headers: { ...baseHeaders, 'Content-Range': `bytes */${total}` },
        });
      }

      let start: number;
      let end: number;
      if (!match[1] && match[2]) {
        const suffix = Number(match[2]);
        if (!Number.isFinite(suffix) || suffix <= 0) {
          return new Response(null, {
            status: 416,
            headers: { ...baseHeaders, 'Content-Range': `bytes */${total}` },
          });
        }
        start = Math.max(0, total - suffix);
        end = total - 1;
      } else {
        start = Number(match[1]);
        end = match[2] ? Number(match[2]) : total - 1;
      }

      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= total) {
        return new Response(null, {
          status: 416,
          headers: { ...baseHeaders, 'Content-Range': `bytes */${total}` },
        });
      }

      end = Math.min(end, total - 1);
      const slice = plaintext.subarray(start, end + 1);
      return new Response(new Uint8Array(slice), {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Length': String(slice.length),
          'Content-Range': `bytes ${start}-${end}/${total}`,
        },
      });
    }

    // Use the platform-standard Response with Uint8Array rather than passing a
    // Node Buffer through NextResponse. This avoids adapter/body coercion on
    // binary responses while preserving the exact decrypted bytes.
    return new Response(new Uint8Array(plaintext), {
      status: 200,
      headers: {
        ...baseHeaders,
        'Content-Length': String(total),
      },
    });
  } catch (error) {
    console.error('[ContentMedia] Failed to serve canonical asset', id, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'asset-delivery-failed' },
      { status: 502 },
    );
  }
}
