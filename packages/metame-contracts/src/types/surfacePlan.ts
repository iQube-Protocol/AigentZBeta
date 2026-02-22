import { z } from "zod";
import { SurfaceSchema, DensitySchema, DeviceClassSchema, OrientationSchema, InteractionTypeSchema, RealEstateSchema } from "./contentModuleRenderProfile";

// Reference types
export const RefKindSchema = z.enum(["schema_ref", "doc_ref", "uri_ref"]);
export type RefKind = z.infer<typeof RefKindSchema>;

export const RefSchema = z.object({
  kind: RefKindSchema,
  id: z.string(),
});
export type Ref = z.infer<typeof RefSchema>;

// Device context
export const DeviceContextSchema = z.object({
  device_class: DeviceClassSchema,
  orientation: OrientationSchema,
  interaction: InteractionTypeSchema,
  real_estate: RealEstateSchema,
});
export type DeviceContext = z.infer<typeof DeviceContextSchema>;

// Intent
export const IntentSchema = z.object({
  user_ask: z.string(),
  mode: z.enum(["be", "make", "play", "earn", "share"]),
  focus: z.optional(z.string()),
});
export type Intent = z.infer<typeof IntentSchema>;

// Module reference
export const ModuleRefSchema = z.object({
  module_id: z.string(),
  module_type: z.string(),
  render_profile_ref: RefSchema,
  source_refs: z.optional(RefSchema.array()),
});
export type ModuleRef = z.infer<typeof ModuleRefSchema>;

// Placement overrides
export const PlacementOverridesSchema = z.object({
  max_lines: z.optional(z.number()),
  collapse_sections: z.optional(z.boolean()),
  hide_media: z.optional(z.boolean()),
});
export type PlacementOverrides = z.infer<typeof PlacementOverridesSchema>;

// Placement interaction
export const PlacementInteractionSchema = z.object({
  opens: SurfaceSchema,
  open_density: DensitySchema,
});
export type PlacementInteraction = z.infer<typeof PlacementInteractionSchema>;

// Placement
export const PlacementSchema = z.object({
  module_id: z.string(),
  surface: SurfaceSchema,
  density: DensitySchema,
  region: z.enum(["primary", "secondary", "footer", "header", "sidebar", "canvas"]),
  order: z.number(),
  interaction: z.optional(PlacementInteractionSchema),
  overrides: z.optional(PlacementOverridesSchema),
  reasoning_tags: z.optional(z.string().array()),
});
export type Placement = z.infer<typeof PlacementSchema>;

// Navigation
export const NavigationSchema = z.object({
  entry_surface: SurfaceSchema,
  progression: SurfaceSchema.array(),
});
export type Navigation = z.infer<typeof NavigationSchema>;

// Verification references
export const VerificationRefsSchema = z.object({
  dis_ref: RefSchema,
  constraint_manifest_ref: RefSchema,
  parity_report_ref: RefSchema,
});
export type VerificationRefs = z.infer<typeof VerificationRefsSchema>;

// Audit references
export const AuditRefsSchema = z.object({
  trace_id: z.string(),
  span_id: z.string(),
  actor: z.string(),
  event_hashes: z.string().array(),
});
export type AuditRefs = z.infer<typeof AuditRefsSchema>;

// Main surface plan schema
export const SurfacePlanV0Schema = z.object({
  schema_version: z.literal("0.1.0"),
  plan_id: z.string(),
  session_id: z.string(),
  cartridge: z.string(),
  codex_id: z.optional(z.string()),
  capsule_id: z.optional(z.string()),
  thread_id: z.optional(z.string()),
  intent: IntentSchema,
  device_context: DeviceContextSchema,
  modules: ModuleRefSchema.array(),
  placements: PlacementSchema.array(),
  navigation: NavigationSchema,
  verification: VerificationRefsSchema,
  audit: z.optional(AuditRefsSchema),
});
export type SurfacePlanV0 = z.infer<typeof SurfacePlanV0Schema>;
