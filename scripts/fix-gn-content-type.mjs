#!/usr/bin/env node
/**
 * Re-upload the GN gn_still master with Content-Type: application/pdf.
 *
 * The file at codex/masters/metaKnyts/episode_print/ep00_1777828107652.pdf
 * was originally uploaded by the encrypted-master API pipeline, which sets
 * Content-Type to application/octet-stream. Browsers refuse to render
 * octet-stream inline — they always download — so PDFLiteReaderModal can't
 * show the GN even with <object>. Supabase storage.objects.metadata edits
 * only update the Postgres row, not the actual S3 object's Content-Type
 * header, and dashboard re-uploads silently skip when a file already exists
 * at the path.
 *
 * This script downloads the file, deletes it, and uploads back with the
 * correct contentType. Same path, same row in master_content_qubes.
 *
 * Usage:
 *   node scripts/fix-gn-content-type.mjs
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const BUCKET = 'content-media';
const FILE_PATH = 'codex/masters/metaKnyts/episode_print/ep00_1777828107652.pdf';

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function main() {
  console.log(`Target: ${BUCKET}/${FILE_PATH}`);

  console.log('1/3 Downloading current file...');
  const dlStart = Date.now();
  const { data: blob, error: dlErr } = await sb.storage.from(BUCKET).download(FILE_PATH);
  if (dlErr) {
    console.error('Download failed:', dlErr.message || dlErr);
    process.exit(1);
  }
  const sizeMB = (blob.size / 1024 / 1024).toFixed(1);
  const dlSec = ((Date.now() - dlStart) / 1000).toFixed(1);
  console.log(`    Downloaded ${sizeMB} MB in ${dlSec}s`);

  console.log('2/3 Removing existing object (so the re-upload sets fresh metadata)...');
  const { error: rmErr } = await sb.storage.from(BUCKET).remove([FILE_PATH]);
  if (rmErr) {
    console.error('Remove failed:', rmErr.message || rmErr);
    process.exit(1);
  }
  console.log('    Removed.');

  console.log(`3/3 Re-uploading with contentType=application/pdf...`);
  const upStart = Date.now();
  const { error: upErr } = await sb.storage.from(BUCKET).upload(FILE_PATH, blob, {
    contentType: 'application/pdf',
    cacheControl: '3600',
    upsert: true,
  });
  if (upErr) {
    console.error('Upload failed:', upErr.message || upErr);
    console.error('!!! File was deleted in step 2 and NOT restored. Re-run this script with the file in hand, or restore from Supabase backup.');
    process.exit(1);
  }
  const upSec = ((Date.now() - upStart) / 1000).toFixed(1);
  console.log(`    Uploaded in ${upSec}s`);

  console.log('\n✅ Done. Verify with:');
  console.log(`    curl -I "${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${FILE_PATH}"`);
  console.log('Expected: content-type: application/pdf');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
