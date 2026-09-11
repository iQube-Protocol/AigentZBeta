import { NextResponse } from 'next/server';
import { isBitcoinTxid, btcTxUrl, fetchBtcConfirmationWithFallback } from '@/services/ops/btcExplorer';
import { resolveBitcentPremineBalance } from '@/services/ops/bitcentBalance';

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
 * Live balance (added after the 2026-08-02 verification closed R-12): no
 * reliably working Rune-aware testnet indexer has ever been found reachable
 * (the platform's bounded-fallback Bitcoin explorer's Rune-lookup endpoint
 * does not index Runes on testnet at all; the 2026-07-31 session's seven
 * other candidate hosts were all blocked by sandbox egress policy and were
 * never actually observed to work or fail for real). Rather than keep
 * waiting on a Rune-aware indexer, services/ops/bitcentBalance.ts
 * resolves the balance from PRIMARY chain data instead: it decodes the
 * etch transaction's own Runestone (same runelib decoder that verified the
 * etch in scripts/verify-bitcent-etch.js) to find the premine-holding
 * output, then checks — via the plain, already-working Esplora fallback in
 * btcExplorer.ts — whether that output has been spent. Unspent: the full
 * premine balance is reported, sourced and timestamped. Spent: reported
 * honestly as unresolved (a genuine indexer requirement to trace the
 * transfer), never as zero or a guess. This only runs once the ratified
 * issuance record's own verification says VALID_ETCH — see
 * bitcent-issuance-record.json's etchBroadcast.verification.
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

    // Live balance, from primary chain data (see module comment above).
    // Only attempted when the etch itself is ratified as VALID_ETCH — this
    // route does not re-derive cenotaph status.
    const alreadyVerifiedValidEtch = record.etchBroadcast?.verification?.verdict === 'VALID_ETCH';
    const balanceResult = isBitcoinTxid(txHash)
      ? await resolveBitcentPremineBalance({ txid: txHash, alreadyVerifiedValidEtch })
      : null;

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
      // Live balance — resolved from primary chain data, never fabricated.
      // balanceResolved === false always carries balanceUnresolvedReason.
      balanceResolved: balanceResult?.resolved ?? false,
      balance: balanceResult?.amount ?? null,
      balanceSource: balanceResult?.source ?? null,
      balanceCheckedAt: balanceResult?.checkedAt ?? null,
      balanceOutputIndex: balanceResult?.outputIndex ?? null,
      balanceUnresolvedReason: balanceResult?.reason ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to load Bitcent status' },
      { status: 500 },
    );
  }
}
