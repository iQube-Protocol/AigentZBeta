'use client';

/**
 * BridgeActivityGroupRail — renders a stage's declared `BridgeActivityGroup[]`
 * as stacked `BridgeActivityCarousel`s: "vertical = progression through the
 * lesson, horizontal = alternatives/activities within that lesson moment"
 * (operator's own framing, 2026-09-03). This is the data-driven half of the
 * Learning Rail — a stage supplies groups as plain data; this component is
 * the only place that turns them into UI, so no stage hand-rolls its own
 * carousel markup.
 */

import type { BridgeActivityGroup } from '@/services/journey/bridgeActivity';
import { BridgeActivityCarousel } from '@/components/journey/BridgeActivityCarousel';

export function BridgeActivityGroupRail({ groups }: { groups: BridgeActivityGroup[] }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <BridgeActivityCarousel key={group.id} group={group} />
      ))}
    </div>
  );
}

export default BridgeActivityGroupRail;
