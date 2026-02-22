import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

// Simple types without external dependencies
type DeviceContext = {
  device_class: "mobile" | "tablet" | "desktop" | "large_screen";
  orientation: "portrait" | "landscape" | "any";
  interaction: "touch" | "pointer" | "mixed";
  real_estate: "xs" | "s" | "m" | "l" | "xl";
};

type Intent = {
  user_ask: string;
  mode: "be" | "make" | "play" | "earn" | "share";
  focus?: string;
};

type Placement = {
  module_id: string;
  surface: "liquid_ui" | "embed" | "drawer" | "overlay";
  density: "micro" | "compact" | "standard" | "expanded" | "full";
  region: string;
  order: number;
  reasoning_tags: string[];
};

// Load configuration
const CONFIG_DIR = path.resolve("configs/qriptopian");
const MATRIX_PATH = path.join(CONFIG_DIR, "surface_decision_matrix.v0.json");
const PROFILES_PATH = path.join(CONFIG_DIR, "module_render_profiles.v0.json");

let matrixCache: any = null;
let profilesCache: any[] | null = null;

function loadMatrix() {
  if (!matrixCache) {
    matrixCache = JSON.parse(fs.readFileSync(MATRIX_PATH, "utf-8"));
  }
  return matrixCache;
}

function loadProfiles() {
  if (!profilesCache) {
    profilesCache = JSON.parse(fs.readFileSync(PROFILES_PATH, "utf-8"));
  }
  return profilesCache;
}

function getProfileByType(moduleType: string): any | null {
  const profiles = loadProfiles();
  return profiles.find((p: any) => p.module_type === moduleType) || null;
}

function chooseSurface(profile: any, device: DeviceContext, intent: Intent): string {
  const preferred = profile.profile.preferred_surfaces || [];
  const allowed = profile.profile.allowed_surfaces || [];
  
  // Simple selection logic
  if (preferred.length > 0 && allowed.includes(preferred[0])) {
    return preferred[0];
  }
  
  // Fallback to first allowed surface
  if (allowed.length > 0) {
    return allowed[0];
  }
  
  // Default fallback
  return "embed";
}

function chooseDensity(profile: any, device: DeviceContext): string {
  const constraints = profile.profile.density_constraints || {};
  return constraints.preferred || "standard";
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
      modules,
    } = body;

    // Validate required fields
    if (!plan_id || !session_id || !cartridge || !intent || !device_context || !modules) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const matrix = loadMatrix();
    const placements: Placement[] = [];

    modules.forEach((moduleInput: any, index: number) => {
      const profile = getProfileByType(moduleInput.module_type);
      if (!profile) {
        throw new Error(`No render profile found for module type: ${moduleInput.module_type}`);
      }

      const surface = chooseSurface(profile, device_context, intent);
      const density = chooseDensity(profile, device_context);

      placements.push({
        module_id: moduleInput.module_id,
        surface: surface as any,
        density: density as any,
        region: surface === "overlay" ? "canvas" : surface === "drawer" ? "secondary" : "primary",
        order: index,
        reasoning_tags: [
          `preferred:${profile.profile.preferred_surfaces?.[0] || "n/a"}`,
          `surface:${surface}`,
          `density:${density}`,
          `mode:${intent.mode}`,
          `device:${device_context.device_class}/${device_context.orientation}/${device_context.real_estate}`,
        ],
      });
    });

    const surfacePlan = {
      schema_version: "0.1.0",
      plan_id,
      session_id,
      cartridge,
      intent,
      device_context,
      modules: modules.map((m: any) => ({
        module_id: m.module_id,
        module_type: m.module_type,
        render_profile_ref: { kind: "schema_ref", id: `render_profile:${m.module_type}` },
      })),
      placements,
      navigation: {
        entry_surface: "liquid_ui",
        progression: ["liquid_ui", "embed", "drawer", "overlay"],
      },
      verification: {
        dis_ref: { kind: "doc_ref", id: `dis:${cartridge}:v0` },
        constraint_manifest_ref: { kind: "doc_ref", id: `constraints:${cartridge}:v0` },
        parity_report_ref: { kind: "doc_ref", id: `parity:pending` },
      },
    };

    return NextResponse.json(surfacePlan);
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

    const profiles = loadProfiles();
    const matrix = loadMatrix();

    return NextResponse.json({
      cartridge,
      available_modules: profiles.map((p: any) => ({
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
