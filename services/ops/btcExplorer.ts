/**
 * btcExplorer — THE canonical Bitcoin explorer/API URL helper.
 *
 * Every Bitcoin explorer link and API base on the platform MUST come from
 * this module. History (docs/CANISTER_MONITORING_UPGRADE.md): mempool.space
 * proved unreliable and was replaced with blockstream.info — but only on the
 * ops page, leaving other surfaces pointing at the abandoned provider. That
 * split was the recurring "mempool explorer" bug (2026-07-06 audit). A
 * canary test (tests/btc-explorer.test.ts) scans the source tree for
 * hardcoded explorer hosts to prevent recurrence.
 *
 * Isomorphic: no deps. In the browser BTC_NETWORK is absent, so the helper
 * defaults to testnet — the platform's current network everywhere.
 */

const NETWORK: 'testnet' | 'mainnet' =
  typeof process !== 'undefined' && process.env?.BTC_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';

/** Explorer web base (human-facing links). */
export function btcExplorerBase(): string {
  return NETWORK === 'mainnet' ? 'https://blockstream.info' : 'https://blockstream.info/testnet';
}

/** The canonical Esplora API base (blockstream) for an EXPLICIT network —
 * for callers (e.g. the x402 BTC adapter) that carry their own network
 * parameter instead of reading BTC_NETWORK. */
export function btcCanonicalApiBaseFor(network: 'mainnet' | 'testnet'): string {
  return network === 'mainnet'
    ? 'https://blockstream.info/api'
    : 'https://blockstream.info/testnet/api';
}

/** The canonical Esplora API base (blockstream), BTC_NETWORK-keyed. */
export function btcCanonicalApiBase(): string {
  return btcCanonicalApiBaseFor(NETWORK);
}

/** Esplora API base (programmatic status/tx reads). Env override first
 * (NEXT_PUBLIC_RPC_BTC_TESTNET), canonical blockstream fallback — the
 * "endpoint: not configured" dead-end is gone. */
export function btcApiBase(): string {
  const configured =
    typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_RPC_BTC_TESTNET : undefined;
  if (configured && configured.trim().length > 0) return configured.trim().replace(/\/$/, '');
  return btcCanonicalApiBase();
}

/**
 * A Bitcoin txid is 64 hex chars — but so is a Merkle root, which is why
 * shape-checking alone caused 404 links (proof_of_state's anchor ids are
 * roots, not txids). Use this as a NECESSARY guard, and source txids ONLY
 * from `btc_anchor_txid` / explorer responses — never from `lastAnchorId`.
 */
export function isBitcoinTxid(s: unknown): s is string {
  return typeof s === 'string' && /^[a-f0-9]{64}$/i.test(s);
}

export function btcTxUrl(txid: string): string {
  return `${btcExplorerBase()}/tx/${txid}`;
}

export function btcBlockHeightUrl(height: number | string): string {
  return `${btcExplorerBase()}/block-height/${height}`;
}

export function btcAddressUrl(address: string): string {
  return `${btcExplorerBase()}/address/${address}`;
}
