import { z } from "zod";
import {
  ContentModuleRenderProfileV0Schema as ContentProfileZ,
  SurfacePlanV0Schema as SurfacePlanZ,
  SurfaceSchema,
  DensitySchema,
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

const SurfaceDecisionRuleWhenSchema = z.object({
  device_class: z.enum(["mobile", "tablet", "desktop", "large_screen"]).optional(),
  orientation: z.enum(["portrait", "landscape", "any"]).optional(),
  real_estate: z.enum(["xs", "s", "m", "l", "xl"]).optional(),
  mode: z.enum(["be", "make", "play", "earn", "share"]).optional(),
  surface: SurfaceSchema.optional(),
  density: DensitySchema.optional(),
  region: z.enum(["primary", "secondary", "footer", "header", "sidebar", "canvas"]).optional(),
  module_type: z.string().optional(),
});

const SurfaceDecisionRuleThenSchema = z.object({
  action: z.string(),
  params: z.record(z.unknown()).optional(),
});

const SurfaceDecisionRuleSchema = z.object({
  id: z.string(),
  priority: z.number().int().optional(),
  when: SurfaceDecisionRuleWhenSchema.optional(),
  then: SurfaceDecisionRuleThenSchema,
});

export const SurfaceDecisionMatrixV0Schema = z.object({
  schema_version: z.string(),
  cartridge: z.string(),
  fractal_ladder: z.array(SurfaceSchema).optional(),
  default_surface_by_mode: z
    .object({
      be: SurfaceSchema.optional(),
      make: SurfaceSchema.optional(),
      play: SurfaceSchema.optional(),
      earn: SurfaceSchema.optional(),
      share: SurfaceSchema.optional(),
    })
    .optional(),
  device_surface_bias: z.record(z.array(SurfaceSchema)).optional(),
  density_policy: z
    .object({
      default_by_real_estate: z.record(DensitySchema).optional(),
      overlay_default_density: DensitySchema.optional(),
      mobile_max_density_unless_preferred: DensitySchema.optional(),
    })
    .optional(),
  surface_rules: z.array(SurfaceDecisionRuleSchema).default([]),
  parity_expectations: z.record(z.unknown()).optional(),
});

export type SurfaceDecisionMatrixV0 = z.infer<typeof SurfaceDecisionMatrixV0Schema>;

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

function normalizeDocSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function isSurface(value: unknown): value is Surface {
  return ["liquid_ui", "embed", "drawer", "overlay"].includes(String(value));
}

function isDensity(value: unknown): value is Density {
  return ["micro", "compact", "standard", "expanded", "full"].includes(String(value));
}

export function generateParityStub(plan: SurfacePlan): SurfacePlan["verification"]["parity_report_ref"] {
  const cartridgeSlug = normalizeDocSlug(plan.cartridge);
  return {
    kind: "doc_ref",
    id: `parity:${cartridgeSlug}:${plan.plan_id}:v0`,
  };
}

type MatrixRuleApplyContext = {
  moduleProfilesByModuleId?: Map<string, ContentProfile>;
};

function ruleMatches(
  rule: SurfaceDecisionMatrixV0["surface_rules"][number],
  plan: SurfacePlan,
  placement: Placement,
  moduleType: string
): boolean {
  const when = rule.when;
  if (!when) return true;
  const dc = plan.device_context;
  const intent = plan.intent;
  if (when.device_class && when.device_class !== dc.device_class) return false;
  if (when.orientation && when.orientation !== dc.orientation && when.orientation !== "any") return false;
  if (when.real_estate && when.real_estate !== dc.real_estate) return false;
  if (when.mode && when.mode !== intent.mode) return false;
  if (when.surface && when.surface !== placement.surface) return false;
  if (when.density && when.density !== placement.density) return false;
  if (when.region && when.region !== placement.region) return false;
  if (when.module_type && when.module_type !== moduleType) return false;
  return true;
}

function resolveAllowedSurface(
  target: Surface,
  profile?: ContentProfile,
  fallback?: Surface
): Surface {
  if (!profile) return target;
  const allowed = new Set(profile.profile.allowed_surfaces);
  const disallowed = new Set(profile.profile.disallowed_surfaces ?? []);
  if (allowed.has(target) && !disallowed.has(target)) return target;

  if (fallback && allowed.has(fallback) && !disallowed.has(fallback)) return fallback;

  const preferred = profile.profile.preferred_surfaces.find((surface) => allowed.has(surface) && !disallowed.has(surface));
  if (preferred) return preferred;

  const firstAllowed = profile.profile.allowed_surfaces.find((surface) => !disallowed.has(surface));
  return firstAllowed ?? fallback ?? target;
}

function updatePlacementInteraction(
  placement: Placement,
  ladder: Surface[],
  profile?: ContentProfile
): Placement["interaction"] | undefined {
  const allowed = profile ? new Set(profile.profile.allowed_surfaces) : new Set<Surface>(ladder);
  const idx = ladder.indexOf(placement.surface);
  if (idx === -1) return undefined;
  const opens = ladder.slice(idx + 1).find((surface) => allowed.has(surface));
  if (!opens) return undefined;
  return {
    opens,
    open_density: opens === "overlay" ? "full" : placement.density,
  };
}

export function applyMatrixRules(
  plan: SurfacePlan,
  matrix: SurfaceDecisionMatrixV0,
  context: MatrixRuleApplyContext = {}
): SurfacePlan {
  const parsedPlan = SurfacePlanZ.parse(plan);
  const parsedMatrix = SurfaceDecisionMatrixV0Schema.parse(matrix);
  const ladder = parsedMatrix.fractal_ladder?.length ? parsedMatrix.fractal_ladder : parsedPlan.navigation.progression;
  const defaultSurfaceByMode = parsedMatrix.default_surface_by_mode ?? {};
  const overlayDensity = parsedMatrix.density_policy?.overlay_default_density;
  const mobileMaxDensity = parsedMatrix.density_policy?.mobile_max_density_unless_preferred;
  const byModuleId = new Map(parsedPlan.modules.map((module) => [module.module_id, module]));

  const rules = parsedMatrix.surface_rules
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => {
      const ap = a.rule.priority ?? 1000;
      const bp = b.rule.priority ?? 1000;
      // Higher numeric priority runs first; lower numeric priority (higher precedence) runs last.
      return ap === bp ? a.index - b.index : bp - ap;
    });

  const placements = parsedPlan.placements.map((placement) => {
    const moduleType = byModuleId.get(placement.module_id)?.module_type ?? "";
    const profile = context.moduleProfilesByModuleId?.get(placement.module_id);
    const reasoning = [...(placement.reasoning_tags ?? [])];
    let next: Placement = { ...placement, reasoning_tags: reasoning };

    // Mode default first if provided by matrix.
    const modeDefault = defaultSurfaceByMode[parsedPlan.intent.mode];
    if (modeDefault) {
      const resolved = resolveAllowedSurface(modeDefault, profile, next.surface);
      if (resolved !== next.surface) {
        next.surface = resolved;
        next.region = regionFor(resolved);
        reasoning.push(`matrix_default_surface:${parsedPlan.intent.mode}->${resolved}`);
      }
    }

    for (const { rule } of rules) {
      if (!ruleMatches(rule, parsedPlan, next, moduleType)) continue;
      const action = rule.then.action;
      const params = rule.then.params ?? {};
      let changed = false;

      if (action === "force_surface_if_allowed" && isSurface(params.surface)) {
        const resolved = resolveAllowedSurface(params.surface, profile, next.surface);
        if (resolved !== next.surface) {
          next.surface = resolved;
          next.region = regionFor(resolved);
          changed = true;
        }
      } else if (action === "promote_one_step") {
        const idx = ladder.indexOf(next.surface);
        if (idx >= 0) {
          const target = ladder[Math.min(idx + 1, ladder.length - 1)];
          const resolved = resolveAllowedSurface(target, profile, next.surface);
          if (resolved !== next.surface) {
            next.surface = resolved;
            next.region = regionFor(resolved);
            changed = true;
          }
        }
      } else if (action === "prefer_drawer_unless_surface_preferred" && parsedPlan.device_context.device_class === "mobile") {
        const preferredOverlay = Boolean(profile?.profile.preferred_surfaces.includes("overlay"));
        if (!preferredOverlay && next.surface === "overlay") {
          const resolved = resolveAllowedSurface("drawer", profile, next.surface);
          if (resolved !== next.surface) {
            next.surface = resolved;
            next.region = regionFor(resolved);
            changed = true;
          }
        }
      } else if (action === "force_density" && isDensity(params.density)) {
        if (params.density !== next.density) {
          next.density = params.density;
          changed = true;
        }
      } else if (action === "collapse_sections") {
        next.overrides = { ...(next.overrides ?? {}), collapse_sections: true };
        changed = true;
      } else if (action === "hide_media") {
        next.overrides = { ...(next.overrides ?? {}), hide_media: true };
        changed = true;
      } else if (action === "truncate_text") {
        const maxLines = typeof params.max_lines === "number" ? params.max_lines : 6;
        next.overrides = { ...(next.overrides ?? {}), max_lines: maxLines };
        changed = true;
      }

      if (changed) reasoning.push(`matrix_rule:${rule.id}`);
    }

    if (overlayDensity && next.surface === "overlay") {
      next.density = overlayDensity;
      reasoning.push("autofix:overlay_default_density");
    }

    if (mobileMaxDensity && parsedPlan.device_context.device_class === "mobile") {
      const pref = profile?.profile.preferred_surfaces ?? [];
      if (!pref.includes(next.surface)) {
        next.density = clampDensity(next.density, "micro", mobileMaxDensity);
      }
    }

    if (profile) {
      const bounds = pickDensity(profile, parsedPlan.device_context);
      const resolvedSurface = resolveAllowedSurface(next.surface, profile, next.surface);
      next.surface = resolvedSurface;
      next.region = regionFor(resolvedSurface);
      next.density = clampDensity(next.density, bounds.min, bounds.max);
    }

    next.interaction = updatePlacementInteraction(next, ladder, profile);
    return next;
  });

  return SurfacePlanZ.parse({
    ...parsedPlan,
    navigation: {
      ...parsedPlan.navigation,
      progression: ladder,
    },
    placements,
  });
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
  matrix?: SurfaceDecisionMatrixV0;
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

  let plan: SurfacePlan = {
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

  if (args.matrix) {
    const moduleProfilesByModuleId = new Map(
      args.modules.map((module) => [module.module_id, module.render_profile])
    );
    plan = applyMatrixRules(plan, args.matrix, { moduleProfilesByModuleId });
  }

  plan = {
    ...plan,
    verification: {
      ...plan.verification,
      parity_report_ref: generateParityStub(plan),
    },
  };

  // Validate against schema (throws if invalid) 
  return SurfacePlanZ.parse(plan);
}
