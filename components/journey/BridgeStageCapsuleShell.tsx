'use client';

/**
 * BridgeStageCapsuleShell — the SAME right-pane capsule chrome
 * `FsBridgeCapsuleSection`'s companion capsule uses (header eyebrow +
 * description in the strip's own typography, one bordered container, one
 * internally-scrolling region), extracted so the "first threshold" stages
 * (Orient/Passport/Choose, both bridges) can encapsulate their EXISTING
 * right-pane content the same way — presentation only, never a rebuild.
 *
 * Deliberately a pure wrapper: it takes whatever `children` the caller
 * already renders and puts a header + scroll region around them, unchanged.
 * A caller's own nested bordered elements (e.g. `ConstitutionalFrontierOrientSurface`'s
 * own capsule, `BridgeActionModeQuestion`'s own capsule) staying visually
 * nested inside this outer capsule is the SAME nesting pattern
 * `BridgeActivityCapsule` already uses inside `FsBridgeCapsuleSection`'s
 * companion column — never flattened away.
 *
 * Scrolling only actually engages when the caller's own layout gives this
 * component's parent a definite height (e.g. `BridgeOrientSurface`'s own
 * `lg:h-full` grid) — same content-driven-unless-bounded contract
 * `BridgeContentCapsule` and `FsBridgeCapsuleSection` already use.
 */

import type { ReactNode } from 'react';
import { ListenButton } from '@/components/shared/ListenButton';

export interface BridgeStageCapsuleShellProps {
  eyebrow: string;
  description?: string;
  accentEyebrowClass: string;
  children: ReactNode;
  className?: string;
}

export function BridgeStageCapsuleShell({
  eyebrow,
  description,
  accentEyebrowClass,
  children,
  className,
}: BridgeStageCapsuleShellProps) {
  return (
    <div
      className={`flex h-full min-h-0 flex-col rounded-2xl border border-white/[0.07] bg-slate-900/40 p-3.5 ${className ?? ''}`}
    >
      <div className="shrink-0 border-b border-white/[0.07] pb-2">
        <p className={`text-[10px] uppercase tracking-[0.25em] ${accentEyebrowClass}`}>{eyebrow}</p>
        {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pt-3 pr-1">{children}</div>
    </div>
  );
}

/**
 * liquidGlassButtonClass — the shared "liquid glass" button treatment
 * (translucent accent tint + backdrop blur + accent hairline) that replaces
 * a solid full-color button fill (`bg-indigo-500`/`bg-amber-500`) across
 * both bridges. Callers append their own layout classes (padding, rounding,
 * flex alignment) — this returns only the material/color half, the same
 * division of labour `resolveFsAccentClasses` already established for the
 * FS stages' eyebrow/dot colors.
 */
export interface BridgeStepTeachingNoteProps {
  accent: 'indigo' | 'amber';
  /** e.g. "What this step enables". */
  eyebrow: string;
  title: string;
  /** Short — one or two sentences, not a long block. Optional \n\n-separated
   *  paragraphs are honored (unlike the strip's copy, which is deliberately
   *  collapsed to one paragraph — a teaching note is allowed a beat of
   *  structure). */
  body: string;
  /** Optional short "what this choice means" bullets — e.g. Choose's list of
   *  what each capsule option leads to. Omit for steps with nothing to
   *  enumerate. */
  bullets?: string[];
}

/**
 * BridgeStepTeachingNote — full-width textual/audio teaching module for the
 * "first threshold" stages (Orient/Passport/Choose, both bridges), added
 * 2026-09-06 at the operator's direction: "turning the bridge into a
 * comprehensive and complete teaching/learning resource." Mirrors the
 * strip's copy typography from `FsBridgeCapsuleSection` (eyebrow/title/lead)
 * plus its `ListenButton`, but spans the full page width below the two-column
 * grid rather than living under the left-column media — these three stages'
 * media panes are already the step's own interactive surface (questionnaire/
 * passport/capsule picker), not a place to also carry a long explanation.
 * Scrolls internally past a generous max-height rather than pushing the page
 * — deliberately short copy (see `body`'s own doc) means this rarely engages.
 */
export function BridgeStepTeachingNote({ accent, eyebrow, title, body, bullets }: BridgeStepTeachingNoteProps) {
  const accentEyebrowClass = accent === 'indigo' ? 'text-indigo-400/80' : 'text-amber-400/80';
  const accentBulletClass = accent === 'indigo' ? 'bg-indigo-400' : 'bg-amber-400';
  const paragraphs = body.split('\n\n').filter(Boolean);
  return (
    <div className="mt-4 rounded-2xl border border-white/[0.07] bg-slate-900/40 p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className={`text-[10px] uppercase tracking-[0.25em] ${accentEyebrowClass}`}>{eyebrow}</p>
        <ListenButton
          compact
          getText={() => [title, ...paragraphs, ...(bullets ?? [])].filter(Boolean).join(' ')}
        />
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-100">{title}</p>
      <div className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1 text-[13px] leading-[1.5] text-slate-300">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {bullets && bullets.length > 0 && (
          <ul className="space-y-1.5 pt-1">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${accentBulletClass}`} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function liquidGlassButtonClass(accent: 'indigo' | 'amber'): string {
  return accent === 'indigo'
    ? 'border border-indigo-400/40 bg-indigo-500/15 text-indigo-100 backdrop-blur-md transition hover:border-indigo-400/60 hover:bg-indigo-500/25'
    : 'border border-amber-400/40 bg-amber-500/15 text-amber-100 backdrop-blur-md transition hover:border-amber-400/60 hover:bg-amber-500/25';
}

export default BridgeStageCapsuleShell;
