"use client";
import React from "react";

export type ScoreKind = 'sensitivity' | 'risk' | 'accuracy' | 'verifiability';

// iQube Protocol color logic
export function scoreColor(kind: ScoreKind, value: number) {
  const v = Math.max(0, Math.min(10, Number(value) || 0));
  if (kind === 'sensitivity' || kind === 'risk') {
    if (v <= 4) return 'text-green-400';
    if (v <= 7) return 'text-amber-400';
    return 'text-red-400';
  }
  if (v <= 3) return 'text-red-400';
  if (v <= 6) return 'text-amber-400';
  return 'text-green-400';
}

// Dots for card/modal (no numeric text; tooltip carries number)
export const Dots: React.FC<{ value: number; colorClass?: string; kind?: ScoreKind; title: string; size?: 'xs' | 'sm' }>
  = ({ value, colorClass, kind, title, size = 'sm' }) => {
  const v = Math.max(0, Math.min(10, Number(value) || 0));
  const filled = Math.round(v / 2);
  const dotClass = size === 'xs' ? 'text-[9px]' : 'text-[10px]';
  const color = colorClass || (kind ? scoreColor(kind, v) : 'text-slate-400');
  return (
    <div className="flex items-center gap-1" title={`${title}: ${v.toFixed(1)}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`${dotClass} ${i < filled ? color : 'text-slate-600'}`}>●</span>
      ))}
    </div>
  );
};

// Compact dots for list/table cells
export const DotsInline: React.FC<{ value: number; kind: ScoreKind; title: string }>
  = ({ value, kind, title }) => {
  const v = Math.max(0, Math.min(10, Number(value) || 0));
  const filled = Math.round(v / 2);
  const color = scoreColor(kind, v);
  return (
    <div className="flex items-center justify-center" title={`${title}: ${v.toFixed(1)}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`text-[10px] ${i < filled ? color : 'text-slate-600'}`}>●</span>
      ))}
    </div>
  );
};
