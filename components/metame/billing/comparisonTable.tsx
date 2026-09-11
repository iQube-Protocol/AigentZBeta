'use client';

/**
 * Shared 3-column tier-comparison primitives, used by both the citizen ladder
 * modal (Free / Sovereignty / Stewardship) and the Founder Office modal
 * (Operator / Operator+ / Portfolio Operator). Keeping these in one place means
 * the two modals stay visually identical — same dot/check/value semantics.
 */

import { Check, Minus } from 'lucide-react';

export type CellContent = React.ReactNode | boolean | null;

export function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function CellValue({ v }: { v: CellContent }) {
  if (v === true) return <Check className="mx-auto h-4 w-4 text-emerald-400" />;
  if (v === false || v === null || v === undefined) return <Minus className="mx-auto h-3 w-3 text-slate-600" />;
  if (typeof v === 'string') return <span className="text-xs text-slate-300">{v}</span>;
  return <>{v}</>;
}

export function FeatureRow({
  label, a, b, c,
}: {
  label: string;
  a: CellContent;
  b: CellContent;
  c: CellContent;
}) {
  return (
    <tr className="border-t border-white/5">
      <td className="py-2 pr-3 align-top text-xs text-slate-400">{label}</td>
      <td className="py-2 text-center align-top"><CellValue v={a} /></td>
      <td className="py-2 text-center align-top"><CellValue v={b} /></td>
      <td className="py-2 text-center align-top"><CellValue v={c} /></td>
    </tr>
  );
}

export function GroupHeader({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={4} className="pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </td>
    </tr>
  );
}

/** Multi-provider model cell — primary model + comparable cross-provider class. */
export function ModelCell({ primary, alts }: { primary: string; alts: string[] }) {
  return (
    <div className="flex flex-col items-center gap-0.5 leading-tight">
      <span className="text-xs text-slate-200">{primary}</span>
      {alts.map((a) => (
        <span key={a} className="text-[10px] text-slate-500">{a}</span>
      ))}
    </div>
  );
}

export function TierCard({
  label, price, isFree, selected, onSelect,
}: {
  label: string;
  price: string;
  isFree?: boolean;
  selected: boolean;
  onSelect?: () => void;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors ${
        selected ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 bg-white/[0.02]'
      }`}
    >
      <div className="text-xs font-semibold text-slate-300">{label}</div>
      <div className="text-lg font-bold">{price}</div>
      {isFree ? (
        <div className="text-[11px] text-emerald-400">Always free</div>
      ) : (
        <button
          onClick={onSelect}
          className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
            selected
              ? 'bg-purple-600 text-white hover:bg-purple-500'
              : 'border border-white/20 text-slate-200 hover:bg-white/10'
          }`}
        >
          {selected ? 'Selected ✓' : 'Select'}
        </button>
      )}
    </div>
  );
}
