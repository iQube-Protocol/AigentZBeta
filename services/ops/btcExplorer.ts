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

/** The mempool.space Esplora-compatible API base, BTC_NETWORK-keyed. Used
 * ONLY as a bounded fallback (see fetchBtcConfirmationWithFallback below) —
 * blockstream.info stays the configured primary per the 2026-07-06 audit
 * (docs/CANISTER_MONITORING_UPGRADE.md). Do not use this as a standalone
 * primary source anywhere; that reintroduces the reliability problem the
 * original switch to blockstream.info fixed. */
function mempoolApiBase(): string {
  return NETWORK === 'mainnet' ? 'https://mempool.space/api' : 'https://mempool.space/testnet/api';
}

interface TxConfirmationProbe {
  confirmed: boolean;
  blockHeight: number | null;
  confirmations: number | null;
}

async function probeTxConfirmation(apiBase: string, txid: string): Promise<TxConfirmationProbe | null> {
  const txRes = await fetch(`${apiBase}/tx/${txid}`, { cache: 'no-store' });
  if (!txRes.ok) return null;
  const txJson: any = await txRes.json();
  const confirmed = !!txJson?.status?.confirmed;
  const blockHeight = typeof txJson?.status?.block_height === 'number' ? txJson.status.block_height : null;
  if (!confirmed || blockHeight == null) return { confirmed, blockHeight, confirmations: null };
  const tipRes = await fetch(`${apiBase}/blocks/tip/height`, { cache: 'no-store' });
  if (!tipRes.ok) return { confirmed, blockHeight, confirmations: null };
  const tipHeight = Number(await tipRes.text());
  if (!Number.isFinite(tipHeight)) return { confirmed, blockHeight, confirmations: null };
  return { confirmed, blockHeight, confirmations: Math.max(0, tipHeight - blockHeight + 1) };
}

export type BtcExplorerSource = 'blockstream' | 'mempool';

/** Human-readable labels for a BtcExplorerSource — UI surfaces must use
 * this, never a hardcoded 'blockstream.info'/'mempool.space' string
 * (tests/btc-explorer.test.ts's canary forbids that outside this file). */
export const BTC_EXPLORER_LABELS: Record<BtcExplorerSource, string> = {
  blockstream: 'blockstream.info',
  mempool: 'mempool.space',
};

export interface BtcConfirmationResult {
  confirmed: boolean;
  confirmations: number | null;
  blockHeight: number | null;
  /** Which source the reported confirmations/blockHeight came from. Null
   * only when neither source resolved the transaction at all. */
  source: BtcExplorerSource | null;
  checkedAt: string;
  /** Present only when both sources answered AND their confirmation counts
   * disagreed — never silently merged (operator ruling 2026-07-31). */
  divergence: { blockstream: number | null; mempool: number | null } | null;
  /** Surfaced, never collapsed into a bare "—" (operator ruling 2026-07-31):
   * set when neither source could resolve the transaction at all. */
  error: string | null;
}

/**
 * Confirmation status with a bounded fallback (operator ruling 2026-07-31,
 * following the 2026-07-31 Bitcent ops-card incident): blockstream.info
 * stays the configured PRIMARY source — do not replace it globally, its
 * 2026-07-06 switch had its own reliability rationale — but a transaction
 * blockstream.info can't currently resolve is checked against mempool.space
 * before giving up. When both sources answer and disagree, the LOWER
 * confirmation count wins (confirmation state is determined conservatively
 * — never over-claim finality) and the disagreement itself is reported via
 * `divergence`, never silently merged into one number.
 */
