/**
 * Universal Search federation — the fan-out/rank/merge core behind
 * `GET /api/companion/search` (PRD-MMC-IMPL-002 Increment 1, RATIFIED
 * 2026-07-23) AND behind the Constitutional Overlay's registry-match lookup
 * (Increment 2, Step 2) — extracted into a service module so both callers
 * share ONE registry-matching implementation (CLAUDE.md "Extend, Don't
 * Duplicate") rather than the Overlay re-querying the registry a second way.
 *
 * See: codexes/packs/agentiq/updates/2026-07-23_prd-mmc-impl-002-companion-phase3-implementation-plan.md §3.
 *
 * Reimplements NO underlying table read — each `search*` function only
 * federates, ranks, and shapes for display, calling the exact functions the
 * named existing route already calls:
 *
 *   - IRL research overview   → `buildResearchOverview()` (`services/research/publicReads.ts`),
 *     the exact function `GET /api/research/overview` itself calls.
 *   - Registry — canonical iQubes → `listIQubes()` + `resolveIQube(..., { projection: 'public' })`
 *     (`services/registry/resolver.ts`), the exact functions
 *     `GET /api/registry/iqube?expand=public` itself calls.
 *   - Registry — published assets → `listAssets()` (`services/registry/persistence.ts`),
 *     the exact function `GET /api/registry/assets` itself calls (its own
 *     `search` filter param is reused directly — same substring matcher,
 *     not a second implementation of it).
 *   - Registry — personal library → `GET /api/registry/library` itself, via an
 *     internal same-origin HTTP call. Unlike the other three sources, this
 *     route's read logic is NOT factored into a separate importable service
 *     function (it inlines its own raw Supabase REST calls keyed by a legacy
 *     `userId` query param, pre-dating the identity spine) — so there is no
 *     function to import here without duplicating that inline logic. Calling
 *     the route itself is the "Extend, Don't Duplicate" choice. The caller's
 *     `personaId` is passed as `userId`; if that id space doesn't match
 *     whatever wrote `user_library.user_id` for a given account, the result
 *     is an empty (not incorrect-account) list — a librarian scoped by id
 *     equality can only ever under-return, never leak another caller's rows.
 *   - Capability graph → `buildCapabilityGraph()` (`services/capability/capabilityGraph.ts`),
 *     the PURE, synchronous producer/edge builder — deliberately NOT
 *     `recommendProducers()`. `recommendProducers(capability, tier)` answers
 *     "who can produce THIS ONE named capability at THIS tier", which needs a
 *     capability id chosen in advance; a free-text search has no such id to
 *     supply. `buildCapabilityGraph().producers` is the same module's own
 *     pure producer list (id/kind/label/ref — already T2-safe, no async
 *     standing lookups) and is exactly the shape a title/label keyword match
 *     needs. Documented as a judgment call, not a silent scope change.
 *
 * Ranking: substring/keyword match on title (and, where present, subtitle)
 * only — no ML/embedding ranking (explicit non-goal, plan §4). Results whose
 * title starts with the query rank above results that merely contain it;
 * ties keep source-then-title order.
 *
 * T1/T2 discipline: every field below is copied from what the underlying
 * source already returns to its own existing callers (display_name/name/
 * label/claim/hypothesis strings, T2-safe iqube_id/assetId/producer-id refs).
 * `target` is NOT source data — it's this façade's own static routing
 * metadata (a codex slug + tab), added so the client can build a deep link
 * via `buildCodexUrl()`. It carries no identifier of any kind.
 */

import { buildResearchOverview } from '@/services/research/publicReads';
import { listAssets } from '@/services/registry/persistence';
import { listGoogleConnectorAssetSummaries } from '@/services/registry/googleConnectorCatalog';
import { listIQubes, resolveIQube } from '@/services/registry/resolver';
import { buildCapabilityGraph } from '@/services/capability/capabilityGraph';
import type { ResearchExperiment, ResearchSeries } from '@/types/research';
import type { RegistryPublicView } from '@/types/registry-canonical';
import type { CompanionSearchResult, CompanionSearchTarget } from '@/types/companionSearch';

