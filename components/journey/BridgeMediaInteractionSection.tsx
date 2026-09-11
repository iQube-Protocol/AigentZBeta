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
 * squeezed column. Below `lg`, ordinary page scrolling is used (no bounded
 * height, no internal scroll region) — the operator's explicit instruction
 * that mobile/tablet-stacked layouts must never gain a second, nested tiny
 * scroll pane.
 *
 * Locked split viewport (2026-09-03, "production learning pattern" pass):
 * at `lg:` and above, this component now fills whatever height its OWN
 * parent gives it (`lg:h-full`) rather than letting the page be the
 * scroll surface. That parent height is real and definite because
 * `JourneyRunSurface` already establishes one for a stage's sole surface
 * (`flex min-h-0 flex-1 flex-col`, the 2026-09-03 "viewport-collapse fix" —
 * see that file's own header comment) — this component relies on that
 * existing contract rather than hardcoding a `vh` figure, so it adapts to
 * whatever chrome (header, stepper) actually occupies the rest of the
 * screen. The RIGHT column (`lg:overflow-y-auto lg:min-h-0`) is the one
 * scroll region; the media column never scrolls and never disappears.
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
    <div className={`grid gap-4 lg:h-full lg:grid-cols-[3fr_2fr] lg:items-stretch ${className ?? ''}`}>
      <div className="lg:h-full lg:min-h-0">
        <BridgeMediaCarouselPane items={items} emptyLabel={emptyLabel} heightClassName="h-[60vh] max-h-[70vh] min-h-[18rem] lg:h-full lg:max-h-none" />
      </div>

      <div className="flex flex-col gap-3 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1">
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
