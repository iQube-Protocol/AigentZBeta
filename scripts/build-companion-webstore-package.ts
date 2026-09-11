/**
 * Chrome Web Store submission package for the metaMe Companion extension.
 *
 * This is a SEPARATE, one-purpose export from the canonical internal
 * distribution path in `services/companion/extensionArtifact.ts` — it reuses
 * that module's file reader and zip writer rather than reimplementing either
 * (CLAUDE.md "Extend, Don't Duplicate"). The one thing it changes is the one
 * thing the two paths structurally disagree on: `manifest.json`'s pinned
 * `key` field.
 *
 * `key` pins a stable extension ID for the load-unpacked distribution path
 * (`get_companion_install` / `/api/companion/extension`) — `configs/embed/
 * policy.v1.json`'s CSP frame-ancestors allowlist trusts the exact ID that
 * key derives. The checked-in manifest.json MUST keep it; removing it would
 * silently change the trusted origin (this is what broke on the first pass —
 * `tests/companion-extension-artifact.test.ts` would have caught it at
 * commit time via `manifest.json pins no key`).
 *
 * The Chrome Web Store's own upload validator does the opposite: it REJECTS
 * a manifest that has a `key` field at all (the store assigns its own ID on
 * publish). So a store submission needs the same source tree with `key`
 * stripped from manifest.json ONLY inside that one archive — never in the
 * checked-in file.
 *
 * Run with: npx tsx scripts/build-companion-webstore-package.ts
 */

import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import {
  readExtensionDir,
  writeStoreZip,
  type ExtensionFile,
} from '../services/companion/extensionArtifact';

function stripKeyForWebStore(files: ExtensionFile[]): ExtensionFile[] {
  return files.map((f) => {
    if (f.path !== 'manifest.json') return f;
    const parsed = JSON.parse(f.bytes.toString('utf8')) as Record<string, unknown>;
    delete parsed.key;
    return { path: f.path, bytes: Buffer.from(JSON.stringify(parsed, null, 2) + '\n', 'utf8') };
  });
}

function main() {
  const { files, excluded } = readExtensionDir();
  if (excluded.length > 0) {
    console.log(`Excluded from the bundle (not on the allowlist): ${excluded.join(', ')}`);
  }

  const storeFiles = stripKeyForWebStore(files);
  // '' — root-less archive. Chrome Web Store's uploader requires manifest.json
  // at the zip root, unlike the load-unpacked path's wrapping folder.
  const zip = writeStoreZip(storeFiles, '');

  const outDir = path.join(process.cwd(), 'dist', 'extensions');
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'metaMe-Companion-Chromium.zip');
  writeFileSync(outPath, zip);

  const manifest = JSON.parse(storeFiles.find((f) => f.path === 'manifest.json')!.bytes.toString('utf8'));
  console.log(`Wrote ${outPath} (${zip.length} bytes, ${storeFiles.length} files)`);
  console.log(`Chrome Web Store manifest checks:`);
  console.log(`  name: "${manifest.name}" (${manifest.name.length} chars, limit 75)`);
  console.log(`  short_name: "${manifest.short_name}"`);
  console.log(`  description: "${manifest.description}" (${manifest.description.length} chars, limit 132)`);
  console.log(`  key present: ${'key' in manifest} (must be false for store upload)`);
  console.log(`  manifest_version: ${manifest.manifest_version}`);
}

main();
