import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAutoDriveApi } from '@autonomys/auto-drive';
import { NetworkId } from '@autonomys/auto-utils';
import { unwrapKeyWithMasterKey, decryptContent } from '@/server/services/encryptionService';

// Polyfill for Promise.withResolvers (Node.js 22+ feature, not available in Node 20)
if (typeof Promise.withResolvers === 'undefined') {
  (Promise as any).withResolvers = function <T>() {
    let resolve: (value: T | PromiseLike<T>) => void;
    let reject: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve: resolve!, reject: reject! };
  };
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RouteParams {
  params: { cid: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { cid } = params;
    if (!cid) return NextResponse.json({ error: 'CID required' }, { status: 400, headers: corsHeaders });

    const asset = await findAssetByCid(cid);
  if (!asset?.token_qube_id) {
    return NextResponse.json({ error: 'Asset/token qube not found' }, { status: 404, headers: corsHeaders });
  }

  const { data: tokenQube, error: tokenError } = await supabase
    .from('iq_token_qubes')
    .select('key_ciphertext, key_wrapping_alg')
    .eq('id', asset.token_qube_id)
    .single();

  if (tokenError || !tokenQube) {
    return NextResponse.json({ error: 'Token qube not found' }, { status: 404, headers: corsHeaders });
  }

  const contentKey = unwrapKeyWithMasterKey({
    keyCiphertext: tokenQube.key_ciphertext,
    wrappingAlgorithm: tokenQube.key_wrapping_alg || 'aes-256-kw',
  });

  const apiKey = process.env.AUTONOMYS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Autonomys not configured' }, { status: 500, headers: corsHeaders });

  const api = createAutoDriveApi({ apiKey, network: NetworkId.MAINNET });
  const stream = await api.downloadFile(asset.auto_drive_cid);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const encryptedData = Buffer.concat(chunks);

  const decryptedPdf = decryptContent({
    ciphertext: encryptedData,
    iv: asset.encryption_iv,
    authTag: asset.encryption_auth_tag || '',
    key: contentKey,
  });

  // Dynamic import to avoid Next.js ESM issues
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  const { getDocument } = pdfjs as any;

  const loadingTask = getDocument({
    data: new Uint8Array(decryptedPdf),
    isEvalSupported: false, // Security hardening
  });
  const pdf = await loadingTask.promise;

    return NextResponse.json(
      { pages: pdf.numPages, suggestedWidth: 1200 },
      { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' } }
    );
  } catch (error: any) {
    const errorDetails = {
      message: error?.message || 'Unknown error',
      name: error?.name || 'Error',
      stack: error?.stack || 'No stack trace',
      stringified: String(error),
      cid: params.cid,
      type: typeof error,
      keys: error ? Object.keys(error) : []
    };
    console.error('[PDF Meta] Error processing PDF:', errorDetails);
    
    const errorMessage = error?.message || error?.toString?.() || JSON.stringify(error) || 'Failed to process PDF';
    return NextResponse.json(
      { error: errorMessage, details: errorDetails },
      { status: 500, headers: corsHeaders }
    );
  }
}

async function findAssetByCid(cid: string) {
  const { data: asset } = await supabase
    .from('codex_media_assets')
    .select('auto_drive_cid, encryption_iv, encryption_auth_tag, token_qube_id')
    .eq('auto_drive_cid', cid)
    .single();

  if (asset) return asset;

  const { data: master } = await supabase
    .from('master_content_qubes')
    .select('auto_drive_cid, encryption_iv, encryption_auth_tag, token_qube_id')
    .eq('auto_drive_cid', cid)
    .single();

  return master ?? null;
}
