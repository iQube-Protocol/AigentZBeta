import { NextRequest, NextResponse } from "next/server";
import { loadDesignQube } from "@/services/metame/designQubeLoader";
import { DISGenerator } from "@/app/services/designParity/DesignIntentSpec";
import { ConstraintManifestGenerator } from "@/app/services/designParity/ConstraintManifest";
import { analyzeDesignGap } from "@/app/services/designParity/DesignGapCheck";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      designQube: designQubePayload,
      designQubeId,
      templateRegistry,
      options,
    } = body ?? {};

    const designQube =
      designQubePayload ??
      (await loadDesignQube({
        id: designQubeId || undefined,
        includeImages: false,
      }));

    if (!designQube) {
      return NextResponse.json({ error: "DesignQube is required" }, { status: 400 });
    }

    const dis = await DISGenerator.generateFromDesignQube(
      designQube,
      templateRegistry || [],
      options || {}
    );
    const cm = ConstraintManifestGenerator.generateFromDIS(dis);
    const gapReport = analyzeDesignGap({ designQube, dis, cm });

    return NextResponse.json({
      success: true,
      data: {
        gapReport,
        dis,
        cm,
      },
    });
  } catch (error: any) {
    console.error("[Design Gap Check] error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
