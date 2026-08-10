'use client';

/**
 * KnytsBridgeMediaStage — the ONE cinematic component shared by HOME and
 * ORIENT (surface reconciliation, 2026-08-09): "these are the two surfaces
 * where video should dominate... follow one shared media-stage component."
 *
 * Home speaks Mythos. Orient explains the constitutional choice. The
 * distinction lives entirely in the `section`'s copy/media (admin-editable
 * via /api/journey/knyts-bridge/editorial-config + KnytsBridgeAdminPanel)
 * and in the caller's `ctaStageId` — never in a second component.
 */

import { useEffect, useState } from 'react';
import { ArrowRight, Trophy } from 'lucide-react';
import type { KnytsBridgeEditorialSection } from '@/services/journey/knytsBridgeEditorialConfig';
import { KNYTS_BRIDGE_SECTION_DEFAULTS } from '@/services/journey/knytsBridgeEditorialConfig';

interface CrossingOfTheWeek {
  weekStart: string;
  communityContentId: string;
  title: string;
  score: number;
}

function selectStage(stageId: string) {
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId } }));
  } catch {
    /* non-fatal */
  }
}

interface Props {
  /** Which editorial_config row to read/fall back to. */
  section: 'home' | 'orient';
  /** Which stage the CTA advances to. */
  ctaStageId: string;
  /** HOME shows the campaign reward callout + Crossing of the Week teaser; ORIENT does not. */
  showCampaignExtras?: boolean;
}

export function KnytsBridgeMediaStage({ section, ctaStageId, showCampaignExtras = false }: Props) {
  const defaults = KNYTS_BRIDGE_SECTION_DEFAULTS[section] ?? KNYTS_BRIDGE_SECTION_DEFAULTS.home;
  const [config, setConfig] = useState<KnytsBridgeEditorialSection>(defaults);
  const [crossingOfTheWeek, setCrossingOfTheWeek] = useState<CrossingOfTheWeek | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/journey/knyts-bridge/editorial-config?section=${section}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json: { ok?: boolean; config?: KnytsBridgeEditorialSection }) => {
        if (!cancelled && json.ok && json.config) setConfig(json.config);
      })
      .catch(() => {
        /* non-fatal — the shipped defaults still render */
      });
    return () => {
      cancelled = true;
    };
  }, [section]);

  useEffect(() => {
    if (!showCampaignExtras) return;
    let cancelled = false;
    fetch('/api/journey/knyts-bridge/crossing-of-the-week', { cache: 'no-store' })
      .then((r) => r.json())
      .then((json: { ok?: boolean; crossing?: CrossingOfTheWeek | null }) => {
        if (!cancelled && json.ok && json.crossing) setCrossingOfTheWeek(json.crossing);
      })
      .catch(() => {
        /* non-fatal */
      });
    return () => {
      cancelled = true;
    };
  }, [showCampaignExtras]);

  const headline = config.headline || defaults.headline;
  const shortCopy = config.shortCopy || defaults.shortCopy || '';
  const ctaLabel = config.campaignCta || defaults.campaignCta || 'Continue';

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-400/20 bg-gradient-to-b from-slate-950 via-slate-950 to-amber-950/10">
      {(config.videoUrl || config.posterUrl) && (
        <div className="relative aspect-video w-full bg-slate-900">
          {config.videoUrl ? (
            <video
              className="h-full w-full object-cover"
              src={config.videoUrl}
              poster={config.posterUrl ?? undefined}
              controls
              playsInline
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.posterUrl ?? undefined} alt="" className="h-full w-full object-cover" />
          )}
        </div>
      )}

      <div className="mx-auto max-w-2xl px-6 py-14 text-center">
        <p className="text-[11px] uppercase tracking-[0.3em] text-amber-400">The KNYTS Bridge</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{headline}</h1>
        {shortCopy.split('\n\n').map((para, i) => (
          <p key={i} className="mt-4 text-sm leading-relaxed text-slate-300">
            {para}
          </p>
        ))}
        {showCampaignExtras && config.rewardCopy && (
          <p className="mt-4 text-sm font-semibold text-amber-300">{config.rewardCopy}</p>
        )}
        <button
          type="button"
          onClick={() => selectStage(ctaStageId)}
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </button>

        {showCampaignExtras && crossingOfTheWeek && (
          <button
            type="button"
            onClick={() => selectStage('view')}
            className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-left transition hover:bg-amber-500/15"
          >
            <Trophy className="h-5 w-5 shrink-0 text-amber-300" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-amber-400">Crossing of the Week</p>
              <p className="truncate text-sm font-semibold text-white">{crossingOfTheWeek.title}</p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

export default KnytsBridgeMediaStage;
