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
    console.error("[registry/assets] GET error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
