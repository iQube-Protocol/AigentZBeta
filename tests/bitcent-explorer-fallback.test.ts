import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  fetchBtcConfirmationWithFallback,
  fetchBtcRawTxHexWithFallback,
  fetchBtcOutspendWithFallback,
} from '../services/ops/btcExplorer';

// Bitcent ops-card confirmation canaries (operator ruling 2026-07-31,
// following the Bitcent ops-card incident where 33 real mempool.space/
// blockstream.info confirmations were not reflected on the card). These pin
// the bounded-fallback contract: blockstream.info primary, mempool.space
// consulted only when needed, divergence reported rather than merged, and a
// total failure surfaced as an explicit error rather than a silent "—".

const TXID = 'a'.repeat(64);
const TIP_HEIGHT = 5084256;
const BLOCK_HEIGHT = 5084224; // operator-verified real block height for this tx

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body, text: async () => String(body) } as Response;
}
function textResponse(body: string, ok = true) {
  return { ok, json: async () => JSON.parse(body), text: async () => body } as Response;
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

describe('fetchBtcConfirmationWithFallback — confirmation math (operator fixture)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('computes confirmations as tipHeight - blockHeight + 1 from the exact operator-supplied fixture', async () => {
    mockFetchByHost({
      blockstream: (path) => {
        if (path.startsWith(`/tx/${TXID}`)) {
          return jsonResponse({ status: { confirmed: true, block_height: BLOCK_HEIGHT } });
        }
        if (path.startsWith('/blocks/tip/height')) return textResponse(String(TIP_HEIGHT));
        throw new Error(`unexpected blockstream path ${path}`);
      },
      mempool: () => jsonResponse({}, false),
    });

    const result = await fetchBtcConfirmationWithFallback(TXID);
    expect(result.confirmed).toBe(true);
    expect(result.blockHeight).toBe(BLOCK_HEIGHT);
    expect(result.confirmations).toBe(TIP_HEIGHT - BLOCK_HEIGHT + 1);
    expect(result.source).toBe('blockstream');
    expect(result.error).toBeNull();
  });
});

