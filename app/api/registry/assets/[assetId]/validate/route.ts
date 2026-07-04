import { NextRequest, NextResponse } from "next/server";
import { runValidation } from "@/services/registry/validatorService";
import { scoreAsset } from "@/services/registry/trustScorerService";
import {
  getLatestValidation,
  listValidationsForAsset,
  listArtifactsForValidation,
} from "@/services/registry/persistence";

type Params = { params: Promise<{ assetId: string }> };

/**
 * GET /api/registry/assets/[assetId]/validate
 * Returns the latest completed validation with its artifacts.
 * ?history=1 returns all validations for the asset.
 * ?validationId=xxx&artifacts=1 returns artifacts for a specific validation.
 */
export async function GET(req: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const { searchParams } = new URL(req.url);
    const history = searchParams.get("history") === "1";
    const validationId = searchParams.get("validationId");
    const withArtifacts = searchParams.get("artifacts") === "1";

    if (history) {
      const validations = await listValidationsForAsset(params.assetId);
      return NextResponse.json({ ok: true, data: validations });
    }

    if (validationId && withArtifacts) {
      const artifacts = await listArtifactsForValidation(validationId);
      return NextResponse.json({ ok: true, data: artifacts });
    }

    // Default: latest validation + its artifacts
    const validation = await getLatestValidation(params.assetId);
    if (!validation) {
      return NextResponse.json({ ok: false, error: "No validation found" }, { status: 404 });
    }

    if (withArtifacts) {
      const artifacts = await listArtifactsForValidation(validation.validationId);
      return NextResponse.json({ ok: true, data: { validation, artifacts } });
    }

    return NextResponse.json({ ok: true, data: validation });
  } catch (err) {
    console.error("[registry/assets/validate] GET error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/registry/assets/[assetId]/validate — trigger validation + trust scoring */
export async function POST(req: NextRequest, props: Params) {
  const params = await props.params;
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
