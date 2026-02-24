import { NextResponse } from "next/server";
import { loadDesignQube } from "../../../../services/metame/designQubeLoader";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const includeImages = searchParams.get("includeImages") === "1";
    const id = searchParams.get("id") || undefined;

    const designQube = await loadDesignQube({
      id,
      includeImages,
    });

    return NextResponse.json({
      success: true,
      designQube,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to load design qube",
      },
      { status: 500 }
    );
  }
}
