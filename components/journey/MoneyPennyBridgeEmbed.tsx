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
 */

import { useEffect } from 'react';
import { buildCodexUrl } from '@/utils/codex-nav';

export function MoneyPennyBridgeEmbed({
  tab,
  personaId,
  className,
}: {
  /**
   * A MoneyPenny native area tab slug ('home' | 'my-money' | 'plan' |
   * 'markets' | 'activity') — passed straight through as `?tab=` to the
   * real MONEYPENNY_CARTRIDGE tabs. A legacy MoneyPennyPanelKey value
   * (e.g. 'financial-profile') also still works: it self-heals into the
   * correct native area tab showing that exact panel (see
   * MoneyPennyPanelTab.tsx's own header) — callers in THIS repo should
   * still prefer the native slug directly, to land there in one render
   * with no self-heal redirect.
   */
  tab: string;
  personaId?: string | null;
  className?: string;
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
