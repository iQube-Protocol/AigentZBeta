import { NextRequest, NextResponse } from "next/server";
import { publishAsset } from "@/services/registry/publisherService";

type Params = { params: { assetId: string } };

/** POST /api/registry/assets/[assetId]/publish */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json() as {
      publishedBy?: string;
      validationId?: string;
      notes?: string;
      force?: boolean;
    };

    if (!body.publishedBy) {
      return NextResponse.json({ ok: false, error: "publishedBy is required" }, { status: 400 });
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
