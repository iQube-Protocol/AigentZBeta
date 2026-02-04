import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAutoDriveApi } from '@autonomys/auto-drive';
import { NetworkId } from '@autonomys/auto-utils';
import { unwrapKeyWithMasterKey, decryptContent } from '@/server/services/encryptionService';

export const runtime = 'nodejs';
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { limit = 5 } = await req.json();
    
    const { data: assets } = await supabase
      .from('master_content_qubes')
      .select('id, auto_drive_cid, encryption_iv, encryption_auth_tag, token_qube_id, title')
      .eq('content_type', 'episode_print')
      .is('pdf_lite_url', null)
      .limit(limit);

    if (!assets?.length) {
      return NextResponse.json({ message: 'No PDFs need processing' });
    }

    const results = [];
    for (const asset of assets) {
      try {
        const { data: tokenQube } = await supabase
          .from('iq_token_qubes')
          .select('key_ciphertext, key_wrapping_alg')
          .eq('id', asset.token_qube_id)
          .single();

        if (!tokenQube) {
          throw new Error('Token qube not found');
        }

        const contentKey = unwrapKeyWithMasterKey({
          keyCiphertext: tokenQube.key_ciphertext,
          wrappingAlgorithm: tokenQube.key_wrapping_alg || 'aes-256-kw',
        });

        const api = createAutoDriveApi({ 
          apiKey: process.env.AUTONOMYS_API_KEY!, 
          network: NetworkId.MAINNET 
        });
        
        const stream = await api.downloadFile(asset.auto_drive_cid);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(Buffer.from(chunk));
        
        const decryptedPdf = decryptContent({
          ciphertext: Buffer.concat(chunks),
          iv: asset.encryption_iv,
          authTag: asset.encryption_auth_tag || '',
          key: contentKey,
        });

        const filename = `pdf-lite/${asset.id}.pdf`;
        await supabase.storage
          .from('content-media')
          .upload(filename, decryptedPdf, { contentType: 'application/pdf', upsert: true });

        const { data: urlData } = supabase.storage
          .from('content-media')
          .getPublicUrl(filename);

        await supabase
          .from('master_content_qubes')
          .update({ pdf_lite_url: urlData.publicUrl })
          .eq('id', asset.id);

        results.push({ id: asset.id, title: asset.title, status: 'success', url: urlData.publicUrl });
      } catch (error: any) {
        results.push({ id: asset.id, title: asset.title, status: 'failed', error: error.message });
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
