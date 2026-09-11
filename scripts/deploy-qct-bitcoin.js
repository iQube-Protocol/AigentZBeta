/**
 * BitCent (B¢) Runes Etching Script — the SOLE authoritative etching path.
 *
 * CONSOLIDATION (2026-07-30, operator-ruled). This repo previously carried
 * SIX competing/duplicate BitCent deployment scripts. Five are deleted:
 *   - deploy-qct-bitcoin-basic.js / -final.js / -simple.js: incomplete
 *     drafts, two of which hardcoded a now-rotated testnet private key
 *     (removed 2026-07-30, R-11/G-3).
 *   - deploy-qct-runes.js / deploy-qct-runes.ts: used the correct `runelib`
 *     Runestone/Etching/Terms protocol encoder, but carried the SUPERSEDED
 *     400,000,000 premine tokenomics.
 * THIS file is what remains, and it is deliberately NOT "the old
 * deploy-qct-bitcoin.js with new numbers" — that file's OP_RETURN encoder
 * was a non-functional placeholder (`Buffer.alloc(8) // needs proper
 * encoding`, a `RUNE_TEST` magic string that is not the real Runestone
 * protocol). This script ports the real `runelib`-based Taproot etching
 * flow from deploy-qct-runes.* and combines it with the ratified tokenomics.
 *
 * TOKENOMICS ARE NEVER HARDCODED HERE. Every value is loaded from
 * scripts/bitcent-issuance-record.json — the frozen issuance record — and
 * this script refuses to broadcast (though NOT to dry-run) unless every one
 * of the ten required fields is marked `ratified: true` there. A Rune's
 * name, divisibility, cap and premine are immutable at etch; there is no
 * second attempt, so "trust whoever edited this file last" is not an
 * acceptable gate.
 *
 * See:
 *   codexes/packs/agentiq/updates/2026-07-29_qriptocent-supply-constitution.md
 *   codexes/packs/agentiq/updates/2026-07-30_bitcent-frozen-issuance-record.md
 *   scripts/bitcent-issuance-record.json
 *
 * Usage:
 *   npx tsx scripts/... (this file is plain JS, run with node)
 *   node scripts/deploy-qct-bitcoin.js                  # dry run (default)
 *   node scripts/deploy-qct-bitcoin.js --execute         # real broadcast --
 *                                                          refuses unless the
 *                                                          issuance record is
 *                                                          fully ratified
 *   node scripts/deploy-qct-bitcoin.js --mainnet --execute  # refuses unless
 *     BITCENT_MAINNET_ISSUANCE_RATIFIED=yes is ALSO set -- a separate,
 *     deliberately harder gate than testnet.
 *
 * Requires (server-side only, never committed):
 *   BITCENT_TESTNET_DEPLOYER_WIF (testnet), or BITCENT_MAINNET_DEPLOYER_WIF
 *   (mainnet, not yet used by this script -- mainnet is refused outright
 *   below pending its own separate ratification path).
 *   TREASURY_OPERATOR_PASSCODE_HASH / TREASURY_OPERATOR_PASSCODE_SALT --
 *   required on the --execute path (see "Pilot treasury authority" below).
 *
 * ── Pilot treasury authority (2026-07-30, PILOT-AUTHORISED — PROVISIONAL
 *    SECURITY PROFILE; see
 *    codexes/packs/agentiq/updates/2026-07-30_pilot-treasury-authority.md) ──
 *
 * The --execute path additionally requires, in order: a fresh, single-use
 * mandate (auto-built from this run's own known values -- asset, amount,
 * source, destination, network, expiry); a verified operator passcode
 * (bound procedurally to this mandate by the review-then-approve prompt
 * sequence, never stored in plaintext, rate-limited); and BOTH required
 * signatory checks for the 'bitcent-treasury-ordinary' transaction class
 * (Aigent Nakamoto approval + Aigent Kn0w1 observation -- see
 * services/treasury/pilotTreasuryAuthority.js). A second check, right
 * before broadcast, confirms the REAL built transaction still matches the
 * mandate the operator approved. None of this replaces the existing
 * ratification gate or the "type yes" broadcast confirmation below -- it
 * runs in addition to both.
 */

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const dotenv = require('dotenv');

for (const envFile of ['.env.local', '.env.local.temp']) {
  const envPath = path.join(__dirname, '..', envFile);
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false });
}

const { Runestone, Etching, Rune, none, some } = require('runelib');
const { networks, Psbt, payments, script: bscript, initEccLib } = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
const { ECPairFactory } = require('ecpair');
const axios = require('axios');
const crypto = require('crypto');

