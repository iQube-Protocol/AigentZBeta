'use client';

/**
 * BridgeMediaInteractionSection — generic "media beside a focused
 * interaction" composer (CFS media/interaction reuse pass, 2026-09-03).
 * Mirrors `BridgeOrientSurface`'s own two-column grid
 * (`grid gap-4 lg:grid-cols-[3fr_2fr]`) and reuses its extracted left-column
 * carousel (`BridgeMediaCarouselPane`) — the ONLY difference from
 * `BridgeOrientSurface` is that the right column renders caller-supplied
 * `children` (the "focused interaction") instead of the hardcoded
 * `ConstitutionalFrontierOrientSurface` questionnaire. This is what lets a
 * Financial Sovereignty section reuse the exact same rich-media composition
 * View/Orient already established, with its own interaction slotted in.
 *
 * At narrow widths the grid collapses to a single column (Tailwind's `lg:`
 * breakpoint is the same one BridgeOrientSurface and BridgeContentCapsule
 * already rely on) — media stacks above its interaction, never beside a
 * squeezed column.
 */

import type { ReactNode } from 'react';
import { BridgeMediaCarouselPane, type BridgeMediaCarouselItem } from '@/components/journey/BridgeMediaCarouselPane';

export interface BridgeMediaInteractionSectionProps {
  items: BridgeMediaCarouselItem[];
  emptyLabel?: string;
  eyebrow?: string;
  headline: string;
  /** Concise lead copy — ONE short paragraph, not a stacked block. */
  lead?: string;
  /** The focused interaction — a role picker, a rehearsal, a starting-point
   *  chip set, etc. Rendered exactly as supplied; this component owns no
   *  interaction logic of its own. */
  children: ReactNode;
  className?: string;
}

export function BridgeMediaInteractionSection({
  items,
  emptyLabel,
  eyebrow,
  headline,
  lead,
  children,
  className,
}: BridgeMediaInteractionSectionProps) {
  return (
    <div className={`grid gap-4 lg:grid-cols-[3fr_2fr] ${className ?? ''}`}>
      <BridgeMediaCarouselPane items={items} emptyLabel={emptyLabel} />

      <div className="flex flex-col gap-3">
        <div>
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{eyebrow}</p>
          )}
          <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">{headline}</h2>
          {lead && <p className="mt-2 text-[13px] leading-[1.5] text-slate-300">{lead}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

export default BridgeMediaInteractionSection;
