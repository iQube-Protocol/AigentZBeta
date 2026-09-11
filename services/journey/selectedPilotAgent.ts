/**
 * The operator's last-selected Horizen pilot agent — shared, client-side,
 * across every surface that offers an agent selector (Horizen Pilot Closure
 * item 5, 2026-08-09).
 *
 * ── THE GAP THIS CLOSES ──────────────────────────────────────────────────────
 *
 * PilotJourneyTab.tsx already threads `selectedAgentSlug` correctly into
 * every surface it renders (RegisterAgentPanel, PulseTransparencyToggle,
 * MarketaEligibilityView, HorizenAgentPageSurface, the receipts drawer) — a
 * genuine, already-completed genericity fix. But that selection lived only in
 * component-local `useState`, so `JourneyCompanionCarousel` (rendered from a
 * completely different React tree, triggered by the "Horizen" chat word) had
 * no way to know which agent the operator was actually working with on the
 * Journey tab, and silently defaulted to MoneyPenny.
 *
 * This module is the ONE shared, persisted record of that choice — read by
 * the Companion carousel, written by the Journey tab's own selector — so a
 * choice made on one surface is not invisible to the other. Client-only by
 * construction (SSR-safe: every read/write is a no-op when `window` is
 * undefined, and callers still resolve a real default).
 */

import { DEFAULT_REGISTRABLE_AGENT_SLUG, resolveRegistrableAgent } from '@/services/horizen/registrableAgents';

const STORAGE_KEY = 'metame_horizen_pilot_agent_slug';

export function getSelectedPilotAgentSlug(): string {
  if (typeof window === 'undefined') return DEFAULT_REGISTRABLE_AGENT_SLUG;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // Only ever return a slug that still resolves — a stale/foreign value
    // must never be handed to a caller as though it were valid.
    return stored && resolveRegistrableAgent(stored) ? stored : DEFAULT_REGISTRABLE_AGENT_SLUG;
  } catch {
    return DEFAULT_REGISTRABLE_AGENT_SLUG;
  }
}

export function setSelectedPilotAgentSlug(slug: string): void {
  if (typeof window === 'undefined') return;
  if (!resolveRegistrableAgent(slug)) return; // never persist an unresolvable slug
  try {
    window.localStorage.setItem(STORAGE_KEY, slug);
  } catch {
    /* non-fatal — the selection simply won't survive this surface */
  }
}
