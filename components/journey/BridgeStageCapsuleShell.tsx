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
export function liquidGlassButtonClass(accent: 'indigo' | 'amber'): string {
  return accent === 'indigo'
    ? 'border border-indigo-400/40 bg-indigo-500/15 text-indigo-100 backdrop-blur-md transition hover:border-indigo-400/60 hover:bg-indigo-500/25'
    : 'border border-amber-400/40 bg-amber-500/15 text-amber-100 backdrop-blur-md transition hover:border-amber-400/60 hover:bg-amber-500/25';
}

export default BridgeStageCapsuleShell;
