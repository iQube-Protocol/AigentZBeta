import { NextResponse } from 'next/server';
import { isBitcoinTxid, btcTxUrl, fetchBtcConfirmationWithFallback } from '@/services/ops/btcExplorer';

/**
 * GET /api/ops/bitcent/testnet
 *
 * Ops-card status for the Bitcent (B¢) Rune, distinct from the existing
 * /api/ops/btc/status route (which reports the Proof-of-State DVN anchor,
 * not Bitcent). Tokenomics are read from scripts/bitcent-issuance-record.json
 * (the single ratified source of truth); the deployment-specific facts (tx
 * hash, deployer) come from deployments/bitcent-testnet.json, mirroring the
 * deployments/qct-*-addresses.json precedent used for other chains. The
 * confirmation/block-height read is live, via the canonical btcExplorer
 * helper's bounded-fallback path (fetchBtcConfirmationWithFallback) — the
 * configured primary explorer, with a secondary consulted only when the
 * primary can't resolve the tx, divergence reported rather than merged, a
 * total failure surfaced as confirmationError rather than a silent "—".
 * See services/ops/btcExplorer.ts for which providers those are and why,
 * and tests/btc-explorer.test.ts for the canary that keeps every Bitcoin
 * explorer reference flowing through that one helper (this file is
 * intentionally not in that canary's allowlist — never hardcode a provider
 * host here even in a comment).
 *
 * Deliberately does NOT attempt a live Rune-supply/balance read: no reliably
 * working Rune-aware testnet indexer was found this session (the assumed
 * Rune-lookup API path on one candidate indexer returned a generic route-
 * not-found, and the Esplora-style API the platform's own Bitcoin helper
 * uses is not Ordinals/Runes-aware at all). This route reports the ratified
 * tokenomics and the transaction's confirmation status honestly, and does
 * not fabricate a live on-chain balance.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');

    const record = JSON.parse(
      readFileSync(join(process.cwd(), 'scripts', 'bitcent-issuance-record.json'), 'utf8'),
    );
    const deployment = JSON.parse(
      readFileSync(join(process.cwd(), 'deployments', 'bitcent-testnet.json'), 'utf8'),
    );

    const txHash: string = deployment.txHash;
    let confirmations: number | null = null;
    let blockHeight: number | null = null;
    let status: 'confirmed' | 'pending' | 'unknown' = 'unknown';
    let source: 'blockstream' | 'mempool' | null = null;
    let checkedAt: string | null = null;
    let divergence: { blockstream: number | null; mempool: number | null } | null = null;
    let explorerError: string | null = null;

    if (isBitcoinTxid(txHash)) {
      // Bounded fallback (operator ruling 2026-07-31, following the Bitcent
      // ops-card incident): blockstream.info stays primary; mempool.space is
      // consulted only when needed. Divergence is reported, never merged
      // silently, and a total failure is surfaced as an explicit error —
      // never silently collapsed into an unexplained "—" on the card.
      const result = await fetchBtcConfirmationWithFallback(txHash);
      confirmations = result.confirmations;
      blockHeight = result.blockHeight;
      status = result.confirmed ? 'confirmed' : result.error ? 'unknown' : 'pending';
      source = result.source;
      checkedAt = result.checkedAt;
      divergence = result.divergence;
      explorerError = result.error;
    }

    return NextResponse.json({
      ok: true,
      at: new Date().toISOString(),
      network: deployment.network,
      txHash,
      explorer: isBitcoinTxid(txHash) ? btcTxUrl(txHash) : null,
      status,
      confirmations,
      blockHeight,
      confirmationSource: source,
      confirmationCheckedAt: checkedAt,
      confirmationDivergence: divergence,
      confirmationError: explorerError,
      runeName: record.runeName?.value ?? null,
      symbol: record.symbol?.value ?? null,
      maxSupply: record.maxSupply?.value ?? null,
      premine: record.premine?.value ?? null,
      initiallyActiveIssuance: record.mintTerms?.value?.initiallyActiveIssuance ?? null,
      governedReserve: record.mintTerms?.value?.governedReserve ?? null,
      premineCustodianAddress: record.premineCustodian?.value ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to load Bitcent status' },
      { status: 500 },
    );
  }
}
