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
 * Layout: a fixed-height shell — main viewport (left) + a small selectable
 * rail of media/option cards (right) + an optional lower context strip —
 * with no page-level vertical scroll. Every real hydration today (View's
 * Video/Plate/Paper, Orient's 3 questions, Personify's 2 supporting tools)
 * has at most a handful of rail cards, so the rail is a static column here,
 * not a scrolling/paging list — a carousel primitive would be premature
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
}

const RAIL_ASPECT_CLASS: Record<BridgeCapsuleRailAspect, string> = {
  landscape: 'aspect-[16/9]',
  portrait: 'aspect-[3/4]',
  compact: 'aspect-square',
};

export function BridgeContentCapsule({
  railCards,
  activeRailId: controlledActive,
  onRailChange,
  renderViewport,
  renderStrip,
  allowFullscreen = true,
  className,
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

  const body = (
    <div className={`flex h-full min-h-0 flex-col gap-3 ${className ?? ''}`}>
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
          {renderViewport(activeCard.id, { fullscreen })}
        </div>
        {railCards.length > 1 && (
          <div className="flex w-24 shrink-0 flex-col gap-2 sm:w-28">
            {railCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => setActive(card.id)}
                aria-pressed={card.id === activeCard.id}
                className={`shrink-0 overflow-hidden rounded-lg border text-left transition ${RAIL_ASPECT_CLASS[card.aspect ?? 'landscape']} ${
                  card.id === activeCard.id
                    ? 'border-indigo-400/60 ring-1 ring-indigo-400/40'
                    : 'border-slate-800 hover:border-slate-600'
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
      {renderStrip && (
        <div className="shrink-0 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          {renderStrip(activeCard.id)}
        </div>
      )}
      {allowFullscreen && (
        <div className="flex shrink-0 justify-end">
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
