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
import { BridgeActivityCapsule } from '@/components/journey/BridgeActivityCapsule';

export function BridgeActivityGroupRail({ groups }: { groups: BridgeActivityGroup[] }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <BridgeActivityCarousel key={group.id} group={group} />
      ))}
    </div>
  );
}

/**
 * BridgeActivityCompanionColumn (2026-09-06, Bridge-capsule-shell
 * convergence pass) — the SAME `BridgeActivityGroup[]` data, rendered as a
 * full-width vertical stack instead of a horizontal scroll-snap rail. This
 * is the hybrid the shell convergence needs: `BridgeContentCapsule` owns the
 * spatial shell (viewport/strip/expandable right column); the actual
 * learning content embedded in that right column is still the SAME
 * `BridgeActivityDescriptor`/`BridgeActivityGroup` model + `BridgeActivityCapsule`
 * presentation already used by the horizontal rail — never a second,
 * re-authored content model. Each capsule keeps its own mounted state
 * exactly as the carousel does (no conditional unmount here either); only
 * the layout direction and capsule `variant` differ.
 */
export function BridgeActivityCompanionColumn({ groups }: { groups: BridgeActivityGroup[] }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        if (group.activities.length === 0) return null;
        return (
          <div key={group.id} className="space-y-1.5">
            {group.title && <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{group.title}</p>}
            <div className="space-y-2">
              {group.activities.map((activity) => (
                <BridgeActivityCapsule key={activity.id} activity={activity} variant="stacked" />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default BridgeActivityGroupRail;
