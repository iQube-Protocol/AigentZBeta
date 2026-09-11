/**
 * Capability Discovery bridge (CFS-015, Strand Two, Phase 2).
 *
 * Implements the CapabilityService contract (types/constitutional.ts §1):
 * bridges the registry trust-scoring subsystem to a discovery/ranking path —
 * "which registered assets can serve these requested capabilities, ranked by
 * trust, and where are the gaps?"
 *
 * Reads registry_assets through the same Supabase server pattern as
 * services/registry/persistence.ts (never a parallel client). Column names
 * verified against that module: registry_assets carries asset_id, name,
 * capabilities (CapabilityDescriptor[] jsonb), current_version; the numeric
 * trust score lives in registry_trust_scores.numeric_score (latest row per
 * asset). Trust enrichment is best-effort — a failed score lookup degrades
 * to trustScore: null, it does not fail discovery.
 *
 * Honest envelope (CFS-014 precedent): infrastructure failure (no client,
 * query error) → { evaluated: false, reason }. Zero matches from a WORKING
 * query is a real answer → evaluated: true with gaps.
 *
 * Server-only.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type {
  CapabilityGapReport,
  CapabilityMatch,
  MaybeEvaluated,
} from '@/types/constitutional';

interface AssetRow {
  asset_id: string;
  name: string;
  capabilities: unknown;
  current_version: string | null;
}

/** Capability names from a registry_assets.capabilities jsonb value —
 * CapabilityDescriptor[] per types/registryIngestion.ts, with a defensive
 * plain-string branch for hand-seeded rows. */
function capabilityNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const names: string[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string' && entry.trim()) names.push(entry.trim());
    else if (
      entry &&
      typeof entry === 'object' &&
      typeof (entry as { name?: unknown }).name === 'string'
    ) {
      names.push((entry as { name: string }).name);
    }
  }
  return names;
}

/** Case-insensitive substring/token match. */
function matchesText(haystack: string, needle: string): boolean {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase().trim();
  if (!h || !n) return false;
  if (h.includes(n) || n.includes(h)) return true;
  const tokens = n.split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
  return tokens.length > 0 && tokens.every((t) => h.includes(t));
}

function assetServes(asset: AssetRow, requested: string): boolean {
  for (const cap of capabilityNames(asset.capabilities)) {
    if (matchesText(cap, requested)) return true;
  }
  // Name as fallback signal.
  return matchesText(asset.name ?? '', requested);
}

export async function discoverCapabilities(
  requested: string[],
): Promise<MaybeEvaluated<{ report: CapabilityGapReport }>> {
  const cleaned = Array.from(
    new Set(requested.filter((r) => typeof r === 'string' && r.trim().length > 0).map((r) => r.trim())),
  );
  if (cleaned.length === 0) {
    return {
      evaluated: true,
      report: { requested: [], matches: [], gaps: [], recommendation: null },
    };
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return { evaluated: false, reason: 'Supabase configuration missing — registry_assets unreachable' };
  }

  const { data, error } = await supabase
    .from('registry_assets')
    .select('asset_id,name,capabilities,current_version')
    .limit(500);
  if (error) {
    return { evaluated: false, reason: `registry_assets query failed: ${error.message}` };
  }
  const assets = (data ?? []) as AssetRow[];

  // Match each request against every asset; collect per-request top data and
  // the union of matched assets for the report's matches list.
  const matchedAssets = new Map<string, AssetRow>();
  const perRequest = new Map<string, AssetRow[]>();
  for (const req of cleaned) {
    const hits = assets.filter((a) => assetServes(a, req));
    perRequest.set(req, hits);
    for (const hit of hits) matchedAssets.set(hit.asset_id, hit);
  }

  // Best-effort trust enrichment: latest numeric_score per matched asset from
  // registry_trust_scores (column names per services/registry/persistence.ts).
  const trustByAsset = new Map<string, number>();
  const matchedIds = Array.from(matchedAssets.keys());
  if (matchedIds.length > 0) {
    const { data: scoreRows, error: scoreError } = await supabase
      .from('registry_trust_scores')
      .select('asset_id,numeric_score,created_at')
      .in('asset_id', matchedIds)
      .order('created_at', { ascending: false });
    if (!scoreError) {
      for (const row of (scoreRows ?? []) as { asset_id: string; numeric_score: unknown }[]) {
        if (trustByAsset.has(row.asset_id)) continue; // rows are newest-first
        const score = Number(row.numeric_score);
        if (Number.isFinite(score)) trustByAsset.set(row.asset_id, score);
      }
    }
    // scoreError → degrade to trustScore null; discovery itself still holds.
  }

  const matches: CapabilityMatch[] = Array.from(matchedAssets.values()).map((a) => ({
    assetId: a.asset_id,
    name: a.name,
    capabilities: capabilityNames(a.capabilities),
    trustScore: trustByAsset.get(a.asset_id) ?? null,
    version: a.current_version ?? null,
  }));
  // Rank by trustScore desc, nulls last; name as a stable tiebreak.
  matches.sort((a, b) => {
    if (a.trustScore === null && b.trustScore === null) return a.name.localeCompare(b.name);
    if (a.trustScore === null) return 1;
    if (b.trustScore === null) return -1;
    if (b.trustScore !== a.trustScore) return b.trustScore - a.trustScore;
    return a.name.localeCompare(b.name);
  });

  const gaps = cleaned.filter((req) => (perRequest.get(req) ?? []).length === 0);

  // One-line recommendation: the top-ranked match per served request.
  const rankIndex = new Map(matches.map((m, i) => [m.assetId, i]));
  const served = cleaned.filter((req) => (perRequest.get(req) ?? []).length > 0);
  const recommendation =
    served.length === 0
      ? null
      : served
          .map((req) => {
            const top = (perRequest.get(req) ?? [])
              .slice()
              .sort(
                (a, b) =>
                  (rankIndex.get(a.asset_id) ?? Number.MAX_SAFE_INTEGER) -
                  (rankIndex.get(b.asset_id) ?? Number.MAX_SAFE_INTEGER),
              )[0];
            return `${req} → ${top.name}`;
          })
          .join('; ');

  return {
    evaluated: true,
    report: { requested: cleaned, matches, gaps, recommendation },
  };
}
