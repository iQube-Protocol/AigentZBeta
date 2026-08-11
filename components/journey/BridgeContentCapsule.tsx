'use client';

/**
 * BridgeContentCapsule — the shared, reusable content-capsule shell for
 * Threshold Guide surfaces (CI Bridge VIEW / ORIENT / PERSONIFY, 2026-08-11).
 *
 * HARD BOUNDARY (operator-mandated, non-negotiable): this component owns
 * ONLY spatial/presentation state — which rail card is active, which
 * viewport renderer is shown, local fullscreen/hero state. It MUST NEVER
 * independently determine journey stage completion, Passport state,
 * constitutional authority, delegation, Standing, or durable completion —
 * those remain owned exclusively by the journey observer/canonical
 * services. Selecting a rail card changes what is DISPLAYED, never what is
 * TRUE. Enforced by tests/bridge-content-capsule.test.ts, which fails the
 * build if this file imports fetch/personaFetch or any journey/receipt
 * service.
 *
 * Layout (corrected 2026-08-11 to a TRUE two-column composition, per the
 * operator's column-geometry brief): one parent grid,
 * `grid-template-columns: minmax(0,3fr) minmax(200px,1fr)`. The LEFT column
 * nests the viewport and the strip STACKED — so the strip's width is the
 * viewport's width, and it can never bleed under the rail (the bug the
 * brief was filed against: the strip used to be a second full-width row
 * spanning under both viewport AND rail).
 *
 * Geometry is CONTENT-DRIVEN, not a fixed-height box fought with overflow
 * scroll (corrected again same day — a caller wrapping this in a fixed
 * `h-[30rem]` let the aspect-locked viewport consume nearly all of it,
 * squeezing the strip out). This component itself never sets its own
 * height — it sizes to whatever the left column's content needs. The RIGHT
 * column has no independent height of its own either: it is a plain grid
 * item, so it STRETCHES to match the row's height (CSS Grid's default
 * `align-items: stretch`, which resolves to the left column's natural
 * content height) — that stretched, now-definite height is what its own
 * `h-full` resolves against, letting the rail cards flex-distribute it.
 * This is pure CSS; no ResizeObserver or measured height is needed, and
 * callers must NOT wrap this component in a fixed-height box.
 *
 * The viewport's own height is driven by `viewportAspectRatio` — a
 * per-active-card ratio (width/height) the CALLER supplies, since only the
 * caller knows what's really being shown (a 16:9 video vs. a plate/cover
 * with its own native ratio). Returning `undefined` for a card leaves the
 * viewport unconstrained (sized by its content — Orient's questions,
 * Personify's tool picker). This is deliberately NOT a fixed 'video' | fill'
 * mode: forcing every artifact into one shape was the second defect this
 * fix closes — a portrait cover or a 4:3 plate must never be squeezed into
 * a 16:9 box.
 *
 * Selected-rail-card treatment (editorial polish pass, 2026-08-11): a
 * restrained amber/gold edge, not a bright indigo dashboard glow — the
 * constitutional accent already established by Orient's own option
 * buttons, now shared by the rail across every hydration. Border opacity
 * generally lowered (white/[0.07] instead of solid slate-800) so the
 * artifact/content dominates over nested chrome.
 *
 * Rail cards fill the rail's height with WEIGHTED flex-grow by aspect
 * (portrait ~1.6x, landscape/compact ~1x) rather than equal shares, so a
 * portrait card (e.g. a paper cover) naturally claims more vertical room
 * than a landscape one. Every real hydration today (View's Video/Plate/
 * Paper, Orient's 3 questions, Personify's 2 supporting tools) has at most
 * a handful of rail cards, so the rail is a static column, not a
 * scrolling/paging list — a carousel primitive would be premature
 * abstraction for a list this short. Moving between multiple CAPSULES
 * (e.g. View's vignettes) is the parent's concern: wrap sibling
 * <BridgeContentCapsule key={...} /> instances in the real swipeable
 * components/ui/carousel.tsx primitive, not a feature of this shell.
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2 } from 'lucide-react';
import { overlayZClass } from '@/components/ui/overlayLayers';

export type BridgeCapsuleRailAspect = 'landscape' | 'portrait' | 'compact';

export interface BridgeCapsuleRailCard {
  id: string;
  label: string;
  aspect?: BridgeCapsuleRailAspect;
  renderThumb?: () => React.ReactNode;
}

export interface BridgeContentCapsuleProps {
  railCards: BridgeCapsuleRailCard[];
  /** Uncontrolled by default (internal state). Pass both to control it. */
  activeRailId?: string;
  onRailChange?: (id: string) => void;
  renderViewport: (activeRailId: string, opts: { fullscreen: boolean }) => React.ReactNode;
  renderStrip?: (activeRailId: string) => React.ReactNode;
  allowFullscreen?: boolean;
  className?: string;
  /**
   * Per-active-card viewport ratio (width / height), e.g. `16 / 9` for a
   * video card or `plateImage.width / plateImage.height` for a plate card.
   * Return `undefined` for a card to leave the viewport unconstrained
   * (sized by its own content — the right default for Orient's questions
   * and Personify's tool picker, which are not media at all).
   */
  viewportAspectRatio?: (activeRailId: string) => number | undefined;
}

