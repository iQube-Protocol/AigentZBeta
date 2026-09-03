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
  /** MoneyPennyPanelKey — which capsule to open (e.g. 'financial-profile', 'overview'). */
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
    focusedNavDepth: 0,
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
