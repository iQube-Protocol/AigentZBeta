/**
 * R-12 — BitCent Rune name-availability check (governed-reserve, 2026-07-30).
 *
 * ── WHY THESE CANARIES WERE REWRITTEN (2026-08-03) ────────────────────────
 *
 * They were pinning a contract the script no longer has, and the OLD contract
 * was the defect. `scripts/check-bitcent-name-availability.js` used to be able
 * to answer `LIKELY AVAILABLE` — and it answered exactly that about BITCENT, a
 * name we had ourselves already etched on testnet3 (tx 551bbaaa…, 16,038
 * confirmations). A Rune name is immutable once etched, so that verdict pointed
 * in the one direction capable of causing a second, irreversible spend.
 *
 * The script was then corrected on two axes at once:
 *   1. `LIKELY AVAILABLE` was DELETED from the verdict vocabulary. No evidence
 *      available to a single indexer can establish that a name is free; the
 *      wording read as a licence to spend.
 *   2. Our own etch short-circuits the question — NETWORK-SCOPED, because a
 *      testnet etch says nothing about mainnet availability.
 *
 * These canaries were left asserting the removed vocabulary, so they failed
 * rather than describing the safer behaviour. Each one below is re-pointed at
 * the branch it was actually trying to protect, and the vocabulary itself is
 * now pinned so the dangerous verdict cannot return.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const REPO = join(__dirname, '..');
const SCRIPT = join(REPO, 'scripts/check-bitcent-name-availability.js');

async function loadCheckName() {
  const mod = await import(pathToFileURL(SCRIPT).href);
  return mod.checkName as (
    name: string,
    opts: { network?: string; httpGet: (url: string) => Promise<unknown> },
  ) => Promise<{
    verdict: string;
    detail: string;
    conclusive: boolean;
    indexerAgrees?: boolean;
    indexerDetail?: string;
  }>;
}

/** A network we hold NO etch for — the only way to reach the probe branches. */
const UNETCHED_NETWORK = 'mainnet';

describe('the name we already etched is a closed question, not an open one', () => {
  it('answers ETCHED_BY_US on the network we hold the etch for', async () => {
    const checkName = await loadCheckName();
    // testnet3 is the network in the issuance record's etchBroadcast.
    const result = await checkName('BITCENT', { network: 'testnet3', httpGet: async () => ({ status: 404 }) });
    expect(result.verdict).toMatch(/ALREADY ETCHED BY US/);
    expect(result.conclusive).toBe(true);
    expect(result.detail).toContain('551bbaaa');
  });

  it('reports an indexer 404 as a fact about the INDEXER, never as doubt about the etch', async () => {
    // mempool.space's testnet Rune endpoint has returned 404 for BITCENT
    // through 16,038 confirmations. The etch is confirmed on chain and was
    // decoded from its own OP_RETURN; the indexer simply does not answer.
    const checkName = await loadCheckName();
    const result = await checkName('BITCENT', { network: 'testnet3', httpGet: async () => ({ status: 404 }) });
    expect(result.indexerAgrees).toBe(false);
    expect(result.indexerDetail).toMatch(/not about the etch/i);
    expect(result.conclusive, 'an indexer that cannot answer must not reopen a settled question').toBe(true);
  });

  it('does NOT carry the testnet etch over to a network we have not etched on', async () => {
    // The property that makes the short-circuit safe rather than dangerous: a
    // "we already did this" answer must never authorise a mainnet spend.
    const checkName = await loadCheckName();
    const result = await checkName('BITCENT', { network: UNETCHED_NETWORK, httpGet: async () => ({ status: 404 }) });
    expect(result.verdict).not.toMatch(/ETCHED BY US/);
  });
});

describe('no result this script can return means "free"', () => {
  it('has no LIKELY AVAILABLE verdict at all — the vocabulary, not just the branch', async () => {
    /*
     * THE HISTORICAL DEFECT ITSELF (OS-9). This exact phrase is what the
     * script said about a name we had already etched. Deleting the branch
     * while leaving the phrase in the vocabulary would let it come back.
     *
     * Asserted against the exported VERDICTS, not the file text: the file
     * still NAMES the removed phrase — in the comment explaining why it is
     * gone, and in the issuance record's own account of the incident. A
     * source-text assertion would forbid documenting the fix.
     */
    const { VERDICTS } = await import(pathToFileURL(SCRIPT).href);
    expect(Object.values(VERDICTS as Record<string, string>).join(' ')).not.toMatch(/LIKELY AVAILABLE/);
    expect(Object.values(VERDICTS as Record<string, string>).join(' ')).not.toMatch(/AVAILABLE/);
  });

  it('an indexer 404 is INCONCLUSIVE — absence from one index is not evidence of absence', async () => {
    const checkName = await loadCheckName();
    const result = await checkName('SOMEOTHERNAME', { network: UNETCHED_NETWORK, httpGet: async () => ({ status: 404 }) });
    expect(result.verdict).toMatch(/INCONCLUSIVE/);
    expect(result.conclusive).toBe(false);
  });

  it('an unexpected status is INCONCLUSIVE, never coerced into a yes/no answer', async () => {
    const checkName = await loadCheckName();
    const result = await checkName('SOMEOTHERNAME', {
      network: UNETCHED_NETWORK,
      httpGet: async () => ({ status: 500, data: null }),
    });
    expect(result.verdict).toMatch(/INCONCLUSIVE/);
    expect(result.conclusive).toBe(false);
  });

  it('a transport failure is INCONCLUSIVE, and says which failure', async () => {
    const checkName = await loadCheckName();
    const result = await checkName('SOMEOTHERNAME', {
      network: UNETCHED_NETWORK,
      httpGet: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    expect(result.verdict).toMatch(/INCONCLUSIVE/);
    expect(result.detail).toMatch(/ECONNREFUSED/);
  });
});

describe('a name someone else holds is refused conclusively', () => {
  it('a 200 with an existing Rune record, on a network we have not etched, is ETCHED BY SOMEONE ELSE', async () => {
    const checkName = await loadCheckName();
    const result = await checkName('SOMEOTHERNAME', {
      network: UNETCHED_NETWORK,
      httpGet: async () => ({ status: 200, data: { rune: 'SOMEOTHERNAME', etched: true } }),
    });
    expect(result.verdict).toMatch(/ALREADY ETCHED BY SOMEONE ELSE/);
    expect(result.conclusive).toBe(true);
  });
});

describe('the subject comes from the ratified record', () => {
  it('loads the name from the issuance record, not a hardcoded literal', () => {
    const src = readFileSync(SCRIPT, 'utf-8');
    expect(src).toMatch(/loadIssuanceRecord/);
    expect(src).toMatch(/record\.runeName\?\.value/);
  });
});
