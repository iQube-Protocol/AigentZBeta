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
 *
 * `layout` (added 2026-08-11, editorial polish pass): 'standard' is the
 * ORIGINAL, UNCHANGED KNYTS rendering (centered, max-w-2xl, tall padding) —
 * the default, so KNYTS Bridge's visual output stays exactly as it was.
 * 'cinematic' is CI Bridge's opt-in.
 *
 * Refined again same day (hero-overlay pass): when a real `videoUrl`
 * exists, the video is now the full-bleed hero surface and the
 * eyebrow/headline/copy/CTAs render as a floating caption overlay anchored
 * lower-left INSIDE the video frame — not a separate block stacked below
 * it. The overlay fades out while the video plays (native `onPlay`/
 * `onPause`/`onEnded`) and reappears on pause or on hover, so the video can
 * breathe once playing rather than permanently carrying text. When no
 * video exists (true today — CLAUDE.md's No-Guessing rule forbids
 * inventing a hero-film URL), there is nothing to overlay onto, so this
 * falls back to the plain centered text treatment.
 */

import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';

export type BridgeAccent = 'amber' | 'indigo';
export type BridgeMediaStageLayout = 'standard' | 'cinematic';

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
  layout?: BridgeMediaStageLayout;
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
  layout = 'standard',
}: BridgeMediaStageProps) {
  const classes = ACCENT_CLASSES[accent];
  const [isPlaying, setIsPlaying] = useState(false);
  const [hovering, setHovering] = useState(false);
  const showOverlay = !isPlaying || hovering;

  if (layout === 'cinematic') {
    const ctas = (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPrimaryCta}
          className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${classes.button}`}
        >
          {primaryCtaLabel}
          <ArrowRight className="h-4 w-4" />
        </button>
        {secondaryCtaLabel && onSecondaryCta && (
          <button
            type="button"
            onClick={onSecondaryCta}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-black/20 px-4 py-2.5 text-sm font-medium text-slate-200 backdrop-blur-sm transition hover:border-white/40"
          >
            {secondaryCtaLabel}
          </button>
        )}
      </div>
    );

    if (videoUrl) {
      return (
        <div className="mx-auto max-w-6xl px-4 pt-6 pb-6">
          <div
            className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/50"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
          >
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              className="h-full w-full object-cover"
              controls
              poster={posterUrl}
              src={videoUrl}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
            {/* Cinematic caption overlay — lower-left, inset from the focal
                center, fades out while playing so the video can breathe;
                reappears on pause/hover. Bottom padding clears the native
                video control bar rather than fighting it with custom controls. */}
            <div
              className={`pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/20 to-transparent p-5 pb-14 transition-opacity duration-500 sm:p-8 sm:pb-16 ${
                showOverlay ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="pointer-events-auto max-w-md">
                <p className={`text-[10px] uppercase tracking-[0.3em] ${classes.eyebrow}`}>{eyebrow}</p>
                <h1 className="mt-1.5 text-xl font-semibold leading-snug text-white sm:text-2xl">{headline}</h1>
                {paragraphs.slice(0, 2).map((p, i) => (
                  <p key={i} className="mt-1.5 text-sm leading-[1.5] text-slate-200/90">
                    {p}
                  </p>
                ))}
                {highlightLine && <p className={`mt-1.5 text-sm font-semibold ${classes.highlight}`}>{highlightLine}</p>}
                <div className="mt-4">{ctas}</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // No real hero film exists yet — nothing to overlay onto. Plain
    // centered fallback, kept compact/restrained rather than tall+empty.
    return (
      <div className="mx-auto max-w-5xl px-6 pt-10 pb-8 text-center">
        <p className={`text-[11px] uppercase tracking-[0.3em] ${classes.eyebrow}`}>{eyebrow}</p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold leading-snug text-white">{headline}</h1>
        {(paragraphs.length > 0 || highlightLine) && (
          <div className="mx-auto mt-4 max-w-[65ch]">
            {paragraphs.map((p, i) => (
              <p key={i} className="mt-2 text-[15px] leading-[1.55] text-slate-300">
                {p}
              </p>
            ))}
            {highlightLine && <p className={`mt-2 text-sm font-semibold ${classes.highlight}`}>{highlightLine}</p>}
          </div>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">{ctas}</div>
      </div>
    );
  }

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
