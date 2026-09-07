'use client';

/**
 * FsBridgeCapsuleSection — the shared shell wiring for every Financial
 * Sovereignty bridge stage (Discover/Learn/Explore/Prepare/Operate/Cross).
 * Extracted from FinancialSovereigntyIntroStage.tsx (2026-09-06) so
 * Operate/Prepare/Cross can reuse the SAME shell wiring rather than each
 * hand-rolling its own — see that file's own header for the full history
 * of this shell (Bridge-capsule-shell convergence, then the layout/accent
 * fixes) before changing anything here.
 *
 * Layout summary (see FinancialSovereigntyIntroStage.tsx's own prior
 * header comment for the full reasoning behind each point):
 *   - Left column: `BridgeMediaCarouselPane` as a true 16:9 hero
 *     (`viewportAspectRatio={() => 16/9}`), with its own prev/dots/next nav
 *     floating on the media's bottom edge (`dotsPosition="overlay"`,
 *     visible on rollover/keyboard-focus, no background pill), then the
 *     strip beneath it carrying the stage's compact eyebrow/headline/lead/
 *     contextual-line copy (View stage's own excerpt typography) plus a
 *     `ListenButton`.
 *   - `className="h-full"` + `rightColumnWeight="2fr"` give the shell a
 *     real bounded height (riding the "locked viewport" ancestor chain
 *     JourneyRunSurface already establishes) and a ~60/40 column split
 *     matching Orient's own `grid-cols-[3fr_2fr]` — wide enough for a
 *     future companion more complex than a plain activity list (e.g. an
 *     HFT trading console).
 *   - Right column: ONE atomic capsule (bordered container) with a small
 *     header ("Learning capsule") in the strip's own typography, then
 *     `companionExtra` (optional real functional content — a live profile
 *     card, an embed toggle — rendered ABOVE the activity groups, never
 *     decomposed into a capsule itself), then the stage's
 *     `BridgeActivityGroup[]` via `BridgeActivityCompanionColumn`, all
 *     inside ONE scrolling region, with `renderFooter` (default: a
 *     full-width Continue banner) pinned under a divider at the bottom.
 *
 * `renderFooter` lets a stage swap the default single Continue banner for
 * its own action row (e.g. Operate's "Open MoneyPenny" + "Continue", or
 * Cross's single "Cross to Financial Services" button) without forking
 * this file — the shell itself stays agnostic about what the footer
 * contains.
 */

import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { BridgeContentCapsule } from '@/components/journey/BridgeContentCapsule';
import { BridgeMediaCarouselPane, type BridgeMediaCarouselItem } from '@/components/journey/BridgeMediaCarouselPane';
import { BridgeActivityCompanionColumn } from '@/components/journey/BridgeActivityGroupRail';
import type { BridgeActivityGroup } from '@/services/journey/bridgeActivity';
import { ListenButton } from '@/components/shared/ListenButton';
import { type BridgeAccent } from '@/components/journey/BridgeMediaStage';

/**
 * Bridge-consistent accent classes — CI stays indigo/lilac, KNYTS stays
 * amber (BridgeMediaStage's own ACCENT_CLASSES pairing). ONE place derives
 * these so no FS stage hardcodes a color from the other bridge's palette.
 */
export function resolveFsAccentClasses(accent: BridgeAccent): {
  buttonClass: string;
  eyebrowClass: string;
  dotClass: string;
} {
  return accent === 'indigo'
    ? {
        buttonClass: 'bg-indigo-500 hover:bg-indigo-400 text-slate-950',
        eyebrowClass: 'text-indigo-400/80',
        dotClass: 'bg-indigo-400',
      }
    : {
        buttonClass: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
        eyebrowClass: 'text-amber-400/80',
        dotClass: 'bg-amber-400',
      };
}

export interface FsBridgeCapsuleSectionProps {
  items: BridgeMediaCarouselItem[];
  emptyLabel: string;
  eyebrow: string;
  headline: string;
  lead: string;
  contextualLine?: string;
  groups: BridgeActivityGroup[];
  /** Real functional content (a live profile card, an embed-toggle action
   *  row) rendered ABOVE the activity groups inside the same scrolling
   *  companion capsule — never decomposed into a capsule itself. */
  companionExtra?: ReactNode;
  accentEyebrowClass: string;
  accentDotClass: string;
  /** Default footer: a full-width Continue banner using onContinue/
   *  continueDisabled/accentButtonClass. Supply `renderFooter` instead for
   *  a stage that needs a different action row (Operate/Cross). */
  onContinue?: () => void;
  continueDisabled?: boolean;
  accentButtonClass?: string;
  renderFooter?: () => ReactNode;
}

export function FsBridgeCapsuleSection({
  items,
  emptyLabel,
  eyebrow,
  headline,
  lead,
  contextualLine,
  groups,
  companionExtra,
  accentEyebrowClass,
  accentDotClass,
  onContinue,
  continueDisabled,
  accentButtonClass,
  renderFooter,
}: FsBridgeCapsuleSectionProps) {
  return (
    <BridgeContentCapsule
      className="h-full"
      rightColumnWeight="2fr"
      railCards={[{ id: 'primary', label: 'Media' }]}
      viewportAspectRatio={() => 16 / 9}
      renderViewport={() => (
        <BridgeMediaCarouselPane
          items={items}
          emptyLabel={emptyLabel}
          dotsPosition="overlay"
          activeDotClassName={accentDotClass}
        />
      )}
      renderStrip={() => (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className={`text-[10px] uppercase tracking-[0.25em] ${accentEyebrowClass}`}>{eyebrow}</p>
            <ListenButton compact getText={() => [headline, lead, contextualLine].filter(Boolean).join(' ')} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{headline}</p>
          <p className="mt-2 text-[13px] leading-[1.5] text-slate-300">{lead}</p>
          {contextualLine && <p className="mt-2 text-xs text-slate-400">{contextualLine}</p>}
        </div>
      )}
      renderCompanion={() => (
        <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/[0.07] bg-slate-900/40 p-3.5">
          <div className="shrink-0 border-b border-white/[0.07] pb-2">
            <p className={`text-[10px] uppercase tracking-[0.25em] ${accentEyebrowClass}`}>Learning capsule</p>
            <p className="mt-1 text-xs text-slate-500">Everything for this stage, gathered in one place.</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pt-3 pr-1">
            {companionExtra}
            <BridgeActivityCompanionColumn groups={groups} />
          </div>
          <div className="mt-3 shrink-0 border-t border-white/[0.07] pt-3">
            {renderFooter ? (
              renderFooter()
            ) : (
              <button
                type="button"
                onClick={onContinue}
                disabled={continueDisabled}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${accentButtonClass} ${
                  continueDisabled ? 'cursor-not-allowed opacity-40' : ''
                }`}
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    />
  );
}

export default FsBridgeCapsuleSection;
