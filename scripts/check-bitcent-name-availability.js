/**
 * R-12 — answer "may we etch this Rune name?" for the ratified name in
 * scripts/bitcent-issuance-record.json (`runeName.value`).
 *
 * ── The defect this script was rebuilt to fix (operator, 2026-08-02) ────────
 *
 * It reported `LIKELY AVAILABLE` for BITCENT while our own etch transaction
 * 551bbaaa… had 16,038 confirmations on testnet3. Two independent faults:
 *
 *  1. It never consulted our own record of what we had already broadcast, so
 *     it answered an availability question that was already CLOSED.
 *  2. It mapped HTTP 404 from one indexer to "likely available". A 404 cannot
 *     distinguish "no such Rune" from "this endpoint does not answer Rune
 *     queries on testnet at all" — and of the two possible errors, it chose
 *     the one that invites a second, irreversible etch. A Rune name cannot be
 *     un-etched; the safe direction of failure is INCONCLUSIVE.
 *
 * ── The order of authority ─────────────────────────────────────────────────
 *
 *   1. OUR OWN ETCH RECORD wins, unconditionally. If `etchBroadcast.txid` is
 *      present for this network, we etched it. No indexer opinion can make it
 *      available again, so no indexer is consulted for the verdict.
 *   2. Only when we have NOT etched it does an indexer probe carry weight —
 *      and then a 404 is still not proof of availability, because we have no
 *      way to tell a working indexer from a silent one.
 *
 * ── The control probe ──────────────────────────────────────────────────────
 *
 * Our own etched name IS the control: a name we hold positive on-chain
 * evidence for. If the indexer 404s on THAT, the indexer is not answering
 * Rune queries — proven, not suspected — and every other 404 it returns is
 * worthless. No third-party name is guessed here; the control is a fact this
 * repository already owns.
 *
 * Requires network egress to mempool.space — run from the operator's own
 * machine, not from a network-restricted sandbox.
 *
 * Usage:
 *   node scripts/check-bitcent-name-availability.js
 */

const axios = require('axios');
const { loadIssuanceRecord } = require('./deploy-qct-bitcoin.js');

const MEMPOOL_TESTNET_RUNE_API = 'https://mempool.space/testnet/api/v1/runes';

/**
 * Every verdict this script can reach. `LIKELY AVAILABLE` is deliberately
 * absent: no evidence available to this script can establish that a name is
 * free, and the old wording read as a licence to spend.
 */
const VERDICTS = {
  ETCHED_BY_US: 'ALREADY ETCHED BY US — the availability question is closed',
  ETCHED_BY_OTHER: 'ALREADY ETCHED BY SOMEONE ELSE — DO NOT USE THIS NAME',
  INCONCLUSIVE: 'INCONCLUSIVE — no evidence of absence',
};

/**
 * The etch we ourselves broadcast on this network, or null.
 *
 * Network-scoped: a testnet etch says nothing about mainnet availability, and
 * silently reusing one for the other is how a "we already did this" answer
 * ends up authorising a mainnet spend.
 */
function ourEtchOn(record, network) {
  const etch = record.etchBroadcast;
  if (!etch || typeof etch.txid !== 'string' || etch.txid.length === 0) return null;
  if (etch.network !== network) return null;
  return etch;
}

/** One indexer lookup, reduced to `found` | `absent` | `unusable`. */
async function probeIndexer(name, httpGet) {
  const url = `${MEMPOOL_TESTNET_RUNE_API}/${encodeURIComponent(name)}`;
  try {
    const res = await httpGet(url);
    if (res.status === 404) return { outcome: 'absent', detail: `HTTP 404 from ${url}` };
    if (res.status === 200 && res.data && typeof res.data === 'object') {
      return { outcome: 'found', detail: JSON.stringify(res.data) };
    }
    return { outcome: 'unusable', detail: `HTTP ${res.status} — unrecognised shape` };
  } catch (err) {
    return { outcome: 'unusable', detail: `request failed: ${err.message}` };
  }
}

/**
 * `httpGet` is injectable so tests exercise every branch deterministically,
 * without a real socket (mirrors the injectable-transport convention already
 * used in services/horizen/client.ts).
 */
