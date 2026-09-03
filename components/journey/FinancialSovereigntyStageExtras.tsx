'use client';

/**
 * FinancialSovereigntyStageExtras — the CFS content pack's per-stage reading
 * material (topics, an accessible text alternative for the stage's plate,
 * understanding-check questions, and the CI/KNYTS contextual example line),
 * composed as a single `children` block inside the existing
 * BridgeMediaStage/PrepareFinancialProfileReview/Operate surfaces — never a
 * competing page or a second stage navigator. Reading/checks are always
 * visible and never gate anything (pack policy:
 * readingPreparationAndSampleModeUngated) — this block adds NO stage
 * transition, NO evidence write, and NO server call of its own.
 *
 * `asset`/`infographicUrl` render the accessible caption regardless of
 * publication state: when an admin has published a plate (`infographicUrl`
 * set — BridgeMediaStage itself renders the `<img>`), this shows the real
 * caption underneath; when nothing has been published yet, it shows an
 * honest "not yet published" notice plus the plain-text alternative from
 * the pack's artwork manifest — never a broken image, never invented
 * imagery (CLAUDE.md's Gated Content principle extended: absent means
 * absent, plainly labeled).
 */

import { useState } from 'react';
import type { FsBridge, FsStageAsset, FsStageContent } from '@/services/journey/financialSovereigntyContent';
import { FinancialSovereigntyUnderstandingCheck } from '@/components/journey/FinancialSovereigntyUnderstandingCheck';
import { FinancialSovereigntyCostExample } from '@/components/journey/FinancialSovereigntyCostExample';

function AssetCaption({ asset, infographicUrl, label }: { asset: FsStageAsset; infographicUrl: string | null | undefined; label?: string }) {
  return (
    <div className="text-xs text-slate-500">
      {label && <p className="mb-0.5 font-medium text-slate-400">{label}</p>}
      {infographicUrl ? (
        <p>{asset.caption}</p>
      ) : (
        <p>
          <span className="italic">Artwork not yet published.</span> Text alternative: {asset.alt}
        </p>
      )}
    </div>
  );
}

export interface FsAssetCaptionEntry {
  asset: FsStageAsset;
  infographicUrl?: string | null;
  label?: string;
}

export function FinancialSovereigntyStageExtras({
  content,
  bridge,
  assets,
  showCostExample,
}: {
  content: FsStageContent;
  bridge: FsBridge;
  /** One entry per plate this stage shows — a single-element array for every
   *  stage except Learn (three lesson plates). Each entry's `infographicUrl`
   *  is that plate's admin-published URL, or null/undefined when unpublished. */
  assets: FsAssetCaptionEntry[];
  /** Explore only — renders the deterministic cost-sensitivity interactive. */
  showCostExample?: boolean;
}) {
  const [topicsOpen, setTopicsOpen] = useState(false);

  return (
    <div className="mt-4 space-y-3 text-left">
      {assets.map((entry, i) => (
        <AssetCaption key={i} asset={entry.asset} infographicUrl={entry.infographicUrl} label={entry.label} />
      ))}

      <p className="text-xs italic text-slate-500">{content.contextualLine[bridge]}</p>

      <div>
        <button
          type="button"
          onClick={() => setTopicsOpen((v) => !v)}
          className="text-xs font-medium text-slate-300 underline decoration-dotted underline-offset-2 hover:text-slate-100"
        >
          {topicsOpen ? 'Hide topics' : `Read the topics (${content.topics.length})`}
        </button>
        {topicsOpen && (
          <div className="mt-2 space-y-2">
            {content.topics.map((topic) => (
              <div key={topic.id} className="rounded-md border border-white/10 bg-white/[0.02] p-2.5">
                <p className="text-xs font-semibold text-slate-200">{topic.title}</p>
                <p className="mt-0.5 text-xs text-slate-400">{topic.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCostExample && <FinancialSovereigntyCostExample />}

      {content.checks.map((check) => (
        <FinancialSovereigntyUnderstandingCheck key={check.id} check={check} />
      ))}

      <p className="text-xs text-slate-500">{content.exerciseSummary}</p>
    </div>
  );
}

export default FinancialSovereigntyStageExtras;
