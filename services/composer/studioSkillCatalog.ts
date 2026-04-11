/**
 * Studio Skill Catalog
 *
 * Defines all first-party Studio skills and bundles in RegistryIngestion-compatible
 * format (SkillQube / WorkflowQube). This is the single source of truth for:
 *   - Workflows tab display in ComposerStudio
 *   - Registry intake seed submissions
 *   - Trust band and badge assignment for Studio skills
 *
 * To register these in the Registry, call submitStudioSkillsToRegistry() from
 * a seed script or admin action, passing a valid tenantId and personaId.
 */

export type TrustBand = "L1_EXPERIMENTAL" | "L2_VERIFIED_COMMUNITY" | "L3_PRODUCTION_CANDIDATE" | "L4_PRODUCTION_APPROVED" | "L5_CORE_SOVEREIGN";

export interface StudioSkillEntry {
  id: string;                 // Canonical skill identifier (matches SKILL_REGISTRY keys where applicable)
  name: string;
  description: string;
  assetClass: "SkillQube";
  trustBand: TrustBand;
  badge: "A" | "B" | "C";
  compositeScore?: number;
  provider: string;
  invokeEndpoint: string;     // API endpoint that invokes this skill
  tags: string[];
  interfaceSchema: {
    inputs: Array<{ name: string; type: string; required: boolean; description?: string }>;
    outputs: Array<{ name: string; type: string; description?: string }>;
  };
}

export interface StudioBundleEntry {
  id: string;
  name: string;
  description: string;
  assetClass: "WorkflowQube";
  engine: "inline";
  triggerType: "manual";
  presetId: string;           // Matches ExperienceBundlePresetId
  blockKinds: string[];
  tags: string[];
}

