/**
 * Bitcent (B¢) live-balance resolver canaries.
 *
 * The wallet's testnet Bitcent row was hardcoded `pending = true` forever,
 * never even attempting a live read (see git history of
 * app/components/content/SmartWalletDrawer.tsx and
 * app/api/ops/bitcent/testnet/route.ts before this change). These tests pin
 * the fix: services/ops/bitcentBalance.ts resolves the CURRENT premine
 * balance from PRIMARY chain data — decoding the etch transaction's own
 * Runestone with the same runelib encoder that built it
 * (scripts/deploy-qct-bitcoin.js), then checking whether the premine output
 * has been spent via the platform's existing Esplora fallback — with no
 * Rune-aware indexer required for the common case, and never a fabricated
 * number for the case it cannot resolve.
 *
 * The synthetic transactions below are built with the exact same runelib
 * encoder deploy-qct-bitcoin.js uses (Etching + Runestone), so this
 * exercises the real decode path, not a mocked stand-in for it.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Transaction, address as btcAddress, networks } from 'bitcoinjs-lib';
import { Runestone, Etching, Rune, some, none } from 'runelib';
import { resolveBitcentPremineBalance } from '../services/ops/bitcentBalance';

const TXID = 'b'.repeat(64);
const PREMINE_ADDRESS = 'tb1qse78njf7v33lmwjl2dq6j2g0djhw0h5awkrcwn';

/** Mirrors scripts/deploy-qct-bitcoin.js's buildEtchingTransaction shape:
 * output 0 = OP_RETURN Runestone, output 1 = premine address (546 sats),
 * optional output 2 = change to the same address. No edicts, no explicit
 * Pointer -- the premine defaults to the first non-OP_RETURN output. */
function buildEtchTxHex(opts: { pointerVout?: number; extraChangeOutput?: boolean } = {}): string {
  const tx = new Transaction();
  tx.addInput(Buffer.alloc(32, 1), 0);

  const rune = Rune.fromName('BITCENT');
  const etching = new Etching(some(2), some(100000000000), some(rune), none(), some('B'), none(), true);
  const pointer = opts.pointerVout != null ? some(opts.pointerVout) : none();
  const stone = new Runestone([], some(etching), none(), pointer);
  tx.addOutput(stone.encipher(), BigInt(0));

  const outScript = btcAddress.toOutputScript(PREMINE_ADDRESS, networks.testnet);
  tx.addOutput(outScript, BigInt(546));
  if (opts.extraChangeOutput) {
    tx.addOutput(outScript, BigInt(12345));
  }
  return tx.toHex();
}

function mockFetchByHost(handlers: { blockstream?: (path: string) => Response; mempool?: (path: string) => Response }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('blockstream.info')) {
        const path = url.split('blockstream.info/testnet/api')[1] ?? '';
        if (handlers.blockstream) return handlers.blockstream(path);
        throw new Error('unexpected blockstream call');
      }
      if (url.includes('mempool.space')) {
        const path = url.split('mempool.space/testnet/api')[1] ?? '';
        if (handlers.mempool) return handlers.mempool(path);
        throw new Error('unexpected mempool call');
      }
      throw new Error(`unexpected host: ${url}`);
    }),
  );
}

function hexResponse(hex: string, ok = true): Response {
  return { ok, text: async () => hex, json: async () => ({}) } as Response;
}
function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}
function failedResponse(): Response {
  return { ok: false, text: async () => '', json: async () => ({}) } as Response;
}

