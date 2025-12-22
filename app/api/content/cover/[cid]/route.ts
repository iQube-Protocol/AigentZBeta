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

export const runtime = 'nodejs';

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
      return NextResponse.json({ error: 'CID required' }, { status: 400 });
    }

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
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }

      // Use master content
      console.log('[CoverStream] Found in master_content_qubes, token_qube_id:', master.token_qube_id);
      return await streamDecryptedContent(master);
    }

    console.log('[CoverStream] Found asset:', asset.id, 'mime_type:', asset.mime_type, 'token_qube_id:', asset.token_qube_id);
    return await streamDecryptedContent(asset);

  } catch (error) {
    console.error('[CoverStream] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Stream failed' },
      { status: 500 }
    );
  }
}

async function streamDecryptedContent(asset: {
  auto_drive_cid: string;
  mime_type: string;
  encryption_iv: string;
  encryption_auth_tag: string | null;
  token_qube_id: string | null;
}) {
  // Get the decryption key from token_qube
  if (!asset.token_qube_id) {
    return NextResponse.json({ error: 'No token qube for decryption' }, { status: 400 });
  }

  const { data: tokenQube, error: tokenError } = await supabase
    .from('iq_token_qubes')
    .select('key_ciphertext, key_wrapping_alg')
    .eq('id', asset.token_qube_id)
    .single();

  if (tokenError || !tokenQube) {
    console.error('[CoverStream] Token qube query error:', tokenError);
    return NextResponse.json({ error: `Token qube not found: ${tokenError?.message || 'unknown'}` }, { status: 404 });
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
    return NextResponse.json({ error: 'Key unwrap failed - check CODEX_MASTER_KEY' }, { status: 500 });
  }

  // Fetch encrypted content from Autonomys
  const apiKey = process.env.AUTONOMYS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Autonomys not configured' }, { status: 500 });
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
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
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
    return NextResponse.json({ error: 'Decryption failed' }, { status: 500 });
  }

  // Return the decrypted image
  return new NextResponse(decryptedData, {
    headers: {
      'Content-Type': asset.mime_type || 'image/jpeg',
      'Content-Length': decryptedData.length.toString(),
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    },
  });
}
