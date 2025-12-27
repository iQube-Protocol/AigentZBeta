import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.PDF_PAGES_BUCKET || 'content-media';
const WIDTH = Number(process.env.PDF_PAGE_WIDTH || 1200);
const LIMIT = Number(process.env.LIMIT || 5);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let err = '';
    p.stderr.on('data', d => (err += d.toString()));
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`${cmd} failed (${code}): ${err}`))));
  });
}

async function downloadToFile(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(filePath, buf);
  return buf.length;
}

async function uploadWebp(localPath, remotePath) {
  const buf = await fs.readFile(localPath);
  const { error } = await supabase.storage.from(BUCKET).upload(remotePath, buf, {
    contentType: 'image/webp',
    upsert: true,
    cacheControl: '3600',
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(remotePath);
  return data.publicUrl;
}

async function upsertManifest({ cid, pdfLiteUrl, pagesCount, basePath }) {
  const { error } = await supabase
    .from('pdf_page_manifests')
    .upsert({
      auto_drive_cid: cid,
      source_pdf_lite_url: pdfLiteUrl,
      pages_count: pagesCount,
      bucket: BUCKET,
      base_path: basePath,
      width: WIDTH,
    }, { onConflict: 'auto_drive_cid' });

  if (error) throw error;
}

async function markPagesReady(cid, pagesCount) {
  const upd1 = await supabase.from('codex_media_assets')
    .update({ pages_ready: true, pages_count: pagesCount })
    .eq('auto_drive_cid', cid);

  if (upd1.error) console.warn('codex_media_assets update error:', upd1.error.message);

  const upd2 = await supabase.from('master_content_qubes')
    .update({ pages_ready: true, pages_count: pagesCount })
    .eq('auto_drive_cid', cid);

  if (upd2.error) console.warn('master_content_qubes update error:', upd2.error.message);
}

async function fetchTargets() {
  const { data, error } = await supabase
    .from('codex_media_assets')
    .select('auto_drive_cid, pdf_lite_url, pages_ready, mime_type')
    .eq('mime_type', 'application/pdf')
    .not('pdf_lite_url', 'is', null)
    .or('pages_ready.is.null,pages_ready.eq.false')
    .limit(LIMIT);

  if (error) throw error;
  return data || [];
}

async function countPagesWithGhostscript(pdfPath) {
  const script = ['-q', '-dNODISPLAY', '-c', `(${pdfPath}) (r) file runpdfbegin pdfpagecount = quit`];
  return new Promise((resolve, reject) => {
    const p = spawn('gs', script, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', d => (out += d.toString()));
    p.stderr.on('data', d => (err += d.toString()));
    p.on('close', code => {
      if (code !== 0) return reject(new Error(`gs pagecount failed: ${err}`));
      const n = Number(out.trim());
      if (!Number.isFinite(n) || n <= 0) return reject(new Error(`Invalid pagecount output: "${out}"`));
      resolve(n);
    });
  });
}

async function renderPages(pdfPath, outDir) {
  const outPattern = path.join(outDir, 'page-%04d.png');
  await run('gs', [
    '-dSAFER', '-dBATCH', '-dNOPAUSE', '-sDEVICE=pngalpha', '-r150',
    `-sOutputFile=${outPattern}`, pdfPath
  ]);
}

async function convertPngsToWebps(outDir) {
  const sharp = (await import('sharp')).default;
  const files = (await fs.readdir(outDir)).filter(f => f.endsWith('.png')).sort();
  const webps = [];

  for (const f of files) {
    const pngPath = path.join(outDir, f);
    const webpName = f.replace('page-', 'p').replace('.png', '.webp');
    const webpPath = path.join(outDir, webpName);

    const img = sharp(pngPath);
    const meta = await img.metadata();
    const w = meta.width || WIDTH;

    const pipeline = w > WIDTH ? img.resize({ width: WIDTH }) : img;
    await pipeline.webp({ quality: 75 }).toFile(webpPath);

    webps.push({ webpName, webpPath });
  }
  return webps;
}

(async () => {
  const targets = await fetchTargets();
  console.log(`Found ${targets.length} PDFs to render (limit=${LIMIT})`);

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfpages-'));

  for (const t of targets) {
    const cid = t.auto_drive_cid;
    const pdfLiteUrl = t.pdf_lite_url;

    console.log(`\n==> CID ${cid}`);
    try {
      const pdfPath = path.join(tmp, `${cid}.pdf`);
      const outDir = path.join(tmp, cid);
      await fs.mkdir(outDir, { recursive: true });

      const bytes = await downloadToFile(pdfLiteUrl, pdfPath);
      console.log(`Downloaded PDF lite: ${bytes} bytes`);

      const pagesCount = await countPagesWithGhostscript(pdfPath);
      console.log(`Pages: ${pagesCount}`);

      await renderPages(pdfPath, outDir);
      console.log(`Rendered PNG pages`);

      const webps = await convertPngsToWebps(outDir);
      console.log(`Converted to ${webps.length} WEBPs`);

      const basePath = `pdf-pages/${cid}/w${WIDTH}`;
      for (let i = 0; i < webps.length; i++) {
        const { webpName, webpPath } = webps[i];
        const remotePath = `${basePath}/${webpName}`;
        await uploadWebp(webpPath, remotePath);
        if ((i + 1) % 5 === 0) console.log(`Uploaded ${i + 1}/${webps.length}`);
      }

      await upsertManifest({ cid, pdfLiteUrl, pagesCount, basePath });
      await markPagesReady(cid, pagesCount);

      console.log(`✅ Done CID ${cid}: ${pagesCount} pages at ${basePath}/`);
    } catch (e) {
      console.error(`❌ CID ${cid} failed:`, e.message || e);
    }
  }

  console.log('\nAll done.');
})();
