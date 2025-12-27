import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAutoDriveApi } from '@autonomys/auto-drive';
import { NetworkId } from '@autonomys/auto-utils';
import { PDFDocument } from 'pdf-lib';
import { unwrapKeyWithMasterKey, decryptContent } from '@/server/services/encryptionService';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
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
    const cid = params?.cid;
    if (!cid) {
      return NextResponse.json({ error: 'CID required' }, { status: 400, headers: corsHeaders });
    }

    const assetLookup = await findAssetByCid(cid);
    if (!assetLookup) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404, headers: corsHeaders });
    }

    const { table, asset } = assetLookup;

    if (typeof asset.page_count === 'number' && asset.page_count > 0) {
      return NextResponse.json(
        { 
          pages: asset.page_count, 
          suggestedWidth: 1200, 
          cached: true,
          pdfLiteUrl: asset.pdf_lite_url || undefined
        },
        { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' } }
      );
    }

    if (!asset.token_qube_id) {
      return NextResponse.json({ error: 'No token qube for decryption' }, { status: 400, headers: corsHeaders });
    }

    const { data: tokenQube, error: tokenError } = await supabase
      .from('iq_token_qubes')
      .select('key_ciphertext, key_wrapping_alg')
      .eq('id', asset.token_qube_id)
      .single();

    if (tokenError || !tokenQube) {
      return NextResponse.json(
        { error: `Token qube not found: ${tokenError?.message || 'unknown'}` },
        { status: 404, headers: corsHeaders }
      );
    }

    const contentKey = unwrapKeyWithMasterKey({
      keyCiphertext: tokenQube.key_ciphertext,
      wrappingAlgorithm: tokenQube.key_wrapping_alg || 'aes-256-kw',
    });

    const apiKey = process.env.AUTONOMYS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Autonomys not configured' }, { status: 500, headers: corsHeaders });
    }

    const api = createAutoDriveApi({ apiKey, network: NetworkId.MAINNET });
    const stream = await api.downloadFile(asset.auto_drive_cid);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const encryptedPdf = Buffer.concat(chunks);

    const decryptedPdf = decryptContent({
      ciphertext: encryptedPdf,
      iv: asset.encryption_iv,
      authTag: asset.encryption_auth_tag || '',
      key: contentKey,
    });

    const pdfDoc = await PDFDocument.load(decryptedPdf, { updateMetadata: false });
    const pages = pdfDoc.getPageCount();

    await supabase.from(table).update({ page_count: pages }).eq('id', asset.id);

    return NextResponse.json(
      { pages, suggestedWidth: 1200, cached: false, pdfLiteUrl: asset.pdf_lite_url || undefined },
      { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' } }
    );
  } catch (error: any) {
    console.error('[PDF Meta] Error:', { message: error?.message, stack: error?.stack });
    return NextResponse.json(
      { error: error?.message || 'PDF meta failed' },
      { status: 500, headers: corsHeaders }
    );
  }
}

async function findAssetByCid(cid: string): Promise<null | { table: 'codex_media_assets' | 'master_content_qubes'; asset: any }> {
  const { data: asset, error } = await supabase
    .from('codex_media_assets')
    .select('id, auto_drive_cid, mime_type, encryption_iv, encryption_auth_tag, token_qube_id, page_count, pdf_lite_url')
    .eq('auto_drive_cid', cid)
    .single();

  if (asset && !error) return { table: 'codex_media_assets', asset };

  const { data: master, error: masterError } = await supabase
    .from('master_content_qubes')
    .select('id, auto_drive_cid, mime_type, encryption_iv, encryption_auth_tag, token_qube_id, page_count, pdf_lite_url')
    .eq('auto_drive_cid', cid)
    .single();

  if (master && !masterError) return { table: 'master_content_qubes', asset: master };

  return null;
}
