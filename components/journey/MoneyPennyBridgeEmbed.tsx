'use client';

/**
 * MoneyPennyBridgeEmbed — the shared in-frame MoneyPenny mount for CI and
 * KNYTS's Prepare/Operate stages (MoneyPenny experience-coherence
 * correction, 2026-09-03, operator directive: "Prepare's profile task and
 * Operate's MoneyPenny workspace must render inside the existing bridge
 * frame/stage. Do not use a new tab, popup or whole-page navigation as the
 * primary launch behaviour. Same-tab window.location.assign is not an
 * embedding fix.").
 *
 * Reuses the EXACT mechanism the Horizen bridge already uses for its own
 * MoneyPenny embed (`moneypenny-orchestration-focused` in
 * services/journey/journeySurfaceRegistry.ts) — `buildCodexUrl`'s
 * `focused`/`focusedNavDepth` options, which suppress the embedded
 * cartridge's own top-level chrome via CodexPanelDynamic's
 * `suppressPrimaryChrome` — rather than a second, hand-built iframe
 * convention. Mounts the canonical MoneyPenny workspace
 * (`MoneyPennyPanelTab` → `MoneyPennyCopilotWorkspace`), never an
 * orchestration-only substitute.
 *
 * `focusedNavDepth: 1` (navigation-hierarchy correction, 2026-09-03 —
 * raised from 0 the same day MoneyPenny's five areas became real native
 * CodexTabs): depth 0 would hide BOTH of CodexPanelDynamic's chrome tiers,
 * including the Home | My Money | Plan | Markets | Activity sub-header —
 * leaving the embedded operator with no way to switch areas at all. Depth
 * 1 hides only the outer "MoneyPenny · Admin" bar (redundant inside a
 * bridge/journey stage that already supplies its own header/stepper) while
 * keeping the area sub-header navigable — the SAME precedent
 * `knyts-bridge-buy-store`'s own depth: 1 already established for KNYT's
 * Store tab ("retains the Store's own navigation strip ... required for
 * the destination to remain functionally navigable").
 *
 * Dispatches `journey:host-copilot-suppress` (the same
 * window-CustomEvent convention `journey:select-stage` already
 * establishes) so `JourneyRunSurface` stops mounting its own
 * `JourneyCopilotHost` while this embed is showing — MoneyPenny's inline
 * `SmartTriadCopilotLayer` copilot is a complete replacement for the
 * bridge's ambient one, not an addition to it (SC-09: "the host and
 * embedded cartridge coordinate copilot ownership so one active
 * conversation is presented"). Un-dispatches (false) on unmount so closing
 * this embed restores the bridge's own copilot.
 *
 * `expandable` (navigation/viewport correction follow-up, 2026-09-03,
 * operator directive: "They should both [CI/Knightsbridge] have the exact
 * same expand-to-metaMe-shell affordance as Horizen bridge") — when true,
 * this embed stops targeting the standalone `moneypenny-codex` cartridge
 * fixed-focused and instead renders through the SAME registry descriptor
 * (`JOURNEY_SURFACES['moneypenny-orchestration-focused']`) and
 * `buildEmbedSurfaceSrc` Horizen's own aigentme-stage override already
 * uses, with the identical Focus/Full toggle toolbar
 * (`JourneyRunSurface.tsx`'s `kind: 'embed'` render switch is the
 * canonical copy of this toolbar; this is a deliberate, small duplicate of
 * that JSX rather than a shared export, since JourneyRunSurface's version
 * is keyed to its own `expandedEmbedIndices` map, not applicable to a
 * standalone component with a single embed and no sibling surfaces) —
 * expanding reveals metaMe's own real navigation with MoneyPenny selected,
 * never a jump to the standalone cartridge shell. `tab` is ignored in this
 * mode: the shared descriptor's own `tab` (`home`) always wins, exactly as
 * every other consumer of that descriptor gets the same destination.
 * Default `false` preserves the original fixed-focused-only behavior for
 * Prepare's financial-profile embed, which has no expand affordance and
 * targets a specific area tab the descriptor doesn't carry.
 */

import { useState, useEffect } from 'react';
import { buildCodexUrl } from '@/utils/codex-nav';
import { JOURNEY_SURFACES, buildEmbedSurfaceSrc } from '@/services/journey/journeySurfaceRegistry';

export function MoneyPennyBridgeEmbed({
  tab,
  personaId,
  className,
  expandable = false,
}: {
  /**
   * A MoneyPenny native area tab slug ('home' | 'my-money' | 'plan' |
   * 'markets' | 'activity') — passed straight through as `?tab=` to the
   * real MONEYPENNY_CARTRIDGE tabs. A legacy MoneyPennyPanelKey value
   * (e.g. 'financial-profile') also still works: it self-heals into the
   * correct native area tab showing that exact panel (see
   * MoneyPennyPanelTab.tsx's own header) — callers in THIS repo should
   * still prefer the native slug directly, to land there in one render
   * with no self-heal redirect. Ignored when `expandable` is true (see
   * that prop's own doc comment above).
   */
  tab: string;
  personaId?: string | null;
  className?: string;
  expandable?: boolean;
}) {
  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent('journey:host-copilot-suppress', { detail: { suppressed: true } }));
    } catch {
      /* non-fatal */
    }
    return () => {
      try {
        window.dispatchEvent(new CustomEvent('journey:host-copilot-suppress', { detail: { suppressed: false } }));
      } catch {
        /* non-fatal */
      }
    };
  }, []);

  const [isExpanded, setIsExpanded] = useState(false);

  if (expandable) {
    const descriptor = JOURNEY_SURFACES['moneypenny-orchestration-focused'];
    if (descriptor.kind === 'embed') {
      const shouldFocus = !isExpanded && descriptor.focused;
      const src = buildEmbedSurfaceSrc(
        { ...descriptor, focused: shouldFocus ? true : undefined },
        { personaId: personaId ?? undefined },
        buildCodexUrl,
      );
      return (
        <div className="flex min-h-0 w-full flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] text-slate-400">{descriptor.breadcrumb}</span>
            <button
              type="button"
              onClick={() => setIsExpanded((e) => !e)}
              className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 bg-none border-none cursor-pointer p-0"
            >
              {isExpanded ? 'Focus view' : (descriptor.openLabel ?? 'Open full view ↗')}
            </button>
          </div>
          <iframe
            src={src}
            title="MoneyPenny"
            className={className ?? 'h-[36rem] w-full rounded-md border border-slate-800 bg-slate-950'}
          />
        </div>
      );
    }
  }

  const src = buildCodexUrl('moneypenny', {
    personaId: personaId ?? undefined,
    tab,
    focused: true,
    focusedNavDepth: 1,
  });

  return (
    <iframe
      src={src}
      title="MoneyPenny"
      className={className ?? 'h-[36rem] w-full rounded-md border border-slate-800 bg-slate-950'}
    />
  );
}

export default MoneyPennyBridgeEmbed;
