/**
 * SmartTriadSourceBadge — the ONE mode/provenance badge every SmartTriad
 * runtime/market atomic surface renders (2026-09-04 "atomic, capsule-
 * composable surfaces" ruling). Distinguishes, at minimum, SIMULATION /
 * PAPER / LIVE / STALE / DISCONNECTED — never lets a surface imply "live"
 * merely because a value exists.
 */

import type { SmartTriadMarketGaugeBasePayload } from '@/types/smarttriad/richBlocks';

const MODE_LABEL: Record<SmartTriadMarketGaugeBasePayload['mode'], string> = {
  simulation: 'SIMULATION',
  paper: 'PAPER',
  live: 'LIVE',
};

const MODE_CLASS: Record<SmartTriadMarketGaugeBasePayload['mode'], string> = {
  simulation: 'border-amber-800/60 bg-amber-500/10 text-amber-300',
  paper: 'border-sky-800/60 bg-sky-500/10 text-sky-300',
  live: 'border-emerald-800/60 bg-emerald-500/10 text-emerald-300',
};

function isStale(observedAt: string | undefined, staleAfterMs: number): boolean {
  if (!observedAt) return false;
  const observed = Date.parse(observedAt);
  if (Number.isNaN(observed)) return false;
  return Date.now() - observed > staleAfterMs;
}

export function SmartTriadSourceBadge({
  mode,
  source,
  staleAfterMs = 60_000,
}: {
  mode: SmartTriadMarketGaugeBasePayload['mode'];
  source: SmartTriadMarketGaugeBasePayload['source'];
  staleAfterMs?: number;
}) {
  const stale = mode !== 'simulation' && isStale(source.observedAt, staleAfterMs);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        stale ? 'border-orange-800/60 bg-orange-500/10 text-orange-300' : MODE_CLASS[mode]
      }`}
      title={source.label}
    >
      {stale ? 'STALE' : MODE_LABEL[mode]}
    </span>
  );
}
