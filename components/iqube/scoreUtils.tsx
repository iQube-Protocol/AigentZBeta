"use client";
import React from "react";

export type ScoreKind = 'sensitivity' | 'risk' | 'accuracy' | 'verifiability' | 'reliability' | 'trust';

// iQube Protocol color logic
export function scoreColor(kind: ScoreKind, value: number) {
  const v = Math.max(0, Math.min(10, Number(value) || 0));
  if (kind === 'sensitivity' || kind === 'risk') {
    if (v <= 4) return 'text-green-400';
    if (v <= 7) return 'text-amber-400';
    return 'text-red-400';
  }
  // For accuracy, verifiability, reliability, and trust: higher is better
  if (v <= 3) return 'text-red-400';
  if (v <= 6) return 'text-amber-400';
  return 'text-green-400';
}

// Dots for card/modal (no numeric text; tooltip carries number)
export const Dots: React.FC<{ value: number; colorClass?: string; kind?: ScoreKind; title: string; size?: 'xs' | 'sm' }>
  = ({ value, colorClass, kind, title, size = 'sm' }) => {
  const v = Math.max(0, Math.min(10, Number(value) || 0));
  const filled = Math.round(v / 2);
  const dotClass = size === 'xs' ? 'text-[8px]' : 'text-[10px]';
  const gapClass = size === 'xs' ? 'gap-0.5' : 'gap-1';
  const color = colorClass || (kind ? scoreColor(kind, v) : 'text-slate-400');
  return (
    <div className={`flex items-center ${gapClass}`} title={`${title}: ${v.toFixed(1)}`}>
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

// Derived score calculations
export function calculateReliabilityScore(accuracyScore: number, verifiabilityScore: number): number {
  // Reliability = weighted average of accuracy and verifiability
  // Accuracy is more important (60%) than verifiability (40%)
  const accuracy = Math.max(0, Math.min(10, Number(accuracyScore) || 0));
  const verifiability = Math.max(0, Math.min(10, Number(verifiabilityScore) || 0));
  return Math.round((accuracy * 0.6 + verifiability * 0.4) * 10) / 10;
}

export function calculateTrustScore(sensitivityScore: number, riskScore: number): number {
  // Trust = inverse relationship with sensitivity and risk
  // Lower sensitivity and risk = higher trust
  const sensitivity = Math.max(0, Math.min(10, Number(sensitivityScore) || 0));
  const risk = Math.max(0, Math.min(10, Number(riskScore) || 0));
  // Convert to trust: 10 - weighted average of sensitivity (40%) and risk (60%)
  // Risk is more important for trust calculation
  const trustScore = 10 - (sensitivity * 0.4 + risk * 0.6);
  return Math.max(0, Math.round(trustScore * 10) / 10);
}
