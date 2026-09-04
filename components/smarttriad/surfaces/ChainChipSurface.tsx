/**
 * ChainChipSurface — the shared chain badge every market atomic surface
 * uses (harvested from MoneyPenny002's `src/components/ChainChip.tsx`).
 * Not itself a rich-block kind — a plain internal UI primitive shared by
 * QuotesSurface/FillsSurface, never forked per-surface.
 */

const CHAIN_LABEL: Record<string, string> = {
  ethereum: 'ETH',
  eth: 'ETH',
  arbitrum: 'ARB',
  arb: 'ARB',
  base: 'BASE',
  polygon: 'POLY',
  poly: 'POLY',
  optimism: 'OP',
  op: 'OP',
  solana: 'SOL',
  sol: 'SOL',
  bitcoin: 'BTC',
  btc: 'BTC',
};

export function ChainChipSurface({ chain }: { chain: string }) {
  const label = CHAIN_LABEL[chain.toLowerCase()] ?? chain.toUpperCase();
  return (
    <span className="inline-flex items-center rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
      {label}
    </span>
  );
}
