#!/usr/bin/env node
/**
 * Phase 2.5 — backfill: encrypt legacy unencrypted Supabase content (state-C).
 *
 * Run mode (operator-triggered):
 *
 *   # Dry run — list rows that would be encrypted, no writes
 *   node scripts/backfill-encrypt-state-c.mjs --dry-run
 *
 *   # Live run — encrypt in place
 *   node scripts/backfill-encrypt-state-c.mjs
 *
 *   # Limit
 *   node scripts/backfill-encrypt-state-c.mjs --limit=3
 *
 *   # With per-row plaintext backup (recommended for live runs).
 *   # Atomic: each row is written to disk + size-verified BEFORE
 *   # encryption proceeds. If backup fails the row is skipped.
 *   node scripts/backfill-encrypt-state-c.mjs --backup-to=./backfill-backups
 *
 * Required env (loaded from .env.local automatically):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   CONTENT_ENCRYPTION_MASTER_KEY  (32 bytes base64 — see Phase 2.0 doc)
 *
 * What it does, per row:
 *   1. Reads master_content_qubes / codex_media_assets where
 *      content_state='C' AND (encryption_iv IS NULL OR encryption_iv='')
 *   2. Downloads bytes from Supabase Storage at the parsed path
 *   3. Encrypts in memory (AES-256-GCM, HKDF-derived per-asset key)
 *   4. Re-uploads ciphertext (overwrite)
 *   5. Updates the row with encryption_iv, encryption_auth_tag,
 *      encryption_key_id='v1'
 *
 * Idempotency: rows where encryption_iv is already set are skipped.
 *
 * Backup recommended before live run: snapshot the content-media bucket
 * via Supabase dashboard. The encrypt-in-place is reversible only if
 * the original plaintext is preserved elsewhere.
 */

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createCipheriv, randomBytes, hkdfSync } from 'node:crypto';

// Inlined from services/content/encryption.ts so the script is standalone
// (no tsx / no transpiler needed). Keep these in sync if the TS version
// changes — both must produce identical ciphertexts for a given (master,
// masterId) pair.
const HKDF_INFO_V1 = 'aigentz-content-v1';
function getMasterKey() {
  const raw = process.env.CONTENT_ENCRYPTION_MASTER_KEY || '';
  let buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) buf = Buffer.from(raw, 'hex');
  if (buf.length !== 32) {
    throw new Error(`CONTENT_ENCRYPTION_MASTER_KEY invalid length (${buf.length}, expected 32)`);
  }
  return buf;
}
function deriveAssetKey(masterId) {
  return Buffer.from(hkdfSync('sha256', getMasterKey(), Buffer.from(masterId, 'utf8'), HKDF_INFO_V1, 32));
}
function encryptBuffer(plaintext, masterId) {
  const key = deriveAssetKey(masterId);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  key.fill(0);
  return { ciphertext, iv, authTag, keyId: 'v1' };
}
function ivToBase64(iv) { return iv.toString('base64'); }
function authTagToBase64(t) { return t.toString('base64'); }

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// override: true — dotenv v17 default is "do not overwrite existing env",
// so a stale empty CONTENT_ENCRYPTION_MASTER_KEY in the shell silently
// shadows the .env.local value. This forces .env.local to win.
loadEnv({ path: path.resolve(__dirname, '../.env.local'), override: true });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 100;
const backupArg = args.find((a) => a.startsWith('--backup-to='));
const backupDir = backupArg ? backupArg.split('=')[1] : null;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MASTER_KEY = process.env.CONTENT_ENCRYPTION_MASTER_KEY;
const BUCKET = 'content-media';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[backfill] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}
if (!MASTER_KEY) {
  console.error('[backfill] CONTENT_ENCRYPTION_MASTER_KEY not set in process.env after .env.local load.');
  console.error('[backfill] Diagnostics:');
  console.error('  - .env.local path:', path.resolve(__dirname, '../.env.local'));
  console.error('  - var present in process.env:', 'CONTENT_ENCRYPTION_MASTER_KEY' in process.env);
  console.error('  - var value length:', (process.env.CONTENT_ENCRYPTION_MASTER_KEY || '').length);
  console.error('[backfill] Common causes:');
  console.error('  - .env.local has the var on a line with quotes/spaces that broke parsing');
  console.error('  - shell has CONTENT_ENCRYPTION_MASTER_KEY="" exported (overrides dotenv unless override:true)');
  console.error('  - .env.local was edited but the wrong path was loaded');
  console.error('[backfill] Verify with: grep CONTENT_ENCRYPTION_MASTER_KEY .env.local');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
  // Node 18 has no native WebSocket. The supabase-js client unconditionally
  // initialises a RealtimeClient even when you only use storage/postgrest,
  // so we hand it the `ws` polyfill. Drop this branch when Node ≥20 lands.
  realtime: {
    transport: (await import('ws')).default,
  },
});

function pathFromStorageUrl(url) {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+)$/);
  return m ? m[1] : null;
}

/**
 * Upload bytes to Supabase Storage using the resumable / TUS protocol.
 * Handles files larger than the simple .upload() endpoint can manage
 * (which fails with `fetch failed` on the default Node 18 fetch timeouts
 * when the file is more than a few MB and the connection is slow).
 *
 * Falls back to a single PUT for small files since the resumable
 * handshake adds latency we don't need for sub-MB content.
 */
