import { z } from "zod";
import {
  ContentModuleRenderProfileV0Schema as ContentProfileZ,
  SurfacePlanV0Schema as SurfacePlanZ,
} from "@metame/contracts";

// Types inferred from zod in @metame/contracts
type ContentProfile = z.infer<typeof ContentProfileZ>;
type SurfacePlan = z.infer<typeof SurfacePlanZ>;

type Surface = "liquid_ui" | "embed" | "drawer" | "overlay";
type Density = "micro" | "compact" | "standard" | "expanded" | "full";

type DeviceContext = SurfacePlan["device_context"];
type Intent = SurfacePlan["intent"];
type ModuleRef = SurfacePlan["modules"][number];
type Placement = SurfacePlan["placements"][number];

type ModuleInput = {
  module_id: string;
  module_type: string;
  render_profile: ContentProfile; // embed the profile object in caller
  source_refs?: ModuleRef["source_refs"];
};

// ---------- helpers ----------
const LAYER: Record<Surface, number> = { liquid_ui: 0, embed: 1, drawer: 2, overlay: 3 };
const LADDER: Surface[] = ["liquid_ui", "embed", "drawer", "overlay"];

function clampDensity(d: Density, min: Density, max: Density): Density {
  const order: Density[] = ["micro", "compact", "standard", "expanded", "full"];
  const di = order.indexOf(d);
  const mini = order.indexOf(min);
  const maxi = order.indexOf(max);
  const clamped = Math.min(Math.max(di, mini), maxi);
  return order[clamped];
}

function pickDensity(profile: ContentProfile, device: DeviceContext): { min: Density; pref: Density; max: Density } {
  const dc = profile.profile.density_constraints;
  let min = dc.min;
  let pref = dc.preferred;
  let max = dc.max;

  const overrides = dc.per_device_overrides ?? [];
  const match = overrides.find(o => {
    if (o.device !== device.device_class) return false;
    if (!o.orientation) return true;
    return o.orientation === device.orientation || o.orientation === "any";
  });

  if (match) {
    min = match.min;
    pref = match.preferred;
    max = match.max;
  }

  // tiny real estate nudges
  if (device.real_estate === "xs") {
    // prefer not above standard unless required
    max = clampDensity(max, "micro", "standard");
    pref = clampDensity(pref, min, max);
  }
  if (device.real_estate === "xl") {
    // allow expansion if module supports it
    pref = clampDensity(pref, min, max);
  }

  return { min, pref, max };
}

function chooseSurface(profile: ContentProfile, device: DeviceContext, intent: Intent): Surface {
  const preferred = profile.profile.preferred_surfaces;
  const allowed = new Set(profile.profile.allowed_surfaces);
  const disallowed = new Set(profile.profile.disallowed_surfaces ?? []);

  // Filter preferred by allowed & not disallowed
  const candidates = preferred.filter(s => allowed.has(s) && !disallowed.has(s));

  // Intent-driven bias: Make/Play often wants more focus; Share often wants drawer
  const biasUp = intent.mode === "make" || intent.mode === "play";
  const biasShare = intent.mode === "share";

  // Device-driven bias: mobile prefers embed/drawer; desktop can stay embed/compact
  const deviceBias: Surface[] =
    device.device_class === "mobile"
      ? ["embed", "drawer", "overlay", "liquid_ui"]
      : device.device_class === "tablet"
        ? ["embed", "drawer", "overlay", "liquid_ui"]
        : ["embed", "drawer", "liquid_ui", "overlay"];

  // Start from best candidate; otherwise fall back to deviceBias ∩ allowed
  let base: Surface | undefined = candidates[0] ?? deviceBias.find(s => allowed.has(s) && !disallowed.has(s));

  if (!base) base = "embed"; // hard fallback

  // Apply biases gently (never violate allowed/disallowed)
  function canUse(s: Surface) {
    return allowed.has(s) && !disallowed.has(s);
  }

  if (biasShare && canUse("drawer")) base = "drawer";
  if (biasUp) {
    // promote one step up the ladder when possible
    const next = LADDER[Math.min(LADDER.indexOf(base) + 1, LADDER.length - 1)];
    if (canUse(next)) base = next;
  }

  // Prevent "overlay everywhere" on mobile unless explicitly preferred
  if (device.device_class === "mobile" && base === "overlay" && !preferred.includes("overlay")) {
    if (canUse("drawer")) base = "drawer";
  }

  return base;
}

function regionFor(surface: Surface): Placement["region"] {
  if (surface === "overlay") return "canvas";
  if (surface === "drawer") return "secondary";
  if (surface === "embed") return "primary";
  return "header"; // liquid_ui
}