export async function fetchBtcConfirmationWithFallback(txid: string): Promise<BtcConfirmationResult> {
  const checkedAt = new Date().toISOString();
  const primaryBase = btcCanonicalApiBase();
  const fallbackBase = mempoolApiBase();

  const [primary, fallback] = await Promise.all([
    probeTxConfirmation(primaryBase, txid).catch(() => null),
    probeTxConfirmation(fallbackBase, txid).catch(() => null),
  ]);

  const divergence =
    primary?.confirmations != null && fallback?.confirmations != null && primary.confirmations !== fallback.confirmations
      ? { blockstream: primary.confirmations, mempool: fallback.confirmations }
      : null;

  if (primary?.confirmed && fallback?.confirmed && primary.confirmations != null && fallback.confirmations != null) {
    const conservative = Math.min(primary.confirmations, fallback.confirmations);
    return {
      confirmed: true,
      confirmations: conservative,
      blockHeight: primary.blockHeight,
      source: conservative === fallback.confirmations && conservative !== primary.confirmations ? 'mempool' : 'blockstream',
      checkedAt,
      divergence,
      error: null,
    };
  }
  if (primary?.confirmed) {
    return { confirmed: true, confirmations: primary.confirmations, blockHeight: primary.blockHeight, source: 'blockstream', checkedAt, divergence, error: null };
  }
  if (fallback?.confirmed) {
    return { confirmed: true, confirmations: fallback.confirmations, blockHeight: fallback.blockHeight, source: 'mempool', checkedAt, divergence, error: null };
  }
  if (primary || fallback) {
    // At least one source resolved the tx but it isn't confirmed yet.
    const seen = primary ?? fallback!;
    return {
      confirmed: false,
      confirmations: null,
      blockHeight: seen.blockHeight,
      source: primary ? 'blockstream' : 'mempool',
      checkedAt,
      divergence: null,
      error: null,
    };
  }
  return {
    confirmed: false,
    confirmations: null,
    blockHeight: null,
    source: null,
    checkedAt,
    divergence: null,
    error: 'Neither blockstream.info nor mempool.space could resolve this transaction',
  };
}

export interface BtcRawTxHexResult {
  hex: string | null;
  source: BtcExplorerSource | null;
  checkedAt: string;
  error: string | null;
}

async function probeRawTxHex(apiBase: string, txid: string): Promise<string | null> {
  const res = await fetch(`${apiBase}/tx/${txid}/hex`, { cache: 'no-store' });
  if (!res.ok) return null;
  const text = (await res.text()).trim();
  return /^[0-9a-f]+$/i.test(text) ? text : null;
}

/**
 * Raw transaction hex, bounded-fallback (same shape as
 * fetchBtcConfirmationWithFallback above). Used to decode a transaction's own
 * Runestone from PRIMARY chain data — never a Rune-aware indexer's opinion —
 * following the precedent set by scripts/verify-bitcent-etch.js.
 */
export async function fetchBtcRawTxHexWithFallback(txid: string): Promise<BtcRawTxHexResult> {
  const checkedAt = new Date().toISOString();
  const primaryBase = btcCanonicalApiBase();
  const fallbackBase = mempoolApiBase();

  const [primary, fallback] = await Promise.all([
    probeRawTxHex(primaryBase, txid).catch(() => null),
    probeRawTxHex(fallbackBase, txid).catch(() => null),
  ]);

  if (primary) return { hex: primary, source: 'blockstream', checkedAt, error: null };
  if (fallback) return { hex: fallback, source: 'mempool', checkedAt, error: null };
  return {
    hex: null,
    source: null,
    checkedAt,
    error: 'Neither blockstream.info nor mempool.space returned the raw transaction',
  };
}

export interface BtcOutspendResult {
  /** null only when neither source could resolve the output's spend status. */
  spent: boolean | null;
  source: BtcExplorerSource | null;
  checkedAt: string;
  error: string | null;
}

async function probeOutspend(apiBase: string, txid: string, vout: number): Promise<boolean | null> {
  const res = await fetch(`${apiBase}/tx/${txid}/outspend/${vout}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const json: any = await res.json();
  return typeof json?.spent === 'boolean' ? json.spent : null;
}

/**
 * Whether a specific transaction output has been spent, bounded-fallback.
 * A plain Esplora capability (no Rune awareness needed) — used to determine
 * whether a Rune balance allocated to that output at etch time is still
 * live there, without needing a Rune-aware indexer for the common case
 * where the output has never moved.
 */
export async function fetchBtcOutspendWithFallback(txid: string, vout: number): Promise<BtcOutspendResult> {
  const checkedAt = new Date().toISOString();
  const primaryBase = btcCanonicalApiBase();
  const fallbackBase = mempoolApiBase();

  const [primary, fallback] = await Promise.all([
    probeOutspend(primaryBase, txid, vout).catch(() => null),
    probeOutspend(fallbackBase, txid, vout).catch(() => null),
  ]);

  if (primary !== null) return { spent: primary, source: 'blockstream', checkedAt, error: null };
  if (fallback !== null) return { spent: fallback, source: 'mempool', checkedAt, error: null };
  return {
    spent: null,
    source: null,
    checkedAt,
    error: 'Neither blockstream.info nor mempool.space could resolve the output-spend status',
  };
}
