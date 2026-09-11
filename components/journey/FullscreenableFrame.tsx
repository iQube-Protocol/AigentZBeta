'use client';

/**
 * FullscreenableFrame — the conventional in-viewport fullscreen control
 * (targeted correction pass, 2026-08-11), extracted so any CI Bridge stage
 * presenting a single contextual artifact (not BridgeContentCapsule's
 * viewport+rail composition) can offer the SAME icon-button-inside-the-
 * viewport fullscreen affordance View already established there —
 * without duplicating the portal/overlay logic per call site.
 *
 * Mirrors BridgeContentCapsule.tsx's own fullscreen chrome exactly: an
 * absolute-positioned Maximize2/Minimize2 icon button, top-right, same
 * position/treatment entering or exiting; a `createPortal` overlay when
 * fullscreen. BridgeContentCapsule itself is left untouched (its fullscreen
 * logic is entangled with its own viewport+rail grid) — this is the
 * reusable version for a single-artifact viewport like Choose's contextual
 * left panel.
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2 } from 'lucide-react';
import { overlayZClass } from '@/components/ui/overlayLayers';

export function FullscreenableFrame({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const body = (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 ${fullscreen ? '' : className ?? ''}`}
    >
      {children}
      <button
        type="button"
        onClick={() => setFullscreen((v) => !v)}
        aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        title={title ? `${fullscreen ? 'Exit fullscreen' : 'Fullscreen'} — ${title}` : fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        className="absolute right-2 top-2 z-10 inline-flex items-center justify-center rounded-md bg-black/50 p-1.5 text-white/80 backdrop-blur-sm transition hover:bg-black/70 hover:text-white"
      >
        {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      </button>
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

export default FullscreenableFrame;
