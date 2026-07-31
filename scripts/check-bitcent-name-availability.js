/**
 * R-12 — verify the ratified Rune name (scripts/bitcent-issuance-record.json
 * `runeName.value`) is not already etched on Bitcoin testnet, before the real
 * `deploy-qct-bitcoin.js --execute` broadcast (a Rune name is immutable once
 * etched -- there is no second attempt).
 *
 * Loads the name from the frozen issuance record via deploy-qct-bitcoin.js's
 * own `loadIssuanceRecord()` (single source of truth -- CLAUDE.md
 * inv.engineering.036) rather than re-parsing the JSON or hardcoding
 * "BITCENT" here.
 *
 * THIS SCRIPT DOES NOT GUESS AN ANSWER. It queries mempool.space's public
 * testnet Rune API (the same host this repo already documents as the
 * canonical testnet explorer -- scripts/QCT_RUNES_DEPLOYMENT.md). If that
 * indexer returns a shape this script does not recognise, or does not
 * support Rune lookups on testnet at all, the script reports INCONCLUSIVE
 * rather than asserting "available" or "taken" from a guess. A 404 is
 * treated as evidence of absence from THIS indexer only, not proof of global
 * availability -- the printed output says so explicitly and recommends a
 * manual cross-check against a second indexer before spending on the etch.
 *
 * Requires network egress to mempool.space -- run from the operator's own
 * machine, not from a network-restricted sandbox.
 *
 * Usage:
 *   node scripts/check-bitcent-name-availability.js
 */

const axios = require('axios');
const { loadIssuanceRecord } = require('./deploy-qct-bitcoin.js');

const MEMPOOL_TESTNET_RUNE_API = 'https://mempool.space/testnet/api/v1/runes';

/**
 * `httpGet` is injectable so tests exercise the 404/200/other-status branches
 * deterministically, without a real socket (mirrors the injectable-transport
 * convention already used in services/horizen/client.ts).
 */
async function checkName(name, { httpGet = (url) => axios.get(url, { validateStatus: () => true }) } = {}) {
  const url = `${MEMPOOL_TESTNET_RUNE_API}/${encodeURIComponent(name)}`;
  console.log(`Querying ${url} ...`);
  try {
    const res = await httpGet(url);
    if (res.status === 404) {
      return {
        verdict: 'LIKELY AVAILABLE (not found on this indexer)',
        detail: 'mempool.space testnet returned 404 for this name -- no matching etched Rune on record there.',
        conclusive: false,
      };
    }
    if (res.status === 200 && res.data && typeof res.data === 'object') {
      return {
        verdict: 'ALREADY ETCHED -- DO NOT USE THIS NAME',
        detail: `mempool.space testnet returned an existing Rune record: ${JSON.stringify(res.data)}`,
        conclusive: true,
      };
    }
    return {
      verdict: 'INCONCLUSIVE',
      detail: `Unexpected response (HTTP ${res.status}). This indexer may not support Rune lookups on testnet, or the API shape has changed. Do not treat this as "available".`,
      conclusive: false,
    };
  } catch (err) {
    return {
      verdict: 'INCONCLUSIVE',
      detail: `Request failed: ${err.message}. Could not reach the indexer -- try again or check https://mempool.space/testnet manually.`,
      conclusive: false,
    };
  }
}

async function main() {
  const record = loadIssuanceRecord();
  const name = record.runeName?.value;
  if (!name) {
    console.error('Refusing: runeName.value is missing from the issuance record.');
    process.exitCode = 1;
    return;
  }
  console.log(`Checking Rune name availability for: ${name}\n`);

  const result = await checkName(name);
  console.log(`\nVerdict: ${result.verdict}`);
  console.log(`Detail:  ${result.detail}`);
  console.log(
    '\nThis checks ONE indexer. Before broadcasting the real etch, also cross-check manually at:\n' +
      `  https://mempool.space/testnet (search "${name}")\n` +
      '  https://ordinals.com (if it serves testnet) or another ord-compatible testnet indexer.\n' +
      'A Rune name is immutable once etched -- confirm with more than one source before spending.',
  );

  if (result.verdict.startsWith('ALREADY ETCHED')) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Unexpected error:', err);
    process.exitCode = 1;
  });
}

module.exports = { checkName };
