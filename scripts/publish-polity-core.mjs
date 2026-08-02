#!/usr/bin/env node
/**
 * publish-polity-core.mjs — write the Polity Core constitutional assets to
 * Autodrive (Autonomys) for content-addressed immutability.
 *
 * The machine-readable frameworks (and the human-readable docs) are the source
 * of legitimacy for autonomous agents. Publishing them to Autodrive yields a
 * permanent CID per asset so any party can verify the on-chain copy matches the
 * in-repo source.
 *
 * Usage (operator runs locally — outbound HTTPS is blocked in the sandbox):
 *
 *   AUTONOMYS_API_KEY=... node scripts/publish-polity-core.mjs
 *
 * On success it writes services/polity/frameworks/autodrive-cids.json with the
 * { asset, version, cid, publishedAt } records. Paste the CIDs into
 * codexes/packs/polity-core/items/AMENDMENT_RECORDS.md, and for source-lineage
 * records into the matching SRC-*.json under autoDrive.cid.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createAutoDriveApi } from '@autonomys/auto-drive';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Assets to publish — machine-readable frameworks + human-readable docs.
const ASSETS = [
  { label: 'constitution', version: '1.0.0', path: 'services/polity/frameworks/constitution.v1.json' },
  { label: 'agent-charter', version: '1.0.0', path: 'services/polity/frameworks/agent-charter.v1.json' },
  { label: 'delegation-framework', version: '1.0.0', path: 'services/polity/frameworks/delegation-framework.v1.json' },
  { label: 'standing-charter', version: '1.0.0', path: 'services/polity/frameworks/standing-charter.v1.json' },
  { label: 'metacommons-charter', version: '1.0.0', path: 'services/polity/frameworks/metacommons-charter.v1.json' },
  { label: 'founder-office-charter', version: '1.0.0', path: 'services/polity/frameworks/founder-office-charter.v1.json' },
  { label: 'constitution-doc', version: '1.0.0', path: 'codexes/packs/polity-core/items/CONSTITUTION.md' },
  { label: 'standing-charter-doc', version: '1.0.0', path: 'codexes/packs/polity-core/items/STANDING_CHARTER.md' },
  { label: 'metacommons-charter-doc', version: '1.0.0', path: 'codexes/packs/polity-core/items/METACOMMONS_CHARTER.md' },
  { label: 'founder-office-charter-doc', version: '1.0.0', path: 'codexes/packs/polity-core/items/FOUNDER_OFFICE_CHARTER.md' },
  { label: 'agent-charter-doc', version: '1.0.0', path: 'codexes/packs/polity-core/items/AGENT_CHARTER.md' },
  { label: 'delegation-framework-doc', version: '1.0.0', path: 'codexes/packs/polity-core/items/DELEGATION_FRAMEWORK.md' },
  { label: 'standing-framework-doc', version: '1.0.0', path: 'codexes/packs/polity-core/items/STANDING_FRAMEWORK.md' },
  { label: 'governance-framework-doc', version: '1.0.0', path: 'codexes/packs/polity-core/items/GOVERNANCE_FRAMEWORK.md' },

  // Constitutional Internet — canonical source-lineage records (CR-8, 2026-08-02).
  // Canonical, frozen, provenance-bearing → Auto Drive. The repo keeps the pointer;
  // paste the resulting CID into the record's .json under autoDrive.cid.
  { label: 'src-if-iapp-2017-001', version: '1.0.0', path: 'codexes/packs/polity-core/items/commentary/constitutional-internet/03-source-lineage/internet-foundation-uddr/SRC-IF-IAPP-2017-001.md' },
];

const PLACEHOLDERS = new Set(['...', '…', '<key>', '<your-key>', 'YOUR_KEY', 'xxx', 'changeme']);

async function main() {
  const apiKey = process.env.AUTONOMYS_API_KEY?.trim();
  if (!apiKey) {
    console.error('AUTONOMYS_API_KEY environment variable not set.');
    console.error('Run:  AUTONOMYS_API_KEY=<real key> node scripts/publish-polity-core.mjs');
    process.exit(1);
  }
  if (PLACEHOLDERS.has(apiKey) || /^[.<>\s]+$/.test(apiKey)) {
    console.error(`AUTONOMYS_API_KEY is a placeholder ("${apiKey}"), not a real key.`);
    console.error('Substitute the actual key — the shell passes "..." through literally,');
    console.error('and Auto Drive answers an invalid key with a generic 500.');
    process.exit(1);
  }

  const api = createAutoDriveApi({ apiKey, network: 'mainnet' });
  const outPath = join(ROOT, 'services/polity/frameworks/autodrive-cids.json');

  // Resume: never re-upload an asset that already has a CID.
  const records = [];
  const done = new Map();
  try {
    const prior = JSON.parse(await readFile(outPath, 'utf-8'));
    for (const r of prior.records ?? []) {
      if (r?.cid && r?.asset) { done.set(r.asset, r); records.push(r); }
    }
    if (done.size) console.log(`Resuming — ${done.size} asset(s) already published.\n`);
  } catch { /* first run */ }

  const flush = async () => {
    await writeFile(outPath, JSON.stringify({ network: 'mainnet', records }, null, 2) + '\n');
  };

  const failures = [];
  for (const asset of ASSETS) {
    if (done.has(asset.label)) {
      console.log(`Skipping ${asset.label} — already published (${done.get(asset.label).cid})`);
      continue;
    }
    const abs = join(ROOT, asset.path);
    let buf;
    try {
      buf = await readFile(abs);
    } catch {
      console.log(`SKIP ${asset.label} — file not found at ${asset.path}`);
      failures.push({ asset: asset.label, reason: 'file not found' });
      continue;
    }
    const filename = asset.path.split('/').pop();
    process.stdout.write(`Publishing ${asset.label} (${asset.path})… `);
    try {
      const cid = await api.uploadFileFromBuffer(buf, filename, { compression: false });
      console.log(cid);
      records.push({ asset: asset.label, version: asset.version, path: asset.path, cid, publishedAt: new Date().toISOString() });
      await flush(); // persist after every success so a later failure loses nothing
    } catch (e) {
      const msg = e?.message || String(e);
      console.log(`FAILED — ${msg}`);
      failures.push({ asset: asset.label, reason: msg });
      if (/unauthor|forbidden|401|403|invalid.*key|internal server error/i.test(msg)) {
        console.error('\nStopping: this looks like an authentication failure.');
        console.error('Auto Drive returns a generic 500 for an invalid or expired key — check AUTONOMYS_API_KEY.');
        break;
      }
    }
  }

  await flush();
  console.log(`\nWrote ${records.length} CID record(s) to services/polity/frameworks/autodrive-cids.json`);
  if (failures.length) {
    console.log(`${failures.length} asset(s) did not publish:`);
    for (const f of failures) console.log(`  - ${f.asset}: ${f.reason}`);
    console.log('Re-run the script once resolved — published assets are skipped automatically.');
  }
  console.log('Paste framework/doc CIDs into codexes/packs/polity-core/items/AMENDMENT_RECORDS.md');
  console.log('and source-lineage CIDs into the matching SRC-*.json under autoDrive.cid, then commit.');
  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error('publish-polity-core failed:', e?.message || e);
  process.exit(1);
});