async function checkName(
  name,
  {
    record = loadIssuanceRecord(),
    network = 'testnet3',
    httpGet = (url) => axios.get(url, { validateStatus: () => true }),
  } = {},
) {
  const etch = ourEtchOn(record, network);

  if (etch) {
    // Closed question. The indexer is still probed — but only to report
    // whether it can see our etch, never to reopen the verdict.
    const probe = await probeIndexer(name, httpGet);
    const indexerSeesIt = probe.outcome === 'found';
    return {
      verdict: VERDICTS.ETCHED_BY_US,
      detail:
        `${name} was etched by us on ${etch.network} in tx ${etch.txid}` +
        (etch.broadcastAt ? ` (broadcast ${etch.broadcastAt})` : '') +
        `. Source: ${etch.source ?? 'scripts/bitcent-issuance-record.json'}.`,
      etch,
      conclusive: true,
      indexerAgrees: indexerSeesIt,
      indexerDetail: indexerSeesIt
        ? `Indexer confirms: ${probe.detail}`
        : `Indexer does NOT show it (${probe.detail}). That is a fact about the INDEXER, ` +
          `not about the etch — the transaction is confirmed on chain. mempool.space's ` +
          `testnet Rune index does not answer for this name.`,
    };
  }

  // No etch of ours on this network. Probe, with our own etched name (on
  // whatever network we do hold one for) as the control.
  const probe = await probeIndexer(name, httpGet);
  if (probe.outcome === 'found') {
    return {
      verdict: VERDICTS.ETCHED_BY_OTHER,
      detail: `Indexer returned an existing Rune record and we have no etch of our own on ${network}: ${probe.detail}`,
      conclusive: true,
    };
  }

  const control = record.etchBroadcast?.txid ? record.etchBroadcast : null;
  if (probe.outcome === 'absent' && control) {
    const controlProbe = await probeIndexer(record.runeName?.value ?? name, httpGet);
    if (controlProbe.outcome !== 'found') {
      return {
        verdict: VERDICTS.INCONCLUSIVE,
        detail:
          `The indexer returned nothing for ${name}, but it also returns nothing for ` +
          `${record.runeName?.value} — a name we hold a confirmed etch for (tx ${control.txid}). ` +
          `The endpoint is not answering Rune queries; its silence carries no information.`,
        conclusive: false,
      };
    }
  }

  return {
    verdict: VERDICTS.INCONCLUSIVE,
    detail:
      `${probe.detail}. Absence from one indexer is not evidence that the name is free, and ` +
      `this script cannot establish that it is. Cross-check at least one further ord-compatible ` +
      `indexer before spending on an etch.`,
    conclusive: false,
  };
}

async function main() {
  const record = loadIssuanceRecord();
  const name = record.runeName?.value;
  if (!name) {
    console.error('Refusing: runeName.value is missing from the issuance record.');
    process.exitCode = 1;
    return;
  }
  console.log(`Checking Rune name: ${name}\n`);

  const result = await checkName(name, { record });
  console.log(`Verdict: ${result.verdict}`);
  console.log(`Detail:  ${result.detail}`);
  if (result.indexerDetail) console.log(`Indexer: ${result.indexerDetail}`);

  if (result.verdict === VERDICTS.ETCHED_BY_US) {
    console.log(
      `\nNothing to check and nothing to spend. Re-etching ${name} is not possible; ` +
        'a Rune name is immutable once etched. Mainnet issuance is a SEPARATE ratification\n' +
        'with its own record — this testnet etch does not authorise it.',
    );
    return;
  }

  console.log(
    '\nThis consults ONE indexer, and no result it can return proves a name is free.\n' +
      `Before broadcasting an etch, cross-check manually at:\n` +
      `  https://mempool.space/testnet (search "${name}")\n` +
      '  another ord-compatible testnet indexer\n' +
      'A Rune name is immutable once etched — confirm with more than one source before spending.',
  );

  if (result.verdict === VERDICTS.ETCHED_BY_OTHER) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Unexpected error:', err);
    process.exitCode = 1;
  });
}

module.exports = { checkName, ourEtchOn, VERDICTS };