// ─── Ranking ────────────────────────────────────────────────────────────────

function matchIndex(haystack: string, needle: string): number {
  return haystack.toLowerCase().indexOf(needle);
}

function matches(result: Pick<CompanionSearchResult, 'title' | 'subtitle'>, needle: string): boolean {
  const hay = `${result.title} ${result.subtitle ?? ''}`;
  return matchIndex(hay, needle) >= 0;
}

/** Substring/keyword rank only — no ML/embedding ranking (plan §4 non-goal). */
export function rankSearchResults(
  results: CompanionSearchResult[],
  query: string,
): CompanionSearchResult[] {
  const needle = query.toLowerCase();
  return [...results].sort((a, b) => {
    const ai = matchIndex(a.title, needle);
    const bi = matchIndex(b.title, needle);
    const aTitleHit = ai >= 0 ? ai : Number.MAX_SAFE_INTEGER;
    const bTitleHit = bi >= 0 ? bi : Number.MAX_SAFE_INTEGER;
    if (aTitleHit !== bTitleHit) return aTitleHit - bTitleHit;
    return a.title.localeCompare(b.title);
  });
}

// ─── Source 1 — IRL research overview ──────────────────────────────────────

export const RESEARCH_TARGET: CompanionSearchTarget = { slug: 'irl-cartridge', tab: 'irl-dashboard' };

function readSeriesList(overview: Record<string, unknown>): ResearchSeries[] {
  return Array.isArray(overview.series) ? (overview.series as ResearchSeries[]) : [];
}

function readExperimentEntries(
  overview: Record<string, unknown>,
): Array<{ experiment: ResearchExperiment }> {
  return Array.isArray(overview.experiments)
    ? (overview.experiments as Array<{ experiment: ResearchExperiment }>)
    : [];
}

export async function searchResearch(query: string): Promise<CompanionSearchResult[]> {
  const overview = await buildResearchOverview(new Date().toISOString());
  const out: CompanionSearchResult[] = [];

  for (const series of readSeriesList(overview)) {
    const candidate: CompanionSearchResult = {
      source: 'research',
      title: series.name,
      subtitle: series.claim,
      ref: series.id,
      target: RESEARCH_TARGET,
    };
    if (matches(candidate, query)) out.push(candidate);
  }

  for (const entry of readExperimentEntries(overview)) {
    const exp = entry.experiment;
    if (!exp) continue;
    const candidate: CompanionSearchResult = {
      source: 'research',
      title: `${exp.family} (${exp.id})`,
      subtitle: exp.hypothesis,
      ref: exp.id,
      target: RESEARCH_TARGET,
    };
    if (matches(candidate, query)) out.push(candidate);
  }

  return out;
}

// ─── Source 2 — Registry: canonical iQubes ─────────────────────────────────

export const REGISTRY_TARGET: CompanionSearchTarget = { slug: 'iqube-registry', tab: 'browse' };

/** Bounds hydration cost — the same `resolveIQube` call the route's own
 *  `expand=public` path makes per entry, capped tighter here since this is a
 *  fan-out alongside three other reads, not a dedicated catalog page load. */
const REGISTRY_IQUBE_HYDRATE_LIMIT = 100;

function isRegistryPublicView(value: unknown): value is RegistryPublicView {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { display_name?: unknown }).display_name === 'string' &&
    typeof (value as { iqube_id?: unknown }).iqube_id === 'string'
  );
}

export async function searchRegistryIQube(query: string): Promise<CompanionSearchResult[]> {
  const { entries } = await listIQubes({ limit: REGISTRY_IQUBE_HYDRATE_LIMIT });
  const hydrated = await Promise.all(
    entries.map((entry) =>
      resolveIQube(entry.iqube_id, { projection: 'public', allowPrivate: false }).catch(() => null),
    ),
  );

  const out: CompanionSearchResult[] = [];
  for (const view of hydrated) {
    if (!isRegistryPublicView(view)) continue;
    const candidate: CompanionSearchResult = {
      source: 'registry-iqube',
      title: view.display_name,
      subtitle: view.display_description,
      ref: view.iqube_id,
      target: REGISTRY_TARGET,
    };
    if (matches(candidate, query)) out.push(candidate);
  }
  return out;
}

