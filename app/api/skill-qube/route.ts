import { NextRequest, NextResponse } from "next/server";
import { listAssets } from "@/services/registry/persistence";
import type { AssetListFilter, TrustBand, PolicyClass } from "@/types/registryIngestion";

/**
 * GET /api/skill-qube
 *
 * Thin wrapper over /api/registry/assets pre-filtered to assetClass=SkillQube.
 *
 * Query params:
 *   tenantId, trustBand, publicationStatus, policyClass, limit, offset
 *   search — partial match on name or description (e.g. "know1" for Know1's skills)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const filter: AssetListFilter = {
      assetClass: "SkillQube",
      tenantId: searchParams.get("tenantId") ?? undefined,
      trustBand: (searchParams.get("trustBand") as TrustBand) || undefined,
      // Default to published-only in alpha; pass publicationStatus=all to bypass
      publicationStatus:
        searchParams.get("publicationStatus") === "all"
          ? undefined
          : (searchParams.get("publicationStatus") || "published"),
      policyClass: (searchParams.get("policyClass") as PolicyClass) || undefined,
      // search="know1" is the idiomatic way to get Know1's skill family
      search: searchParams.get("search") || undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50,
      offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0,
    };

    const skills = await listAssets(filter);
    return NextResponse.json({ ok: true, data: skills, count: skills.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("42P01") || msg.includes("does not exist") || msg.includes("relation")) {
      return NextResponse.json({ ok: true, data: [], count: 0, _note: "table_pending" });
    }
    console.error("[skill-qube] GET error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
