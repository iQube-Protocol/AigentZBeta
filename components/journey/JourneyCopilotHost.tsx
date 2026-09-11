'use client';

/**
 * JourneyCopilotHost — the ONE shared floating copilot for a Journey spine
 * (Journey Runtime copilot invariant, item 1, semantic repair 2026-08-25).
 *
 * Mounted once from `JourneyRunSurface`, independent of the active stage —
 * it stays mounted across every stage of the journey, including through the
 * fullscreen toggle (JourneyRunSurface renders its `content` tree, which
 * this sits inside, for both the normal-flow and fullscreen-portal return
 * paths). Identity resolves from `journey.copilot` via
 * `resolveJourneyCopilot` — never a hand-copied agent id/name/accentColor.
 *
 * Uses the EXISTING `CodexCopilotLayer` + `CopilotHostContext` dedupe
 * architecture, unchanged: mounted with default props, this registers as a
 * `hostRole: 'tab'` (specialized) host, so a surrounding cartridge's own
 * generic `hostRole: 'panel'` copilot yields to it automatically wherever a
 * `CopilotHostProvider` wraps the tree (e.g. a Journey embedded inside a
 * cartridge shell's Pilot tab). A bare Bridge page has no such provider
 * above it, so there `useCopilotHost()` falls back to its no-op default —
 * harmless, since a bare page has no competing generic copilot to yield to
 * in the first place.
 *
 * Embedded stage surfaces continue suppressing their OWN floating copilot
 * exactly as before (`suppressFloatingCopilot` on `embed`-kind registry
 * descriptors, `?copilot=off`) — this file changes nothing about that
 * mechanism; it only adds the ONE copilot those surfaces were always meant
 * to defer to.
 */

import { useEffect, useState } from 'react';
import { CodexCopilotLayer } from '@/app/components/codex/CodexCopilotLayer';
import { useActivePersona } from '@/app/hooks/useActivePersona';
import { resolveJourneyCopilot } from '@/services/journey/journeyCopilotResolver';
import type { JourneyDefinition, JourneyStageDefinition, JourneyStageRuntimeState } from '@/types/journey';

/**
 * Remote "open the journey copilot" request — the same `window` CustomEvent
 * pattern `journey:select-stage` already uses (JourneyRunSurface's own
 * companion-synchronization seam). Lets an in-journey stage surface (e.g.
 * KnytsBridgeChooseSurface's "Ask the copilot" affordance) open the ONE
 * shared floating copilot without either surface needing a reference to the
 * other — there is only ever one journey mounted per page, so this is
 * deliberately not journey-id-scoped, matching `journey:select-stage`.
 */
export function openJourneyCopilot() {
  try {
    window.dispatchEvent(new CustomEvent('journey:open-copilot'));
  } catch {
    /* non-fatal */
  }
}

export interface JourneyCopilotHostProps {
  journey: JourneyDefinition;
  personaId?: string;
  activeStage: JourneyStageDefinition;
  activeStageRuntime?: JourneyStageRuntimeState;
  selectedAgentSlug?: string;
  /**
   * AEE-XP-001 §10/XP-5 (2026-09-01) — the canonical companion role occupant
   * for this caller, resolved SERVER-SIDE (this component stays a plain
   * client component — no NextRequest, no server role-resolution here) by
   * the journey's own `state` route via `resolvePrimaryCompanionForJourney`
   * and projected down as ordinary runtime data through
   * `JourneyRunSurface` -> here. Substitutes ONLY the agent identity/name;
   * `resolveJourneyCopilot(journey)` below still supplies accent/prompt/
   * quickPrompts unchanged — this is never a second companion-state system,
   * just a data override on the ONE existing resolver's output. Absent/null
   * (no request context wired it, or no real assignment resolved) falls
   * open to the journey's existing static copilot, unchanged.
   */
  resolvedCompanionAgent?: { id: string; name: string } | null;
}

export function JourneyCopilotHost({
  journey,
  personaId,
  activeStage,
  activeStageRuntime,
  selectedAgentSlug,
  resolvedCompanionAgent,
}: JourneyCopilotHostProps) {
  const [isOpen, setIsOpen] = useState(false);
  const resolved = resolveJourneyCopilot(journey);
  const agent = resolvedCompanionAgent ?? resolved.agent;

  useEffect(() => {
    const onOpenRequest = () => setIsOpen(true);
    window.addEventListener('journey:open-copilot', onOpenRequest);
    return () => window.removeEventListener('journey:open-copilot', onOpenRequest);
  }, []);

  // T1-safe display context — the SAME canonical surface ActivePersonaControl
  // reads (displayLabel, then own FIO handle, never a UUID), never personaId
  // itself inside groundContext (personaId already travels as its own prop,
  // matching every existing copilot mount's convention).
  const { surface: activePersonaSurface } = useActivePersona();
  type SurfaceWithFio = typeof activePersonaSurface & { ownFioHandle?: string };
  const personaDisplayLabel =
    activePersonaSurface?.displayLabel ??
    (activePersonaSurface as SurfaceWithFio | null)?.ownFioHandle ??
    null;

  return (
    <CodexCopilotLayer
      isOpen={isOpen}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
      variant="floating"
      accentColor={resolved.accentColor}
      agent={agent}
      personaId={personaId}
      enableInferenceRendering
      contextId={`journey-${journey.id}`}
      promptPlaceholder={resolved.promptPlaceholder}
      quickPrompts={resolved.quickPrompts}
      groundContext={{
        surface: 'journey-runtime',
        journeyId: journey.id,
        journeyLabel: journey.label,
        activeStageId: activeStage.id,
        activeStageLabel: activeStage.label,
        activeStageState: activeStageRuntime?.state ?? null,
        personaDisplayLabel,
        selectedAgentSlug: selectedAgentSlug ?? null,
      }}
    />
  );
}

export default JourneyCopilotHost;
