import fs from "node:fs";
import path from "node:path";

import { buildSurfacePlanV0 } from "../../services/metame/surfaceSelector";
import { ContentModuleRenderProfileV0 } from "../../../packages/metame-contracts/src/types/contentModuleRenderProfile";

function loadJSON<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}

function indexProfiles(profiles: ContentModuleRenderProfileV0[]) {
  const byType = new Map<string, ContentModuleRenderProfileV0>();
  for (const p of profiles) byType.set(p.module_type, p);
  return byType;
}

const matrixPath = path.resolve("configs/qriptopian/surface_decision_matrix.v0.json");
const profilesPath = path.resolve("configs/qriptopian/module_render_profiles.v0.json");

const matrix = loadJSON<any>(matrixPath);
const profiles = loadJSON<ContentModuleRenderProfileV0[]>(profilesPath);
const profileByType = indexProfiles(profiles);

const modules = [
  { module_id: "mod_badge_01", module_type: "KNYT.BadgePortal" },
  { module_id: "mod_story_01", module_type: "Qriptopian.StoryCard" },
  { module_id: "mod_thread_01", module_type: "KNYT.CanonThread" },
  { module_id: "mod_quote_01", module_type: "KNYT.QuotePanel" },
  { module_id: "mod_share_01", module_type: "metaMe.ShareGate" }
].map(m => ({
  ...m,
  render_profile: profileByType.get(m.module_type)!,
}));

const scenarios = [
  {
    name: "mobile_portrait_make",
    device_context: { device_class: "mobile", orientation: "portrait", interaction: "touch", real_estate: "s" as const },
    intent: { user_ask: "Build a KNYT capsule thread inside Qriptopian", mode: "make" as const, focus: "KNYT within Qriptopian" }
  },
  {
    name: "tablet_portrait_be",
    device_context: { device_class: "tablet", orientation: "portrait", interaction: "touch", real_estate: "m" as const },
    intent: { user_ask: "Show me today's KNYT highlights", mode: "be" as const, focus: "KNYT within Qriptopian" }
  },
  {
    name: "tablet_landscape_play",
    device_context: { device_class: "tablet", orientation: "landscape", interaction: "touch", real_estate: "l" as const },
    intent: { user_ask: "Run a canon check quiz", mode: "play" as const, focus: "KNYT within Qriptopian" }
  },
  {
    name: "desktop_share",
    device_context: { device_class: "desktop", orientation: "any", interaction: "pointer", real_estate: "l" as const },
    intent: { user_ask: "Share this capsule with my network", mode: "share" as const, focus: "KNYT within Qriptopian" }
  }
];

export function runQriptopianFixture() {
  console.log("Running Qriptopian Golden Path Fixture...\n");
  
  for (const s of scenarios) {
    try {
      const plan = buildSurfacePlanV0({
        plan_id: `plan_${s.name}`,
        session_id: "sess_123456",
        cartridge: "Qriptopian",
        intent: s.intent,
        device_context: s.device_context,
        codex_id: "codex_qriptopian_issue_01",
        capsule_id: "capsule_knyt_001",
        thread_id: "thread_knyt_bridge_001",
        modules,
        matrix,
        verification: {
          dis_ref: { kind: "doc_ref", id: "dis:qriptopian:v0" },
          constraint_manifest_ref: { kind: "doc_ref", id: "constraints:qriptopian:v0" },
          parity_report_ref: { kind: "doc_ref", id: "parity:pending" }
        }
      });

      console.log("=== Scenario:", s.name, "===");
      console.log("Device:", `${s.device_context.device_class}/${s.device_context.orientation}/${s.device_context.real_estate}`);
      console.log("Intent Mode:", s.intent.mode);
      console.log("Placements:");
      
      plan.placements.forEach((p: any) => {
        console.log(`  ${p.module_id}: ${p.surface} (${p.density}) - order ${p.order}`);
      });
      
      console.log(`Total placements: ${plan.placements.length}`);
      console.log("Status: ✅ SUCCESS\n");
      
    } catch (error) {
      console.log("=== Scenario:", s.name, "===");
      console.log("Status: ❌ FAILED");
      console.log("Error:", error instanceof Error ? error.message : error);
      console.log("");
    }
  }
}

// Run fixture if called directly
if (require.main === module) {
  runQriptopianFixture();
}
