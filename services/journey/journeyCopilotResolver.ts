/**
 * journeyCopilotResolver — the ONE place a Journey's copilot/guide identity
 * is resolved (Journey Runtime copilot invariant, item 1, semantic repair
 * 2026-08-25).
 *
 * `JourneyDefinition.copilot` is a REFERENCE (a cartridge slug, plus
 * optional prompt-copy overrides) — never a hand-copied agent id/name/
 * accentColor. This resolves that reference against the canonical cartridge
 * copilot configuration (`data/codex-configs.ts`'s `CodexConfig.copilot`),
 * the SAME config `CodexPanelDynamic`'s own generic floating copilot reads.
 *
 * Fails LOUDLY, never guesses: a `cartridgeSlug` that doesn't resolve to a
 * cartridge, or a cartridge with no configured `copilot.agent`, throws
 * immediately — a journey's copilot identity must never silently fall back
 * to a generic/placeholder agent (CLAUDE.md's No-Guessing rule).
 */

import { getCodexBySlug } from '@/data/codex-configs';
import type { JourneyDefinition } from '@/types/journey';

export interface ResolvedJourneyCopilot {
  agent: { id: string; name: string };
  accentColor: string;
  promptPlaceholder?: string;
  quickPrompts?: string[];
}

const DEFAULT_ACCENT_COLOR = 'violet';

export function resolveJourneyCopilot(journey: JourneyDefinition): ResolvedJourneyCopilot {
  const ref = journey.copilot;
  const cartridge = getCodexBySlug(ref.cartridgeSlug);
  if (!cartridge) {
    throw new Error(
      `Journey '${journey.id}' declares copilot.cartridgeSlug='${ref.cartridgeSlug}', but no cartridge with that slug is registered in data/codex-configs.ts. Fix the journey's copilot reference — never fall back to a guessed agent.`,
    );
  }
  if (!cartridge.copilot?.agent) {
    throw new Error(
      `Journey '${journey.id}' declares copilot.cartridgeSlug='${ref.cartridgeSlug}' (cartridge '${cartridge.id}'), but that cartridge has no copilot.agent configured. Add one to ${cartridge.id}'s CodexConfig in data/codex-configs.ts, or point the journey at a cartridge that already has one — never fall back to a guessed agent.`,
    );
  }
  return {
    agent: cartridge.copilot.agent,
    accentColor: cartridge.copilot.accentColor ?? DEFAULT_ACCENT_COLOR,
    promptPlaceholder: ref.promptPlaceholder ?? cartridge.copilot.promptPlaceholder,
    quickPrompts: ref.quickPrompts ?? cartridge.copilot.quickPrompts,
  };
}
