#!/usr/bin/env node
/**
 * One-shot local recovery for orphaned video segments (EXP-002, 2026-07-05).
 *
 * The deployed stitch route failed with "ffmpeg binary unavailable" AFTER the
 * segment clips had generated — and the bundle-size cap forbids shipping
 * ffmpeg in the Lambda (see next.config.js note). This script completes the
 * stitch LOCALLY instead: it lists the orphaned clips, downloads the ones you
 * pick, concatenates them with your machine's ffmpeg, uploads the result to
 * Supabase storage, and prints the public URL.
 *
 * Prereqs: ffmpeg on PATH (macOS: `brew install ffmpeg`), .env.local with
 * NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (+ VENICE_API_KEY for
 * Venice clips).
 *
 * Usage:
 *   node scripts/recover-stitch-segments.mjs --list
 *   node scripts/recover-stitch-segments.mjs --stitch <ref1> <ref2> [ref3] [ref4]
 *
 * where each <ref> (in PLAY ORDER) is either:
 *   - an https URL (Sora clips — printed by --list), or
 *   - venice:<queueId>[:<model>]   (Venice clips — printed by --list;
 *     model defaults to kling-2.6-pro-text-to-video, same as the proxy route)
 */

import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');

const VENICE_VIDEO_BASE = 'https://api.venice.ai/api/v1/video';
const DEFAULT_VENICE_MODEL = 'kling-2.6-pro-text-to-video';
// Mirrors BUCKET_CANDIDATES in app/api/skills/video/stitch/route.ts
const BUCKET_CANDIDATES = ['content-assets', 'assets', 'codex-lite'];

function loadEnvLocal() {
  for (const file of ['.env.local', '.env.local.temp']) {
    const path = join(REPO, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf-8').split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  }
}

function requireFfmpeg() {
  const probe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf-8' });
  if (probe.error || probe.status !== 0) {
    console.error('ffmpeg not found on PATH. Install it first:  brew install ffmpeg');
    process.exit(1);
  }
}

async function supabase(path, { method = 'GET', body, headers = {} } = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...headers,
    },
    body,
  });
  return res;
}