// ─── Source 3 — Registry: published assets ─────────────────────────────────

export async function searchRegistryAsset(query: string): Promise<CompanionSearchResult[]> {
  // Reuses `listAssets`'s own `search` filter — the same substring matcher
  // `GET /api/registry/assets` already applies — never a second
  // implementation of that match.
  const assets = await listAssets({ search: query, limit: 50, offset: 0 });

  // Mirrors the route's own seed-catalog merge (Google Workspace
  // ConnectorQube seed entries) so this façade returns the same asset set
  // the route itself would for the same query — never a second, divergent
  // implementation of that merge.
  const liveIds = new Set(assets.map((a) => a.assetId));
  const needle = query.toLowerCase();
  for (const seed of listGoogleConnectorAssetSummaries()) {
    if (liveIds.has(seed.assetId)) continue;
    const hay = `${seed.name} ${seed.description ?? ''}`.toLowerCase();
    if (hay.includes(needle)) assets.push(seed);
  }

  return assets.map((asset) => ({
    source: 'registry-asset' as const,
    title: asset.name,
    subtitle: asset.description,
    ref: asset.assetId,
    target: REGISTRY_TARGET,
  }));
}

// ─── Source 4 — Registry: personal library ─────────────────────────────────

interface LibraryRow {
  template_id?: string;
  id?: string;
  iqube_templates?: { name?: string; description?: string } | null;
}

export async function searchRegistryLibrary(
  query: string,
  personaId: string,
  origin: string,
): Promise<CompanionSearchResult[]> {
  try {
    const url = new URL('/api/registry/library', origin);
    url.searchParams.set('userId', personaId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    const body: unknown = await res.json();
    if (!Array.isArray(body)) return [];

    const out: CompanionSearchResult[] = [];
    for (const row of body as LibraryRow[]) {
      const name = row.iqube_templates?.name;
      if (!name) continue;
      const candidate: CompanionSearchResult = {
        source: 'registry-library',
        title: name,
        subtitle: row.iqube_templates?.description,
        ref: String(row.template_id ?? row.id ?? name),
        target: REGISTRY_TARGET,
      };
      if (matches(candidate, query)) out.push(candidate);
    }
    return out;
  } catch {
    return []; // best-effort source — a federated search degrades, never fails, on one source's error
  }
}

// ─── Source 5 — Capability graph producers ─────────────────────────────────

export const CAPABILITY_TARGET: CompanionSearchTarget = { slug: 'agentiq', tab: 'capability-pipeline' };

export function searchCapability(query: string): CompanionSearchResult[] {
  const { producers } = buildCapabilityGraph();
  const out: CompanionSearchResult[] = [];
  for (const producer of producers) {
    const candidate: CompanionSearchResult = {
      source: 'capability',
      title: producer.label,
      subtitle: producer.kind,
      ref: producer.id,
      target: CAPABILITY_TARGET,
    };
    if (matches(candidate, query)) out.push(candidate);
  }
  return out;
}

// ─── Full fan-out — the one entry point `/api/companion/search` calls ─────

export async function federateSearch(
  query: string,
  personaId: string,
  origin: string,
): Promise<CompanionSearchResult[]> {
  const [research, registryIQube, registryAsset, registryLibrary, capability] = await Promise.all([
    searchResearch(query).catch(() => []),
    searchRegistryIQube(query).catch(() => []),
    searchRegistryAsset(query).catch(() => []),
    searchRegistryLibrary(query, personaId, origin).catch(() => []),
    Promise.resolve(searchCapability(query)).catch(() => []),
  ]);

  return rankSearchResults(
    [...research, ...registryIQube, ...registryAsset, ...registryLibrary, ...capability],
    query,
  );
}