export const STUDIO_SKILLS: StudioSkillEntry[] = [
  {
    id: "skill:image_openai",
    name: "Image Generation — OpenAI",
    description:
      "Generate portrait (1024×1536) and landscape (1536×1024) hero imagery via OpenAI gpt-image-1. Supports editorial, cinematic, illustrative, and photorealistic visual styles.",
    assetClass: "SkillQube",
    trustBand: "L3_PRODUCTION_CANDIDATE",
    badge: "A",
    compositeScore: 78,
    provider: "openai",
    invokeEndpoint: "/api/skills/image/generate",
    tags: ["image", "openai", "gpt-image-1", "portrait", "landscape", "editorial"],
    interfaceSchema: {
      inputs: [
        { name: "provider_id", type: "string", required: true, description: '"openai"' },
        { name: "portrait_prompt", type: "string", required: false },
        { name: "landscape_prompt", type: "string", required: false },
        { name: "visual_style", type: "string", required: false, description: "editorial | cinematic | photorealistic | illustrative" },
        { name: "experience_id", type: "string", required: false },
      ],
      outputs: [
        { name: "images", type: "GeneratedImage[]", description: "Array of portrait + landscape generated images" },
        { name: "receipt", type: "object", description: "DVN receipt with provider, model, and output metadata" },
      ],
    },
  },
  {
    id: "skill:image_venice",
    name: "Image Generation — Venice",
    description:
      "Generate portrait and landscape hero imagery via Venice AI (venice-sd35, hidream, flux-2-pro). Privacy-preserving, no data retention.",
    assetClass: "SkillQube",
    trustBand: "L3_PRODUCTION_CANDIDATE",
    badge: "A",
    compositeScore: 76,
    provider: "venice",
    invokeEndpoint: "/api/skills/image/generate",
    tags: ["image", "venice", "venice-sd35", "flux", "portrait", "landscape"],
    interfaceSchema: {
      inputs: [
        { name: "provider_id", type: "string", required: true, description: '"venice"' },
        { name: "portrait_prompt", type: "string", required: false },
        { name: "landscape_prompt", type: "string", required: false },
        { name: "visual_style", type: "string", required: false },
        { name: "experience_id", type: "string", required: false },
      ],
      outputs: [
        { name: "images", type: "GeneratedImage[]" },
        { name: "receipt", type: "object" },
      ],
    },
  },
  {
    id: "skill:video_sora_curated",
    name: "Video Generation — Sora (Curated)",
    description:
      "First-party curated OpenAI Sora video generation. Supports 5–20 second clips at 16:9 or 9:16. Trust composite 79, Badge A.",
    assetClass: "SkillQube",
    trustBand: "L4_PRODUCTION_APPROVED",
    badge: "A",
    compositeScore: 79,
    provider: "openai",
    invokeEndpoint: "/api/skills/invoke",
    tags: ["video", "sora", "openai", "curated", "16:9", "9:16"],
    interfaceSchema: {
      inputs: [
        { name: "skill_id", type: "string", required: true, description: '"sora_video_gen_curated"' },
        { name: "prompt", type: "string", required: true },
        { name: "duration", type: "number", required: false, description: "Seconds (default 10)" },
        { name: "aspect_ratio", type: "string", required: false, description: '"16:9" | "9:16"' },
        { name: "style", type: "string", required: false, description: "cinematic | dramatic | natural" },
        { name: "experience_id", type: "string", required: false },
      ],
      outputs: [
        { name: "video_url", type: "string" },
        { name: "generation_id", type: "string" },
        { name: "receipt", type: "object" },
      ],
    },
  },
  {
    id: "skill:video_venice",
    name: "Video Generation — Venice",
    description:
      "Venice AI video generation. Privacy-preserving, no data retention. Trust composite 82, Badge A.",
    assetClass: "SkillQube",
    trustBand: "L4_PRODUCTION_APPROVED",
    badge: "A",
    compositeScore: 82,
    provider: "venice",
    invokeEndpoint: "/api/skills/invoke",
    tags: ["video", "venice", "privacy"],
    interfaceSchema: {
      inputs: [
        { name: "skill_id", type: "string", required: true, description: '"venice_video_gen"' },
        { name: "prompt", type: "string", required: true },
        { name: "duration", type: "number", required: false },
        { name: "aspect_ratio", type: "string", required: false },
        { name: "venice_model", type: "string", required: false },
        { name: "experience_id", type: "string", required: false },
      ],
      outputs: [
        { name: "video_url", type: "string" },
        { name: "generation_id", type: "string" },
        { name: "receipt", type: "object" },
      ],
    },
  },
  {
    id: "skill:video_sora_community",
    name: "Video Generation — Sora (Community)",
    description:
      "Community-sourced Sora video generation. Trust composite 52, Badge C. Suitable for experimentation.",
    assetClass: "SkillQube",
    trustBand: "L2_VERIFIED_COMMUNITY",
    badge: "C",
    compositeScore: 52,
    provider: "openai",
    invokeEndpoint: "/api/skills/invoke",
    tags: ["video", "sora", "community"],
    interfaceSchema: {
      inputs: [
        { name: "skill_id", type: "string", required: true, description: '"sora_video_gen_community"' },
        { name: "prompt", type: "string", required: true },
        { name: "duration", type: "number", required: false },
        { name: "aspect_ratio", type: "string", required: false },
        { name: "experience_id", type: "string", required: false },
      ],
      outputs: [
        { name: "video_url", type: "string" },
        { name: "generation_id", type: "string" },
        { name: "receipt", type: "object" },
      ],
    },
  },
  {
    id: "skill:article_generation",
    name: "Article / Story Generation",
    description:
      "AI-authored editorial article drafts with title, deck, opening, structured sections, takeaways, glossary, and next action. Rendered as article_draft blocks within experience bundles.",
    assetClass: "SkillQube",
    trustBand: "L3_PRODUCTION_CANDIDATE",
    badge: "A",
    compositeScore: 75,
    provider: "openai",
    invokeEndpoint: "/api/composer/article/generate",
    tags: ["article", "editorial", "copy", "story", "takeaways", "glossary"],
    interfaceSchema: {
      inputs: [
        { name: "prompt", type: "string", required: true, description: "Topic / brief for the article" },
        { name: "title", type: "string", required: false },
        { name: "issue_slug", type: "string", required: false },
        { name: "outputs", type: "string[]", required: false, description: "Desired copilot output types" },
        { name: "takeaways_count", type: "number", required: false, description: "Default 3" },
        { name: "experience_id", type: "string", required: false },
      ],
      outputs: [
        { name: "title", type: "string" },
        { name: "deck", type: "string" },
        { name: "opening", type: "string" },
        { name: "sections", type: "Array<{ heading, body }>" },
        { name: "takeaways", type: "string[]" },
        { name: "glossary", type: "Array<{ term, definition }>" },
        { name: "nextAction", type: "string" },
      ],
    },
  },
];

