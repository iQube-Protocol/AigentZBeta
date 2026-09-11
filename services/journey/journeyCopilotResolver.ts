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

/**
 * `resolveJourneyCopilot` above stays a PURE, synchronous, config-only
 * resolver — CLIENT-SAFE. `JourneyCopilotHost.tsx` (a `'use client'`
 * component) imports it directly.
 *
 * The additive, request-aware resolver (`resolvePrimaryCompanionForJourney`,
 * AEE-XP-001 §10/XP-5) lives in a SEPARATE file —
 * services/journey/primaryCompanionResolver.ts — deliberately, not here.
 * That function statically imports `resolveAigentMeIdentity`
 * (services/agents/aigentMeRoleResolution.ts), which chains through
 * server-only code down to Node's `crypto` module. Keeping it in THIS file
 * previously broke every build touching the KNYTS/CI bridge pages: webpack's
 * client bundler must statically resolve a module's full import graph the
 * moment ANY client component imports ANYTHING from it, even an export the
 * component never calls — so `node:crypto` ended up in the browser bundle
 * and webpack refused it (`UnhandledSchemeError`, 15 consecutive failed
 * deploys, 2026-09-01 incident). Never re-add a server-only import to this
 * file — see primaryCompanionResolver.ts's own header for the fix in full,
 * and tests/journey-copilot-assigned-companion-wiring.test.ts's
 * "client-bundle-safe" canary that now guards this boundary.
 */
