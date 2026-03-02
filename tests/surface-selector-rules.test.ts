import { describe, expect, it } from "vitest";
import { ContentModuleRenderProfileV0Schema, SurfacePlanV0Schema } from "@metame/contracts";

import {
  applyMatrixRules,
  buildSurfacePlanV0,
  generateParityStub,
  type SurfaceDecisionMatrixV0,
} from "@/services/metame/surfaceSelector";

function makeProfile(moduleType: string) {
  return ContentModuleRenderProfileV0Schema.parse({
    schema_version: "0.1.0",
    module_type: moduleType,
    display_name: moduleType,
    profile: {
      primary_modality: "mixed",
      interaction_style: "skim",
      preferred_surfaces: ["overlay"],
      allowed_surfaces: ["embed", "drawer", "overlay"],
      density_constraints: {
        min: "compact",
        preferred: "standard",
        max: "expanded",
      },
      responsive_rules: [],
      experience_affinity: {
        best_for: ["capsule"],
        avoid_for: [],
      },
    },
  });
}

function makePlan() {
  const profile = makeProfile("Qriptopian.StoryCard");
  return buildSurfacePlanV0({
    plan_id: "plan_surface_rules_1",
    session_id: "sess_surface_rules_1",
    cartridge: "Qriptopian",
    intent: {
      user_ask: "show content",
      mode: "be",
      focus: "stories",
    },
    device_context: {
      device_class: "desktop",
      orientation: "any",
      interaction: "pointer",
      real_estate: "l",
    },
    modules: [
      {
        module_id: "module_story_1",
        module_type: "Qriptopian.StoryCard",
        render_profile: profile,
      },
    ],
    verification: {
      dis_ref: { kind: "doc_ref", id: "dis:qriptopian:v0" },
      constraint_manifest_ref: { kind: "doc_ref", id: "constraints:qriptopian:v0" },
      parity_report_ref: { kind: "doc_ref", id: "parity:pending" },
    },
  });
}

describe("surfaceSelector matrix rules", () => {
  it("applies conflicting rules with deterministic priority precedence", () => {
    const plan = makePlan();
    const matrix: SurfaceDecisionMatrixV0 = {
      schema_version: "0.1.0",
      cartridge: "Qriptopian",
      surface_rules: [
        {
          id: "force_embed_low_precedence",
          priority: 100,
          then: { action: "force_surface_if_allowed", params: { surface: "embed" } },
        },
        {
          id: "force_drawer_high_precedence",
          priority: 10,
          then: { action: "force_surface_if_allowed", params: { surface: "drawer" } },
        },
      ],
    };

    const profile = makeProfile("Qriptopian.StoryCard");
    const result = applyMatrixRules(plan, matrix, {
      moduleProfilesByModuleId: new Map([["module_story_1", profile]]),
    });

    expect(result.placements[0]?.surface).toBe("drawer");
    expect(result.placements[0]?.reasoning_tags).toContain("matrix_rule:force_embed_low_precedence");
    expect(result.placements[0]?.reasoning_tags).toContain("matrix_rule:force_drawer_high_precedence");
    expect(() => SurfacePlanV0Schema.parse(result)).not.toThrow();
  });

  it("is deterministic for identical plan + matrix input", () => {
    const plan = makePlan();
    const matrix: SurfaceDecisionMatrixV0 = {
      schema_version: "0.1.0",
      cartridge: "Qriptopian",
      default_surface_by_mode: {
        be: "embed",
      },
      surface_rules: [
        {
          id: "promote_be",
          then: { action: "promote_one_step" },
        },
      ],
    };

    const profile = makeProfile("Qriptopian.StoryCard");
    const ctx = { moduleProfilesByModuleId: new Map([["module_story_1", profile]]) };
    const a = applyMatrixRules(plan, matrix, ctx);
    const b = applyMatrixRules(plan, matrix, ctx);

    expect(a).toEqual(b);
  });

  it("no-op matrix leaves placements unchanged", () => {
    const plan = makePlan();
    const matrix: SurfaceDecisionMatrixV0 = {
      schema_version: "0.1.0",
      cartridge: "Qriptopian",
      surface_rules: [],
    };

    const result = applyMatrixRules(plan, matrix);
    expect(result.placements).toEqual(plan.placements);
    expect(result.navigation.progression).toEqual(plan.navigation.progression);
  });
});

describe("surfaceSelector parity stub", () => {
  it("creates stable parity doc_ref and buildSurfacePlanV0 preserves other verification refs", () => {
    const plan = makePlan();
    const parity = generateParityStub(plan);

    expect(parity.kind).toBe("doc_ref");
    expect(parity.id).toBe("parity:qriptopian:plan_surface_rules_1:v0");
    expect(plan.verification.dis_ref.id).toBe("dis:qriptopian:v0");
    expect(plan.verification.constraint_manifest_ref.id).toBe("constraints:qriptopian:v0");
    expect(plan.verification.parity_report_ref.id).toBe("parity:qriptopian:plan_surface_rules_1:v0");
  });
});
