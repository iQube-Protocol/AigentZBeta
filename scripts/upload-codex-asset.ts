#!/usr/bin/env -S node --import tsx/esm
/**
 * Local codex asset uploader — bypasses the AWS Lambda 6MB request body cap
 * that blocks /api/admin/codex/upload-asset for anything over ~5MB.
 *
 * Runs the SAME encryption + Autonomys + iQube registry + codex_media_assets
 * pipeline as the API route, just from the operator's machine where there's
 * no payload limit. Use whenever an upload comes back 413.
 *
 * Setup (one-time):
 *   1. Make sure .env.local has AUTONOMYS_API_KEY, SUPABASE_SERVICE_ROLE_KEY,
 *      NEXT_PUBLIC_SUPABASE_URL, and CODEX_MASTER_KEY. CODEX_MASTER_KEY must
 *      be the SAME value that's set in Amplify for dev — encryptionService
 *      wraps every content key with it, and the prod /api/content/*
 *      decryption routes will fail if a different key was used here.
 *   2. npm install tsx (or use npx tsx).
 *
 * Usage:
 *   npx tsx scripts/upload-codex-asset.ts \
 *     --file ./KnytRush-front.png \
 *     --title "KNYT Rush front" \
 *     --assetKind character_poster \
 *     --episodeNumber 11 \
 *     --series metaKnyts
 *
 *   Optional flags:
 *     --variantName "KnytRush"
 *     --rarityTier rare
 *     --editionMax 1656
 *     --priceAmount 200       (Q¢ — only if the asset has its own price)
 *     --paymentType one-time
 *     --paymentSurface overlay
 *     --displayMode image
 *     --isShareable
 *
 * Notes:
 * - episodeNumber for character_poster uses the DB convention (pricing+1).
 *   Character #10 (display) → episodeNumber=11.
 * - On success the script prints { id, cid, metaQubeId, blakQubeId,
 *   tokenQubeId } so you can verify the row in Supabase.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import {
  uploadCodexMediaAsset,
  type CodexAssetKind,
} from '../server/services/autonomysContentService';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '..', '.env.local') });

function getArg(name: string, required = false): string | undefined {
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

function getFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function mimeFromExt(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mov') return 'video/quicktime';
  return 'application/octet-stream';
}

async function main() {
  const filePath = getArg('file', true)!;
  const title = getArg('title', true)!;
  const assetKind = getArg('assetKind', true)! as CodexAssetKind;
  const episodeNumberStr = getArg('episodeNumber');
  const series = getArg('series') || 'metaKnyts';
  const variantName = getArg('variantName');
  const rarityTier = getArg('rarityTier') as 'legendary' | 'epic' | 'rare' | 'common' | undefined;
  const editionMaxStr = getArg('editionMax');
  const priceAmountStr = getArg('priceAmount');
  const paymentType = getArg('paymentType') as 'one-time' | 'subscription' | undefined;
  const paymentSurface = getArg('paymentSurface') as 'overlay' | 'embedded' | 'liquid' | undefined;
  const displayMode = getArg('displayMode') as 'pdf' | 'image' | 'video' | 'text_extract' | undefined;
  const recommendedTask = getArg('recommendedTask');
  const isShareable = getFlag('isShareable');

  // Fail fast before doing 20MB of Autonomys upload work if the master key
  // isn't loaded — otherwise encryptionService.wrapKeyWithMasterKey throws
  // AFTER the upload completes, wasting bandwidth + leaving an orphan CID.
  const requiredEnv = [
    'CODEX_MASTER_KEY',
    'AUTONOMYS_API_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
  ];
  const missing = requiredEnv.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing required env vars in .env.local: ${missing.join(', ')}`);
    console.error('CODEX_MASTER_KEY must match the value configured in Amplify for dev.');
    process.exit(1);
  }

  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }
  const buffer = fs.readFileSync(absPath);
  const mimeType = mimeFromExt(absPath);

  console.log(`[upload-codex-asset] ${title}`);
  console.log(`  file:       ${absPath}`);
  console.log(`  size:       ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`  mime:       ${mimeType}`);
  console.log(`  assetKind:  ${assetKind}`);
  console.log(`  ep number:  ${episodeNumberStr ?? '(none)'}`);
  console.log(`  series:     ${series}`);

  try {
    const result = await uploadCodexMediaAsset({
      file: buffer,
      mimeType,
      title,
      assetKind,
      episodeNumber: episodeNumberStr ? parseInt(episodeNumberStr, 10) : undefined,
      series,
      variantName,
      rarityTier,
      editionMax: editionMaxStr ? parseInt(editionMaxStr, 10) : undefined,
      priceAmount: priceAmountStr ? Number(priceAmountStr) : undefined,
      paymentType,
      paymentSurface,
      isShareable,
      recommendedTask,
      displayMode,
    });
    console.log('\n[upload-codex-asset] SUCCESS');
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error('\n[upload-codex-asset] FAILED:', err?.message || err);
    if (err?.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
