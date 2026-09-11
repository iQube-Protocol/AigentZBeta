/**
 * Video Content Streaming Endpoint
 * Streams video content from Autonomys - supports both encrypted and unencrypted files.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAutoDriveApi } from '@autonomys/auto-drive';
import { NetworkId } from '@autonomys/auto-utils';
import { unwrapKeyWithMasterKey, decryptContent } from '@/server/services/encryptionService';
import { findStateCRowByUrl, streamStateCPlaintext } from '@/services/content/stateCDelivery';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getContentDescriptorByCid } from '@/services/content/getContentDescriptor';
import { evaluateAccess } from '@/services/access/evaluateAccess';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const videoCache = new Map<string, { data: Buffer; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000;
// Keep each response body safely below typical SSR edge/body limits.
const MAX_CHUNK_BYTES = 4 * 1024 * 1024; // 4 MB

export async function OPTIONS() {
  return new NextResponse(null);
}

export async function GET(req: NextRequest, props: { params: Promise<{ cid: string }> }) {
  const params = await props.params;
  try {
    const cid = params.cid;
    if (!cid) return NextResponse.json({ error: 'CID required' }, { status: 400,  });

    // ─────────────────────────────────────────────────────────────────
    // Spine gate — Phase 1.4 consumer migration #3
    //
    // Video deliveries are higher-stakes than covers (motion-comic
    // assets are typically state D / payment-gated). Same shadow-log
    // posture: gate runs and logs; ACCESS_SPINE_ENFORCE=1 enforces.
    //
    // Gate runs BEFORE the early HTTP-redirect path so even direct-
    // redirect deliveries pass through evaluateAccess.
    // ─────────────────────────────────────────────────────────────────
    const enforceGate = process.env.ACCESS_SPINE_ENFORCE === '1';
    try {
      const descriptor = await getContentDescriptorByCid(cid);
      if (descriptor) {
        const context = await getActivePersona(req);
        if (!context) {
          console.log(
            `[SPINE] route=video result=unauthenticated cid=${cid} ` +
            `asset=${descriptor.assetId} state=${descriptor.state} ` +
            `gating=${descriptor.gating.kind} enforce=${enforceGate}`,
          );
          if (enforceGate && descriptor.gating.kind !== 'free') {
            return NextResponse.json(
              { error: 'unauthenticated' },
              { status: 403, headers: { 'X-Access-Denied': 'unauthenticated' } },
            );
          }
        } else {
          const decision = await evaluateAccess(context, descriptor, 'watch');
          console.log(
            `[SPINE] route=video result=${decision.allow ? 'ALLOW' : 'DENY'} ` +
            `reason=${decision.reason} cid=${cid} asset=${descriptor.assetId} ` +
            `state=${descriptor.state} gating=${descriptor.gating.kind} ` +
            `enforce=${enforceGate}`,
          );
          if (enforceGate && !decision.allow) {
            return NextResponse.json(
              { error: decision.reason },
              { status: 403, headers: { 'X-Access-Denied': decision.reason } },
            );
          }
        }
      } else {
        console.log(`[SPINE] route=video result=skip cid=${cid} reason=no-descriptor`);
      }
    } catch (gateErr) {
      console.error('[SPINE] route=video result=ERROR', gateErr);
      if (enforceGate) {
        return NextResponse.json(
          { error: 'gate-error' },
          { status: 503, headers: { 'X-Access-Denied': 'gate-error' } },
        );
      }
    }

    // Phase 2.6 — state-C videos go through decrypt-stream; state-A
    // (free) videos still 302-redirect (no encrypted bytes at rest).
    if (cid.startsWith('http://') || cid.startsWith('https://')) {
      const found = await findStateCRowByUrl(cid);
      if (found?.row?.encryption_iv) {
        return await streamStateCPlaintext(found.row, {
          contentType: found.row.mime_type || 'video/mp4',
        });
      }
      return NextResponse.redirect(cid, 302);
    }

    // Find asset in database - check multiple sources
    let asset = (await supabase.from('master_content_qubes')
      .select('id, auto_drive_cid, mime_type, encryption_iv, encryption_auth_tag, token_qube_id, blak_qube_id')
      .eq('auto_drive_cid', cid).single()).data;

    if (!asset) {
      asset = (await supabase.from('codex_media_assets')
        .select('id, auto_drive_cid, mime_type, encryption_iv, encryption_auth_tag, token_qube_id, blak_qube_id')
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
          token_qube_id: tokenQubeId,
          blak_qube_id: blakQube.id
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
          .eq('id', asset?.token_qube_id)
          .single();

        if (!tokenQube) {
          return NextResponse.json({ error: 'Token not found' }, { status: 404,  });
        }

        const contentKey = unwrapKeyWithMasterKey({
          keyCiphertext: tokenQube.key_ciphertext,
          wrappingAlgorithm: tokenQube.key_wrapping_alg || 'aes-256-kw',
        });

        videoData = decryptContent({
          ciphertext: rawData,
          iv: asset?.encryption_iv || '',
          authTag: asset?.encryption_auth_tag || '',
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

    const clampChunkEnd = (start: number, requestedEnd?: number) => {
      const maxEnd = Math.min(start + MAX_CHUNK_BYTES - 1, videoData.length - 1);
      if (typeof requestedEnd === 'number' && Number.isFinite(requestedEnd)) {
        return Math.max(start, Math.min(requestedEnd, maxEnd));
      }
      return maxEnd;
    };

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = Number.parseInt(parts[0], 10);
      const requestedEnd = parts[1] ? Number.parseInt(parts[1], 10) : undefined;
      if (!Number.isFinite(start) || start < 0 || start >= videoData.length) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${videoData.length}`,
            'Accept-Ranges': 'bytes',
          },
        });
      }
      const end = clampChunkEnd(start, requestedEnd);
      return new NextResponse(new Uint8Array(videoData.slice(start, end + 1)), {
        status: 206,
        headers: {
          'Content-Type': mimeType,
          'Content-Range': `bytes ${start}-${end}/${videoData.length}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(end - start + 1),
          'Cache-Control': 'no-store',
        },
      });
    }

    // No Range header sent (mobile Safari often omits it on the first probe).
    // Returning a 206 here causes mobile browsers to treat the partial chunk
    // as the entire file and never issue follow-up Range requests — desktop
    // recovers, mobile silently fails. So we send the full body as 200 with
    // Accept-Ranges, which mobile parses correctly and adapters can range
    // into for seeking. Edge body-size limits are mitigated by streaming via
    // a ReadableStream rather than buffering the whole Uint8Array at once.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const CHUNK = 1_048_576; // 1 MiB
        for (let i = 0; i < videoData.length; i += CHUNK) {
          controller.enqueue(new Uint8Array(videoData.slice(i, Math.min(i + CHUNK, videoData.length))));
        }
        controller.close();
      },
    });
    return new NextResponse(stream, {
      status: 200,
      headers: {
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
      { status: 500,  }
    );
  }
}
