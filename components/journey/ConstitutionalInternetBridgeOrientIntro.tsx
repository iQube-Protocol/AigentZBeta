'use client';

/**
 * ConstitutionalInternetBridgeOrientIntro — the CI Bridge's ORIENT surface.
 *
 * Extracted (2026-08-12, KNYTS↔CI parity pass) into a thin indigo-preset
 * wrapper over the bridge-neutral `BridgeOrientSurface` — the actual
 * two-column layout, media carousel, parchment-matte plate mounts, and the
 * shared `ConstitutionalFrontierOrientSurface` questionnaire now live
 * there, composed identically by KNYTS's own orient wrapper. This file's
 * visible output is unchanged: item 0 is the admin-configured video
 * (falling back to the real canonical CIP-007B "Bearing Instrument"
 * plate), item 1 is the real canonical CIP-004 plate ("Government-Grade,
 * Not Government-Dependent").
 */

import { canonicalPlateImage } from '@/services/artifact/canonicalPlateImages';
import { BridgeOrientSurface } from '@/components/journey/BridgeOrientSurface';

const BEARING_INSTRUMENT = canonicalPlateImage('CIP-007B');
const GOVERNMENT_GRADE_PLATE = canonicalPlateImage('CIP-004');

export function ConstitutionalInternetBridgeOrientIntro() {
  return (
    <BridgeOrientSurface
      section="ci-orient"
      fallbackPlate={BEARING_INSTRUMENT}
      carouselPlates={GOVERNMENT_GRADE_PLATE ? [GOVERNMENT_GRADE_PLATE] : []}
    />
  );
}

export default ConstitutionalInternetBridgeOrientIntro;
