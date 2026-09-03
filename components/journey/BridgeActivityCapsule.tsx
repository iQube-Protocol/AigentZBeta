'use client';

/**
 * BridgeActivityCapsule — the "Bridge capsule presentation" layer for a
 * single BridgeActivityDescriptor. Purely visual framing (title,
 * description, completion affordance, responsive sizing) around whatever
 * activity component the caller supplies as `content` — this shell owns NO
 * domain logic, so the same capsule works for a quiz, a simulation, a goal
 * picker or a capability card without modification.
 *
 * Sizing is responsive min/max width + a scroll-snap start point, not a
 * fraction of the current column — the operator's own requirement ("avoid
 * cards that depend on the exact current column width... use responsive
 * min/max widths and snap points") so the same capsule reads correctly
 * whether hosted in this Bridge's narrow rail, a wider MoneyPenny panel, or
 * a modal.
 */

import type { ReactNode } from 'react';
import type { BridgeActivityDescriptor } from '@/services/journey/bridgeActivity';

export function BridgeActivityCapsule({ activity }: { activity: BridgeActivityDescriptor }) {
  return (
    <div
      data-activity-id={activity.id}
      className="w-[min(88vw,22rem)] shrink-0 snap-start rounded-xl border border-white/10 bg-white/[0.02] p-3.5"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-100">{activity.title}</p>
          {activity.description && <p className="mt-0.5 text-xs text-slate-400">{activity.description}</p>}
        </div>
        {activity.completion === 'complete' && (
          <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            ✓
          </span>
        )}
      </div>
      <div className="text-sm text-slate-300">{activity.content}</div>
    </div>
  );
}

/** Non-capsule variant — same width/snap contract, plain wrapper, no title
 *  chrome. Used when an activity's own content already carries its heading
 *  (e.g. a knowledge-check group whose chip is itself the title). */
export function BridgeActivityBareCapsule({ children }: { children: ReactNode }) {
  return <div className="w-[min(88vw,22rem)] shrink-0 snap-start">{children}</div>;
}

export default BridgeActivityCapsule;
