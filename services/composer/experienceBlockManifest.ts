type RecordLike = Record<string, unknown>;

type ExperienceLike = {
  id?: string;
  template_id?: string;
  name?: string;
  description?: string;
  goal?: string;
  configuration?: RecordLike | null;
  components?: unknown[] | null;
  metadata?: RecordLike | null;
};

export type ExperienceBlockKind =
  | "image_generation"
  | "video_generation"
  | "article_draft"
  // Coherent Bundle Generation (2026-07-19): ONE block that produces a
  // constitutional video + companion article from one invariant substrate,
  // coherent by construction. Judgement is a post-accept affordance, not a
  // block (the sequencing engine cannot express a never-gating block).
  | "coherent_bundle"
  | "deployment";

export type ExperienceBlockState = "ready" | "partial" | "stubbed";

export type ExperienceBlockDescriptor = {
  id: string;
  kind: ExperienceBlockKind;
  label: string;
  state: ExperienceBlockState;
  inputs: string[];
  outputs: string[];
  dependsOn: string[];
  evidence: string[];
  notes: string[];
};

export type ExperienceBlockManifest = {
  primaryFlow: "single_block" | "compound_ready";
  blockCount: number;
  blocks: ExperienceBlockDescriptor[];
  sequencing: string[];
  nextCompositionOpportunities: string[];
};

function asRecord(value: unknown): RecordLike | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordLike) : null;
}

function firstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function hasGeneratedAssetType(metadata: RecordLike, type: "image" | "video") {
  const assets = Array.isArray(metadata.generated_assets) ? metadata.generated_assets : [];
  return assets.some((asset) => {
    const record = asRecord(asset);
    if (!record) return false;
    const explicitType = firstString([record.type, record.media_type]);
    if (explicitType) return explicitType === type;
    const url = firstString([
      record.asset_url,
      record.assetUrl,
      record.video_url,
      record.videoUrl,
      record.image_url,
      record.imageUrl,
      record.url,
    ]);
    return type === "video"
      ? Boolean(url && /\.(mp4|m4v|mov|webm|ogg)(\?|$)/i.test(url))
      : Boolean(url && !/\.(mp4|m4v|mov|webm|ogg)(\?|$)/i.test(url));
  });
}

function hasDeploymentState(metadata: RecordLike) {
  const deploymentState = asRecord(metadata.deployment_state);
  return Boolean(deploymentState && firstString([deploymentState.last_target, deploymentState.last_status]));
}

