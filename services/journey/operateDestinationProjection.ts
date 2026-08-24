/**
 * Operate destination projection (Financial Services / AEE reference-surface
 * closeout, 2026-08-24).
 *
 * A thin, reusable journeyId -> destination lookup that lets a journey's
 * Operate-equivalent stage land its embed surface on a SPECIFIC metaMe
 * Catalogue item + default tab, rather than the generic aigentMe welcome
 * shell. Consumed by:
 *   - services/journey/journeySurfaceRegistry.ts (resolves the embed `tab`
 *     for the 'horizen-operate-destination' surface)
 *   - services/adaptive/journeySpineAdapter.ts (feeds the same projection
 *     into AEE's AdaptiveInteractionContext for it to reason over — AEE only
 *     ever READS this map; it never owns or derives it)
 *
 * Journey-scoped only, per the navigation rule this implements: "Journey-
 * scoped destination projection may select and emphasize an existing metaMe
 * Catalogue item and default tab, but may not change constitutional truth,
 * global user configuration, or capability availability." This map never
 * mutates data/activation-catalog.ts, never restricts other catalogue items
 * or tabs, and never becomes a persisted persona preference — it is pure,
 * static, per-journey data read at render/projection time.
 *
 * Generic by construction: adding a destination for a new journey is a new
 * map entry, never new branching logic in the registry or the AEE adapter.
 */

export interface OperateDestination {
  /** data/activation-catalog.ts ACTIVATION_CATALOG id this journey lands on. */
  catalogueItemId: string;
  /** metame-codex tab slug to show by default once that catalogue item is open. */
  defaultTab: string;
  /**
   * Modes reachable FROM the default tab, for AEE/Experience Guide context
   * only — never a hint to default into one of them directly. Optional;
   * omitted when the destination has no sub-mode chooser.
   */
  availableModes?: string[];
}

const JOURNEY_OPERATE_DESTINATIONS: Record<string, OperateDestination> = {
  // Financial Services / Horizen Constitutional Admission Journey
  // (services/journey/horizenMoneyPennyJourney.ts, id 'horizen-moneypenny-
  // admission'). Operate lands on MoneyPenny's Orchestration console — the
  // mode chooser — never directly on Advisor/Architect/Runtime.
  'horizen-moneypenny-admission': {
    catalogueItemId: 'moneypenny',
    defaultTab: 'moneypenny-orchestration',
    availableModes: ['advisor', 'architect', 'runtime'],
  },
};

/** Returns the registered Operate destination for a journey, or null when none is registered — callers must fall back to the generic surface, never guess one. */
export function resolveOperateDestination(journeyId: string): OperateDestination | null {
  return JOURNEY_OPERATE_DESTINATIONS[journeyId] ?? null;
}
