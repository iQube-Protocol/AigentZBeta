import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export const runtime = 'nodejs';
export const maxDuration = 300;

const BUCKET = 'content-media';
const WIDTH = 1200;

function run(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => (err += d.toString()));
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`${cmd} failed (${code}): ${err}`))));
  });
}

async function downloadToFile(url: string, filePath: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(filePath, buf);
  return buf.length;
}

async function countPages(pdfPath: string) {
  const script = ['-q', '-dNODISPLAY', '-c', `(${pdfPath}) (r) file runpdfbegin pdfpagecount = quit`];
  return new Promise<number>((resolve, reject) => {
    const p = spawn('gs', script, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', d => (out += d.toString()));
    p.stderr.on('data', d => (err += d.toString()));
    p.on('close', code => {
      if (code !== 0) return reject(new Error(`gs pagecount failed: ${err}`));
      const n = Number(out.trim());
      if (!Number.isFinite(n) || n <= 0) return reject(new Error(`Invalid pagecount: "${out}"`));
      resolve(n);
    });
  });
}

async function renderPages(pdfPath: string, outDir: string) {
  const outPattern = path.join(outDir, 'page-%04d.png');
  await run('gs', [
    '-dSAFER', '-dBATCH', '-dNOPAUSE', '-sDEVICE=pngalpha', '-r150',
    `-sOutputFile=${outPattern}`, pdfPath
  ]);
}

async function convertToWebps(outDir: string) {
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

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  try {
    const { limit = 3, debug = false } = await req.json();
    
    // Debug: Check what PDFs exist
    if (debug) {
      const { data: allPdfs } = await supabase
        .from('codex_media_assets')
        .select('auto_drive_cid, pdf_lite_url, pages_ready, mime_type')
        .eq('mime_type', 'application/pdf')
        .limit(10);
      
      const { data: allQubes } = await supabase
        .from('master_content_qubes')
        .select('auto_drive_cid, pdf_lite_url, pages_ready')
        .not('pdf_lite_url', 'is', null)
        .limit(10);
      
      return NextResponse.json({ 
        debug: true,
        codex_media_assets: allPdfs,
        master_content_qubes: allQubes
      });
    }
    
    // Try master_content_qubes first since that's where pdf_lite_url was populated
    const { data: targets, error } = await supabase
      .from('master_content_qubes')
      .select('auto_drive_cid, pdf_lite_url, pages_ready')
      .not('pdf_lite_url', 'is', null)
      .or('pages_ready.is.null,pages_ready.eq.false')
      .limit(limit);

    if (error) throw error;
    if (!targets || targets.length === 0) {
      return NextResponse.json({ message: 'No PDFs to render', processed: 0 });
    }

    const results = [];
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfpages-'));

    for (const t of targets) {
      const cid = t.auto_drive_cid;
      const pdfLiteUrl = t.pdf_lite_url;

      try {
        const pdfPath = path.join(tmp, `${cid}.pdf`);
        const outDir = path.join(tmp, cid);
        await fs.mkdir(outDir, { recursive: true });

        await downloadToFile(pdfLiteUrl, pdfPath);
        const pagesCount = await countPages(pdfPath);
        await renderPages(pdfPath, outDir);
        const webps = await convertToWebps(outDir);

        const basePath = `pdf-pages/${cid}/w${WIDTH}`;
        for (const { webpName, webpPath } of webps) {
          const buf = await fs.readFile(webpPath);
          const remotePath = `${basePath}/${webpName}`;
          await supabase.storage.from(BUCKET).upload(remotePath, buf, {
            contentType: 'image/webp',
            upsert: true,
            cacheControl: '3600',
          });
        }

        await supabase.from('pdf_page_manifests').upsert({
          auto_drive_cid: cid,
          source_pdf_lite_url: pdfLiteUrl,
          pages_count: pagesCount,
          bucket: BUCKET,
          base_path: basePath,
          width: WIDTH,
        }, { onConflict: 'auto_drive_cid' });

        await supabase.from('codex_media_assets')
          .update({ pages_ready: true, pages_count: pagesCount })
          .eq('auto_drive_cid', cid);

        await supabase.from('master_content_qubes')
          .update({ pages_ready: true, pages_count: pagesCount })
          .eq('auto_drive_cid', cid);

        results.push({ cid, pagesCount, status: 'success' });
      } catch (e: any) {
        results.push({ cid, status: 'failed', error: e.message });
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
