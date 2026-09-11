/**
 * The Rune-name checker must never answer "available" about a name we etched.
 *
 * ── The defect this exists to prevent, which already happened ──────────────
 *
 * `npm run check:bitcent-name` printed `LIKELY AVAILABLE (not found on this
 * indexer)` for BITCENT while our own etch transaction 551bbaaa… sat at 16,038
 * confirmations on testnet3. Two faults compounded:
 *
 *   1. The script never read our own record of what we had broadcast, so it
 *      answered a question that was closed.
 *   2. It mapped one indexer's HTTP 404 to "likely available". A 404 cannot
 *      separate "no such Rune" from "this endpoint does not index Runes on
 *      testnet" — and it resolved that ambiguity toward the outcome that
 *      invites a second etch. A Rune name is immutable once etched.
 *
 * The general rule these canaries hold: unknown ≠ absent, and of the two ways
 * to be wrong about an irreversible spend, only one is survivable.
 */

import { describe, it, expect } from 'vitest';

import { readSource, stripComments } from './_lib/sourceAuthority';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { checkName, ourEtchOn, VERDICTS } = require('../scripts/check-bitcent-name-availability.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const RECORD = require('../scripts/bitcent-issuance-record.json');

const SCRIPT = 'scripts/check-bitcent-name-availability.js';

const absent = async () => ({ status: 404 });
const found = async () => ({ status: 200, data: { rune: 'X', number: 1 } });
const broken = async () => {
  throw new Error('ECONNRESET');
};

describe('our own etch record outranks every indexer', () => {
  it('reports ETCHED BY US, not availability, when we hold the etch', async () => {
    const r = await checkName('BITCENT', { record: RECORD, httpGet: absent });
    expect(r.verdict).toBe(VERDICTS.ETCHED_BY_US);
    expect(r.conclusive).toBe(true);
    expect(r.detail).toContain(RECORD.etchBroadcast.txid);
  });

  it('a 404 against a name we etched is reported as an indexer fact, not a rune fact', async () => {
    // The exact live situation. The indexer's silence must be attributed to
    // the indexer — attributing it to the chain is what produced the bug.
    const r = await checkName('BITCENT', { record: RECORD, httpGet: absent });
    expect(r.indexerAgrees).toBe(false);
    expect(r.indexerDetail).toMatch(/about the INDEXER/i);
    expect(r.verdict).not.toMatch(/available/i);
  });

  it('the etch is network-scoped — a testnet etch never closes a mainnet question', async () => {
    const mainnetOnly = { ...RECORD, etchBroadcast: { ...RECORD.etchBroadcast, network: 'mainnet' } };
    expect(ourEtchOn(mainnetOnly, 'testnet3')).toBeNull();
    const r = await checkName('BITCENT', { record: mainnetOnly, network: 'testnet3', httpGet: absent });
    expect(r.verdict).toBe(VERDICTS.INCONCLUSIVE);
  });

  it('an etch entry with no txid is not an etch', () => {
    expect(ourEtchOn({ etchBroadcast: { network: 'testnet3' } }, 'testnet3')).toBeNull();
    expect(ourEtchOn({}, 'testnet3')).toBeNull();
  });
});

describe('no evidence this script can gather establishes that a name is free', () => {
  const unetched = { ...RECORD, etchBroadcast: undefined };

  it('never emits an "available" verdict in any branch', async () => {
    for (const httpGet of [absent, broken, async () => ({ status: 500 })]) {
      const r = await checkName('SOMENAME', { record: unetched, httpGet });
      expect(r.verdict).toBe(VERDICTS.INCONCLUSIVE);
      expect(r.conclusive).toBe(false);
    }
    expect(Object.values(VERDICTS).join(' ')).not.toMatch(/available(?! )/i);
  });

  it('the word LIKELY AVAILABLE appears nowhere in the script', () => {
    // The old wording read as a licence to spend on an irreversible etch.
    expect(stripComments(readSource(SCRIPT))).not.toMatch(/LIKELY AVAILABLE/i);
  });

  it('an indexer that cannot see our own confirmed etch is declared unusable', async () => {
    // Our etched name is the control: a name we hold positive on-chain
    // evidence for. A 404 on THAT proves the endpoint is not answering.
    const r = await checkName('SOMEOTHERNAME', { record: RECORD, network: 'unrelated-net', httpGet: absent });
    expect(r.verdict).toBe(VERDICTS.INCONCLUSIVE);
    expect(r.detail).toMatch(/not answering Rune queries/i);
  });

  it('a positive indexer hit on an unetched name is still conclusive against use', async () => {
    const r = await checkName('TAKENNAME', { record: unetched, httpGet: found });
    expect(r.verdict).toBe(VERDICTS.ETCHED_BY_OTHER);
    expect(r.conclusive).toBe(true);
  });
});

describe('the issuance record keeps its frozen parameters separate from observations', () => {
  it('etchBroadcast is namespaced and marked observational', () => {
    // Appending to a governed record is only safe if a reader can tell which
    // keys are ratified issuance parameters and which are a log of events.
    expect(RECORD.etchBroadcast.$comment).toMatch(/OBSERVATIONAL/);
    expect(RECORD.etchBroadcast.source).toBeTruthy();
  });

  it('the valid-etch verification is persisted as an observational receipt', () => {
    // Operator, 2026-08-02: "I would preserve the verification output and
    // transaction evidence as a receipt in the BITCENT record." It is primary
    // evidence — decoded from the transaction itself — so it outranks any
    // indexer, and it must be readable without re-running the script.
    const v = RECORD.etchBroadcast.verification;
    expect(v.verdict).toBe('VALID_ETCH');
    expect(v.isCenotaph).toBe(false);
    expect(v.confirmedInBlock).toBe(5084224);
    expect(v.$comment).toMatch(/OBSERVATIONAL/);
    expect(v.method).toMatch(/verify-bitcent-etch/);
    // The receipt must not read as authorising anything on mainnet.
    expect(v.consequence).toMatch(/mainnet/i);
  });

  it('no ratified field acquired a ratification flag from the append', () => {
    // The ten frozen fields each carry `ratified`; the observation must not.
    expect(RECORD.etchBroadcast.ratified).toBeUndefined();
    expect(RECORD.runeName.ratified).toBe(true);
  });
});
