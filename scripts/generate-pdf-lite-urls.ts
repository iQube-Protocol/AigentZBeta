// Load environment variables FIRST before any imports
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Verify CODEX_MASTER_KEY is loaded
if (!process.env.CODEX_MASTER_KEY) {
  console.error('❌ CODEX_MASTER_KEY not found in .env.local');
  process.exit(1);
}

// Now import other modules
import { createClient } from '@supabase/supabase-js';
import { createAutoDriveApi } from '@autonomys/auto-drive';
import { NetworkId } from '@autonomys/auto-utils';
import { unwrapKeyWithMasterKey, decryptContent } from '../server/services/encryptionService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function generatePdfLiteUrl(asset: any, table: string) {
  console.log(`\nProcessing: ${asset.title || asset.auto_drive_cid}`);

  const { data: tokenQube } = await supabase
    .from('iq_token_qubes')
    .select('key_ciphertext, key_wrapping_alg')
    .eq('id', asset.token_qube_id)
    .single();

  if (!tokenQube) {
    console.error('  ❌ Token qube not found');
    return false;
  }

  const contentKey = unwrapKeyWithMasterKey({
    keyCiphertext: tokenQube.key_ciphertext,
    wrappingAlgorithm: tokenQube.key_wrapping_alg || 'aes-256-kw',
  });

  console.log('  📥 Downloading from Autonomys...');
  const api = createAutoDriveApi({ apiKey: process.env.AUTONOMYS_API_KEY!, network: NetworkId.MAINNET });
  const stream = await api.downloadFile(asset.auto_drive_cid);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const encryptedPdf = Buffer.concat(chunks);
  console.log(`  ✓ Downloaded ${encryptedPdf.length} bytes`);

  console.log('  🔓 Decrypting...');
  const decryptedPdf = decryptContent({
    ciphertext: encryptedPdf,
    iv: asset.encryption_iv,
    authTag: asset.encryption_auth_tag || '',
    key: contentKey,
  });
  console.log(`  ✓ Decrypted ${decryptedPdf.length} bytes`);

  const filename = `pdf-lite/${asset.id}.pdf`;
  console.log(`  📤 Uploading to Supabase Storage...`);
  const { error: uploadError } = await supabase.storage
    .from('content-media')
    .upload(filename, decryptedPdf, { contentType: 'application/pdf', upsert: true });

  if (uploadError) {
    console.error(`  ❌ Upload failed: ${uploadError.message}`);
    return false;
  }

  const { data: urlData } = supabase.storage.from('content-media').getPublicUrl(filename);
  const pdfLiteUrl = urlData.publicUrl;

  await supabase.from(table).update({ pdf_lite_url: pdfLiteUrl }).eq('id', asset.id);
  console.log(`  ✅ Generated: ${pdfLiteUrl}`);
  return true;
}

async function main() {
  console.log('🔍 Finding PDFs without pdf_lite_url...\n');
  
  const { data: assets } = await supabase
    .from('master_content_qubes')
    .select('id, auto_drive_cid, encryption_iv, encryption_auth_tag, token_qube_id, title, episode_number')
    .eq('content_type', 'episode_print')
    .is('pdf_lite_url', null)
    .limit(10);

  if (!assets?.length) {
    console.log('✓ No PDFs need processing');
    return;
  }

  console.log(`Found ${assets.length} PDFs to process`);
  let success = 0;
  let failed = 0;

  for (const asset of assets) {
    try {
      const result = await generatePdfLiteUrl(asset, 'master_content_qubes');
      if (result) success++;
      else failed++;
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Summary: ${success} succeeded, ${failed} failed`);
}

main().catch(console.error);
