'use client';

/**
 * MetaMeStudioTab — mounts ComposerStudio inside the metaMe cartridge shell.
 *
 * ComposerStudio renders with `position: fixed; inset: 0` to cover the full
 * viewport.  Setting `will-change: transform` on the parent creates a new
 * CSS containing block so `position: fixed` descendants are bounded to this
 * div instead of the viewport.  A negative margin-top clips the Studio's own
 * "metaMe Studio" h1 header (we display that info in the sub-header banner
 * via SubHeaderSlotContext instead).
 *
 * Do NOT modify ComposerStudio.tsx — all adaptations live here.
 */

import React, { useContext } from 'react';
import { createPortal } from 'react-dom';
import { Hexagon } from 'lucide-react';
import { ComposerStudio } from '@/components/composer/ComposerStudio';
import { SubHeaderSlotContext } from '../SubHeaderSlot';

// Height of the Studio's own header row in px.  Measured from:
//   <div class="min-h-screen px-5 py-4"> ... py-4=16px top
//   <div class="flex items-start gap-3"> text-xl font-bold ~28px line-height
//   + space-y-6 gap below = 24px → total ≈ 68px; use 76px for safety.
const STUDIO_HEADER_PX = 76;

export function MetaMeStudioTab() {
  const subHeaderSlotEl = useContext(SubHeaderSlotContext);

  // Portal content: banner text injected into the left sub-header slot.
  const bannerContent = (
    <div className="flex items-center gap-2 px-1">
      <Hexagon className="w-3 h-3 text-rose-400 flex-shrink-0" />
      <span className="text-[11px] text-slate-400 whitespace-nowrap">
        Build Experiences using guided templates, the Composer API and receipt pipeline.
      </span>
    </div>
  );

  return (
    <>
      {subHeaderSlotEl && createPortal(bannerContent, subHeaderSlotEl)}

      {/*
        `will-change: transform` establishes a new containing block for
        position:fixed descendants (CSS Containment spec §2.1).
        `overflow: hidden` clips anything that bleeds outside this box.
      */}
      <div
        className="relative w-full h-full overflow-hidden"
        style={{ willChange: 'transform' }}
      >
        {/* Slide the Studio up to hide its own header, compensate height */}
        <div
          style={{
            marginTop: -STUDIO_HEADER_PX,
            height: `calc(100% + ${STUDIO_HEADER_PX}px)`,
          }}
        >
          <ComposerStudio />
        </div>
      </div>
    </>
  );
}

export default MetaMeStudioTab;