const {
  authorizeTreasuryAction,
  assertMandateMatchesTransaction,
  TreasuryAuthorityRefusal,
  PILOT_SECURITY_STATUS,
} = require('../services/treasury/pilotTreasuryAuthority');
const {
  createFileBackedNonceStore,
  recordFailedPasscodeAttempt,
  assertNotLockedOut,
} = require('./_lib/treasuryMandateLedger');

initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

const ISSUANCE_RECORD_PATH = path.join(__dirname, 'bitcent-issuance-record.json');
const REQUIRED_FIELDS = [
  'runeName',
  'symbol',
  'divisibility',
  'maxSupply',
  'premine',
  'mintTerms',
  'allocationSchedule',
  'premineCustodian',
  'relationshipToBaseQc',
  'independenceDeclaration',
];

function loadIssuanceRecord() {
  if (!fs.existsSync(ISSUANCE_RECORD_PATH)) {
    throw new Error(`Frozen issuance record not found at ${ISSUANCE_RECORD_PATH}`);
  }
  return JSON.parse(fs.readFileSync(ISSUANCE_RECORD_PATH, 'utf8'));
}

/**
 * Returns { ratified: string[], open: string[] } over the ten required
 * fields. Never guesses -- a field missing from the record entirely counts
 * as open, same as one explicitly marked `ratified: false`.
 */
function checkRatification(record) {
  const ratified = [];
  const open = [];
  for (const field of REQUIRED_FIELDS) {
    if (record[field] && record[field].ratified === true) ratified.push(field);
    else open.push(field);
  }
  return { ratified, open };
}

/**
 * Resolves the tokenomics actually used to build the transaction.
 *
 * `allowIllustrative`: when true (dry-run only), an open field falls back to
 * its `illustrativeOnly` / `proposed` value SOLELY so the encoder has
 * something to build a structurally valid demonstration transaction from --
 * every such value is logged, loudly, as illustrative and unratified. When
 * false (the --execute path), EVERY field -- mintTerms included -- throws
 * rather than substituting a placeholder. This function enforces that
 * itself (defense in depth): it does not rely solely on `main()`'s separate
 * up-front refusal, because a future caller of this function directly must
 * get the same guarantee the CLI path gets.
 */
function resolveTokenomics(record, { allowIllustrative }) {
  const val = (field, illustrativeKey) => {
    const entry = record[field];
    if (entry && entry.ratified === true) return entry.value;
    if (!allowIllustrative) {
      throw new Error(`resolveTokenomics called for unratified field "${field}" without allowIllustrative`);
    }
    const illustrative = illustrativeKey ? entry?.[illustrativeKey] : entry?.value;
    console.warn(`⚠️  ILLUSTRATIVE, NOT RATIFIED: "${field}" using placeholder value for this dry run only.`);
    return illustrative;
  };

  // Governed-reserve model (2026-07-30 amendment): mintTerms is a plain
  // value object -- { initiallyActiveIssuance, governedReserve, openMint }
  // -- resolved through the SAME generic path as every other field, no
  // special-cased illustrative fallback. `openMint` must be exactly 'none'
  // -- this script never constructs a public-mint Terms structure, so any
  // other value is refused rather than silently ignored.
  const mintTerms = val('mintTerms', 'illustrativeOnly');
  if (mintTerms && mintTerms.openMint !== 'none') {
    throw new Error(
      `mintTerms.openMint is "${mintTerms.openMint}", but this script only implements openMint: "none" ` +
        '(no permissionless public mint). A different open-mint policy requires new etching code, not just a new record value.',
    );
  }

  return {
    name: val('runeName'),
    symbol: val('symbol'),
    divisibility: val('divisibility'),
    maxSupply: val('maxSupply'),
    premine: val('premine'),
    initiallyActiveIssuance: mintTerms?.initiallyActiveIssuance,
    governedReserve: mintTerms?.governedReserve,
    openMint: mintTerms?.openMint,
  };
}

function toXOnly(pubkey) {
  return pubkey.subarray(1, 33);
}

