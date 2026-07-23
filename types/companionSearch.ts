/**
 * metaMe Companion — Universal Search result contract.
 *
 * PRD-MMC-IMPL-002 Increment 1 (RATIFIED 2026-07-23).
 * See: codexes/packs/agentiq/updates/2026-07-23_prd-mmc-impl-002-companion-phase3-implementation-plan.md §3.
 *
 * A sibling, browser-safe type module (mirrors `types/companionObserver.ts`'s
 * own rationale for being separate from route/service files): the search
 * façade (`app/api/companion/search/route.ts`) and its UI consumer
 * (`components/companion/CompanionSearchPanel.tsx`) both need the exact same
 * result shape, and a Next.js `route.ts` file should only export its HTTP
 * handlers + segment config — not be a type-import target for client
 * components. This file is that shared contract instead.
 *
 * TIER DISCIPLINE: every field is either (a) copied verbatim from a source
 * that already returns it to its own existing callers (title/subtitle
 * strings, T2-safe ref ids), or (b) this façade's own static routing
 * metadata (`target`), which carries no identifier of any kind. No T0 field
 * belongs here, ever.
 */

export type CompanionSearchSource =
  | 'research'
  | 'registry-iqube'
  | 'registry-asset'
  | 'registry-library'
  | 'capability';

/** Static, identifier-free routing metadata for `buildCodexUrl(target.slug, { tab: target.tab, ... })`. */
export interface CompanionSearchTarget {
  slug: string;
  tab?: string;
}

export interface CompanionSearchResult {
  source: CompanionSearchSource;
  title: string;
  subtitle?: string;
  /** T2-safe reference id from the underlying source (never a T0 identifier). */
  ref: string;
  target: CompanionSearchTarget;
}
