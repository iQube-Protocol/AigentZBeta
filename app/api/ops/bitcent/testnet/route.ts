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
 *
 * 2026-07-31 mainnet-readiness follow-up session: re-attempted this search
 * with real network calls (not documentation-only) against seven distinct
 * candidate Runes-aware indexer hosts — the documented testnet Rune-lookup
 * host named in check-bitcent-name-availability.js (both its documented path
 * and its bare host), the Esplora testnet host this repo's canonical Bitcoin
 * helper already uses, Hiro's Runes API host, two UniSat open-API hosts
 * (mainnet-path and testnet-path), the ordinals.com Rune page, and Best in
 * Slot's API host (which documents mainnet+testnet+signet Runes coverage —
 * see codexes/packs/agentiq/updates/ for this session's Bitcent update doc
 * with the full host list). Every one of the seven failed identically at the
 * sandbox's egress proxy with a CONNECT-tunnel 403 (organisation policy
 * denial, per the proxy's own README — indistinguishable from "this indexer
 * doesn't work" from inside this sandbox, but NOT the same claim). No
 * provider's actual JSON response for Bitcent's Rune (name `BITCENT`, etch
 * tx `551bbaaa50b5ed91c585aee90af1e8f41932da80a93525fd1eebe234a68deb65`) was
 * ever observed this session, so per CLAUDE.md's "No Guessing" rule none of
 * them was wired in — that would be integrating an unverified assumption
 * about a real financial data source. The next session with real network
 * egress (the operator's own machine, as with every other live Bitcent step)
 * should re-run these exact calls before concluding any of them "works" or
 * "doesn't work" — this comment is a record of what was tried, not a verdict
 * on the providers themselves.
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
