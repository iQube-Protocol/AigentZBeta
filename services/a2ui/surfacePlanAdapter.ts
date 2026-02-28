import type { SurfacePlanV0 } from "@metame/contracts";
import type { A2UIModuleNode, A2UINode, A2UIRegion, A2UISurfacePayload } from "./types";

function mapSurfaceToComponent(surface: SurfacePlanV0["placements"][number]["surface"]): string {
  switch (surface) {
    case "liquid_ui":
      return "A2LiquidSlot";
    case "embed":
      return "A2EmbedSlot";
    case "drawer":
      return "A2DrawerSlot";
    case "overlay":
      return "A2OverlaySlot";
    default:
      return "A2UnknownSlot";
  }
}

export function surfacePlanToA2UIPayload(plan: SurfacePlanV0): A2UISurfacePayload {
  const moduleById = new Map(plan.modules.map((m) => [m.module_id, m]));
  const placements = [...plan.placements].sort((a, b) => a.order - b.order);

  const regionBuckets = placements.reduce<Record<A2UIRegion, SurfacePlanV0["placements"]>>(
    (acc, placement) => {
      acc[placement.region] = [...(acc[placement.region] ?? []), placement];
      return acc;
    },
    {
      primary: [],
      secondary: [],
      footer: [],
      header: [],
      sidebar: [],
      canvas: [],
    }
  );

  const moduleNodes: A2UIModuleNode[] = placements.map((placement) => {
    const moduleRef = moduleById.get(placement.module_id);

    return {
      id: `a2ui_module_${placement.module_id}`,
      moduleId: placement.module_id,
      moduleType: moduleRef?.module_type ?? "unknown",
      surface: placement.surface,
      density: placement.density,
      region: placement.region,
      order: placement.order,
      opens: placement.interaction?.opens,
      openDensity: placement.interaction?.open_density,
      overrides: placement.overrides,
      reasoningTags: placement.reasoning_tags,
      sourceRefs: moduleRef?.source_refs,
    };
  });

  const regionChildren: A2UINode[] = (Object.keys(regionBuckets) as A2UIRegion[])
    .filter((region) => regionBuckets[region].length > 0)
    .map((region) => ({
      id: `region_${region}`,
      type: "A2Region",
      props: {
        region,
      },
      children: regionBuckets[region]
        .sort((a, b) => a.order - b.order)
        .map((placement) => ({
          id: `placement_${placement.module_id}`,
          type: mapSurfaceToComponent(placement.surface),
          props: {
            moduleId: placement.module_id,
            surface: placement.surface,
            density: placement.density,
            order: placement.order,
            interaction: placement.interaction,
            overrides: placement.overrides,
            reasoningTags: placement.reasoning_tags,
          },
        })),
    }));

  return {
    schema_version: "a2ui.surface.v0",
    plan_id: plan.plan_id,
    session_id: plan.session_id,
    cartridge: plan.cartridge,
    intent: plan.intent,
    device_context: plan.device_context,
    navigation: plan.navigation,
    tree: {
      id: "a2ui_root",
      type: "A2SurfacePlan",
      props: {
        entrySurface: plan.navigation.entry_surface,
        progression: plan.navigation.progression,
      },
      children: regionChildren,
    },
    modules: moduleNodes,
  };
}
