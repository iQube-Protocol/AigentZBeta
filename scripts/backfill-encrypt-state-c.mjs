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
loadEnv({ path: path.resolve(__dirname, '../.env.local') });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 100;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MASTER_KEY = process.env.CONTENT_ENCRYPTION_MASTER_KEY;
const BUCKET = 'content-media';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[backfill] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}
if (!MASTER_KEY) {
  console.error('[backfill] CONTENT_ENCRYPTION_MASTER_KEY not set — generate with `openssl rand -base64 32`');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function pathFromStorageUrl(url) {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+)$/);
  return m ? m[1] : null;
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
  const enc = encryptBuffer(plaintext, id);
  const { error: upErr } = await sb.storage.from(BUCKET).upload(objectPath, enc.ciphertext, {
    upsert: true,
    contentType: 'application/octet-stream',
  });
  if (upErr) {
    console.log(`  ${table}/${id}  FAIL upload: ${upErr.message}`);
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