/** Vertical-share weight per aspect — a portrait card (e.g. a paper cover)
 *  naturally claims more of the rail's height than a landscape one. */
const RAIL_ASPECT_WEIGHT: Record<BridgeCapsuleRailAspect, number> = {
  landscape: 1,
  portrait: 1.6,
  compact: 0.9,
};

export function BridgeContentCapsule({
  railCards,
  activeRailId: controlledActive,
  onRailChange,
  renderViewport,
  renderStrip,
  allowFullscreen = true,
  className,
  viewportAspectRatio,
}: BridgeContentCapsuleProps) {
  const [internalActive, setInternalActive] = useState<string>(railCards[0]?.id ?? '');
  const [fullscreen, setFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const active = controlledActive ?? internalActive;
  const activeCard = railCards.find((c) => c.id === active) ?? railCards[0];

  const setActive = (id: string) => {
    if (onRailChange) onRailChange(id);
    else setInternalActive(id);
  };

  if (!activeCard) return null;

  const ratio = viewportAspectRatio?.(activeCard.id);

  const body = (
    <div
      className={`grid gap-3 ${fullscreen ? 'h-full' : ''} ${className ?? ''}`}
      style={{
        gridTemplateColumns: railCards.length > 1 ? 'minmax(0, 3fr) minmax(200px, 1fr)' : 'minmax(0, 1fr)',
        gridTemplateRows: '1fr',
      }}
    >
      {/* LEFT COLUMN — viewport + strip stacked, sized to content. The
          strip's width is this column's width; it can never bleed under
          the rail, and this component never imposes its own height. */}
      <div className="flex flex-col gap-3">
        <div
          className="w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/40"
          style={
            ratio
              ? {
                  aspectRatio: String(ratio),
                  // A near-square/portrait asset at full left-column WIDTH can compute a
                  // height taller than the whole page (e.g. a 4:3 plate at 1300px wide is
                  // ~1000px tall) — pushing the strip below the fold, the exact defect
                  // this cap exists to prevent. Capped, not removed: the box's rendered
                  // shape may then sit a little short of `ratio`, but the actual media
                  // inside (rendered with object-contain by the caller) still never
                  // distorts — it just mattes with more side padding. No cap in
                  // fullscreen, where filling the screen is the point.
                  maxHeight: fullscreen ? undefined : 'min(28rem, 55vh)',
                }
              : undefined
          }
        >
          {renderViewport(activeCard.id, { fullscreen })}
        </div>
        {renderStrip && (
          <div className="rounded-xl border border-white/[0.07] bg-slate-900/40 p-3.5">{renderStrip(activeCard.id)}</div>
        )}
        {allowFullscreen && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setFullscreen((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
            >
              {fullscreen ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" /> Exit fullscreen
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5" /> Fullscreen
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN — the rail. No height of its own: it's a plain grid
          item, so it stretches (CSS Grid default `align-items: stretch`)
          to match the row's height, which is the left column's natural
          content height. That stretched height is what h-full resolves
          against below, letting the cards flex-distribute it. */}
      {railCards.length > 1 && (
        <div className="flex h-full min-h-0 flex-col gap-2">
          {railCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setActive(card.id)}
              aria-pressed={card.id === activeCard.id}
              style={{ flexGrow: RAIL_ASPECT_WEIGHT[card.aspect ?? 'landscape'], flexBasis: 0 }}
              className={`min-h-0 overflow-hidden rounded-lg border text-left transition ${
                card.id === activeCard.id
                  ? 'border-amber-400/50 ring-1 ring-amber-400/25'
                  : 'border-white/[0.07] hover:border-white/20'
              }`}
            >
              {card.renderThumb ? (
                card.renderThumb()
              ) : (
                <div className="flex h-full items-center justify-center bg-slate-950/60 px-2 text-center text-[11px] text-slate-300">
                  {card.label}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (fullscreen && mounted) {
    return createPortal(
      <div className={`fixed inset-0 bg-slate-950 p-4 ${overlayZClass('CARTRIDGE_FULLSCREEN')}`}>{body}</div>,
      document.body,
    );
  }

  return body;
}

export default BridgeContentCapsule;
