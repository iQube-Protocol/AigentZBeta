#!/usr/bin/env node
/**
 * Self-contained codex asset uploader. Bypasses the tsx + @supabase/supabase-js
 * + @peculiar/webcrypto stack that the original upload-codex-asset.ts depends
 * on — uses ONLY Node built-ins (crypto, fs, fetch) plus @autonomys/auto-drive
 * for the chunked Autonomys upload. Works on Node 18+ regardless of which
 * version the shell resolves.
 *
 * Mirrors uploadCodexMediaAsset() in server/services/autonomysContentService.ts
 * line-for-line for the encryption + iQube registry writes so the resulting
 * row is byte-compatible with production /api/content/cover decryption.
 *
 * Usage:
 *   node scripts/upload-codex-asset-direct.mjs \
 *     --file "public/KnytRush front.png" \
 *     --title "KNYT Rush front" \
 *     --assetKind character_poster \
 *     --episodeNumber 11 \
 *     --series metaKnyts
 *
 *   Optional flags (same as the old script):
 *     --variantName --rarityTier --editionMax --priceAmount
 *     --paymentType --paymentSurface --displayMode --isShareable
 *
 * Requires in .env.local:
 *   CODEX_MASTER_KEY (same value as Amplify)
 *   AUTONOMYS_API_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Minimal dotenv parser — same semantics as `dotenv` for our purposes,
//    avoids the dotenvx interceptor monkey-patching the env at import time.
function loadEnvLocal() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error(`Cannot find .env.local at ${envPath}`);
    process.exit(1);
  }
  const text = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

// ── Args
function getArg(name, required = false) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || idx === process.argv.length - 1) {
    if (required) {
      console.error(`Missing required --${name}`);
      process.exit(1);
    }
    return undefined;
  }
  return process.argv[idx + 1];
}
function getFlag(name) {
  return process.argv.includes(`--${name}`);
}

const filePath = getArg('file', true);
const title = getArg('title', true);
const assetKind = getArg('assetKind', true);
const episodeNumberStr = getArg('episodeNumber');
const series = getArg('series') || 'metaKnyts';
const variantName = getArg('variantName');
const rarityTier = getArg('rarityTier');
const editionMaxStr = getArg('editionMax');
const priceAmountStr = getArg('priceAmount');
const paymentType = getArg('paymentType');
const paymentSurface = getArg('paymentSurface');
const displayMode = getArg('displayMode') || 'image';
const recommendedTask = getArg('recommendedTask');
const isShareable = getFlag('isShareable');
const episodeNumber = episodeNumberStr ? parseInt(episodeNumberStr, 10) : undefined;
const editionMax = editionMaxStr ? parseInt(editionMaxStr, 10) : undefined;
const priceAmount = priceAmountStr ? Number(priceAmountStr) : undefined;

// ── Preflight env check
const REQUIRED_ENV = [
  'CODEX_MASTER_KEY',
  'AUTONOMYS_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length) {
  console.error(`Missing env vars in .env.local: ${missingEnv.join(', ')}`);
  process.exit(1);
}
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MASTER_KEY = process.env.CODEX_MASTER_KEY;
const AUTONOMYS_API_KEY = process.env.AUTONOMYS_API_KEY;

// ── File
const absPath = path.resolve(filePath);
if (!fs.existsSync(absPath)) {
  console.error(`File not found: ${absPath}`);
  process.exit(1);
}
const fileBuffer = fs.readFileSync(absPath);
const mimeType = (() => {
  const ext = path.extname(absPath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mov') return 'video/quicktime';
  return 'application/octet-stream';
})();

// ── Crypto helpers — mirror server/services/encryptionService.ts exactly
const ENC_ALG = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;

function encryptContent(plaintext, key) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ENC_ALG, key, iv, { authTagLength: TAG_LEN });
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

function wrapKeyWithMasterKey(contentKey) {
  // Match encryptionService.wrapKeyWithMasterKey: SHA-256(MASTER_KEY) as wrapping key,
  // store iv || authTag || wrappedKey as base64.
  const masterKeyBuf = crypto.createHash('sha256').update(MASTER_KEY).digest();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ENC_ALG, masterKeyBuf, iv, { authTagLength: TAG_LEN });
  const wrapped = Buffer.concat([cipher.update(contentKey), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, wrapped]);
  return { keyCiphertext: combined.toString('base64'), wrappingAlgorithm: 'AES-256-GCM-WRAP' };
}

function computeChecksum(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// ── Supabase REST helpers (no @supabase/supabase-js)
async function supaInsert(table, row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase insert into ${table} failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

// ── Main pipeline
async function main() {
  console.log(`[upload-direct] ${title}`);
  console.log(`  file:       ${absPath}`);
  console.log(`  size:       ${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`  mime:       ${mimeType}`);
  console.log(`  assetKind:  ${assetKind}`);
  console.log(`  ep number:  ${episodeNumber ?? '(none)'}`);
  console.log(`  series:     ${series}`);

  // 1. Encrypt
  const contentKey = crypto.randomBytes(KEY_LEN);
  const encrypted = encryptContent(fileBuffer, contentKey);
  const checksum = computeChecksum(fileBuffer);
  console.log(`[upload-direct] Encrypted ${fileBuffer.length} bytes`);

  // 2. Upload to Autonomys (dynamic import so any module evaluation errors
  //    surface AFTER env is loaded)
  const { createAutoDriveApi } = await import('@autonomys/auto-drive');
  const api = createAutoDriveApi({ apiKey: AUTONOMYS_API_KEY, network: 'mainnet' });
  console.log(`[upload-direct] Uploading to Autonomys (mainnet)...`);

  const isLarge = encrypted.ciphertext.length > 5 * 1024 * 1024;
  const uploadOptions = { compression: false };
  if (isLarge) {
    uploadOptions.uploadChunkSize = 256 * 1024;
    uploadOptions.onProgress = (p) => {
      if (p % 10 === 0 || p === 100) console.log(`[upload-direct] Progress: ${p}%`);
    };
  }

  let cid;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      cid = await api.uploadFileFromBuffer(encrypted.ciphertext, `${title}.enc`, uploadOptions);
      if (cid) break;
    } catch (err) {
      console.error(`[upload-direct] Attempt ${attempt}/5 failed:`, err?.message || err);
      if (attempt === 5) throw err;
      const delay = Math.min(3000 * Math.pow(2, attempt - 1), 30000);
      console.log(`[upload-direct] Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  if (!cid) throw new Error('Upload failed after 5 attempts');
  console.log(`[upload-direct] CID: ${cid}`);

  // 3. Wrap content key
  const wrappedKey = wrapKeyWithMasterKey(contentKey);

  // 4. Build iQube triad
  const slugBase = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const slug = episodeNumber
    ? `mk-ep${String(episodeNumber).padStart(2, '0')}-${slugBase}`
    : `mk-${slugBase}`;

  const metaQubeRow = {
    name: title,
    slug,
    qube_type: 'media_asset',
    series,
    episode_number: episodeNumber ?? null,
    tags: ['metaknyts', assetKind, ...(rarityTier ? [rarityTier] : [])],
    description: `${assetKind.replace(/_/g, ' ')} asset${
      episodeNumber ? ` for Episode ${episodeNumber}` : ''
    }`,
    preview_url: null,
    metadata:
      typeof priceAmount === 'number'
        ? {
            pricing: {
              amount: priceAmount,
              currency: 'Q¢',
              paymentType: paymentType || 'one-time',
              paymentSurface: paymentSurface || 'overlay',
            },
          }
        : {},
  };

  let metaQube;
  try {
    metaQube = await supaInsert('iq_meta_qubes', metaQubeRow);
  } catch (e) {
    // Retry once with a uniquified slug if there's a unique-constraint clash.
    if (String(e?.message || '').includes('duplicate key')) {
      metaQubeRow.slug = `${slug}-${Date.now()}`;
      metaQube = await supaInsert('iq_meta_qubes', metaQubeRow);
    } else {
      throw e;
    }
  }
  console.log(`[upload-direct] metaQube id: ${metaQube.id}`);

  const blakQube = await supaInsert('iq_blak_qubes', {
    payload_pointer: cid,
    payload_type: mimeType,
    payload_provider: 'autonomys',
    payload_size: fileBuffer.length,
    encryption_alg: ENC_ALG,
    encryption_iv: encrypted.iv,
    encryption_auth_tag: encrypted.authTag,
    checksum,
  });
  console.log(`[upload-direct] blakQube id: ${blakQube.id}`);

  const tokenQube = await supaInsert('iq_token_qubes', {
    key_ciphertext: wrappedKey.keyCiphertext,
    key_wrapping_alg: wrappedKey.wrappingAlgorithm,
    key_type: 'AES-256',
    access_policy: {},
  });
  console.log(`[upload-direct] tokenQube id: ${tokenQube.id}`);

  // 5. Insert codex_media_assets row
  const asset = await supaInsert('codex_media_assets', {
    title,
    supabase_title: title,
    episode_number: episodeNumber ?? null,
    asset_kind: assetKind,
    series,
    auto_drive_cid: cid,
    mime_type: mimeType,
    file_size: fileBuffer.length,
    encryption_alg: ENC_ALG,
    encryption_iv: encrypted.iv,
    encryption_auth_tag: encrypted.authTag,
    token_qube_id: tokenQube.id,
    meta_qube_id: metaQube.id,
    blak_qube_id: blakQube.id,
    is_shareable: isShareable,
    recommended_task: recommendedTask ?? null,
    variant_name: variantName ?? null,
    rarity_tier: rarityTier ?? null,
    edition_max: editionMax ?? null,
    edition_minted: 0,
    random_weight: 1,
    display_mode: displayMode,
    status: 'active',
  });
  console.log(`\n[upload-direct] SUCCESS`);
  console.log(
    JSON.stringify(
      {
        id: asset.id,
        cid,
        metaQubeId: metaQube.id,
        blakQubeId: blakQube.id,
        tokenQubeId: tokenQube.id,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error('\n[upload-direct] FAILED:', err?.message || err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});
