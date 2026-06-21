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
 * codexes/packs/polity-core/items/AMENDMENT_RECORDS.md.
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
  { label: 'constitution-doc', version: '1.0.0', path: 'codexes/packs/polity-core/items/CONSTITUTION.md' },
  { label: 'standing-charter-doc', version: '1.0.0', path: 'codexes/packs/polity-core/items/STANDING_CHARTER.md' },
  { label: 'metacommons-charter-doc', version: '1.0.0', path: 'codexes/packs/polity-core/items/METACOMMONS_CHARTER.md' },
  { label: 'agent-charter-doc', version: '1.0.0', path: 'codexes/packs/polity-core/items/AGENT_CHARTER.md' },
  { label: 'delegation-framework-doc', version: '1.0.0', path: 'codexes/packs/polity-core/items/DELEGATION_FRAMEWORK.md' },
  { label: 'standing-framework-doc', version: '1.0.0', path: 'codexes/packs/polity-core/items/STANDING_FRAMEWORK.md' },
  { label: 'governance-framework-doc', version: '1.0.0', path: 'codexes/packs/polity-core/items/GOVERNANCE_FRAMEWORK.md' },
];

async function main() {
  const apiKey = process.env.AUTONOMYS_API_KEY;
  if (!apiKey) {
    console.error('AUTONOMYS_API_KEY environment variable not set.');
    process.exit(1);
  }
  const api = createAutoDriveApi({ apiKey, network: 'mainnet' });

  const records = [];
  for (const asset of ASSETS) {
    const abs = join(ROOT, asset.path);
    const buf = await readFile(abs);
    const filename = asset.path.split('/').pop();
    process.stdout.write(`Publishing ${asset.label} (${asset.path})… `);
    const cid = await api.uploadFileFromBuffer(buf, filename, { compression: false });
    console.log(cid);
    records.push({
      asset: asset.label,
      version: asset.version,
      path: asset.path,
      cid,
      publishedAt: new Date().toISOString(),
    });
  }

  const outPath = join(ROOT, 'services/polity/frameworks/autodrive-cids.json');
  await writeFile(outPath, JSON.stringify({ network: 'mainnet', records }, null, 2) + '\n');
  console.log(`\nWrote ${records.length} CID records to services/polity/frameworks/autodrive-cids.json`);
  console.log('Now paste the CIDs into codexes/packs/polity-core/items/AMENDMENT_RECORDS.md and commit.');
}

main().catch((e) => {
  console.error('publish-polity-core failed:', e?.message || e);
  process.exit(1);
});
