import { describe, expect, it } from "vitest";

import type { SurfacePlanV0 } from "@metame/contracts";
import { surfacePlanToA2UIPayload } from "@/services/a2ui/surfacePlanAdapter";

describe("surfacePlanToA2UIPayload", () => {
  it("maps plan metadata and module interaction fields", () => {
    const plan: SurfacePlanV0 = {
      schema_version: "0.1.0",
      plan_id: "plan_test_1",
      session_id: "session_test_1",
      cartridge: "Qriptopian",
      intent: {
        user_ask: "show me story modules",
        mode: "be",
        focus: "stories",
      },
      device_context: {
        device_class: "mobile",
        orientation: "portrait",
        interaction: "touch",
        real_estate: "s",
      },
      modules: [
        {
          module_id: "module_hero",
          module_type: "Qriptopian.StoryCard",
          render_profile_ref: { kind: "schema_ref", id: "render_profile:Qriptopian.StoryCard" },
          source_refs: [{ kind: "doc_ref", id: "capsule:hero" }],
        },
      ],
      placements: [
        {
          module_id: "module_hero",
          surface: "embed",
          density: "standard",
          region: "primary",
          order: 0,
          interaction: { opens: "drawer", open_density: "compact" },
          overrides: { max_lines: 4 },
          reasoning_tags: ["surface:embed", "mode:be"],
        },
      ],
      navigation: {
        entry_surface: "liquid_ui",
        progression: ["liquid_ui", "embed", "drawer", "overlay"],
      },
      verification: {
        dis_ref: { kind: "doc_ref", id: "dis:qriptopian:v0" },
        constraint_manifest_ref: { kind: "doc_ref", id: "constraints:qriptopian:v0" },
        parity_report_ref: { kind: "doc_ref", id: "parity:pending" },
      },
    };

    const payload = surfacePlanToA2UIPayload(plan);

    expect(payload.schema_version).toBe("a2ui.surface.v0");
    expect(payload.plan_id).toBe(plan.plan_id);
    expect(payload.session_id).toBe(plan.session_id);
    expect(payload.tree.type).toBe("A2SurfacePlan");
    expect(payload.modules).toHaveLength(1);
    expect(payload.modules[0]).toMatchObject({
      moduleId: "module_hero",
      moduleType: "Qriptopian.StoryCard",
      surface: "embed",
      region: "primary",
      opens: "drawer",
      openDensity: "compact",
    });
  });

  it("sorts placements by order and buckets children by region", () => {
    const plan: SurfacePlanV0 = {
      schema_version: "0.1.0",
      plan_id: "plan_test_2",
      session_id: "session_test_2",
      cartridge: "Qriptopian",
      intent: {
        user_ask: "compose layout",
        mode: "make",
      },
      device_context: {
        device_class: "desktop",
        orientation: "any",
        interaction: "pointer",
        real_estate: "l",
      },
      modules: [
        {
          module_id: "m2",
          module_type: "KNYT.CanonThread",
          render_profile_ref: { kind: "schema_ref", id: "render_profile:KNYT.CanonThread" },
        },
        {
          module_id: "m1",
          module_type: "Qriptopian.StoryCard",
          render_profile_ref: { kind: "schema_ref", id: "render_profile:Qriptopian.StoryCard" },
        },
      ],
      placements: [
        {
          module_id: "m2",
          surface: "drawer",
          density: "compact",
          region: "secondary",
          order: 2,
        },
        {
          module_id: "m1",
          surface: "embed",
          density: "standard",
          region: "primary",
          order: 1,
        },
      ],
      navigation: {
        entry_surface: "liquid_ui",
        progression: ["liquid_ui", "embed", "drawer", "overlay"],
      },
      verification: {
        dis_ref: { kind: "doc_ref", id: "dis:qriptopian:v0" },
        constraint_manifest_ref: { kind: "doc_ref", id: "constraints:qriptopian:v0" },
        parity_report_ref: { kind: "doc_ref", id: "parity:pending" },
      },
    };

    const payload = surfacePlanToA2UIPayload(plan);

    expect(payload.modules.map((m) => m.moduleId)).toEqual(["m1", "m2"]);

    const regionNodes = payload.tree.children ?? [];
    expect(regionNodes).toHaveLength(2);
    expect(regionNodes[0].props).toMatchObject({ region: "primary" });
    expect(regionNodes[1].props).toMatchObject({ region: "secondary" });

    const primaryChildren = regionNodes[0].children ?? [];
    const secondaryChildren = regionNodes[1].children ?? [];
    expect(primaryChildren[0].props).toMatchObject({ moduleId: "m1", surface: "embed" });
    expect(secondaryChildren[0].props).toMatchObject({ moduleId: "m2", surface: "drawer" });
  });
});
