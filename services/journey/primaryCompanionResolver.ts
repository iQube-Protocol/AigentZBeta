/**
 * primaryCompanionResolver — the server-only additive companion resolver
 * (AEE-XP-001 §10/XP-5).
 *
 * SPLIT OUT of journeyCopilotResolver.ts (2026-09-01 incident fix): this
 * function statically imports `resolveAigentMeIdentity`
 * (services/agents/aigentMeRoleResolution.ts), which chains through
 * `getActivePersona` -> `constitutionalContext.ts` -> `personaSessionToken.ts`
 * -> Node's `crypto` module. `journeyCopilotResolver.ts`'s PURE
 * `resolveJourneyCopilot` is imported directly by `JourneyCopilotHost.tsx`
 * (a `'use client'` component). Keeping both functions in one file meant
 * webpack's CLIENT bundler had to statically resolve the whole module graph
 * — including `node:crypto` — the moment `JourneyCopilotHost` imported
 * ANYTHING from that file, even though it never called this function.
 * Webpack cannot bundle `node:` scheme imports for the browser target, so
 * every build touching `app/bridge/knyts` or `app/bridge/ci` failed with
 * `UnhandledSchemeError: Reading from "node:crypto" is not handled by
 * plugins` (15 consecutive failed Amplify deploys, 2026-09-01).
 *
 * This file exists ONLY to be imported by request-bearing SERVER code
 * (journey `state` API routes) — never by a client component. If you're
 * tempted to import this from a `'use client'` file, resolve the identity
 * server-side instead and pass it down as a prop
 * (`JourneyRuntimeState.resolvedCompanionAgent`), exactly as every existing
 * call site already does.
 */

import type { NextRequest } from 'next/server';
import type { JourneyDefinition } from '@/types/journey';
import { resolveJourneyCopilot, type ResolvedJourneyCopilot } from '@/services/journey/journeyCopilotResolver';
import { resolveAigentMeIdentity, DEFAULT_AIGENT_ME_IDENTITY } from '@/services/agents/aigentMeRoleResolution';

/**
 * `resolveJourneyCopilot` (journeyCopilotResolver.ts) stays a PURE,
 * synchronous, config-only resolver — every existing call site and canary
 * that depends on that (tests/*-journey-copilot*.test.ts) keeps working
 * unchanged.
 *
 * This is the ADDITIVE resolver for AEE-XP-001 §10/XP-5 ("the current role
 * occupant is resolved from canonical persona assignment, never guessed from
 * surface-local configuration"): server-side, it asks the SAME existing
 * `resolveAigentMeIdentity` every chat surface already uses which real agent
 * is currently assigned as this caller's aigentMe, and — only when that
 * resolves to something OTHER than the generic default (i.e. the citizen
 * actually has an assignment) — returns that identity as the PRIMARY
 * companion instead of the journey's static cartridge default.
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