function ladderOpens(surface: Surface, allowed: Set<Surface>): Surface | undefined {
  const idx = LADDER.indexOf(surface);
  const next = LADDER[Math.min(idx + 1, LADDER.length - 1)];
  if (next !== surface && allowed.has(next)) return next;
  return undefined;
}

function applyResponsiveRules(
  profile: ContentProfile,
  device: DeviceContext,
  surface: Surface,
  density: Density
): { surface: Surface; density: Density; overrides?: Placement["overrides"] } {
  let s = surface;
  let d = density;
  let overrides: Placement["overrides"] | undefined;

  for (const rule of profile.profile.responsive_rules ?? []) {
    const w = rule.when ?? {};
    const match =
      (w.device ? w.device === device.device_class : true) &&
      (w.orientation ? w.orientation === device.orientation || w.orientation === "any" : true) &&
      (w.surface ? w.surface === s : true) &&
      (w.density ? w.density === d : true);

    if (!match) continue;

    const action = rule.then.action;
    const params = rule.then.params ?? {};

    switch (action) {
      case "truncate_text":
        overrides = { ...(overrides ?? {}), max_lines: typeof params.max_lines === "number" ? params.max_lines : 6 };
        break;
      case "collapse_sections":
        overrides = { ...(overrides ?? {}), collapse_sections: true };
        break;
      case "hide_media":
        overrides = { ...(overrides ?? {}), hide_media: true };
        break;
      case "promote_to_drawer":
        s = "drawer";
        break;
      case "promote_to_overlay":
        s = "overlay";
        break;
      case "demote_to_embed":
        s = "embed";
        break;
      case "demote_to_liquid_ui":
        s = "liquid_ui";
        break;
      case "reduce_density":
        d = "compact";
        break;
      case "increase_density":
        d = "expanded";
        break;
      case "swap_to_carousel":
        // a UI concern; keep as tag via override
        overrides = { ...(overrides ?? {}), collapse_sections: true };
        break;
    }
  }

  return { surface: s, density: d, overrides };
}

// ---------- main selector ----------
export function buildSurfacePlanV0(args: {
  plan_id: string;
  session_id: string;
  cartridge: string;
  intent: Intent;
  device_context: DeviceContext;
  codex_id?: string;
  capsule_id?: string;
  thread_id?: string;

  // modules as inputs with their full render profiles
  modules: ModuleInput[];

  // verification refs (can be placeholders)
  verification: SurfacePlan["verification"];
  audit?: SurfacePlan["audit"];
}): SurfacePlan {
  const modules: SurfacePlan["modules"] = args.modules.map(m => ({
    module_id: m.module_id,
    module_type: m.module_type,
    render_profile_ref: { kind: "schema_ref" as const, id: `render_profile:${m.module_type}` },
    source_refs: m.source_refs ?? [],
  }));

  const placements: Placement[] = [];
  let order = 0;

  for (const m of args.modules) {
    const profile = m.render_profile;

    // Choose surface + density
    const surface0 = chooseSurface(profile, args.device_context, args.intent);
    const dens = pickDensity(profile, args.device_context);
    let density0 = clampDensity(dens.pref, dens.min, dens.max);

    // Apply responsive rule actions (promotions/demotions/overrides)
    const allowed = new Set(profile.profile.allowed_surfaces);
    const adjusted = applyResponsiveRules(profile, args.device_context, surface0, density0);

    const surface = adjusted.surface;
    const density = clampDensity(adjusted.density, dens.min, dens.max);

    const opens = ladderOpens(surface, allowed);

    placements.push({
      module_id: m.module_id,
      surface,
      density,
      region: regionFor(surface),
      order: order++,
      interaction: opens
        ? { opens, open_density: opens === "overlay" ? "full" : density }
        : undefined,
      overrides: adjusted.overrides,
      reasoning_tags: [
        `preferred:${profile.profile.preferred_surfaces[0] ?? "n/a"}`,
        `surface:${surface0}->${surface}`,
        `density:${dens.pref}->${density}`,
        `mode:${args.intent.mode}`,
        `device:${args.device_context.device_class}/${args.device_context.orientation}/${args.device_context.real_estate}`,
      ],
    });
  }

  const plan: SurfacePlan = {
    schema_version: "0.1.0",
    plan_id: args.plan_id,
    session_id: args.session_id,
    cartridge: args.cartridge,
    codex_id: args.codex_id,
    capsule_id: args.capsule_id,
    thread_id: args.thread_id,
    intent: args.intent,
    device_context: args.device_context,
    modules,
    placements,
    navigation: {
      entry_surface: "liquid_ui",
      progression: ["liquid_ui", "embed", "drawer", "overlay"],
    },
    verification: args.verification,
    audit: args.audit,
  };

  // Validate against schema (throws if invalid)
  return SurfacePlanZ.parse(plan);
}
