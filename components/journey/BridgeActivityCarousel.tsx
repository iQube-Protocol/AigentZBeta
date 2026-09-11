'use client';

/**
 * BridgeActivityCarousel — horizontal scroll-snap rail of activity capsules
 * (CFS lesson-composition architecture, 2026-09-03).
 *
 * CRITICAL design choice vs. `BridgeMediaCarouselPane`: that media carousel
 * swaps content via conditional rendering (one active item mounted at a
 * time) — correct for heavy media (a single <video> at a time). This
 * carousel does the OPPOSITE: every activity capsule is mounted for the
 * FULL lifetime of the group, positioned side-by-side and moved purely with
 * native CSS scroll (`overflow-x-auto` + `scroll-snap-type`). Nothing here
 * ever unmounts an activity to "move" to another one, so a capsule's own
 * internal state (a slider value, a selected answer, a chosen goal) is
 * physically impossible to lose by scrolling away and back — no lifting,
 * no cache, no explicit preserve/restore code needed. This is what the
 * operator's "state must belong to the activity" invariant asks for.
 *
 * Prev/next buttons call `scrollBy` on the same native scroller (not a
 * re-render), so they compose for free with touch swipe, trackpad
 * scrolling, and keyboard (ArrowLeft/ArrowRight while the rail has focus,
 * standard scroll-container behavior). No dot/position indicator beyond a
 * subtle scrollbar — the operator asked for "visible position/progress
 * without excessive chrome," and a set of activities (unlike media, which
 * has a fixed known count) can vary in count and width, so dots would
 * either misrepresent partial-card scroll positions or need constant
 * recomputation; the browser's own native scrollbar already satisfies
 * "visible position" honestly.
 */

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { BridgeActivityGroup } from '@/services/journey/bridgeActivity';
import { BridgeActivityCapsule } from '@/components/journey/BridgeActivityCapsule';

export function BridgeActivityCarousel({ group }: { group: BridgeActivityGroup }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollByCard = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(360, el.clientWidth * 0.8), behavior: 'smooth' });
  };

  if (group.activities.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        {group.title && <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{group.title}</p>}
        {group.activities.length > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollByCard(-1)}
              aria-label={`Previous in ${group.title ?? 'this group'}`}
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-slate-900/60 p-1 text-slate-400 transition hover:border-white/20 hover:text-slate-200"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => scrollByCard(1)}
              aria-label={`Next in ${group.title ?? 'this group'}`}
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-slate-900/60 p-1 text-slate-400 transition hover:border-white/20 hover:text-slate-200"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      <div
        ref={scrollerRef}
        role="group"
        aria-roledescription="carousel"
        aria-label={group.title ?? 'Activities'}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); scrollByCard(1); }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); scrollByCard(-1); }
        }}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
      >
        {group.activities.map((activity) => (
          <BridgeActivityCapsule key={activity.id} activity={activity} />
        ))}
      </div>
    </div>
  );
}

export default BridgeActivityCarousel;
