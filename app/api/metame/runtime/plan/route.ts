import { NextRequest, NextResponse } from "next/server";
import { buildSurfacePlanV0 } from "@/services/metame/surfaceSelector";
import { ContentModuleRenderProfileV0Schema, type ContentModuleRenderProfileV0 } from "@metame/contracts";
import { SurfaceDecisionMatrixV0Schema, type SurfaceDecisionMatrixV0 } from "@/services/metame/surfaceSelector";
import fs from "node:fs";
import path from "node:path";

// Load Qriptopian configuration
const CONFIG_DIR = path.resolve("configs/qriptopian");
const MATRIX_PATH = path.join(CONFIG_DIR, "surface_decision_matrix.v0.json");
const PROFILES_PATH = path.join(CONFIG_DIR, "module_render_profiles.v0.json");

let matrixCache: SurfaceDecisionMatrixV0 | null = null;
let profilesCache: ContentModuleRenderProfileV0[] | null = null;

function loadMatrix(): SurfaceDecisionMatrixV0 {
  if (!matrixCache) {
    try {
      matrixCache = SurfaceDecisionMatrixV0Schema.parse(JSON.parse(fs.readFileSync(MATRIX_PATH, "utf-8")));
    } catch (error) {
      console.error("Failed to load surface decision matrix:", error);
      throw new Error("Surface decision matrix not available");
    }
  }
  return matrixCache;
}

function loadProfiles(): ContentModuleRenderProfileV0[] {
  if (!profilesCache) {
    try {
      const profilesRaw = JSON.parse(fs.readFileSync(PROFILES_PATH, "utf-8"));
      profilesCache = profilesRaw.map((p: unknown) => ContentModuleRenderProfileV0Schema.parse(p));
    } catch (error) {
      console.error("Failed to load module render profiles:", error);
      throw new Error("Module render profiles not available");
    }
  }
  return profilesCache ?? [];
}

function getProfileByType(moduleType: string): ContentModuleRenderProfileV0 | null {
  const profiles = loadProfiles();
  return profiles.find(p => p.module_type === moduleType) || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      plan_id,
      session_id,
      cartridge,
      intent,
      device_context,
      codex_id,
      capsule_id,
      thread_id,
      modules,
      verification,
      audit,
    } = body;

    // Validate required fields
    if (!plan_id || !session_id || !cartridge || !intent || !device_context || !modules || !verification) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Load render profiles for modules
    const enrichedModules = modules.map((m: any) => {
      const profile = getProfileByType(m.module_type);
      if (!profile) {
        throw new Error(`No render profile found for module type: ${m.module_type}`);
      }
      return {
        ...m,
        render_profile: profile,
      };
    });

    // Build surface plan
    const matrix = loadMatrix();
    const plan = buildSurfacePlanV0({
      plan_id,
      session_id,
      cartridge,
      intent,
      device_context,
      codex_id,
      capsule_id,
      thread_id,
      modules: enrichedModules,
      verification,
      audit,
      matrix,
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Surface plan generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cartridge = searchParams.get("cartridge") || "qriptopian";

    // Return available module types and their profiles
    const profiles = loadProfiles();
    const matrix = loadMatrix();

    return NextResponse.json({
      cartridge,
      available_modules: profiles.map(p => ({
        module_type: p.module_type,
        display_name: p.display_name,
        preferred_surfaces: p.profile.preferred_surfaces,
        allowed_surfaces: p.profile.allowed_surfaces,
        density_constraints: p.profile.density_constraints,
      })),
      surface_decision_matrix: matrix,
    });
  } catch (error) {
    console.error("Surface plan info error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
