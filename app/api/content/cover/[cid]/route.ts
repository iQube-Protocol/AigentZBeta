/**
 * Cover Image Streaming API
 * 
 * GET /api/content/cover/[cid]
 * 
 * Fetches and decrypts cover images from Autonomys for display.
 * Uses the token_qube_id to retrieve the decryption key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAutoDriveApi } from '@autonomys/auto-drive';
import { NetworkId } from '@autonomys/auto-utils';
import { unwrapKeyWithMasterKey, decryptContent } from '../../../../../server/services/encryptionService';
import { getCachedImage, setCachedImage } from './cache';
import sharp from 'sharp';

export const runtime = 'nodejs';

// CORS headers for cross-origin requests from thin client
export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

function withCors(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-tenant-id, x-persona-id');
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RouteParams {
  params: {
    cid: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { cid } = params;

    if (!cid) {
      return withCors(NextResponse.json({ error: 'CID required' }, { status: 400 }));
    }

    // Get variant (default to thumb to avoid CloudFront 1MB limit)
    const variant = req.nextUrl.searchParams.get('variant') ?? 'thumb';
    const cacheKey = `${cid}:${variant}`;

    // Check cache first
    const cached = getCachedImage(cacheKey);
    if (cached) {
      console.log(`[CoverStream] Cache HIT for ${cid}`);
      return withCors(new NextResponse(new Uint8Array(cached.data), {
        headers: {
                    'Content-Type': cached.mimeType,
          'Content-Length': cached.data.length.toString(),
          'Cache-Control': 'public, max-age=3600',
          'X-Cache': 'HIT',
        },
      }));
    }
    
    console.log(`[CoverStream] Cache MISS for ${cid}`);

    // Look up the asset by CID to get encryption metadata
    const { data: asset, error: assetError } = await supabase
      .from('codex_media_assets')
      .select(`
        id,
        auto_drive_cid,
        mime_type,
        encryption_iv,
        encryption_auth_tag,
        token_qube_id
      `)
      .eq('auto_drive_cid', cid)
      .single();

    if (assetError || !asset) {
      console.log('[CoverStream] Asset not found in codex_media_assets, trying master_content_qubes');
      // Try master_content_qubes as fallback
      const { data: master, error: masterError } = await supabase
        .from('master_content_qubes')
        .select(`
          id,
          auto_drive_cid,
          mime_type,
          encryption_iv,
          encryption_auth_tag,
          token_qube_id
        `)
        .eq('auto_drive_cid', cid)
        .single();

      if (masterError || !master) {
        console.log('[CoverStream] Asset not found in master_content_qubes either');
        return withCors(NextResponse.json({ error: 'Asset not found' }, { status: 404 }));
      }

      // Use master content
      console.log('[CoverStream] Found in master_content_qubes, token_qube_id:', master.token_qube_id);
      return await streamDecryptedContent(master, variant, cacheKey);
    }

    console.log('[CoverStream] Found asset:', asset.id, 'mime_type:', asset.mime_type, 'token_qube_id:', asset.token_qube_id);
    return await streamDecryptedContent(asset, variant, cacheKey);

  } catch (error) {
    console.error('[CoverStream] Error:', error);
    return withCors(NextResponse.json(
      { error: error instanceof Error ? error.message : 'Stream failed' },
      { status: 500 }
    ));
  }
}

async function streamDecryptedContent(
  asset: {
    auto_drive_cid: string;
    mime_type: string;
    encryption_iv: string;
    encryption_auth_tag: string | null;
    token_qube_id: string | null;
  },
  variant: string,
  cacheKey: string
) {
  // Get the decryption key from token_qube
  if (!asset.token_qube_id) {
    return withCors(NextResponse.json({ error: 'No token qube for decryption' }, { status: 400 }));
  }

  const { data: tokenQube, error: tokenError } = await supabase
    .from('iq_token_qubes')
    .select('key_ciphertext, key_wrapping_alg')
    .eq('id', asset.token_qube_id)
    .single();

  if (tokenError || !tokenQube) {
    console.error('[CoverStream] Token qube query error:', tokenError);
    return withCors(NextResponse.json({ error: `Token qube not found: ${tokenError?.message || 'unknown'}` }, { status: 404 }));
  }

  // Unwrap the key using the encryption service
  let contentKey: Buffer;
  try {
    contentKey = unwrapKeyWithMasterKey({
      keyCiphertext: tokenQube.key_ciphertext,
      wrappingAlgorithm: tokenQube.key_wrapping_alg || 'aes-256-kw',
    });
  } catch (unwrapError) {
    console.error('[CoverStream] Key unwrap failed:', unwrapError);
    return withCors(NextResponse.json({ error: 'Key unwrap failed - check CODEX_MASTER_KEY' }, { status: 500 }));
  }

  // Fetch encrypted content from Autonomys
  const apiKey = process.env.AUTONOMYS_API_KEY;
  if (!apiKey) {
    return withCors(NextResponse.json({ error: 'Autonomys not configured' }, { status: 500 }));
  }

  // Use SDK v1.6.4+ with proper network support
  // Try MAINNET first, fall back to TAURUS if needed
  const api = createAutoDriveApi({ apiKey, network: NetworkId.MAINNET });
  
  let encryptedData: Buffer;
  try {
    console.log('[CoverStream] Fetching CID:', asset.auto_drive_cid);
    const stream = await api.downloadFile(asset.auto_drive_cid);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    encryptedData = Buffer.concat(chunks);
    console.log('[CoverStream] Downloaded', encryptedData.length, 'bytes');
  } catch (downloadError) {
    console.error('[CoverStream] Download failed:', downloadError);
    return withCors(NextResponse.json({ error: 'Download failed' }, { status: 500 }));
  }

  // Decrypt the content using the encryption service
  let decryptedData: Buffer;
  try {
    decryptedData = decryptContent({
      ciphertext: encryptedData,
      iv: asset.encryption_iv,
      authTag: asset.encryption_auth_tag || '',
      key: contentKey,
    });
  } catch (decryptError) {
    console.error('[CoverStream] Decryption failed:', decryptError);
    return withCors(NextResponse.json({ error: 'Decryption failed' }, { status: 500 }));
  }

  // For covers, default to thumb to stay under CloudFront edge body limits (~1MB)
  let finalData = decryptedData;
  let finalMime = asset.mime_type || 'image/jpeg';
  let thumbOk = true;

  if (variant === 'thumb') {
    try {
      const thumb = await makeThumbUnderLimit(decryptedData);
      finalData = thumb.data;
      finalMime = thumb.mime;
      thumbOk = thumb.ok;
      console.log(`[CoverStream] Thumb: ${thumb.ok ? 'OK' : 'FALLBACK'}, size: ${finalData.length} bytes`);
    } catch (e) {
      console.error('[CoverStream] Thumb encode failed:', e);
      // Fallback to placeholder rather than returning a big body that triggers 413
      finalData = PLACEHOLDER_PNG;
      finalMime = 'image/png';
      thumbOk = false;
    }
  }

  // Cache what we actually return
  setCachedImage(cacheKey, finalData, finalMime);

  return withCors(new NextResponse(new Uint8Array(finalData), {
    headers: {
            'Content-Type': finalMime,
      'Content-Length': finalData.length.toString(),
      'Cache-Control': 'public, max-age=3600',
      'X-Cache': 'MISS',
      'X-Variant': variant,
      'X-Thumb-OK': thumbOk ? '1' : '0',
    },
  }));
}

// ============================================================================
// Thumbnail Generation Helper
// ============================================================================

const MAX_EDGE_BODY_BYTES = 950_000; // Keep well under CloudFront's 1MB limit
const PLACEHOLDER_PNG = Buffer.from(
  // 1x1 transparent PNG
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/P5mU7QAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * Resize and compress image to stay under CloudFront edge response limit.
 * Tries progressively smaller sizes/qualities until under limit.
 * Returns placeholder if all attempts fail.
 */
async function makeThumbUnderLimit(input: Buffer) {
  const attempts = [
    { width: 1024, quality: 75 },
    { width: 900, quality: 70 },
    { width: 800, quality: 65 },
    { width: 700, quality: 60 },
    { width: 600, quality: 55 },
  ];

  for (const a of attempts) {
    try {
      const out = await sharp(input)
        .resize({ width: a.width, withoutEnlargement: true })
        .webp({ quality: a.quality })
        .toBuffer();

      if (out.length <= MAX_EDGE_BODY_BYTES) {
        return { data: out, mime: 'image/webp', ok: true as const };
      }
    } catch (e) {
      console.error(`[makeThumbUnderLimit] Failed at width=${a.width}:`, e);
      continue;
    }
  }

  // All attempts failed, return tiny placeholder
  return { data: PLACEHOLDER_PNG, mime: 'image/png', ok: false as const };
}
