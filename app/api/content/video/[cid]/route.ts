/**
 * Video Content Streaming Endpoint
 * Streams video content from Autonomys - supports both encrypted and unencrypted files.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAutoDriveApi } from '@autonomys/auto-drive';
import { NetworkId } from '@autonomys/auto-utils';
import { unwrapKeyWithMasterKey, decryptContent } from '@/server/services/encryptionService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const videoCache = new Map<string, { data: Buffer; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

export async function GET(req: NextRequest, { params }: { params: { cid: string } }) {
  try {
    const cid = params.cid;
    if (!cid) return NextResponse.json({ error: 'CID required' }, { status: 400, headers: corsHeaders });

    // Find asset in database - check multiple sources
    let asset = (await supabase.from('master_content_qubes')
      .select('id, auto_drive_cid, mime_type, encryption_iv, encryption_auth_tag, token_qube_id, blak_qube_id')
      .eq('auto_drive_cid', cid).single()).data;

    if (!asset) {
      asset = (await supabase.from('codex_media_assets')
        .select('id, auto_drive_cid, mime_type, encryption_iv, encryption_auth_tag, token_qube_id')
        .eq('auto_drive_cid', cid).single()).data;
    }

    // If encryption fields are empty, try to get them from BlakQube
    if (asset && (!asset.encryption_iv || asset.encryption_iv === '') && asset.blak_qube_id) {
      const { data: blakQube } = await supabase
        .from('iq_blak_qubes')
        .select('encryption_iv, encryption_auth_tag')
        .eq('id', asset.blak_qube_id)
        .single();
      if (blakQube) {
        asset.encryption_iv = blakQube.encryption_iv;
        asset.encryption_auth_tag = blakQube.encryption_auth_tag;
      }
    }
    
    // Also check BlakQube directly by CID if no asset found
    if (!asset) {
      const { data: blakQube } = await supabase
        .from('iq_blak_qubes')
        .select('id, payload_type, encryption_iv, encryption_auth_tag')
        .eq('payload_pointer', cid)
        .single();
      if (blakQube) {
        // Find token_qube via segment -> episode -> master_content_qubes
        let tokenQubeId: string | null = null;
        const { data: segment } = await supabase
          .from('codex_motion_segments')
          .select('episode_id, token_qube_id')
          .eq('auto_drive_cid', cid)
          .single();
        if (segment?.token_qube_id) {
          // Use segment's direct token_qube_id
          tokenQubeId = segment.token_qube_id;
        } else if (segment?.episode_id) {
          // Fallback to episode's token_qube
          const { data: mcq } = await supabase
            .from('master_content_qubes')
            .select('token_qube_id')
            .eq('id', segment.episode_id)
            .single();
          tokenQubeId = mcq?.token_qube_id || null;
        }
        asset = {
          id: blakQube.id,
          auto_drive_cid: cid,
          mime_type: blakQube.payload_type,
          encryption_iv: blakQube.encryption_iv,
          encryption_auth_tag: blakQube.encryption_auth_tag,
          token_qube_id: tokenQubeId
        };
      }
    }

    // Check cache first
    let videoData: Buffer;
    const cached = videoCache.get(cid);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[VideoStream] Cache hit:', cid);
      videoData = cached.data;
    } else {
      // Download from Autonomys
      const api = createAutoDriveApi({ apiKey: process.env.AUTONOMYS_API_KEY!, network: NetworkId.MAINNET });
      console.log('[VideoStream] Downloading:', cid);
      
      const stream = await api.downloadFile(cid);
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream) chunks.push(chunk);
      const rawData = Buffer.concat(chunks);
      console.log('[VideoStream] Downloaded:', rawData.length, 'bytes');

      // Check if file is encrypted (has non-empty encryption metadata in DB)
      const isEncrypted = asset?.encryption_iv && asset.encryption_iv !== '' && 
                          asset?.encryption_auth_tag && asset.encryption_auth_tag !== '' && 
                          asset?.token_qube_id;
      
      if (isEncrypted) {
        // Decrypt the content
        const { data: tokenQube } = await supabase
          .from('iq_token_qubes')
          .select('key_ciphertext, key_wrapping_alg')
          .eq('id', asset.token_qube_id)
          .single();

        if (!tokenQube) {
          return NextResponse.json({ error: 'Token not found' }, { status: 404, headers: corsHeaders });
        }

        const contentKey = unwrapKeyWithMasterKey({
          keyCiphertext: tokenQube.key_ciphertext,
          wrappingAlgorithm: tokenQube.key_wrapping_alg || 'aes-256-kw',
        });

        videoData = decryptContent({
          ciphertext: rawData,
          iv: asset.encryption_iv,
          authTag: asset.encryption_auth_tag,
          key: contentKey,
        });
        console.log('[VideoStream] Decrypted:', videoData.length, 'bytes');
      } else {
        // Unencrypted file - use raw data directly
        videoData = rawData;
        console.log('[VideoStream] Unencrypted file, using raw data');
      }

      // Cache it
      videoCache.set(cid, { data: videoData, timestamp: Date.now() });
    }

    const mimeType = asset?.mime_type || 'video/mp4';
    const rangeHeader = req.headers.get('range');

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : videoData.length - 1;
      return new NextResponse(new Uint8Array(videoData.slice(start, end + 1)), {
        status: 206,
        headers: {
          ...corsHeaders,
          'Content-Type': mimeType,
          'Content-Range': `bytes ${start}-${end}/${videoData.length}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(end - start + 1),
          'Cache-Control': 'no-store',
        },
      });
    }

    return new NextResponse(new Uint8Array(videoData), {
      headers: {
        ...corsHeaders,
        'Content-Type': mimeType,
        'Content-Length': String(videoData.length),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
      },
    });

  } catch (error) {
    console.error('[VideoStream] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Stream failed' },
      { status: 500, headers: corsHeaders }
    );
  }
}
