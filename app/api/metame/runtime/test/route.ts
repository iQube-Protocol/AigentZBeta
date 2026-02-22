import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET(request: NextRequest) {
  try {
    const CONFIG_DIR = path.resolve("configs/qriptopian");
    const MATRIX_PATH = path.join(CONFIG_DIR, "surface_decision_matrix.v0.json");
    const PROFILES_PATH = path.join(CONFIG_DIR, "module_render_profiles.v0.json");

    // Test loading configuration files
    const matrix = JSON.parse(fs.readFileSync(MATRIX_PATH, "utf-8"));
    const profiles = JSON.parse(fs.readFileSync(PROFILES_PATH, "utf-8"));

    return NextResponse.json({
      status: "success",
      message: "Surface Selector configuration loaded successfully",
      config: {
        cartridge: matrix.cartridge,
        fractal_ladder: matrix.fractal_ladder,
        total_profiles: profiles.length,
        sample_profile: profiles[0]?.module_type || "none",
      },
    });
  } catch (error) {
    console.error("Test endpoint error:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Unknown error",
        status: "failed" 
      },
      { status: 500 }
    );
  }
}
