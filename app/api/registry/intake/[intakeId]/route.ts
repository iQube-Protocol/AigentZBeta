import { NextRequest, NextResponse } from "next/server";
import { getIntake, updateIntake, getSourceByIntake, deleteIntake } from "@/services/registry/persistence";
import { fetchAndFingerprint } from "@/services/registry/fetcherService";
import { classifySource } from "@/services/registry/classifierService";
import { packageAsset } from "@/services/registry/packagerService";

type Params = { params: Promise<{ intakeId: string }> };

/** GET /api/registry/intake/[intakeId] */
export async function GET(_req: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const intake = await getIntake(params.intakeId);
    if (!intake) {
      return NextResponse.json({ ok: false, error: "Intake not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: intake });
  } catch (err) {
    console.error("[registry/intake/id] GET error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/registry/intake/[intakeId]
 * Advance the intake pipeline by specifying an action:
 *   { action: "fetch" }      — run FetcherService
 *   { action: "classify" }   — run ClassifierService (requires sourceId)
 *   { action: "package" }    — run PackagerService (requires sourceId + classification)
 */
export async function POST(req: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const body = await req.json() as Record<string, unknown>;
    const action = body.action as string;
    const intakeId = params.intakeId;

    if (action === "fetch") {
      const result = await fetchAndFingerprint(intakeId);
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
      }
      return NextResponse.json({ ok: true, data: result.source });
    }

    if (action === "classify") {
      const intake = await getIntake(intakeId);
      if (!intake) return NextResponse.json({ ok: false, error: "Intake not found" }, { status: 404 });
      const source = await getSourceByIntake(intakeId);
      if (!source) return NextResponse.json({ ok: false, error: "No source found — run fetch first" }, { status: 422 });

      const result = await classifySource(
        intakeId,
        intake.sourceType,
        source.manifest,
        intake.sourcePayload
      );
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
      }
      return NextResponse.json({ ok: true, data: result.classification });
    }

    if (action === "package") {
      const intake = await getIntake(intakeId);
      if (!intake) return NextResponse.json({ ok: false, error: "Intake not found" }, { status: 404 });
      const source = await getSourceByIntake(intakeId);
      if (!source) return NextResponse.json({ ok: false, error: "No source found — run fetch first" }, { status: 422 });

      // Classification can be provided in body or re-run inline
      let classification = body.classification as Parameters<typeof packageAsset>[3] | undefined;
      if (!classification) {
        const classResult = await classifySource(
          intakeId,
          intake.sourceType,
          source.manifest,
          intake.sourcePayload
        );
        if (!classResult.ok || !classResult.classification) {
          return NextResponse.json({ ok: false, error: "Classification failed" }, { status: 422 });
        }
        classification = classResult.classification;
      }

      const result = await packageAsset(
        intakeId,
        source.sourceId,
        source.manifest,
        classification,
        intake.sourcePayload
      );
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
      }
      return NextResponse.json({ ok: true, data: { assetId: result.assetId } }, { status: 201 });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("[registry/intake/id] POST error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/registry/intake/[intakeId]
 * Removes an intake that has NOT been published to the registry.
 * Published items (currentStage = "asset.published") are rejected to prevent
 * orphaning live registry entries.
 */
export async function DELETE(_req: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const intake = await getIntake(params.intakeId);
    if (!intake) {
      return NextResponse.json({ ok: false, error: "Intake not found" }, { status: 404 });
    }
    if (intake.currentStage === "asset.published") {
      return NextResponse.json(
        { ok: false, error: "Cannot delete a published intake. Revoke the registry asset first." },
        { status: 409 }
      );
    }
    await deleteIntake(params.intakeId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[registry/intake/id] DELETE error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