describe('fetchBtcConfirmationWithFallback — bounded fallback', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('falls back to mempool.space when blockstream.info cannot resolve the transaction', async () => {
    mockFetchByHost({
      blockstream: () => jsonResponse({}, false),
      mempool: (path) => {
        if (path.startsWith(`/tx/${TXID}`)) return jsonResponse({ status: { confirmed: true, block_height: BLOCK_HEIGHT } });
        if (path.startsWith('/blocks/tip/height')) return textResponse(String(TIP_HEIGHT));
        throw new Error(`unexpected mempool path ${path}`);
      },
    });

    const result = await fetchBtcConfirmationWithFallback(TXID);
    expect(result.confirmed).toBe(true);
    expect(result.source).toBe('mempool');
    expect(result.confirmations).toBe(TIP_HEIGHT - BLOCK_HEIGHT + 1);
  });

  it('reports source AND checkedAt on every result — never a silent, unattributed number', async () => {
    mockFetchByHost({
      blockstream: (path) => {
        if (path.startsWith(`/tx/${TXID}`)) return jsonResponse({ status: { confirmed: true, block_height: BLOCK_HEIGHT } });
        if (path.startsWith('/blocks/tip/height')) return textResponse(String(TIP_HEIGHT));
        throw new Error('unexpected');
      },
      mempool: () => jsonResponse({}, false),
    });
    const result = await fetchBtcConfirmationWithFallback(TXID);
    expect(result.source).toBe('blockstream');
    expect(typeof result.checkedAt).toBe('string');
    expect(new Date(result.checkedAt).toString()).not.toBe('Invalid Date');
  });

  it('surfaces disagreement between explorers as divergence, never silently merged', async () => {
    mockFetchByHost({
      blockstream: (path) => {
        if (path.startsWith(`/tx/${TXID}`)) return jsonResponse({ status: { confirmed: true, block_height: BLOCK_HEIGHT } });
        if (path.startsWith('/blocks/tip/height')) return textResponse(String(TIP_HEIGHT)); // -> 33
        throw new Error('unexpected');
      },
      mempool: (path) => {
        if (path.startsWith(`/tx/${TXID}`)) return jsonResponse({ status: { confirmed: true, block_height: BLOCK_HEIGHT } });
        if (path.startsWith('/blocks/tip/height')) return textResponse(String(TIP_HEIGHT + 5)); // higher tip -> more confirmations
        throw new Error('unexpected');
      },
    });
    const result = await fetchBtcConfirmationWithFallback(TXID);
    expect(result.divergence).not.toBeNull();
    expect(result.divergence?.blockstream).toBe(TIP_HEIGHT - BLOCK_HEIGHT + 1);
    expect(result.divergence?.mempool).toBe(TIP_HEIGHT + 5 - BLOCK_HEIGHT + 1);
  });

  it('is conservative on divergence — reports the LOWER confirmation count, never over-claims finality', async () => {
    mockFetchByHost({
      blockstream: (path) => {
        if (path.startsWith(`/tx/${TXID}`)) return jsonResponse({ status: { confirmed: true, block_height: BLOCK_HEIGHT } });
        if (path.startsWith('/blocks/tip/height')) return textResponse(String(TIP_HEIGHT));
        throw new Error('unexpected');
      },
      mempool: (path) => {
        if (path.startsWith(`/tx/${TXID}`)) return jsonResponse({ status: { confirmed: true, block_height: BLOCK_HEIGHT } });
        if (path.startsWith('/blocks/tip/height')) return textResponse(String(TIP_HEIGHT + 5));
        throw new Error('unexpected');
      },
    });
    const result = await fetchBtcConfirmationWithFallback(TXID);
    expect(result.confirmations).toBe(TIP_HEIGHT - BLOCK_HEIGHT + 1); // the lower of the two
  });

  it('surfaces an explicit error when neither explorer can resolve the transaction — never a silent "—"', async () => {
    mockFetchByHost({
      blockstream: () => jsonResponse({}, false),
      mempool: () => jsonResponse({}, false),
    });
    const result = await fetchBtcConfirmationWithFallback(TXID);
    expect(result.confirmed).toBe(false);
    expect(result.confirmations).toBeNull();
    expect(result.source).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('does not fabricate confirmations for a resolved-but-unconfirmed transaction', async () => {
    mockFetchByHost({
      blockstream: (path) => {
        if (path.startsWith(`/tx/${TXID}`)) return jsonResponse({ status: { confirmed: false } });
        throw new Error('unexpected');
      },
      mempool: () => jsonResponse({}, false),
    });
    const result = await fetchBtcConfirmationWithFallback(TXID);
    expect(result.confirmed).toBe(false);
    expect(result.confirmations).toBeNull();
  });
});

describe('fetchBtcRawTxHexWithFallback — bounded fallback for raw tx hex reads', () => {
  afterEach(() => vi.unstubAllGlobals());
  const HEX = 'deadbeef';

  it('returns the raw hex from blockstream.info when it resolves the transaction', async () => {
    mockFetchByHost({
      blockstream: (path) => (path.startsWith(`/tx/${TXID}/hex`) ? textResponse(HEX) : jsonResponse({}, false)),
      mempool: () => jsonResponse({}, false),
    });
    const result = await fetchBtcRawTxHexWithFallback(TXID);
    expect(result.hex).toBe(HEX);
    expect(result.source).toBe('blockstream');
    expect(result.error).toBeNull();
  });

  it('falls back to mempool.space when blockstream.info cannot return the raw hex', async () => {
    mockFetchByHost({
      blockstream: () => jsonResponse({}, false),
      mempool: (path) => (path.startsWith(`/tx/${TXID}/hex`) ? textResponse(HEX) : jsonResponse({}, false)),
    });
    const result = await fetchBtcRawTxHexWithFallback(TXID);
    expect(result.hex).toBe(HEX);
    expect(result.source).toBe('mempool');
  });

  it('surfaces an explicit error when neither explorer returns the raw transaction — never null with no explanation', async () => {
    mockFetchByHost({
      blockstream: () => jsonResponse({}, false),
      mempool: () => jsonResponse({}, false),
    });
    const result = await fetchBtcRawTxHexWithFallback(TXID);
    expect(result.hex).toBeNull();
    expect(result.source).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

describe('fetchBtcOutspendWithFallback — bounded fallback for output-spend status', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports spent=false from blockstream.info', async () => {
    mockFetchByHost({
      blockstream: (path) => (path.startsWith(`/tx/${TXID}/outspend/1`) ? jsonResponse({ spent: false }) : jsonResponse({}, false)),
      mempool: () => jsonResponse({}, false),
    });
    const result = await fetchBtcOutspendWithFallback(TXID, 1);
    expect(result.spent).toBe(false);
    expect(result.source).toBe('blockstream');
  });

  it('falls back to mempool.space when blockstream.info cannot resolve the output', async () => {
    mockFetchByHost({
      blockstream: () => jsonResponse({}, false),
      mempool: (path) => (path.startsWith(`/tx/${TXID}/outspend/1`) ? jsonResponse({ spent: true }) : jsonResponse({}, false)),
    });
    const result = await fetchBtcOutspendWithFallback(TXID, 1);
    expect(result.spent).toBe(true);
    expect(result.source).toBe('mempool');
  });

  it('surfaces an explicit error when neither explorer can resolve the output-spend status', async () => {
    mockFetchByHost({
      blockstream: () => jsonResponse({}, false),
      mempool: () => jsonResponse({}, false),
    });
    const result = await fetchBtcOutspendWithFallback(TXID, 1);
    expect(result.spent).toBeNull();
    expect(result.source).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

describe('Bitcent wallet — unresolved balance must never render as zero', () => {
  const source = readFileSync(
    join(__dirname, '../app/components/content/SmartWalletDrawer.tsx'),
    'utf8',
  );

  it('the mainnet Bitcent row shows "Awaiting Runes indexer" when pending, never a bare amount', () => {
    expect(source).toMatch(/bcentMainnetPending \? "Awaiting Runes indexer" : formatFixed\(bcentMainnetAmount\)/);
  });

  /*
   * REPLACED 2026-08-03. This asserted the literal "Awaiting Runes indexer"
   * for the TESTNET row — pinning a sentence that had become false. Testnet
   * B¢ is resolved from primary chain data (Runestone decode + output spend
   * check); there is no indexer in that path to await, and the API returns
   * `balanceUnresolvedReason` giving the real cause. A green test requiring
   * the stale sentence was defending the defect (OS-9,
   * codexes/packs/agentiq/updates/2026-08-03_observer-state-invariants.md).
   * The MAINNET row above still legitimately awaits an indexer and keeps its
   * assertion unchanged.
   */
  it('the testnet Bitcent row shows the reason it is unresolved, never a bare amount', () => {
    expect(source).toMatch(/bcentTestnetPending \? bcentTestnetPendingLabel : formatFixed\(bcentTestnetAmount\)/);
  });
});

describe('Bitcent ops card — the two JSON files the route readFileSync()s at request time must be traced into the Lambda bundle', () => {
  // 2026-08-01 incident: /api/ops/bitcent/testnet reads deployments/bitcent-testnet.json
  // and scripts/bitcent-issuance-record.json via readFileSync(join(process.cwd(), ...)),
  // a pattern Next's standalone output tracer cannot statically resolve. Without an
  // outputFileTracingIncludes entry, the Amplify Lambda bundle drops both files, the
  // route throws ENOENT and 500s, and the ops card's hook (useBitcentTestnet) throws on
  // !r.ok, leaving `data` permanently null — the entirely-blank card the operator
  // reported (Status: unknown, Etch TX —, Rune —(—), Premine —, Custodian —, etc.).
  const nextConfig = readFileSync(join(__dirname, '../next.config.js'), 'utf8');

  it('next.config.js traces both JSON files for the bitcent testnet route', () => {
    const match = nextConfig.match(/"\/api\/ops\/bitcent\/testnet":\s*\[([\s\S]*?)\]/);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('deployments/bitcent-testnet.json');
    expect(match![1]).toContain('scripts/bitcent-issuance-record.json');
  });

  it('the route itself still reads both files via readFileSync(join(process.cwd(), ...)) — if this changes, update the trace entry to match', () => {
    const routeSource = readFileSync(
      join(__dirname, '../app/api/ops/bitcent/testnet/route.ts'),
      'utf8',
    );
    expect(routeSource).toMatch(/readFileSync\(join\(process\.cwd\(\), 'scripts', 'bitcent-issuance-record\.json'\)/);
    expect(routeSource).toMatch(/readFileSync\(join\(process\.cwd\(\), 'deployments', 'bitcent-testnet\.json'\)/);
  });
});

describe('an unresolved balance says WHY, not a mechanism it no longer uses (2026-08-03)', () => {
  /*
   * The wallet printed "Awaiting Runes indexer" for every unresolved testnet
   * B¢ balance. That names a dependency the resolver does not have — testnet
   * B¢ comes from primary chain data (Runestone decode + output spend check),
   * with no Rune-aware indexer in the path at all. Meanwhile the API already
   * returned `balanceUnresolvedReason` explaining the real cause, and the
   * surface discarded it.
   */
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const drawer = fs.readFileSync(
    path.join(__dirname, '..', 'app', 'components', 'content', 'SmartWalletDrawer.tsx'),
    'utf8',
  );

  it('the testnet row renders the API-supplied reason, never a hardcoded indexer sentence', () => {
    expect(drawer).toContain('bitcentTestnet.data?.balanceUnresolvedReason');
    expect(drawer).toMatch(/value: bcentTestnetPending \? bcentTestnetPendingLabel/);
  });

  it('still never renders an unresolved balance as a number', () => {
    // The honesty rule this row already had must survive the change.
    expect(drawer).toMatch(/unit: bcentTestnetPending \? "" : "B¢"/);
    expect(drawer).toMatch(/pending: bcentTestnetPending/);
  });
});
