#!/usr/bin/env node
/**
 * Encrypt a single state-C asset offline. Use when the file is too
 * large for the in-script upload path (the master GN PDF, 350MB+).
 *
 * Flow:
 *   1. Reads plaintext from ./backfill-backups/<table>__<id>__<filename>
 *      (or any --in path)
 *   2. Encrypts with the same HKDF-derived per-asset key as the spine
 *   3. Writes ciphertext to ./backfill-backups/<filename>.ciphertext
 *   4. Prints the SQL UPDATE to apply the iv + auth_tag + key_id to
 *      the row (manual run in Supabase SQL editor)
 *   5. Operator uploads ciphertext via Supabase dashboard (drag-drop
 *      replaces the existing object at the same path)
 *
 * Usage:
 *   node scripts/encrypt-large-file.mjs \
 *     --master-id=mk_ep00_print_common \
 *     --in=./backfill-backups/master_content_qubes__mk_ep00_print_common__ep00_1777828107652.pdf
 *
 * The masterId MUST match the row id exactly — it's the HKDF salt.
 * Wrong id → ciphertext that no one can decrypt.
 */

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createCipheriv, randomBytes, hkdfSync } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../.env.local'), override: true });

const args = process.argv.slice(2);
const get = (name) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : null;
};

const masterId = get('master-id');
const inputPath = get('in');
const tableName = get('table') || 'master_content_qubes';

if (!masterId || !inputPath) {
  console.error('Usage: node scripts/encrypt-large-file.mjs --master-id=<row-id> --in=<plaintext-path> [--table=<table-name>]');
  process.exit(1);
}

const masterKeyB64 = process.env.CONTENT_ENCRYPTION_MASTER_KEY || '';
let masterKey = Buffer.from(masterKeyB64, 'base64');
if (masterKey.length !== 32) masterKey = Buffer.from(masterKeyB64, 'hex');
if (masterKey.length !== 32) {
  console.error('CONTENT_ENCRYPTION_MASTER_KEY missing or wrong length');
  process.exit(1);
}

const assetKey = Buffer.from(
  hkdfSync('sha256', masterKey, Buffer.from(masterId, 'utf8'), 'aigentz-content-v1', 32),
);

const plaintext = await fs.readFile(inputPath);
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', assetKey, iv, { authTagLength: 16 });
const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
const authTag = cipher.getAuthTag();
assetKey.fill(0);

const outPath = `${inputPath}.ciphertext`;
await fs.writeFile(outPath, ciphertext);

const ivB64 = iv.toString('base64');
const authTagB64 = authTag.toString('base64');

console.log(`\nPlaintext:   ${inputPath} (${plaintext.byteLength} bytes)`);
console.log(`Ciphertext:  ${outPath} (${ciphertext.byteLength} bytes)`);
console.log(`\n✅ Encryption complete.\n`);
console.log(`Next steps:`);
console.log(`  1. Upload the ciphertext file via Supabase dashboard:`);
console.log(`     Storage → content-media → navigate to the original path`);
console.log(`     Drag-drop ${path.basename(outPath)} to overwrite the existing object`);
console.log(`     Rename it back to the original filename (without .ciphertext suffix)`);
console.log(`\n  2. Update the row via Supabase SQL editor:\n`);
console.log(`UPDATE ${tableName}`);
console.log(`SET encryption_iv = '${ivB64}',`);
console.log(`    encryption_auth_tag = '${authTagB64}',`);
console.log(`    encryption_key_id = 'v1'`);
console.log(`WHERE id = '${masterId}';\n`);
