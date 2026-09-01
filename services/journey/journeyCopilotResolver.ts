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

import type { NextRequest } from 'next/server';
import { getCodexBySlug } from '@/data/codex-configs';
import type { JourneyDefinition } from '@/types/journey';
import { resolveAigentMeIdentity, DEFAULT_AIGENT_ME_IDENTITY } from '@/services/agents/aigentMeRoleResolution';

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
 * resolver — every existing call site and canary that depends on that
 * (tests/*-journey-copilot*.test.ts) keeps working unchanged.
 *
 * This is the ADDITIVE resolver for AEE-XP-001 §10/XP-5 ("the current role
 * occupant is resolved from canonical persona assignment, never guessed from
 * surface-local configuration"): server-side, it asks the SAME existing
 * `resolveAigentMeIdentity` every chat surface already uses (services/agents/
 * aigentMeRoleResolution.ts) which real agent is currently assigned as this
 * caller's aigentMe, and — only when that resolves to something OTHER than
 * the generic default (i.e. the citizen actually has an assignment) —
 * returns that identity as the PRIMARY companion instead of the journey's
 * static cartridge default.
 *
 * Canonical distinction preserved (spec §10): this NEVER changes which
 * SPECIALIST a journey stage foregrounds (Kn0w1 on KNYTS, MoneyPenny on
 * Financial Services) — it only changes who a journey's OWN copilot
 * identity resolves to, for the person-level orchestrator role. A caller
 * with no request context (anonymous, or a route that can't resolve one)
 * gets exactly `resolveJourneyCopilot`'s existing static behaviour — this
 * function never throws and never blocks on a missing assignment.
 */
export async function resolvePrimaryCompanionForJourney(
  request: NextRequest,
  journey: JourneyDefinition,
): Promise<ResolvedJourneyCopilot> {
  const fallback = resolveJourneyCopilot(journey);
  try {
    const identity = await resolveAigentMeIdentity(request);
    if (identity.personaKey === DEFAULT_AIGENT_ME_IDENTITY.personaKey && identity.agentRootId === null) {
      // No real assignment resolved — the citizen's canonical companion IS
      // the generic default, so the journey's static cartridge copilot
      // (already the generic aigentMe/specialist for this Bridge) is
      // already correct. Nothing to override.
      return fallback;
    }
    return {
      agent: { id: identity.personaKey, name: identity.displayLabel },
      accentColor: fallback.accentColor,
      promptPlaceholder: fallback.promptPlaceholder,
      quickPrompts: fallback.quickPrompts,
    };
  } catch {
    // Resolution error — fail open to the existing static behaviour, never
    // block or throw over a voice/routing choice (same discipline
    // resolveAigentMeIdentity itself documents).
    return fallback;
  }
}
