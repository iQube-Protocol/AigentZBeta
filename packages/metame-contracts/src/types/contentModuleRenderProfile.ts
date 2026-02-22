import { z } from "zod";

// Base types
export const SurfaceSchema = z.enum(["liquid_ui", "embed", "drawer", "overlay"]);
export type Surface = z.infer<typeof SurfaceSchema>;

export const DensitySchema = z.enum(["micro", "compact", "standard", "expanded", "full"]);
export type Density = z.infer<typeof DensitySchema>;

export const DeviceClassSchema = z.enum(["mobile", "tablet", "desktop", "large_screen"]);
export type DeviceClass = z.infer<typeof DeviceClassSchema>;

export const OrientationSchema = z.enum(["portrait", "landscape", "any"]);
export type Orientation = z.infer<typeof OrientationSchema>;

export const InteractionTypeSchema = z.enum(["touch", "pointer", "mixed"]);
export type InteractionType = z.infer<typeof InteractionTypeSchema>;

export const RealEstateSchema = z.enum(["xs", "s", "m", "l", "xl"]);
export type RealEstate = z.infer<typeof RealEstateSchema>;

export const ModalitySchema = z.enum(["text", "image", "video", "audio", "interactive", "mixed", "data", "form"]);
export type Modality = z.infer<typeof ModalitySchema>;

export const InteractionStyleSchema = z.enum(["glance", "skim", "read", "explore", "act", "transact"]);
export type InteractionStyle = z.infer<typeof InteractionStyleSchema>;

// Responsive rule types
export const ResponsiveRuleConditionSchema = z.object({
  device: z.optional(DeviceClassSchema),
  orientation: z.optional(OrientationSchema),
  surface: z.optional(SurfaceSchema),
  density: z.optional(DensitySchema),
});

export const ResponsiveRuleActionEnumSchema = z.enum([
  "truncate_text",
  "collapse_sections", 
  "hide_media",
  "promote_to_drawer",
  "promote_to_overlay",
  "demote_to_embed",
  "demote_to_liquid_ui",
  "reduce_density",
  "increase_density",
  "swap_to_carousel"
]);

export const ResponsiveRuleActionParamsSchema = z.record(z.unknown());

export const ResponsiveRuleSchema = z.object({
  when: z.optional(ResponsiveRuleConditionSchema),
  then: z.object({
    action: ResponsiveRuleActionEnumSchema,
    params: z.optional(ResponsiveRuleActionParamsSchema),
  }),
});

// Export types for all schemas
export type ResponsiveRuleCondition = z.infer<typeof ResponsiveRuleConditionSchema>;
export type ResponsiveRuleActionEnum = z.infer<typeof ResponsiveRuleActionEnumSchema>;
export type ResponsiveRuleActionParams = z.infer<typeof ResponsiveRuleActionParamsSchema>;
export type ResponsiveRule = z.infer<typeof ResponsiveRuleSchema>;

// Density constraint types
export const DensityConstraintsDeviceOverrideSchema = z.object({
  device: DeviceClassSchema,
  orientation: z.optional(OrientationSchema),
  min: DensitySchema,
  preferred: DensitySchema,
  max: DensitySchema,
});

export const DensityConstraintsSchema = z.object({
  min: DensitySchema,
  preferred: DensitySchema,
  max: DensitySchema,
  per_device_overrides: z.optional(DensityConstraintsDeviceOverrideSchema.array()),
});

export type DensityConstraintsDeviceOverride = z.infer<typeof DensityConstraintsDeviceOverrideSchema>;
export type DensityConstraints = z.infer<typeof DensityConstraintsSchema>;

// Aesthetic constraints
export const AestheticConstraintsSchema = z.object({
  color_palette: z.optional(z.string().array()),
  typography_scale: z.optional(z.string()),
  spacing_system: z.optional(z.string()),
  brand_alignment: z.optional(z.enum(["strict", "flexible", "minimal"])),
});

export type AestheticConstraints = z.infer<typeof AestheticConstraintsSchema>;

// Experience affinity
export const ExperienceAffinitySchema = z.object({
  best_for: z.string().array(),
  avoid_for: z.string().array(),
});

export type ExperienceAffinity = z.infer<typeof ExperienceAffinitySchema>;

// Main profile schema
export const ContentModuleRenderProfileV0Schema = z.object({
  schema_version: z.literal("0.1.0"),
  module_type: z.string(),
  display_name: z.string(),
  profile: z.object({
    primary_modality: ModalitySchema,
    interaction_style: InteractionStyleSchema,
    preferred_surfaces: SurfaceSchema.array(),
    allowed_surfaces: SurfaceSchema.array(),
    disallowed_surfaces: z.optional(SurfaceSchema.array()),
    density_constraints: DensityConstraintsSchema,
    responsive_rules: z.optional(ResponsiveRuleSchema.array()),
    aesthetic_constraints: z.optional(AestheticConstraintsSchema),
    experience_affinity: z.optional(ExperienceAffinitySchema),
  }),
});

export type ContentModuleRenderProfileV0 = z.infer<typeof ContentModuleRenderProfileV0Schema>;
