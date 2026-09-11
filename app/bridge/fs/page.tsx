'use client';

/**
 * /bridge/fs — thin public adapter for the metaMe × Horizen Constitutional
 * Admission Journey (2026-08-12, KNYTS↔CI parity pass, FS Bridge section).
 * See components/journey/FinancialServicesBridgeFrontDoor.tsx for the ONE
 * real implementation this route and /bridge/financial-services both mount —
 * this file contributes no logic of its own.
 */

import { FinancialServicesBridgeFrontDoor } from '@/components/journey/FinancialServicesBridgeFrontDoor';

export default function FinancialServicesBridgeShortPage() {
  return <FinancialServicesBridgeFrontDoor />;
}
