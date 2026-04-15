import { NextRequest, NextResponse } from "next/server";
import { listAssets } from "@/services/registry/persistence";
import type { AssetListFilter, RegistryAssetClass, TrustBand, PolicyClass } from "@/types/registryIngestion";

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
