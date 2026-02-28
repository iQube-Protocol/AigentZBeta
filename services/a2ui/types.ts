import type { SurfacePlanV0 } from "@metame/contracts";

type SurfacePlacement = SurfacePlanV0["placements"][number];
type SurfaceModuleRef = SurfacePlanV0["modules"][number];
type SurfaceInteraction = NonNullable<SurfacePlacement["interaction"]>;

export type A2UIRegion = SurfacePlanV0["placements"][number]["region"];
export type A2UISurface = SurfacePlanV0["placements"][number]["surface"];
export type A2UIDensity = SurfacePlanV0["placements"][number]["density"];

export interface A2UINode {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  children?: A2UINode[];
}

export interface A2UIModuleNode {
  id: string;
  moduleId: string;
  moduleType: string;
  surface: A2UISurface;
  density: A2UIDensity;
  region: A2UIRegion;
  order: number;
  opens?: SurfaceInteraction["opens"];
  openDensity?: SurfaceInteraction["open_density"];
  overrides?: SurfacePlacement["overrides"];
  reasoningTags?: SurfacePlacement["reasoning_tags"];
  sourceRefs?: SurfaceModuleRef["source_refs"];
}

export interface A2UISurfacePayload {
  schema_version: "a2ui.surface.v0";
  plan_id: string;
  session_id: string;
  cartridge: string;
  intent: SurfacePlanV0["intent"];
  device_context: SurfacePlanV0["device_context"];
  navigation: SurfacePlanV0["navigation"];
  tree: A2UINode;
  modules: A2UIModuleNode[];
}
