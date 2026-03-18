export type RuntimeCapsuleSourceType = "experience" | "codex" | "smart-content";
export type RuntimeLaunchType = "experience" | "codex" | "content";
export type RuntimeAssetStatus = "resolved" | "missing";

export interface RuntimeCapsuleAssetRef {
  uri: string;
  kind: "hero" | "thumbnail";
  origin: "experience" | "smart-content" | "codex";
}

export interface RuntimeCapsuleLaunchTarget {
  type: RuntimeLaunchType;
  href: string;
}

export interface RuntimeCapsuleMetadata {
  tenantId?: string;
  codexId?: string;
  codexSlug?: string;
  codexTab?: string;
  runtimeCartridge?: string;
  projectionId?: string;
  surfaceIntent?: "make" | "play";
  modalityHints: string[];
  durationMinutes?: number | null;
  priceLabel?: string | null;
  status?: string | null;
  contentKind?: "article" | "video" | "character" | "episode" | "generic";
  previewMediaUri?: string | null;
  activeExperienceContext?: Record<string, unknown>;
}

export interface RuntimeCapsuleRecord {
  id: string;
  sourceType: RuntimeCapsuleSourceType;
  title: string;
  description: string;
  heroAsset: RuntimeCapsuleAssetRef | null;
  thumbnailAsset: RuntimeCapsuleAssetRef | null;
  assetStatus: RuntimeAssetStatus;
  metadata: RuntimeCapsuleMetadata;
  launchTarget: RuntimeCapsuleLaunchTarget;
}

export interface RuntimeCapsulesResponse {
  success: boolean;
  capsules: RuntimeCapsuleRecord[];
  total: number;
  focus: string[];
}