export const STUDIO_BUNDLES: StudioBundleEntry[] = [
  {
    id: "workflow:image_article_bundle",
    name: "Image + Article Bundle",
    description:
      "Lock hero/supporting image generation first, then layer article draft and editorial structure. Deploys as a reading experience with visual context.",
    assetClass: "WorkflowQube",
    engine: "inline",
    triggerType: "manual",
    presetId: "image_article_bundle",
    blockKinds: ["image_generation", "article_draft", "deployment"],
    tags: ["bundle", "image", "article", "editorial", "reading-sprint"],
  },
  {
    id: "workflow:video_article_bundle",
    name: "Video + Article Bundle",
    description:
      "Generate or bind the primary video asset first, then add supporting editorial copy. Deploys as a watch experience via Make.",
    assetClass: "WorkflowQube",
    engine: "inline",
    triggerType: "manual",
    presetId: "video_article_bundle",
    blockKinds: ["video_generation", "article_draft", "deployment"],
    tags: ["bundle", "video", "article", "watch", "make"],
  },
];

/**
 * Build registry intake payloads for all Studio skills and bundles.
 * Each intake uses sourceType "direct_upload" with the skill/bundle definition
 * as the sourcePayload, ready for the ingestion pipeline validation stages.
 */
export function buildStudioRegistryIntakes(tenantId: string, submittedBy: string) {
  const skillIntakes = STUDIO_SKILLS.map((skill) => ({
    tenantId,
    submittedBy,
    sourceType: "direct_upload" as const,
    sourcePayload: {
      assetClass: skill.assetClass,
      assetId: skill.id,
      name: skill.name,
      slug: skill.id.replace("skill:", "studio-"),
      description: skill.description,
      trustBand: skill.trustBand,
      publicationStatus: "approved",
      wrapperStrategy: "skill",
      interfaceSchema: skill.interfaceSchema,
      capabilities: [
        {
          name: skill.name,
          description: skill.description,
          inputSchema: Object.fromEntries(
            skill.interfaceSchema.inputs.map((i) => [i.name, { type: i.type, required: i.required }])
          ),
          outputSchema: Object.fromEntries(
            skill.interfaceSchema.outputs.map((o) => [o.name, { type: o.type }])
          ),
        },
      ],
      tags: skill.tags,
      metadata: {
        provider: skill.provider,
        invokeEndpoint: skill.invokeEndpoint,
        compositeScore: skill.compositeScore,
        badge: skill.badge,
        studioNative: true,
      },
    },
  }));

  const bundleIntakes = STUDIO_BUNDLES.map((bundle) => ({
    tenantId,
    submittedBy,
    sourceType: "direct_upload" as const,
    sourcePayload: {
      assetClass: bundle.assetClass,
      assetId: bundle.id,
      name: bundle.name,
      slug: bundle.id.replace("workflow:", "studio-bundle-"),
      description: bundle.description,
      trustBand: "L4_PRODUCTION_APPROVED" as TrustBand,
      publicationStatus: "approved",
      wrapperStrategy: "workflow",
      workflowEngine: bundle.engine,
      triggerType: bundle.triggerType,
      tags: bundle.tags,
      metadata: {
        presetId: bundle.presetId,
        blockKinds: bundle.blockKinds,
        studioNative: true,
      },
    },
  }));

  return [...skillIntakes, ...bundleIntakes];
}
