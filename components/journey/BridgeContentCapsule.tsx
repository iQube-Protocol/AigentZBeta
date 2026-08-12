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
 * a handful of rail cards, so in NON-fullscreen mode the rail stays a
 * static, content-driven column, not a scrolling/paging list. Fullscreen is
 * different (integration pass, 2026-08-11): the operator wants the rail to
 * support 4-5+ cards there, so in fullscreen ONLY the rail becomes its own
 * bounded, independently-scrolling region (`sticky` + `max-h` + `overflow-
 * y-auto`, per-card `minHeight` floor) — decoupled from the left column's
 * height so a tall left pane (which the outer fullscreen portal itself now
 * scrolls) never drags the rail's scroll position with it, and the rail's
 * own scroll never forces the main artifact pane to move. Moving between
 * multiple CAPSULES (e.g. View's vignettes) is still the parent's concern:
 * wrap sibling <BridgeContentCapsule key={...} /> instances in the real
 * swipeable components/ui/carousel.tsx primitive, not a feature of this
 * shell.
 *
 * Fullscreen control (relocated 2026-08-11, integration pass): the
 * Fullscreen/Exit-fullscreen toggle used to be a text link below the
 * viewport+rail grid, next to the excerpt strip — that read as page-level
 * chrome, not part of the artifact. It's now an icon-only button absolutely
 * positioned INSIDE the viewport's own top-right corner (conventional media
 * chrome, same position/treatment whether entering or exiting), which is
 * why the viewport container below gained `relative`.
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
      // `min-h-full` (not `h-full`) in fullscreen: the grid must be AT
      // LEAST the portal's height (so a short left column still fills the
      // screen), but must be free to grow TALLER when the left column's
      // natural content (e.g. a tall portrait viewport + strip) needs more
      // room than the screen — that's what lets the outer portal's own
      // `overflow-y-auto` engage instead of squeezing content. A hard
      // `h-full` would clip the grid to exactly the screen height with
      // nothing left to scroll.
      className={`grid gap-3 ${fullscreen ? 'min-h-full' : ''} ${className ?? ''}`}
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
          className="relative w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/40"
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
          {/* Fullscreen toggle — conventional media chrome, floating inside
              the viewport's own top-right corner. Same position/treatment
              entering or exiting; only the icon swaps. */}
          {allowFullscreen && (
            <button
              type="button"
              onClick={() => setFullscreen((v) => !v)}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              className="absolute right-2 top-2 z-10 inline-flex items-center justify-center rounded-md bg-black/50 p-1.5 text-white/80 backdrop-blur-sm transition hover:bg-black/70 hover:text-white"
            >
              {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
        {renderStrip && (
          <div className="rounded-xl border border-white/[0.07] bg-slate-900/40 p-3.5">{renderStrip(activeCard.id)}</div>
        )}
      </div>

      {/* RIGHT COLUMN — the rail.
          Non-fullscreen: no height of its own — a plain grid item that
          stretches (CSS Grid default `align-items: stretch`) to match the
          row's height (the left column's natural content height), same as
          before this pass.
          Fullscreen: DECOUPLED from the left column's height on purpose —
          `self-start` opts it out of the grid stretch, `max-h-[calc(100vh-2rem)]`
          bounds it to the (padded) screen height, and `overflow-y-auto`
          gives it its OWN scroll region. This is what makes the rail
          support 4-5+ cards without the main artifact pane (which can be
          much taller, e.g. a portrait cover at full height, and relies on
          the outer portal's own overflow-y-auto below) dragging the rail's
          scroll position with it, or vice versa. */}
      {railCards.length > 1 && (
        <div
          className={`flex min-h-0 flex-col gap-2 ${
            fullscreen ? 'self-start max-h-[calc(100vh-2rem)] overflow-y-auto' : 'h-full'
          }`}
        >
          {railCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setActive(card.id)}
              aria-pressed={card.id === activeCard.id}
              style={{
                flexGrow: RAIL_ASPECT_WEIGHT[card.aspect ?? 'landscape'],
                flexBasis: 0,
                // Floor so cards keep a legible thumbnail size instead of
                // flex-shrinking toward 0 before the rail's own scroll ever
                // engages. Non-fullscreen is unaffected (undefined — the
                // existing content-driven, no-scroll behavior).
                minHeight: fullscreen ? '5.5rem' : undefined,
              }}
              className={`min-h-0 shrink-0 overflow-hidden rounded-lg border text-left transition ${
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
      <div className={`fixed inset-0 overflow-y-auto bg-slate-950 p-4 ${overlayZClass('CARTRIDGE_FULLSCREEN')}`}>{body}</div>,
      document.body,
    );
  }

  return body;
}

export default BridgeContentCapsule;
