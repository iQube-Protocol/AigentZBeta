import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE = process.env.AIGENT_API_BASE;
const LIMIT = Number(process.env.LIMIT || 10);

if (!SUPABASE_URL || !SUPABASE_KEY || !API_BASE) {
  console.error('Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AIGENT_API_BASE');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function fetchTargets() {
  const { data, error } = await supabase
    .from('codex_media_assets')
    .select('id, auto_drive_cid, mime_type, pdf_lite_url')
    .is('pdf_lite_url', null)
    .eq('mime_type', 'application/pdf')
    .limit(LIMIT);

  if (error) throw error;
  return data ?? [];
}

async function downloadPdf(cid) {
  const url = `${API_BASE}/api/content/pdf/${cid}`;
  console.log(`  Downloading from: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PDF download failed ${res.status}: ${text.slice(0, 160)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

function runGhostscript(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      '-dPDFSETTINGS=/ebook',
      '-dDetectDuplicateImages=true',
      '-dDownsampleColorImages=true',
      '-dColorImageResolution=150',
      '-dNOPAUSE',
      '-dBATCH',
      '-dQUIET',
      `-sOutputFile=${outputPath}`,
      inputPath,
    ];

    const p = spawn('gs', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let err = '';
    p.stderr.on('data', (d) => (err += d.toString()));

    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Ghostscript failed (${code}): ${err.slice(0, 500)}`));
    });
  });
}

async function uploadLite(cid, pdfBuf) {
  const objectPath = `pdf-lite/${cid}.pdf`;
  const { error } = await supabase.storage
    .from('codex-lite')
    .upload(objectPath, pdfBuf, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: '3600',
    });
  if (error) throw error;

  const { data } = supabase.storage.from('codex-lite').getPublicUrl(objectPath);
  return data.publicUrl;
}

async function updateRow(id, url) {
  const { error } = await supabase
    .from('codex_media_assets')
    .update({ pdf_lite_url: url })
    .eq('id', id);
  if (error) throw error;
}

(async () => {
  console.log('=== PDF-lite Generator ===');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Limit: ${LIMIT}`);
  console.log('');

  const rows = await fetchTargets();
  console.log(`Found ${rows.length} PDFs to process\n`);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-lite-'));
  console.log(`Temp directory: ${tmpDir}\n`);

  let success = 0;
  let failed = 0;

  for (const r of rows) {
    const cid = r.auto_drive_cid;
    try {
      console.log(`[${success + failed + 1}/${rows.length}] Processing ${cid}...`);

      const original = await downloadPdf(cid);
      console.log(`  Downloaded: ${original.length} bytes`);

      const inPath = path.join(tmpDir, `${cid}.pdf`);
      const outPath = path.join(tmpDir, `${cid}.lite.pdf`);
      await fs.writeFile(inPath, original);

      console.log(`  Running Ghostscript...`);
      await runGhostscript(inPath, outPath);

      const liteBuf = await fs.readFile(outPath);
      console.log(`  Compressed to: ${liteBuf.length} bytes (${Math.round((liteBuf.length / original.length) * 100)}% of original)`);

      const url = await uploadLite(cid, liteBuf);
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
  console.log(`\nTemp directory: ${tmpDir} (can be deleted)`);
})();
