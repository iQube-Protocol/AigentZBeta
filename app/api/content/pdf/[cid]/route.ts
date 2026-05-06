/**
 * PDF Content Streaming Endpoint
 * 
 * Decrypts and streams PDF content from Autonomys for viewing.
 * Similar to the cover endpoint but specifically for PDF documents.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAutoDriveApi } from '@autonomys/auto-drive';
import { NetworkId } from '@autonomys/auto-utils';
import {
  unwrapKeyWithMasterKey,
  decryptContent
} from '@/server/services/encryptionService';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getContentDescriptorByCid } from '@/services/content/getContentDescriptor';
import { evaluateAccess } from '@/services/access/evaluateAccess';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CORS headers for cross-origin requests from thin client
export async function OPTIONS() {
  return new NextResponse(null);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function streamDecryptedContent(asset: {
  id: string;
  auto_drive_cid: string;
  mime_type: string;
  encryption_iv: string;
  encryption_auth_tag: string;
  token_qube_id: string;
}) {
  // Get token qube for decryption key
  const { data: tokenQube, error: tokenError } = await supabase
    .from('iq_token_qubes')
    .select('key_ciphertext, key_wrapping_alg')
    .eq('id', asset.token_qube_id)
    .single();

  if (tokenError || !tokenQube) {
    console.error('[PDFStream] Token qube query error:', tokenError);
    return NextResponse.json({ error: `Token qube not found: ${tokenError?.message || 'unknown'}` }, { status: 404,  });
  }

  // Unwrap the content key
  let contentKey: Buffer;
  try {
    contentKey = unwrapKeyWithMasterKey({
      keyCiphertext: tokenQube.key_ciphertext,
      wrappingAlgorithm: tokenQube.key_wrapping_alg || 'aes-256-kw',
    });
  } catch (err) {
    console.error('[PDFStream] Key unwrap error:', err);
    return NextResponse.json({ error: 'Failed to unwrap content key' }, { status: 500,  });
  }

  // Download encrypted content from Autonomys
  const apiKey = process.env.AUTONOMYS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Autonomys not configured' }, { status: 500,  });
  }
  // Use SDK v1.6.4+ with proper network support
  const api = createAutoDriveApi({ apiKey, network: NetworkId.MAINNET });
  
  let encryptedData: Buffer;
  try {
    console.log('[PDFStream] Fetching CID:', asset.auto_drive_cid);
    const stream = await api.downloadFile(asset.auto_drive_cid);
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    encryptedData = Buffer.concat(chunks);
  } catch (err) {
    console.error('[PDFStream] Download error:', err);
    return NextResponse.json({ error: 'Failed to download content' }, { status: 500 });
  }

  // Decrypt content
  let decryptedData: Buffer;
  try {
    decryptedData = decryptContent({
      ciphertext: encryptedData,
      iv: asset.encryption_iv,
      authTag: asset.encryption_auth_tag,
      key: contentKey,
    });
  } catch (err) {
    console.error('[PDFStream] Decryption error:', err);
    return NextResponse.json({ error: 'Failed to decrypt content' }, { status: 500,  });
  }

  // Return PDF with headers that prevent downloading
  return new NextResponse(new Uint8Array(decryptedData), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline', // Display in browser, not download
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { cid: string } }
) {
  try {
    const cid = params.cid;

    if (!cid) {
      return NextResponse.json({ error: 'CID required' }, { status: 400 });
    }

    // ─────────────────────────────────────────────────────────────────
    // Spine gate — Phase 1.4 consumer migration #4
    //
    // Same shadow-log pattern as pdf-page (#1), cover (#2), video (#3).
    // Full-PDF deliveries are state-D-typical (motion-comic episode
    // print files); the gate runs at the top, logs decisions, and
    // enforces only when ACCESS_SPINE_ENFORCE=1 is set.
    //
    // Gate runs BEFORE the early HTTP-redirect path so direct-redirect
    // deliveries also pass through evaluateAccess.
    // ─────────────────────────────────────────────────────────────────
    const enforceGate = process.env.ACCESS_SPINE_ENFORCE === '1';
    try {
      const descriptor = await getContentDescriptorByCid(cid);
      if (descriptor) {
        const context = await getActivePersona(req);
        if (!context) {
          console.log(
            `[PDFStream] spine: unauthenticated cid=${cid} ` +
            `(asset=${descriptor.assetId}, state=${descriptor.state}, ` +
            `gating=${descriptor.gating.kind}); enforce=${enforceGate}`,
          );
          if (enforceGate && descriptor.gating.kind !== 'free') {
            return NextResponse.json(
              { error: 'unauthenticated' },
              { status: 403, headers: { 'X-Access-Denied': 'unauthenticated' } },
            );
          }
        } else {
          const decision = await evaluateAccess(context, descriptor, 'read');
          console.log(
            `[PDFStream] spine: cid=${cid} asset=${descriptor.assetId} ` +
            `state=${descriptor.state} gating=${descriptor.gating.kind} ` +
            `decision=${decision.allow ? 'ALLOW' : 'DENY'}/${decision.reason} ` +
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
        console.log(`[PDFStream] spine: no descriptor for cid=${cid}; gate skipped`);
      }
    } catch (gateErr) {
      console.error('[PDFStream] spine: gate threw:', gateErr);
      if (enforceGate) {
        return NextResponse.json(
          { error: 'gate-error' },
          { status: 503, headers: { 'X-Access-Denied': 'gate-error' } },
        );
      }
    }

    // Supabase-hosted asset: cid is the public URL — redirect directly, no decryption
    if (cid.startsWith('http://') || cid.startsWith('https://')) {
      return NextResponse.redirect(cid, 302);
    }

    // Try master_content_qubes first (where PDFs are stored)
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
      // Try codex_media_assets as fallback
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
        return NextResponse.json({ error: 'PDF not found' }, { status: 404,  });
      }

      return await streamDecryptedContent(asset);
    }

    return await streamDecryptedContent(master);

  } catch (error) {
    console.error('[PDFStream] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Stream failed' },
      { status: 500,  }
    );
  }
}