async function uploadCiphertext(bucket, objectPath, ciphertext) {
  // Small files — keep the simple path (low latency, fewer round trips)
  if (ciphertext.byteLength < 5 * 1024 * 1024) {
    const { error } = await sb.storage.from(bucket).upload(objectPath, ciphertext, {
      upsert: true,
      contentType: 'application/octet-stream',
    });
    if (error) throw new Error(error.message);
    return;
  }

  // Large files — TUS resumable chunked upload via tus-js-client. This
  // is the same protocol Supabase's dashboard uses internally; chunks
  // default to 6MB and the upload survives transient socket drops
  // (UND_ERR_SOCKET on Node 18) by resuming from the last acked offset.
  const tus = await import('tus-js-client');
  const totalBytes = ciphertext.byteLength;
  let lastReported = 0;
  await new Promise((resolve, reject) => {
    const upload = new tus.Upload(ciphertext, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${SERVICE_KEY}`,
        'x-upsert': 'true',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: objectPath,
        contentType: 'application/octet-stream',
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024,
      onError: (err) => reject(err),
      onProgress: (uploaded, total) => {
        // Throttle progress logs to ~10% increments
        const pct = Math.floor((uploaded / total) * 10) * 10;
        if (pct > lastReported) {
          lastReported = pct;
          console.log(`    [tus] ${pct}% (${uploaded}/${total} bytes)`);
        }
      },
      onSuccess: () => resolve(),
    });
    console.log(`    [tus] starting resumable upload size=${totalBytes} target=${objectPath}`);
    upload.start();
  });
}

async function processRow(table, row) {
  const id = row.id;
  const url = row.wip_storage_url || row.auto_drive_cid;
  const objectPath = pathFromStorageUrl(url);
  if (!objectPath) {
    console.log(`  ${table}/${id}  SKIP — could not parse path from ${url}`);
    return { ok: false, reason: 'unparseable-url' };
  }
  if (dryRun) {
    console.log(`  ${table}/${id}  DRY-RUN — would encrypt ${objectPath}`);
    return { ok: true, dryRun: true };
  }

  const { data: blob, error: dlErr } = await sb.storage.from(BUCKET).download(objectPath);
  if (dlErr || !blob) {
    console.log(`  ${table}/${id}  FAIL download: ${dlErr?.message || 'no data'}`);
    return { ok: false, reason: 'download-failed' };
  }
  const plaintext = Buffer.from(await blob.arrayBuffer());

  // Atomic backup-before-encrypt: when --backup-to is set, write
  // plaintext to disk and verify the file exists at the expected
  // size BEFORE encryption proceeds. Any backup failure aborts the
  // row — no data lost.
  if (backupDir) {
    const safeName = `${table}__${id}__${path.basename(objectPath)}`.replace(/[/\\]/g, '_');
    const backupPath = path.join(backupDir, safeName);
    try {
      await fs.mkdir(backupDir, { recursive: true });
      await fs.writeFile(backupPath, plaintext);
      const stat = await fs.stat(backupPath);
      if (stat.size !== plaintext.byteLength) {
        throw new Error(`backup size mismatch: ${stat.size} vs ${plaintext.byteLength}`);
      }
      console.log(`  ${table}/${id}  backup → ${backupPath}`);
    } catch (e) {
      console.log(`  ${table}/${id}  FAIL backup: ${e.message}`);
      return { ok: false, reason: 'backup-failed' };
    }
  }

  const enc = encryptBuffer(plaintext, id);
  try {
    await uploadCiphertext(BUCKET, objectPath, enc.ciphertext);
  } catch (e) {
    console.log(`  ${table}/${id}  FAIL upload: ${e.message}`);
    return { ok: false, reason: 'upload-failed' };
  }
  const { error: updErr } = await sb
    .from(table)
    .update({
      encryption_iv: ivToBase64(enc.iv),
      encryption_auth_tag: authTagToBase64(enc.authTag),
      encryption_key_id: enc.keyId,
    })
    .eq('id', id);
  if (updErr) {
    console.log(`  ${table}/${id}  FAIL row update: ${updErr.message}`);
    return { ok: false, reason: 'row-update-failed' };
  }
  console.log(`  ${table}/${id}  OK (${plaintext.byteLength} bytes → ciphertext)`);
  return { ok: true };
}

async function main() {
  console.log(`[backfill] mode=${dryRun ? 'DRY RUN' : 'LIVE'}  limit=${limit}`);

  const tables = ['master_content_qubes', 'codex_media_assets'];
  const summary = { processed: 0, encrypted: 0, skipped: 0, failed: 0 };

  for (const table of tables) {
    const { data, error } = await sb
      .from(table)
      .select('id, wip_storage_url, auto_drive_cid, encryption_iv')
      .eq('content_state', 'C')
      .or('encryption_iv.is.null,encryption_iv.eq.')
      .limit(limit);

    if (error) {
      console.error(`[backfill] ${table} query failed: ${error.message}`);
      continue;
    }

    console.log(`\n[backfill] ${table}: ${data?.length || 0} rows to process`);
    for (const row of data || []) {
      summary.processed++;
      const r = await processRow(table, row);
      if (r.ok) {
        if (r.dryRun) summary.skipped++;
        else summary.encrypted++;
      } else summary.failed++;
    }
  }

  console.log(`\n[backfill] summary: processed=${summary.processed} encrypted=${summary.encrypted} skipped=${summary.skipped} failed=${summary.failed}`);
  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('[backfill] fatal:', e);
  process.exit(1);
});
