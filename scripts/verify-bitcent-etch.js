/**
 * Is BITCENT actually etched? — read the chain, not an indexer.
 *
 * ── Why this exists (operator, 2026-08-02) ─────────────────────────────────
 *
 *   > "So is Bitcent etched and how do we see it?"
 *
 * The etch transaction has 16,038 confirmations, and mempool.space's testnet
 * Rune endpoint still 404s. The etch record predicted that 404 "would flip to
 * a real Rune record once confirmed and indexed"; it has not. Two very
 * different worlds produce that same 404:
 *
 *   A. mempool.space does not index Runes on testnet at all — our etch is
 *      fine, we are asking a service that does not answer the question.
 *   B. the Runestone in our OP_RETURN is malformed — under the Runes protocol
 *      that makes the transaction a CENOTAPH, and a cenotaph etches NOTHING.
 *      The name would still be free, the premine would not exist, and every
 *      indexer would be correct to show nothing forever.
 *
 * B is not a remote possibility to be waved away: it is the normal outcome of
 * an encoding error, and 16k confirmations without recognition is exactly its
 * signature. No amount of waiting distinguishes A from B, and the difference
 * decides whether B¢ exists.
 *
 * This script settles it from primary evidence — the raw transaction — by
 * decoding the OP_RETURN with the SAME `runelib` encoder that built it, and
 * reporting the protocol's own verdict. No indexer opinion is involved.
 *
 * Requires network egress to a Bitcoin testnet API — run from the operator's
 * own machine, not from a network-restricted sandbox.
 *
 * Usage:
 *   node scripts/verify-bitcent-etch.js
 */

const axios = require('axios');
const bitcoin = require('bitcoinjs-lib');
const { Runestone, Flaw } = require('runelib');
const record = require('./bitcent-issuance-record.json');

const API = 'https://mempool.space/testnet/api';

/** Name every flaw the protocol reports, rather than saying "invalid". */
function flawNames(mask) {
  if (mask === undefined || mask === null) return [];
  const names = [];
  for (const [name, bit] of Object.entries(Flaw)) {
    // Flaw is a reverse-mapped enum, so half its entries are number→name.
    // Only the name→bit-POSITION direction is meaningful here.
    if (typeof bit !== 'number') continue;
    if ((Number(mask) & (1 << bit)) !== 0) names.push(name);
  }
  // No guessing: an unrecognised mask is reported as the raw value rather than
  // matched to whichever flaw happens to share its numeric value.
  return names.length ? names : [`unrecognised flaw mask ${String(mask)}`];
}

async function main() {
  const etch = record.etchBroadcast;
  if (!etch?.txid) {
    // A missing txid is far more often a STALE LOCAL RECORD than a genuine
    // "we never broadcast": the operator's clone tracks Kn0w-1, not the
    // canonical repo, so a partial `git checkout iqp/dev -- <script>` brings
    // the script without the record it reads. Naming the fix beats naming the
    // symptom — this refusal cost a round trip the first time it fired.
    console.error('Refusing: scripts/bitcent-issuance-record.json carries no etchBroadcast.txid.');
    console.error(
      '\nIf your copy of the record is older than the etch, refresh it from the canonical repo:\n' +
        '  git fetch iqp dev && git checkout iqp/dev -- scripts/bitcent-issuance-record.json\n' +
        '\nIf the record is current, then no etch has been broadcast for this name and there is\n' +
        'nothing on chain to verify — which is a different fact, and not a defect.',
    );
    process.exitCode = 1;
    return;
  }
  const { txid } = etch;
  console.log(`Rune name:  ${record.runeName?.value}`);
  console.log(`Etch tx:    ${txid}`);
  console.log(`Network:    ${etch.network}\n`);

  let status;
  let hex;
  try {
    status = (await axios.get(`${API}/tx/${txid}/status`, { validateStatus: () => true })).data;
    hex = (await axios.get(`${API}/tx/${txid}/hex`, { validateStatus: () => true })).data;
  } catch (e) {
    console.error(`Could not reach ${API} (${e.message}). This is not evidence about the etch — retry with network access.`);
    process.exitCode = 1;
    return;
  }
  if (typeof hex !== 'string' || !/^[0-9a-f]+$/i.test(hex.trim())) {
    console.error('The API did not return a raw transaction. Nothing was verified; no conclusion is drawn.');
    process.exitCode = 1;
    return;
  }

  console.log(
    status?.confirmed
      ? `CONFIRMED in block ${status.block_height} (${status.block_hash})`
      : 'NOT CONFIRMED — still in mempool or unknown to this API',
  );

  const tx = bitcoin.Transaction.fromHex(hex.trim());
  const opReturns = tx.outs.filter((o) => o.script[0] === bitcoin.opcodes.OP_RETURN);
  if (opReturns.length === 0) {
    console.log('\nVERDICT: NOT AN ETCH — the transaction carries no OP_RETURN output.');
    console.log('There is no Runestone here, so no Rune was created by this transaction.');
    process.exitCode = 1;
    return;
  }

  let stone = null;
  try {
    stone = Runestone.decipher(hex.trim());
  } catch (e) {
    console.log(`\nVERDICT: UNDECIPHERABLE — runelib could not read the Runestone (${e.message}).`);
    process.exitCode = 1;
    return;
  }

  // runelib returns an Option-like; `value()`/`isSome()` shapes vary by version,
  // so both are probed rather than assumed.
  const value = typeof stone?.value === 'function' ? stone.value() : stone;
  const flaws = value?.flaws ?? value?.cenotaph ?? undefined;

  if (!value) {
    console.log('\nVERDICT: NO RUNESTONE — the OP_RETURN is not a Runes protocol message.');
    console.log('Nothing was etched. The name remains unetched by this transaction.');
    process.exitCode = 1;
    return;
  }

  if (flaws) {
    console.log('\nVERDICT: CENOTAPH — the Runestone is malformed, so the protocol etched NOTHING.');
    console.log(`Flaws: ${flawNames(flaws).join(', ')}`);
    console.log(
      'Consequences, stated plainly: no Rune exists, no premine exists, the B¢ supply is zero,\n' +
        'and every indexer showing nothing is CORRECT. The name is still unetched — a new,\n' +
        'corrected etch would be required, and that is a fresh governed act, not a retry.',
    );
    process.exitCode = 1;
    return;
  }

  const etching = value.etching ?? (typeof value.etching === 'function' ? value.etching() : undefined);
  console.log('\nVERDICT: VALID ETCH — the Runestone is well-formed and the transaction is on chain.');
  // Rune amounts are u128 — they arrive as BigInt and JSON.stringify throws on
  // them. Printed as decimal strings: a supply is exact or it is wrong, so
  // Number() would be the one conversion that must never happen here.
  console.log(
    JSON.stringify(
      { etching, edicts: value.edicts, mint: value.mint, pointer: value.pointer },
      (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
      2,
    ),
  );
  console.log(
    '\nIf an indexer still shows nothing for this name, the indexer is not answering Rune\n' +
      'queries on this network — the etch itself is verified here from the raw transaction.',
  );
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Unexpected error:', e);
    process.exitCode = 1;
  });
}

module.exports = { flawNames };