describe('resolveBitcentPremineBalance', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('refuses to resolve when the etch has not been verified as VALID_ETCH', async () => {
    const result = await resolveBitcentPremineBalance({ txid: TXID, alreadyVerifiedValidEtch: false });
    expect(result.resolved).toBe(false);
    expect(result.reason).toMatch(/verified as a valid/i);
  });

  it('resolves the real premine amount when the premine output is unspent (the common case)', async () => {
    const hex = buildEtchTxHex();
    mockFetchByHost({
      blockstream: (path) => {
        if (path.startsWith(`/tx/${TXID}/hex`)) return hexResponse(hex);
        if (path.startsWith(`/tx/${TXID}/outspend/1`)) return jsonResponse({ spent: false });
        throw new Error(`unexpected blockstream path ${path}`);
      },
      mempool: () => failedResponse(),
    });

    const result = await resolveBitcentPremineBalance({ txid: TXID, alreadyVerifiedValidEtch: true });
    expect(result.resolved).toBe(true);
    expect(result.runeName).toBe('BITCENT');
    expect(result.divisibility).toBe(2);
    // raw premine 100,000,000,000 / 10^2 = 1,000,000,000 -- matches the
    // ratified record's premine.value (scripts/bitcent-issuance-record.json).
    expect(result.amount).toBe(1000000000);
    expect(result.outputIndex).toBe(1);
    expect(result.source).toBe('blockstream');
    expect(result.reason).toBeNull();
  });

  it('still resolves correctly with a change output present (premine output stays index 1)', async () => {
    const hex = buildEtchTxHex({ extraChangeOutput: true });
    mockFetchByHost({
      blockstream: (path) => {
        if (path.startsWith(`/tx/${TXID}/hex`)) return hexResponse(hex);
        if (path.startsWith(`/tx/${TXID}/outspend/1`)) return jsonResponse({ spent: false });
        throw new Error(`unexpected blockstream path ${path}`);
      },
      mempool: () => failedResponse(),
    });

    const result = await resolveBitcentPremineBalance({ txid: TXID, alreadyVerifiedValidEtch: true });
    expect(result.resolved).toBe(true);
    expect(result.outputIndex).toBe(1);
    expect(result.amount).toBe(1000000000);
  });

  it('honours an explicit Pointer field over the first-non-OP_RETURN default', async () => {
    // Pointer -> output 2 (still the premine address in this fixture; the
    // point is the resolver reads the Pointer, not just "first non-OP_RETURN").
    const hex = buildEtchTxHex({ pointerVout: 2, extraChangeOutput: true });
    mockFetchByHost({
      blockstream: (path) => {
        if (path.startsWith(`/tx/${TXID}/hex`)) return hexResponse(hex);
        if (path.startsWith(`/tx/${TXID}/outspend/2`)) return jsonResponse({ spent: false });
        throw new Error(`unexpected blockstream path ${path}`);
      },
      mempool: () => failedResponse(),
    });

    const result = await resolveBitcentPremineBalance({ txid: TXID, alreadyVerifiedValidEtch: true });
    expect(result.resolved).toBe(true);
    expect(result.outputIndex).toBe(2);
  });

  it('never fabricates a balance when the premine output has moved -- reports unresolved, honestly', async () => {
    const hex = buildEtchTxHex();
    mockFetchByHost({
      blockstream: (path) => {
        if (path.startsWith(`/tx/${TXID}/hex`)) return hexResponse(hex);
        if (path.startsWith(`/tx/${TXID}/outspend/1`)) return jsonResponse({ spent: true });
        throw new Error(`unexpected blockstream path ${path}`);
      },
      mempool: () => failedResponse(),
    });

    const result = await resolveBitcentPremineBalance({ txid: TXID, alreadyVerifiedValidEtch: true });
    expect(result.resolved).toBe(false);
    expect(result.amount).toBeNull();
    expect(result.reason).toMatch(/moved/i);
    // Still reports what it DID learn from primary evidence, honestly.
    expect(result.runeName).toBe('BITCENT');
    expect(result.outputIndex).toBe(1);
  });

  it('never fabricates a balance when the raw transaction is unavailable from either explorer', async () => {
    mockFetchByHost({
      blockstream: () => failedResponse(),
      mempool: () => failedResponse(),
    });

    const result = await resolveBitcentPremineBalance({ txid: TXID, alreadyVerifiedValidEtch: true });
    expect(result.resolved).toBe(false);
    expect(result.amount).toBeNull();
    expect(result.reason).toBeTruthy();
  });

  it('never fabricates a balance when neither explorer can resolve the output-spend status', async () => {
    const hex = buildEtchTxHex();
    mockFetchByHost({
      blockstream: (path) => {
        if (path.startsWith(`/tx/${TXID}/hex`)) return hexResponse(hex);
        if (path.startsWith(`/tx/${TXID}/outspend/1`)) return failedResponse();
        throw new Error(`unexpected blockstream path ${path}`);
      },
      mempool: () => failedResponse(),
    });

    const result = await resolveBitcentPremineBalance({ txid: TXID, alreadyVerifiedValidEtch: true });
    expect(result.resolved).toBe(false);
    expect(result.amount).toBeNull();
    expect(result.reason).toBeTruthy();
  });

  it('falls back to mempool.space when blockstream.info cannot resolve the raw transaction', async () => {
    const hex = buildEtchTxHex();
    mockFetchByHost({
      blockstream: () => failedResponse(),
      mempool: (path) => {
        if (path.startsWith(`/tx/${TXID}/hex`)) return hexResponse(hex);
        if (path.startsWith(`/tx/${TXID}/outspend/1`)) return jsonResponse({ spent: false });
        throw new Error(`unexpected mempool path ${path}`);
      },
    });

    const result = await resolveBitcentPremineBalance({ txid: TXID, alreadyVerifiedValidEtch: true });
    expect(result.resolved).toBe(true);
    expect(result.source).toBe('mempool');
    expect(result.amount).toBe(1000000000);
  });
});
