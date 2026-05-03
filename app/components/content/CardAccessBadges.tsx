'use client';

/**
 * Visual badges paired with the cardAccess resolver. Imported by every
 * surface so the visual language for owned / accessible / restricted is
 * consistent across KnytTab, Qriptopian, metaMe experience qubes, etc.
 */

import { Check, Lock, ShieldCheck, ShoppingCart } from 'lucide-react';

export function OwnedBadge({ size = 'sm' }: { size?: 'xs' | 'sm' | 'md' }) {
  const dims = size === 'xs' ? 'h-4 px-1.5 text-[9px]' : size === 'md' ? 'h-6 px-2 text-xs' : 'h-5 px-1.5 text-[10px]';
  const icon = size === 'xs' ? 'h-2.5 w-2.5' : size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 ${dims}`}>
      <Check className={icon} />
      Owned
    </span>
  );
}

export function AccessibleBadge({ size = 'sm', label = 'Accessible' }: { size?: 'xs' | 'sm' | 'md'; label?: string }) {
  const dims = size === 'xs' ? 'h-4 px-1.5 text-[9px]' : size === 'md' ? 'h-6 px-2 text-xs' : 'h-5 px-1.5 text-[10px]';
  const icon = size === 'xs' ? 'h-2.5 w-2.5' : size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-500/15 text-cyan-300 ${dims}`}>
      <ShieldCheck className={icon} />
      {label}
    </span>
  );
}

export function RestrictedBadge({ reason, size = 'sm' }: { reason: string; size?: 'xs' | 'sm' | 'md' }) {
  const dims = size === 'xs' ? 'h-4 px-1.5 text-[9px]' : size === 'md' ? 'h-6 px-2 text-xs' : 'h-5 px-1.5 text-[10px]';
  const icon = size === 'xs' ? 'h-2.5 w-2.5' : size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 text-amber-300 ${dims}`}
      title={reason}
    >
      <Lock className={icon} />
      {reason}
    </span>
  );
}

export function CartButton({
  size = 'md',
  onClick,
  cta = 'Buy',
}: {
  size?: 'sm' | 'md' | 'lg';
  onClick: (e: React.MouseEvent) => void;
  cta?: string;
}) {
  const dims = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  const icon = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex ${dims} items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/15 text-amber-300 transition-colors hover:bg-amber-500/25 hover:text-amber-200`}
      title={cta}
      aria-label={cta}
    >
      <ShoppingCart className={icon} />
    </button>
  );
}
