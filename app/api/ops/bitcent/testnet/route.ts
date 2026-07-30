import { NextResponse } from 'next/server';
import { btcApiBase, isBitcoinTxid, btcTxUrl } from '@/services/ops/btcExplorer';

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
 * helper — see services/ops/btcExplorer.ts for which provider it uses and
 * why, and tests/btc-explorer.test.ts for the canary that keeps every
 * Bitcoin explorer reference flowing through that one helper.
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
    let confirmations: number | undefined;
    let blockHeight: number | undefined;
    let status: 'confirmed' | 'pending' | 'unknown' = 'unknown';

    if (isBitcoinTxid(txHash)) {
      try {
        const base = btcApiBase();
        const txRes = await fetch(`${base}/tx/${txHash}`, { cache: 'no-store' });
        if (txRes.ok) {
          const txJson: any = await txRes.json();
          const confirmed = !!txJson?.status?.confirmed;
          blockHeight = typeof txJson?.status?.block_height === 'number' ? txJson.status.block_height : undefined;
          if (confirmed && typeof blockHeight === 'number') {
            const tipRes = await fetch(`${base}/blocks/tip/height`, { cache: 'no-store' });
            if (tipRes.ok) {
              const tipHeight = Number(await tipRes.text());
              if (Number.isFinite(tipHeight)) confirmations = Math.max(0, tipHeight - blockHeight + 1);
            }
          }
          status = confirmed ? 'confirmed' : 'pending';
        }
      } catch {
        // Explorer unreachable -- status stays 'unknown', never fabricated.
      }
    }

    return NextResponse.json({
      ok: true,
      at: new Date().toISOString(),
      network: deployment.network,
      txHash,
      explorer: isBitcoinTxid(txHash) ? btcTxUrl(txHash) : null,
      status,
      confirmations: confirmations ?? null,
      blockHeight: blockHeight ?? null,
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
