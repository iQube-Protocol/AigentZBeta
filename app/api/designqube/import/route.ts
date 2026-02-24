import { NextRequest, NextResponse } from "next/server";
import {
  importFromCSS,
  importFromFigma,
  importFromXD,
} from "@/app/services/designParity/DesignQubeImporters";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceType } = body ?? {};

    if (sourceType === "css") {
      const { cssText, sourceLabel, sourceLocation } = body;
      if (!cssText) {
        return NextResponse.json({ error: "cssText is required" }, { status: 400 });
      }
      const result = importFromCSS({ cssText, sourceLabel, sourceLocation });
      return NextResponse.json({ success: true, data: result });
    }

    if (sourceType === "figma") {
      const { fileKey, accessToken, fileJson, sourceLabel } = body;
      const result = await importFromFigma({ fileKey, accessToken, fileJson, sourceLabel });
      return NextResponse.json({ success: true, data: result });
    }

    if (sourceType === "xd") {
      const { xdJson, sourceLabel } = body;
      if (!xdJson) {
        return NextResponse.json({ error: "xdJson is required" }, { status: 400 });
      }
      const parsed = typeof xdJson === "string" ? JSON.parse(xdJson) : xdJson;
      const result = importFromXD({ xdJson: parsed, sourceLabel });
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json(
      { error: "Unknown sourceType. Use css | figma | xd." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[DesignQube Import] error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
