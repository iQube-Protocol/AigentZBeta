'use client';

/**
 * BridgeMediaStage — the generic hero/media section every public Threshold
 * Guide Bridge front door opens with (HOME/HOMECOMING).
 *
 * There was no standalone `KnytsBridgeMediaStage` component to extract —
 * the KNYTS Bridge's HOMECOMING section is inline JSX in
 * app/bridge/knyts/page.tsx. This component generalizes that same visual
 * shape (eyebrow, headline, short paragraphs, highlight line, primary +
 * optional secondary CTA, optional video/poster) into one reusable surface,
 * and app/bridge/knyts/page.tsx now renders it too — so KNYTS Bridge gets
 * the generalization for free instead of a second, unrelated CI-only
 * component (operator instruction: "Generalize KnytsBridgeMediaStage into a
 * reusable Bridge media component rather than creating an unrelated CI
 * version"). Visual output for KNYTS is unchanged — same copy, same
 * amber accent, same layout.
 *
 * Video is optional and OFF by default: no hero film URL exists in this
 * codebase for either Bridge today (CLAUDE.md "No Guessing" — a URL is
 * never invented). When a real video asset is available, pass `videoUrl`
 * (+ optional `posterUrl`) and this component renders it above the copy.
 */

import React from 'react';
import { ArrowRight } from 'lucide-react';

export type BridgeAccent = 'amber' | 'indigo';

const ACCENT_CLASSES: Record<BridgeAccent, { eyebrow: string; highlight: string; button: string }> = {
  amber: {
    eyebrow: 'text-amber-400',
    highlight: 'text-amber-300',
    button: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
  },
  indigo: {
    eyebrow: 'text-indigo-400',
    highlight: 'text-indigo-300',
    button: 'bg-indigo-500 hover:bg-indigo-400 text-slate-950',
  },
};

export interface BridgeMediaStageProps {
  eyebrow: string;
  headline: string;
  paragraphs: string[];
  highlightLine?: string;
  primaryCtaLabel: string;
  onPrimaryCta: () => void;
  secondaryCtaLabel?: string;
  onSecondaryCta?: () => void;
  accent?: BridgeAccent;
  videoUrl?: string;
  posterUrl?: string;
}

export function BridgeMediaStage({
  eyebrow,
  headline,
  paragraphs,
  highlightLine,
  primaryCtaLabel,
  onPrimaryCta,
  secondaryCtaLabel,
  onSecondaryCta,
  accent = 'amber',
  videoUrl,
  posterUrl,
}: BridgeMediaStageProps) {
  const classes = ACCENT_CLASSES[accent];

  return (
    <div className="mx-auto max-w-2xl px-6 pt-20 pb-10 text-center">
      {videoUrl && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-white/10">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video className="w-full" controls poster={posterUrl} src={videoUrl} />
        </div>
      )}
      <p className={`text-[11px] uppercase tracking-[0.3em] ${classes.eyebrow}`}>{eyebrow}</p>
      <h1 className="mt-3 text-3xl sm:text-4xl font-bold leading-tight text-white">{headline}</h1>
      {paragraphs.map((p, i) => (
        <p key={i} className="mt-4 text-sm leading-relaxed text-slate-300">{p}</p>
      ))}
      {highlightLine && (
        <p className={`mt-4 text-sm font-semibold ${classes.highlight}`}>{highlightLine}</p>
      )}
      <div className="mt-7 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onPrimaryCta}
          className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition ${classes.button}`}
        >
          {primaryCtaLabel}
          <ArrowRight className="h-4 w-4" />
        </button>
        {secondaryCtaLabel && onSecondaryCta && (
          <button
            type="button"
            onClick={onSecondaryCta}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-white/20"
          >
            {secondaryCtaLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default BridgeMediaStage;
