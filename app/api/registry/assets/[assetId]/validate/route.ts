import { NextRequest, NextResponse } from "next/server";
import { runValidation } from "@/services/registry/validatorService";
import { scoreAsset } from "@/services/registry/trustScorerService";

type Params = { params: { assetId: string } };

/** POST /api/registry/assets/[assetId]/validate — trigger validation + trust scoring */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json() as { triggeredBy?: string };
    const triggeredBy = body.triggeredBy ?? "system";

    const valResult = await runValidation(params.assetId, triggeredBy);
    if (!valResult.ok || !valResult.validationId) {
      return NextResponse.json({ ok: false, error: valResult.error }, { status: 422 });
    }

    const scoreResult = await scoreAsset(params.assetId, valResult.validationId, triggeredBy);
    if (!scoreResult.ok) {
      return NextResponse.json({ ok: false, error: scoreResult.error }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        validationId: valResult.validationId,
        overallResult: valResult.overallResult,
        trustBandCap: valResult.trustBandCap,
        score: scoreResult.score,
      },
    });
  } catch (err) {
    console.error("[registry/assets/validate] POST error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
