import { NextRequest, NextResponse } from 'next/server';
import { createAutoDriveApi } from '@autonomys/auto-drive';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { decryptContent, unwrapKeyWithMasterKey } from '@/server/services/encryptionService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PUBLIC_MEDIA_BUCKET = 'content-media';
const PUBLIC_MEDIA_PREFIX = 'public-codex-media';

function extensionForMime(mimeType: string | null | undefined): string {
  switch ((mimeType || '').toLowerCase()) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'image/gif': return 'gif';
    case 'image/svg+xml': return 'svg';
    default: return 'bin';
  }
}

/**
 * Public delivery surface for canonical codex media assets.
 *
 * Autonomys remains the canonical encrypted source. For assets explicitly
 * marked shareable, this route materialises a byte-identical public delivery
 * derivative in the existing public `content-media` bucket and redirects the
 * browser there. This keeps canonical provenance on Autonomys while avoiding
 * repeated Lambda/Next binary proxying, which proved unreliable for Safari
 * image decoding (partial/blank renders on otherwise valid JPEGs).
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
    .select('id,title,auto_drive_cid,mime_type,file_size,encryption_iv,encryption_auth_tag,token_qube_id,status,is_shareable')
    .eq('id', id)
    .eq('status', 'active')
    .maybeSingle();

  if (assetError) return NextResponse.json({ error: assetError.message }, { status: 500 });
  if (!asset) return NextResponse.json({ error: 'asset-not-found' }, { status: 404 });
  if (!asset.auto_drive_cid || !asset.token_qube_id || !asset.encryption_iv || !asset.encryption_auth_tag) {
    return NextResponse.json({ error: 'asset-incomplete' }, { status: 409 });
  }

  const publicPath = `${PUBLIC_MEDIA_PREFIX}/${asset.id}.${extensionForMime(asset.mime_type)}`;

  // Shareable/public article imagery should be delivered by object storage,
  // not streamed through the application runtime. If the durable derivative
  // already exists, redirect immediately; Supabase Storage then handles range
  // requests, content length and browser caching natively.
  if (asset.is_shareable) {
    const { data: existing, error: listError } = await supabase.storage
      .from(PUBLIC_MEDIA_BUCKET)
      .list(PUBLIC_MEDIA_PREFIX, { search: `${asset.id}.`, limit: 10 });

    if (!listError && existing?.some((entry) => entry.name === `${asset.id}.${extensionForMime(asset.mime_type)}`)) {
      const { data: publicData } = supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(publicPath);
      return NextResponse.redirect(publicData.publicUrl, 307);
    }
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

    // The DB records the original plaintext size at upload. Refuse to publish
    // or proxy a truncated download instead of allowing browsers to cache a
    // partially decoded JPEG.
    if (asset.file_size != null && Number(asset.file_size) !== plaintext.length) {
      console.error('[ContentMedia] Size mismatch', {
        id: asset.id,
        expected: Number(asset.file_size),
        actual: plaintext.length,
        cid: asset.auto_drive_cid,
      });
      return NextResponse.json({ error: 'asset-size-mismatch' }, { status: 502 });
    }

    if (asset.is_shareable) {
      const { error: uploadError } = await supabase.storage
        .from(PUBLIC_MEDIA_BUCKET)
        .upload(publicPath, new Uint8Array(plaintext), {
          contentType: asset.mime_type || 'application/octet-stream',
          cacheControl: '31536000',
          upsert: true,
        });

      if (!uploadError) {
        const { data: publicData } = supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(publicPath);
        return NextResponse.redirect(publicData.publicUrl, 307);
      }

      // Do not make public article delivery depend entirely on the cache write.
      // Log and fall back to the exact-byte proxy response below.
      console.error('[ContentMedia] Public derivative cache write failed', asset.id, uploadError);
    }

    const total = plaintext.length;
    const range = req.headers.get('range');
    const baseHeaders: Record<string, string> = {
      'Content-Type': asset.mime_type || 'application/octet-stream',
      'Cache-Control': 'public, max-age=300, must-revalidate',
      'Accept-Ranges': 'bytes',
      'X-Content-Source': 'autonomys',
      'X-Content-CID': asset.auto_drive_cid,
      'X-Content-Type-Options': 'nosniff',
    };

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
