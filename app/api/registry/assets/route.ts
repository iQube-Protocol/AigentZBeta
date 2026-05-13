import { NextRequest, NextResponse } from "next/server";
import { listAssets } from "@/services/registry/persistence";
import { listGoogleConnectorAssetSummaries } from "@/services/registry/googleConnectorCatalog";
import type { AssetListFilter, RegistryAssetClass, RegistryAssetSummary, TrustBand, PolicyClass } from "@/types/registryIngestion";

/** Match a seed catalog entry against the same filter the live `listAssets`
 *  applies. Lets seed connectors appear in `?assetClass=ConnectorQube` and
 *  `?search=` queries identically to real registry rows. */
function matchesFilter(asset: RegistryAssetSummary, filter: AssetListFilter): boolean {
  if (filter.assetClass && asset.assetClass !== filter.assetClass) return false;
  if (filter.trustBand && asset.trustBand !== filter.trustBand) return false;
  if (filter.publicationStatus && asset.publicationStatus !== filter.publicationStatus) return false;
  if (filter.policyClass && asset.policyClass !== filter.policyClass) return false;
  if (filter.search) {
    const needle = filter.search.toLowerCase();
    const hay = `${asset.name} ${asset.description ?? ""}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

/** GET /api/registry/assets — list/search published assets */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const filter: AssetListFilter = {
      tenantId: searchParams.get("tenantId") ?? undefined,
      assetClass: (searchParams.get("assetClass") as RegistryAssetClass) || undefined,
      trustBand: (searchParams.get("trustBand") as TrustBand) || undefined,
      publicationStatus: searchParams.get("publicationStatus") || undefined,
      policyClass: (searchParams.get("policyClass") as PolicyClass) || undefined,
      search: searchParams.get("search") || undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50,
      offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0,
    };

    const assets = await listAssets(filter);

    // Phase 6.b — merge Google Workspace ConnectorQube seed catalog so the
    // Factory UI lists them alongside live registry rows. Seed entries
    // carry `publicationStatus: 'seed'` so operators can distinguish them
    // and promote any subset via intake when ready. Skipped when the
    // caller filters by a tenant other than the catalog's ('metame').
    const wantSeed = !filter.tenantId || filter.tenantId === "metame";
    if (wantSeed) {
      const liveIds = new Set(assets.map((a) => a.assetId));
      for (const seed of listGoogleConnectorAssetSummaries()) {
        if (liveIds.has(seed.assetId)) continue; // already promoted into live registry
        if (matchesFilter(seed, filter)) assets.push(seed);
      }
    }

    return NextResponse.json({ ok: true, data: assets, count: assets.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("42P01") || msg.includes("does not exist") || msg.includes("relation") || msg.includes("parse") || msg.includes("filter")) {
      return NextResponse.json({ ok: true, data: [], count: 0, _note: "query_error" });
    }
    console.error("[registry/assets] GET error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
