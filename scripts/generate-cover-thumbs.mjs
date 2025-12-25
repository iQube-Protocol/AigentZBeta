import 'dotenv/config';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

// REQUIRED ENV:
// SUPABASE_URL
// SUPABASE_SERVICE_ROLE_KEY
// AIGENT_API_BASE   (e.g. http://localhost:3000 OR https://dev-beta.aigentz.me)
// LIMIT             (optional, default 25)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE = process.env.AIGENT_API_BASE;
const LIMIT = Number(process.env.LIMIT || 25);

if (!SUPABASE_URL || !SUPABASE_KEY || !API_BASE) {
  console.error('Missing env. Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AIGENT_API_BASE');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function fetchMissingCovers() {
  // Prefer codex_media_assets first
  const { data, error } = await supabase
    .from('codex_media_assets')
    .select('id, auto_drive_cid, mime_type, cover_thumb_url')
    .is('cover_thumb_url', null)
    .not('auto_drive_cid', 'is', null)
    .limit(LIMIT);

  if (error) throw error;
  return data ?? [];
}

async function downloadCoverBytes(cid) {
  // Use existing decrypting cover endpoint
  const url = `${API_BASE}/api/content/cover/${cid}?variant=full`;
  console.log(`  Downloading from: ${url}`);
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Cover download failed ${res.status} ${cid}: ${text.slice(0, 120)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, contentType: res.headers.get('content-type') || 'image/jpeg' };
}

async function toWebpThumb(buf) {
  // 900px wide, quality tuned for speed and size
  return await sharp(buf)
    .resize({ width: 900, withoutEnlargement: true })
    .webp({ quality: 65, effort: 4 })
    .toBuffer();
}

async function uploadThumb(cid, webpBuf) {
  const path = `covers/${cid}.webp`;

  const { error: uploadError } = await supabase.storage
    .from('codex-lite')
    .upload(path, webpBuf, {
      contentType: 'image/webp',
      upsert: true,
      cacheControl: '3600',
    });

  if (uploadError) throw uploadError;

  // Public bucket: build URL
  const { data } = supabase.storage.from('codex-lite').getPublicUrl(path);
  return data.publicUrl;
}

async function updateRow(id, url) {
  const { error } = await supabase
    .from('codex_media_assets')
    .update({ cover_thumb_url: url })
    .eq('id', id);

  if (error) throw error;
}

(async () => {
  try {
    console.log('=== Cover Thumbnail Generator ===');
    console.log(`API Base: ${API_BASE}`);
    console.log(`Limit: ${LIMIT}`);
    console.log('');

    const rows = await fetchMissingCovers();
  console.log(`Found ${rows.length} covers to process\n`);

  let success = 0;
  let failed = 0;

  for (const r of rows) {
    const cid = r.auto_drive_cid;
    try {
      console.log(`[${success + failed + 1}/${rows.length}] Processing ${cid}...`);
      const { buf } = await downloadCoverBytes(cid);
      console.log(`  Downloaded: ${buf.length} bytes`);
      const webp = await toWebpThumb(buf);
      console.log(`  Converted to WebP: ${webp.length} bytes`);
      const url = await uploadThumb(cid, webp);
      await updateRow(r.id, url);
      console.log(`  ✅ Uploaded: ${url}\n`);
      success++;
    } catch (e) {
      console.error(`  ❌ Failed:`, e.message || e);
      console.error('');
      failed++;
    }
  }

  console.log('=== Summary ===');
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${rows.length}`);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
