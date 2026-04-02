#!/usr/bin/env node
/**
 * AgentiQ Codex → Autonomys Auto-Drive Sync
 *
 * Uploads all AgentiQ Codex artifacts to Autonomys Auto-Drive (mainnet),
 * records CIDs, and writes a sync manifest into index.json.
 *
 * Usage: node scripts/sync-codex-to-autodrive.js
 * Required env: AUTONOMYS_API_KEY
 *
 * Uses dynamic import() for @autonomys/auto-drive (ESM-safe).
 */

const fs = require("fs");
const path = require("path");

const CODEX_ROOT = path.resolve("codexes/packs/aigency");
const API_KEY = process.env.AUTONOMYS_API_KEY;

// Prefixes all uploaded filenames so they're identifiable on Autonomys
const UPLOAD_PREFIX = "AigencyCodex/repos/AigentZBeta";

if (!API_KEY) {
  console.error("AUTONOMYS_API_KEY not set — aborting sync.");
  process.exit(1);
}

/** Recursively collect all .md and .json files (skip .gitkeep, node_modules). */
function collectFiles(dir, base = CODEX_ROOT) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, base));
    } else if (
      (entry.name.endsWith(".md") || entry.name.endsWith(".json")) &&
      !entry.name.startsWith(".")
    ) {
      results.push({ abs: full, rel: path.relative(base, full) });
    }
  }
  return results;
}

/** Upload a single Buffer to Auto-Drive with retries. Returns CID string. */
async function uploadWithRetry(api, content, filename, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const cid = await api.uploadFileFromBuffer(content, filename, {
        compression: false,
      });
      if (!cid) throw new Error("No CID returned");
      return cid;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  Attempt ${attempt}/${maxRetries} failed: ${msg}`);
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt)); // 1s, 2s backoff
    }
  }
}

async function main() {
  // Dynamic import — handles ESM and CJS packages
  const { createAutoDriveApi } = await import("@autonomys/auto-drive");

  console.log("Initialising Autonomys Auto-Drive API (mainnet)…");
  const api = createAutoDriveApi({ apiKey: API_KEY, network: "mainnet" });

  const files = collectFiles(CODEX_ROOT);
  console.log(`Found ${files.length} file(s) to sync.`);

  const cidMap = {};
  let uploaded = 0;
  let failed = 0;

  for (const { abs, rel } of files) {
    const uploadName = `${UPLOAD_PREFIX}/${rel}`;
    const content = fs.readFileSync(abs);
    try {
      process.stdout.write(`  Uploading ${rel}… `);
      const cid = await uploadWithRetry(api, content, uploadName);
      cidMap[rel] = cid;
      console.log(`CID: ${cid}`);
      uploaded++;
    } catch (err) {
      console.error(`FAILED: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  // Build and upload the manifest itself
  const manifest = {
    generated_at: new Date().toISOString(),
    prefix: UPLOAD_PREFIX,
    files: cidMap,
  };
  const manifestJson = JSON.stringify(manifest, null, 2);
  let manifestCid = null;
  try {
    process.stdout.write("  Uploading sync manifest… ");
    manifestCid = await uploadWithRetry(
      api,
      Buffer.from(manifestJson),
      `${UPLOAD_PREFIX}/autodrive-manifest.json`
    );
    console.log(`CID: ${manifestCid}`);
  } catch (err) {
    console.error(
      `Manifest upload FAILED: ${err instanceof Error ? err.message : err}`
    );
  }

  // Update index.json with manifest CID
  const jsonIndexPath = path.join(CODEX_ROOT, "index.json");
  let jsonIndex = {};
  try {
    jsonIndex = JSON.parse(fs.readFileSync(jsonIndexPath, "utf8"));
  } catch {
    // start fresh
  }
  jsonIndex.autodrive_last_sync = new Date().toISOString();
  jsonIndex.autodrive_manifest_cid = manifestCid;
  jsonIndex.autodrive_path = UPLOAD_PREFIX;
  fs.writeFileSync(jsonIndexPath, JSON.stringify(jsonIndex, null, 2) + "\n");

  console.log(
    `\nSync complete: ${uploaded} uploaded, ${failed} failed.`
  );
  if (manifestCid) {
    console.log(`Manifest CID: ${manifestCid}`);
  }
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Sync script error:", err);
  process.exit(1);
});