async function listPrefix(bucket, prefix) {
  const res = await supabase(`/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prefix,
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    }),
  });
  if (!res.ok) return [];
  return res.json();
}

function publicUrl(bucket, path) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  return `${url}/storage/v1/object/public/${bucket}/${path}`;
}

async function listSegments() {
  for (const bucket of BUCKET_CANDIDATES) {
    const sora = (await listPrefix(bucket, 'generated/openai/videos')).filter((f) =>
      f.name?.endsWith('.mp4'),
    );
    const veniceThumbs = (await listPrefix(bucket, 'generated/venice/thumbnails')).filter((f) =>
      f.name?.endsWith('-thumb.jpg'),
    );
    if (sora.length === 0 && veniceThumbs.length === 0) continue;

    console.log(`\nRecoverable segments (bucket: ${bucket}, newest first):\n`);
    for (const f of sora) {
      console.log(`  [sora]   ${f.created_at ?? '?'}  ${publicUrl(bucket, `generated/openai/videos/${f.name}`)}`);
    }
    for (const f of veniceThumbs) {
      const queueId = f.name.replace(/-thumb\.jpg$/, '');
      console.log(`  [venice] ${f.created_at ?? '?'}  venice:${queueId}`);
    }
    console.log(
      '\nRe-run with:  node scripts/recover-stitch-segments.mjs --stitch <ref1> <ref2> ... (in play order)\n' +
        'Venice refs accept an optional model suffix:  venice:<queueId>:<model>  (default kling-2.6-pro)',
    );
    return;
  }
  console.log('No recoverable segments found in any bucket.');
}

async function downloadRef(ref, destPath) {
  if (ref.startsWith('venice:')) {
    const [, queueId, model] = ref.split(':');
    const apiKey = process.env.VENICE_API_KEY;
    if (!apiKey) throw new Error('VENICE_API_KEY missing from env/.env.local (needed for venice: refs)');
    const res = await fetch(`${VENICE_VIDEO_BASE}/retrieve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || DEFAULT_VENICE_MODEL,
        queue_id: queueId,
        delete_media_on_completion: false,
      }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => null);
      const remote =
        data?.video_url || data?.url || data?.media_url || data?.output?.url || data?.result?.url || data?.data?.url;
      if (!remote) {
        throw new Error(`venice retrieve for ${queueId}: no video (status=${data?.status ?? res.status}) — asset may have expired on Venice's side`);
      }
      const remoteRes = await fetch(remote);
      if (!remoteRes.ok) throw new Error(`venice remote fetch ${remoteRes.status} for ${queueId}`);
      writeFileSync(destPath, Buffer.from(await remoteRes.arrayBuffer()));
      return;
    }
    if (!res.ok) throw new Error(`venice retrieve ${res.status} for ${queueId}`);
    writeFileSync(destPath, Buffer.from(await res.arrayBuffer()));
    return;
  }
  const res = await fetch(ref);
  if (!res.ok) throw new Error(`clip fetch ${res.status} for ${ref.slice(0, 90)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0) throw new Error(`empty clip body for ${ref.slice(0, 90)}`);
  writeFileSync(destPath, buf);
}

async function stitch(refs) {
  requireFfmpeg();
  const tmp = mkdtempSync(join(tmpdir(), 'recover-stitch-'));
  try {
    console.log(`Downloading ${refs.length} clips…`);
    const localPaths = [];
    for (let i = 0; i < refs.length; i += 1) {
      const p = join(tmp, `clip${i}.mp4`);
      await downloadRef(refs[i], p);
      localPaths.push(p);
      console.log(`  ${i + 1}/${refs.length} ✓`);
    }

    const listPath = join(tmp, 'list.txt');
    writeFileSync(listPath, localPaths.map((p) => `file '${p}'`).join('\n'));
    const outPath = join(tmp, 'stitched.mp4');

    // Stream-copy first (same provider/model → same codec), re-encode fallback —
    // identical strategy to app/api/skills/video/stitch/route.ts.
    console.log('Stitching (stream-copy)…');
    try {
      execFileSync('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-movflags', '+faststart', '-y', outPath], { stdio: 'pipe' });
    } catch {
      console.log('Stream-copy failed — re-encoding…');
      execFileSync('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', listPath, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', '-y', outPath], { stdio: 'pipe' });
    }

    const stitched = readFileSync(outPath);
    // Deterministic id — same convention as the stitch route, so a re-run upserts.
    const stitchId = createHash('sha256').update(refs.join('|')).digest('hex').slice(0, 24);
    const storagePath = `generated/stitched/${stitchId}.mp4`;

    console.log(`Uploading ${(stitched.byteLength / 1024 / 1024).toFixed(1)} MB to Supabase…`);
    let uploaded = null;
    for (const bucket of BUCKET_CANDIDATES) {
      const res = await supabase(`/storage/v1/object/${bucket}/${storagePath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'video/mp4', 'x-upsert': 'true', 'Cache-Control': 'max-age=86400' },
        body: stitched,
      });
      if (res.ok) {
        uploaded = publicUrl(bucket, storagePath);
        break;
      }
    }
    if (!uploaded) throw new Error('upload failed in every candidate bucket');

    console.log('\n✅ Stitched video:');
    console.log(`   ${uploaded}\n`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (checked env + .env.local)');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  if (args[0] === '--list') return listSegments();
  if (args[0] === '--stitch') {
    const refs = args.slice(1);
    if (refs.length < 2 || refs.length > 4) {
      console.error('Provide 2–4 clip refs in play order after --stitch.');
      process.exit(1);
    }
    return stitch(refs);
  }
  console.log('Usage:\n  node scripts/recover-stitch-segments.mjs --list\n  node scripts/recover-stitch-segments.mjs --stitch <ref1> <ref2> [ref3] [ref4]');
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
