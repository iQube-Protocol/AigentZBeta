'use client';

/**
 * ArtifactMattedFrame — the shared warm cream/parchment museum-matte mount
 * used everywhere a CI Bridge stage presents a canonical artifact (a plate,
 * a Polity Paper cover, or any other mounted image).
 *
 * Extracted 2026-08-11 (targeted correction pass) from
 * ConstitutionalInternetBridgeViewSequence.tsx's local `MattedFrame` — the
 * operator asked for the SAME treatment on Passport's Bearing Instrument
 * mount and Choose's contextual visuals, and CLAUDE.md's "extend, don't
 * duplicate" rule means the mat colors/shadow get ONE authoritative home
 * rather than three copy-pasted definitions that could drift.
 *
 * Colors are sampled from the actual canonical assets — the seven CIP
 * plates' own backgrounds average ~#f4e6d2, the Polity Papers covers
 * ~#eee8df — so the mat HARMONIZES with the artwork instead of reading as a
 * cold near-white viewport next to warm parchment plates. Never stretches/
 * crops the asset; any leftover space is the matte, not a distortion of the
 * artifact — callers are expected to render their image/video with
 * `object-contain`.
 */

import type { ReactNode } from 'react';

export function ArtifactMattedFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#e8d9bd] p-3">
      <div className="flex h-full w-full items-center justify-center rounded-[2px] bg-[#f6ecd9] p-3 shadow-[inset_0_0_0_1px_rgba(30,58,95,0.09),inset_0_1px_10px_rgba(0,0,0,0.06)]">
        {children}
      </div>
    </div>
  );
}

export default ArtifactMattedFrame;
