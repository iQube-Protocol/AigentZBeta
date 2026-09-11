'use client';

/**
 * FinancialSovereigntyStageExtras — renders the CFS content pack's
 * per-stage reading material (topics, an accessible text alternative for
 * the stage's plate, understanding-check questions, and the CI/KNYTS
 * contextual example line) as an ALWAYS-VISIBLE, clearly labeled section —
 * composed inside the existing BridgeMediaStage/PrepareFinancialProfileReview/
 * Operate surfaces, never a competing page or a second stage navigator.
 * Reading/checks are always visible and never gate anything (pack policy:
 * readingPreparationAndSampleModeUngated) — this block adds NO stage
 * transition, NO evidence write, and NO server call of its own.
 *
 * Content is pre-resolved by the caller via `resolveFsSectionContent()`
 * (services/journey/financialSovereigntyContent.ts) — this component never
 * reads FS_STAGE_CONTENT directly, so it renders whatever the admin has
 * actually published, falling back to the shipped pack default only when
 * nothing has been saved. See FS_LOGICAL_SECTION_MAP in that same module
 * for the full logical-section -> component -> editorial-source mapping.
 *
 * Topics render unconditionally (2026-09-03 composition-verification
 * correction — a collapsed toggle previously hid them by default, which
 * does not demonstrate that a section actually renders). No new pager: this
 * is one vertically-stacked block, not a second navigator competing with
 * the stepper.
 */

import type { FsTopic, FsUnderstandingCheck } from '@/services/journey/financialSovereigntyContent';
import { FinancialSovereigntyUnderstandingCheck } from '@/components/journey/FinancialSovereigntyUnderstandingCheck';
import { FinancialSovereigntyCostExample } from '@/components/journey/FinancialSovereigntyCostExample';

function AssetCaption({ caption, alt, infographicUrl, label }: { caption: string; alt: string; infographicUrl: string | null | undefined; label?: string }) {
  return (
    <div className="text-xs text-slate-500">
      {label && <p className="mb-0.5 font-medium text-slate-400">{label}</p>}
      {infographicUrl ? (
        <>
          <img src={infographicUrl} alt={alt} className="mb-1 w-full rounded-lg border border-white/10 object-contain" />
          <p>{caption}</p>
        </>
      ) : (
        <p>
          <span className="italic">Artwork not yet published.</span> Text alternative: {alt}
        </p>
      )}
    </div>
  );
}

export interface FsAssetCaptionEntry {
  caption: string;
  alt: string;
  infographicUrl?: string | null;
  label?: string;
}

export function FinancialSovereigntyStageExtras({
  sectionLabel,
  topics,
  checks,
  exerciseSummary,
  contextualLine,
  assets,
  showCostExample,
}: {
  /** The logical section's own label (from FS_LOGICAL_SECTION_MAP), rendered as a heading. */
  sectionLabel: string;
  topics: FsTopic[];
  checks: FsUnderstandingCheck[];
  exerciseSummary: string;
  contextualLine: string;
  /** One entry per plate this stage shows — a single-element array for every
   *  stage except Learn (three lesson plates). Each entry's `infographicUrl`
   *  is that plate's admin-published URL, or null/undefined when unpublished. */
  assets: FsAssetCaptionEntry[];
  /** Explore only — renders the deterministic cost-sensitivity interactive. */
  showCostExample?: boolean;
}) {
  return (
    <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-white/[0.015] p-3 text-left" data-fs-section={sectionLabel}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{sectionLabel}</p>

      {assets.map((entry, i) => (
        <AssetCaption key={i} caption={entry.caption} alt={entry.alt} infographicUrl={entry.infographicUrl} label={entry.label} />
      ))}

      {contextualLine && <p className="text-xs italic text-slate-500">{contextualLine}</p>}

      {topics.length > 0 && (
        <div className="space-y-2">
          {topics.map((topic) => (
            <div key={topic.id} className="rounded-md border border-white/10 bg-white/[0.02] p-2.5">
              <p className="text-xs font-semibold text-slate-200">{topic.title}</p>
              <p className="mt-0.5 text-xs text-slate-400">{topic.body}</p>
            </div>
          ))}
        </div>
      )}

      {showCostExample && <FinancialSovereigntyCostExample />}

      {checks.map((check) => (
        <FinancialSovereigntyUnderstandingCheck key={check.id} check={check} />
      ))}

      {exerciseSummary && <p className="text-xs text-slate-500">{exerciseSummary}</p>}
    </div>
  );
}

export default FinancialSovereigntyStageExtras;