function inferArticleLike(experience: ExperienceLike, metadata: RecordLike) {
  const haystack = [
    experience.template_id,
    experience.name,
    experience.description,
    experience.goal,
    firstString([metadata.article_prompt, metadata.article_title]),
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (!haystack) return false;
  return /(article|editorial|reading|read|feature|copy|draft)/.test(haystack);
}

function inferVideoLike(experience: ExperienceLike) {
  const haystack = [
    experience.template_id,
    experience.name,
    experience.description,
    experience.goal,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return /(video|watch|trailer|motion|clip|sora)/.test(haystack);
}

function hasCoherentBundle(experience: ExperienceLike, metadata: RecordLike) {
  if (experience.template_id === "constitutional-video") return true;
  const outputs = asRecord(metadata.block_outputs);
  return Boolean(outputs && asRecord(outputs.coherent_bundle));
}

export function buildExperienceBlockManifest(experience: ExperienceLike | null): ExperienceBlockManifest {
  const metadata = asRecord(experience?.metadata) ?? {};
  const hasCoherentBundleBlock = hasCoherentBundle(experience || {}, metadata);
  // The coherent-bundle block owns video + article jointly — don't also infer
  // them as separate blocks when it's present.
  const hasImageBlock = hasGeneratedAssetType(metadata, "image");
  const hasVideoBlock = !hasCoherentBundleBlock && (hasGeneratedAssetType(metadata, "video") || inferVideoLike(experience || {}));
  const hasArticleBlock = !hasCoherentBundleBlock && inferArticleLike(experience || {}, metadata);
  const hasDeploymentBlock = hasDeploymentState(metadata);

  const blocks: ExperienceBlockDescriptor[] = [];

  if (hasCoherentBundleBlock) {
    const outputs = asRecord(metadata.block_outputs);
    const bundleOut = outputs ? asRecord(outputs.coherent_bundle) : null;
    const hasVideo = Boolean(bundleOut && firstString([bundleOut.video_url]));
    const hasArticle = Boolean(bundleOut && (bundleOut.article || firstString([bundleOut.article_ref])));
    blocks.push({
      id: "coherent_bundle",
      kind: "coherent_bundle",
      label: "Coherent Bundle",
      state: hasVideo && hasArticle ? "ready" : bundleOut ? "partial" : "stubbed",
      inputs: ["content direction", "invariant grounding", "duration + CTA", "asset kinds"],
      outputs: ["shared brief", "voiced constitutional video", "companion article", "built-in coherence evidence"],
      dependsOn: [],
      evidence: ["built-in coherence score", "optional independent judgement"],
      notes: [
        "One invariant substrate -> mutually-coherent assets, coherent by construction (operationalizes EXP-001).",
        "Independent judgement is an optional post-accept affordance, never required to advance.",
      ],
    });
  }

  if (hasImageBlock) {
    blocks.push({
      id: "image_generation",
      kind: "image_generation",
      label: "Image generation",
      state: "ready",
      inputs: ["creator prompt", "provider binding", "portrait/landscape framing"],
      outputs: ["generated image refs", "orientation-aware runtime media"],
      dependsOn: [],
      evidence: ["saved generated image asset", "experience media reuse path"],
      notes: ["Current supported foundation block for article-led experiences."],
    });
  }

  if (hasVideoBlock) {
    blocks.push({
      id: "video_generation",
      kind: "video_generation",
      label: "Video generation",
      state: hasGeneratedAssetType(metadata, "video") ? "partial" : "stubbed",
      inputs: ["creator prompt", "provider binding", "duration/model selection"],
      outputs: ["generated video ref", "watch-oriented runtime media"],
      dependsOn: [],
      evidence: hasGeneratedAssetType(metadata, "video")
        ? ["persisted video asset exists"]
        : ["template/prompt indicates video intent"],
      notes: hasGeneratedAssetType(metadata, "video")
        ? ["Foundation block exists, but runtime/launcher parity is still deferred backlog."]
        : ["Video block is identified, but no persisted video asset is attached yet."],
    });
  }

  if (hasArticleBlock) {
    blocks.push({
      id: "article_draft",
      kind: "article_draft",
      label: "Article draft",
      state: "partial",
      inputs: ["article prompt", "codex context", "linked image/video assets"],
      outputs: ["editorial copy", "read-oriented runtime surface"],
      dependsOn: hasImageBlock || hasVideoBlock ? ["image_generation/video_generation"] : [],
      evidence: ["article-led template or goal detected"],
      notes: ["Article/copy is conceptually in flow, but not yet a fully isolated production block."],
    });
  }

  if (hasDeploymentBlock) {
    blocks.push({
      id: "deployment",
      kind: "deployment",
      label: "Deployment",
      state: "ready",
      inputs: ["artifact selection", "delivery mode", "destination adapter"],
      outputs: ["deployment proof", "publish/launch URLs", "adapter guidance"],
      dependsOn: blocks.length > 0 ? blocks.filter((block) => block.kind !== "deployment").map((block) => block.id) : [],
      evidence: ["deployment proof/history exists on the experience"],
      notes: ["Deployment is now a standalone reusable unit."],
    });
  }

  const sequencing =
    blocks.length > 1
      ? [
          "Generate or bind media blocks first.",
          "Layer article/copy once media context is stable.",
          "Run deployment last against the selected artifact bundle.",
        ]
      : [
          "Current experience is still operating primarily as a single-block flow.",
        ];

  const nextCompositionOpportunities: string[] = [];
  if (hasImageBlock && !hasArticleBlock) {
    nextCompositionOpportunities.push("Bundle image generation with article/copy drafting.");
  }
  if (hasVideoBlock && !hasArticleBlock) {
    nextCompositionOpportunities.push("Bundle video generation with editorial/copy support.");
  }
  if ((hasImageBlock || hasVideoBlock) && hasArticleBlock && hasDeploymentBlock) {
    nextCompositionOpportunities.push("Promote this flow into a reusable multi-block Make bundle.");
  }
  if (nextCompositionOpportunities.length === 0) {
    nextCompositionOpportunities.push("Add a second production-grade block before moving into compound sequencing.");
  }

  return {
    primaryFlow: blocks.length >= 3 ? "compound_ready" : "single_block",
    blockCount: blocks.length,
    blocks,
    sequencing,
    nextCompositionOpportunities,
  };
}
