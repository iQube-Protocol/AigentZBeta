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
  _req: NextRequest,
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

    return new NextResponse(plaintext, {
      status: 200,
      headers: {
        'Content-Type': asset.mime_type || 'application/octet-stream',
        'Content-Length': String(plaintext.length),
        'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable',
        'X-Content-Source': 'autonomys',
        'X-Content-CID': asset.auto_drive_cid,
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
