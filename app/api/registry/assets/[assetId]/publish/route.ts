import { NextRequest, NextResponse } from "next/server";
import { publishAsset } from "@/services/registry/publisherService";
import { getAsset } from "@/services/registry/persistence";

type Params = { params: Promise<{ assetId: string }> };

/** POST /api/registry/assets/[assetId]/publish */
export async function POST(req: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const body = await req.json() as {
      publishedBy?: string;
      tenantId?: string;
      validationId?: string;
      notes?: string;
      force?: boolean;
    };

    if (!body.publishedBy || !body.tenantId) {
      return NextResponse.json({ ok: false, error: "publishedBy and tenantId are required" }, { status: 400 });
    }

    // Tenant-scope gate: verify caller's tenant matches the asset's tenant
    const asset = await getAsset(params.assetId);
    if (!asset) {
      return NextResponse.json({ ok: false, error: "Asset not found" }, { status: 404 });
    }
    if (asset.tenantId !== body.tenantId) {
      return NextResponse.json({ ok: false, error: "Forbidden: asset does not belong to this tenant" }, { status: 403 });
    }

    const result = await publishAsset(params.assetId, body.publishedBy, {
      validationId: body.validationId,
      notes: body.notes,
      force: body.force ?? false,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
    }

    return NextResponse.json({ ok: true, data: { publicationId: result.publicationId } });
  } catch (err) {
    console.error("[registry/assets/publish] POST error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
