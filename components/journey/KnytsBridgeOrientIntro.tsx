'use client';

/**
 * KnytsBridgeOrientIntro — the KNYTS Bridge's ORIENT surface (2026-08-12,
 * KNYTS↔CI parity pass). Thin amber-preset wrapper over the bridge-neutral
 * `BridgeOrientSurface` — the same two-column layout, same shared
 * `ConstitutionalFrontierOrientSurface` questionnaire (Help/Preserve/
 * Authority), CI composes identically. No fabricated second canonical
 * plate exists for KNYTS today (CLAUDE.md's No-Guessing rule), so this
 * mounts with no `carouselPlates` — a clean single-media pane (item 0
 * only: the admin-configured 'orient' video, or an honest "no orientation
 * media configured" notice when none is set — never an invented image).
 */

import { BridgeOrientSurface } from '@/components/journey/BridgeOrientSurface';

export function KnytsBridgeOrientIntro() {
  return <BridgeOrientSurface section="orient" />;
}

export default KnytsBridgeOrientIntro;