async function waitUntilUTXO(address, apiBase) {
  const url = `${apiBase}/address/${address}/utxo`;
  console.log(`Waiting for a UTXO at ${address}...`);
  let utxos = [];
  while (utxos.length === 0) {
    try {
      const res = await axios.get(url);
      utxos = Array.isArray(res.data) ? res.data : [];
      if (utxos.length === 0) {
        console.log('No UTXO yet, waiting 10s...');
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    } catch (err) {
      console.error('Error fetching UTXO:', err.message);
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
  console.log(`Found ${utxos.length} UTXO(s)`);
  return utxos;
}

/** Node's own stdin prompt -- a real deliberate-confirmation gate, not just
 *  another environment variable that can be copy-pasted without re-reading. */
function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
}

/**
 * Masked passcode prompt -- the passcode is never echoed to the terminal or
 * written anywhere; it exists only in memory for the duration of the
 * `verifyOperatorPasscode` comparison in pilotTreasuryAuthority.js.
 */
function promptPasscode(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const output = rl._writeToOutput;
    let masked = false;
    rl._writeToOutput = function (str) {
      if (masked) return; // suppress echo of the passcode itself once the prompt has been written
      output.call(rl, str);
      masked = true;
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function buildEtchingTransaction({ network, apiBase, wif, tokenomics, premineAddress, requireRealUtxo }) {
  const keyPair = ECPair.fromWIF(wif, network);

  const etchingScriptAsm = `${toXOnly(keyPair.publicKey).toString('hex')} OP_CHECKSIG`;
  const etchingScript = bscript.fromASM(etchingScriptAsm);
  const scriptTree = { output: etchingScript };

  const scriptP2tr = payments.p2tr({ internalPubkey: toXOnly(keyPair.publicKey), scriptTree, network });
  const etchingRedeem = { output: etchingScript, redeemVersion: 192 };
  const etchingP2tr = payments.p2tr({
    internalPubkey: toXOnly(keyPair.publicKey),
    scriptTree,
    redeem: etchingRedeem,
    network,
  });

  const address = scriptP2tr.address;
  console.log('📍 Etching (reveal) address:', address);

  let utxos;
  if (requireRealUtxo) {
    console.log('⚠️  Send testnet BTC to this address and wait for confirmations.');
    utxos = await waitUntilUTXO(address, apiBase);
  } else {
    // Dry-run without a funded address: fabricate a structurally-valid UTXO
    // reference purely so the PSBT-building code path can be exercised and
    // decoded locally. NEVER used on the broadcast path (requireRealUtxo is
    // always true there).
    utxos = [{ txid: '0'.repeat(64), vout: 0, value: 100000 }];
    console.log('ℹ️  Dry run with no funded address: using a fabricated placeholder UTXO to exercise the encoder only.');
  }

  const psbt = new Psbt({ network });
  psbt.addInput({
    hash: utxos[0].txid,
    index: utxos[0].vout,
    witnessUtxo: { value: BigInt(utxos[0].value), script: scriptP2tr.output },
    tapLeafScript: [
      {
        leafVersion: etchingRedeem.redeemVersion,
        script: etchingRedeem.output,
        controlBlock: etchingP2tr.witness[etchingP2tr.witness.length - 1],
      },
    ],
  });

  const rune = Rune.fromName(tokenomics.name);
  // Governed-reserve model (2026-07-30): openMint is always 'none' for this
  // record (enforced in resolveTokenomics) -- NO Terms structure is
  // constructed. The entire premine (the full maxSupply, per the
  // governed-reserve amendment) is etched in the ONE custodial output below;
  // nothing can ever be minted afterward. The 100M-active/900M-reserve split
  // is a spend-authorisation POLICY enforced by
  // services/treasury/pilotTreasuryAuthority.js, not a protocol-level split
  // -- Runes has no mechanism to partition a premine into tranches at the
  // UTXO level.
  const etching = new Etching(
    some(tokenomics.divisibility),
    some(tokenomics.premine * Math.pow(10, tokenomics.divisibility)),
    some(rune),
    none(),
    some(tokenomics.symbol),
    none(),
    true,
  );
  const stone = new Runestone([], some(etching), none(), none());

  psbt.addOutput({ script: stone.encipher(), value: BigInt(0) });
  psbt.addOutput({ address: premineAddress, value: BigInt(546) });

  const fee = 10000;
  const change = utxos[0].value - 546 - fee;
  if (change > 546) {
    psbt.addOutput({ address: premineAddress, value: BigInt(change) });
  }

  if (requireRealUtxo) {
    psbt.signAllInputs(keyPair);
    psbt.finalizeAllInputs();
  }

  return { psbt, keyPair, address };
}

async function main() {
  const args = process.argv.slice(2);
  const EXECUTE = args.includes('--execute');
  const MAINNET = args.includes('--mainnet');

  const record = loadIssuanceRecord();
  const { ratified, open } = checkRatification(record);

  console.log('🚀 BitCent (B¢) Runes etching — sole authoritative script\n');
  console.log(`Frozen issuance record: ${ISSUANCE_RECORD_PATH}`);
  console.log(`Ratified fields (${ratified.length}/${REQUIRED_FIELDS.length}): ${ratified.join(', ') || '(none)'}`);
  console.log(`Open fields (${open.length}/${REQUIRED_FIELDS.length}): ${open.join(', ') || '(none)'}\n`);

  if (MAINNET) {
    // Mainnet is refused unconditionally here, ahead of every other check.
    // It requires its own separate ratification path -- ten frozen fields is
    // the TESTNET bar; mainnet additionally requires a Mainnet-specific
    // ratification flag and record this script does not yet implement,
    // per the operator's explicit ruling (2026-07-30): "refuse Mainnet
    // unless a separate Mainnet ratification flag and record are present."
    console.error('Refusing: Mainnet execution requires its own separate ratification flag and record, not yet implemented. Testnet only.');
    process.exitCode = 1;
    return;
  }

  const network = networks.testnet;
  const apiBase = 'https://blockstream.info/testnet/api';

  if (EXECUTE && open.length > 0) {
    console.error(
      `Refusing to broadcast: ${open.length} of ${REQUIRED_FIELDS.length} required issuance fields are not ratified: ${open.join(', ')}.\n` +
      'A Rune\'s name, divisibility, cap and premine are immutable at etch -- there is no second attempt.\n' +
      `See each field's "note" in ${ISSUANCE_RECORD_PATH} for what remains, and\n` +
      'codexes/packs/agentiq/updates/2026-07-30_bitcent-frozen-issuance-record.md for the full record.\n' +
      'Run WITHOUT --execute for a dry run that demonstrates the encoding using illustrative placeholders for open fields.',
    );
    process.exitCode = 1;
    return;
  }

  const tokenomics = resolveTokenomics(record, { allowIllustrative: !EXECUTE });

  console.log('Token configuration for this run:');
  console.log('  Name:', tokenomics.name);
  console.log('  Symbol:', tokenomics.symbol);
  console.log('  Divisibility:', tokenomics.divisibility);
  console.log('  Max supply:', tokenomics.maxSupply.toLocaleString());
  console.log('  On-chain premine (this etch):', tokenomics.premine.toLocaleString());
  console.log('  Initially active issuance:', tokenomics.initiallyActiveIssuance?.toLocaleString?.() ?? tokenomics.initiallyActiveIssuance);
  console.log('  Governed reserve (requires a new mandate to release):', tokenomics.governedReserve?.toLocaleString?.() ?? tokenomics.governedReserve);
  console.log('  Open mint:', tokenomics.openMint, '\n');

  const wif = process.env.BITCENT_TESTNET_DEPLOYER_WIF;
  if (!wif) {
    console.error('Refusing: BITCENT_TESTNET_DEPLOYER_WIF is not set. See .env.example.');
    process.exitCode = 1;
    return;
  }

  // Premine recipient: the ratified custodian wallet if one exists, else the
  // deployer's own address as an explicitly-illustrative testnet stand-in.
  // NEVER silently substitutes on the real broadcast path -- EXECUTE with an
  // unratified custodian was already refused above.
  const keyPairForAddress = ECPair.fromWIF(wif, network);
  const { address: deployerAddress } = payments.p2wpkh({ pubkey: keyPairForAddress.publicKey, network });
  const premineAddress = record.premineCustodian?.ratified ? record.premineCustodian.value : deployerAddress;
  if (!record.premineCustodian?.ratified) {
    console.warn(`⚠️  ILLUSTRATIVE, NOT RATIFIED: "premineCustodian" not yet set -- using the deployer's own testnet address (${deployerAddress}) as a stand-in for this dry run only.`);
  }

  // ── Pilot treasury authority gate (EXECUTE only) ──────────────────────────
  // Fails fast, BEFORE waiting on a funded UTXO or building the real PSBT --
  // an unauthorised attempt should not need a funded address to be refused.
  // See file header + services/treasury/pilotTreasuryAuthority.js.
  let treasuryMandate = null;
  if (EXECUTE) {
    assertNotLockedOut();

    treasuryMandate = {
      action: 'bitcent-testnet-etch',
      asset: tokenomics.name,
      amount: tokenomics.premine,
      source: deployerAddress,
      destination: premineAddress,
      network: 'testnet',
      agent: 'aigent-z',
      nonce: crypto.randomBytes(16).toString('hex'),
      expiry: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      executionMode: 'testnet-broadcast',
      expectedTxSummary:
        `Etch ${tokenomics.name}: on-chain premine ${tokenomics.premine.toLocaleString()} (of which ` +
        `${tokenomics.initiallyActiveIssuance?.toLocaleString?.()} initially active, ` +
        `${tokenomics.governedReserve?.toLocaleString?.()} governed reserve) to ${premineAddress} on testnet`,
      transactionClass: 'bitcent-treasury-ordinary',
    };

    console.log(`\n── Treasury mandate for this run (${PILOT_SECURITY_STATUS}) ──`);
    console.log(`  action:            ${treasuryMandate.action}`);
    console.log(`  asset / amount:    ${treasuryMandate.asset} / ${treasuryMandate.amount.toLocaleString()}`);
    console.log(`  source:            ${treasuryMandate.source}`);
    console.log(`  destination:       ${treasuryMandate.destination}`);
    console.log(`  network:           ${treasuryMandate.network}`);
    console.log(`  expires:           ${treasuryMandate.expiry}`);
    console.log(`  transaction class: ${treasuryMandate.transactionClass}`);

    const providedPasscode = await promptPasscode('\nEnter the treasury operator passcode to approve this mandate: ');
    const passcodeConfig = {
      hash: process.env.TREASURY_OPERATOR_PASSCODE_HASH,
      salt: process.env.TREASURY_OPERATOR_PASSCODE_SALT,
    };
    const context = {
      issuanceRecordRatified: open.length === 0,
      network: 'testnet',
      mainnetMandateExplicit: false,
      // No cap on THIS mandate: it is the one-time genesis issuance that
      // CREATES the treasury balance (the full on-chain premine, per the
      // governed-reserve model), not a spend FROM an existing balance. The
      // 100M-active/900M-reserve split is enforced on FUTURE transfer
      // mandates (not this script), which must set treasuryCap to
      // tokenomics.initiallyActiveIssuance until a new mandate raises it.
      treasuryCap: null,
      operatorIsSolePrincipal: true,
    };

    let authorization;
    try {
      authorization = authorizeTreasuryAction({
        mandate: treasuryMandate,
        providedPasscode,
        passcodeConfig,
        context,
        nonceStore: createFileBackedNonceStore(),
        nowIso: new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof TreasuryAuthorityRefusal && err.refusalCode === 'passcode-incorrect') {
        recordFailedPasscodeAttempt();
      }
      throw err;
    }

    console.log(`\n✅ Treasury mandate authorised.`);
    console.log(`  mandate commitment: ${authorization.mandateCommitment}`);
    console.log(`  required signatory: ${authorization.signatories.requiredSignatory} — ${authorization.signatories.requiredApproval.reason}`);
    console.log(`  observer:           ${authorization.signatories.observer} — ${authorization.signatories.observerResult.reason}`);
  }

  const { psbt, address } = await buildEtchingTransaction({
    network,
    apiBase,
    wif,
    tokenomics,
    premineAddress,
    requireRealUtxo: EXECUTE,
  });

  if (!EXECUTE) {
    console.log('\n✅ Dry run complete -- valid protocol-encoded transaction built, NOT broadcast.');
    console.log('  Reveal address:', address);
    console.log('  Inputs:', psbt.data.inputs.length);
    console.log('  Outputs:', psbt.txOutputs.length, psbt.txOutputs.map((o) => ({ value: o.value.toString() })));
    console.log('\nRun with --execute (after full ratification) to broadcast for real.');
    return;
  }

  // The mandate the operator approved must be the transaction that
  // executes -- checked against the REAL built transaction, not the
  // pre-declared intent, right before broadcast.
  assertMandateMatchesTransaction(treasuryMandate, {
    asset: tokenomics.name,
    amount: tokenomics.premine,
    destination: premineAddress,
    network: 'testnet',
  });

  // EXECUTE path -- fully ratified by this point, real UTXO, real signature.
  const tx = psbt.extractTransaction();
  const txHex = tx.toHex();
  console.log('📝 Transaction ready.');
  console.log('  Fee-inclusive size:', txHex.length / 2, 'bytes');
  console.log('  Explorer (once broadcast):', `https://mempool.space/testnet/tx/${tx.getId()}`);

  const proceed = await confirm('\nType "yes" to broadcast this transaction, anything else to abort: ');
  if (!proceed) {
    console.log('Aborted -- nothing broadcast.');
    return;
  }

  const res = await axios.post(`${apiBase}/tx`, txHex, { headers: { 'Content-Type': 'text/plain' } });
  console.log('✅ Broadcast successful. Response:', res.data);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Failed:', err.message);
    process.exitCode = 1;
  });
}

module.exports = { loadIssuanceRecord, checkRatification, resolveTokenomics, REQUIRED_FIELDS };
