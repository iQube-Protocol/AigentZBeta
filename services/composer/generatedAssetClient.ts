import type { ComposerGeneratedAssetRef } from "@/services/copilot/composer/types";
import { recordRuntimeLifecycleContribution } from "@/services/composer/runtimeLifecycleClient";

type ExperienceMetadata = {
  generated_assets?: Array<Record<string, unknown>>;
  generated_receipts?: Record<string, unknown>;
  dprReceipts?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

type ExperienceQubeResponse = {
  success?: boolean;
  experience_qube?: {
    id?: string;
    tenant_id?: string;
    metadata?: ExperienceMetadata;
  };
};

type LifecycleSummary = {
  generatedImageCount?: number;
  generatedVideoCount?: number;
  lastGeneratedAt?: string;
  lastGeneratedByPersonaId?: string;
};

type PersonaGeneratedMediaRecord = {
  id: string;
  experienceId: string;
  personaId: string;
  type: "image" | "video";
  label: string;
  provider?: string;
  orientation?: "portrait" | "landscape";
  assetUrl?: string;
  storagePath?: string;
  receiptRef?: string;
  prompt?: string;
  createdAt?: string;
  updatedAt: string;
  useCount?: number;
  lastUsedAt?: string;
  lastUsedInExperienceId?: string;
  lastAction?: "generated" | "reused";
  previewCount?: number;
  launchCount?: number;
  lastPreviewAt?: string;
  lastLaunchAt?: string;
  pinnedToExperienceId?: string;
  pinnedAt?: string;
};

export type PersistableGeneratedAsset = ComposerGeneratedAssetRef & {
  prompt?: string;
  createdAt?: string;
};

function toObjectAsset(asset: PersistableGeneratedAsset) {
  return {
    id: asset.id,
    type: asset.type,
    label: asset.label,
    provider: asset.provider,
    orientation: asset.orientation,
    asset_url: asset.assetUrl,
    storage_path: asset.storagePath,
    receipt_ref: asset.receiptRef,
    prompt: asset.prompt,
    created_at: asset.createdAt,
  };
}

function assetMergeKey(asset: Record<string, unknown>) {
  const type = String(asset.type || "image");
  const orientation = asset.orientation ? String(asset.orientation) : "";
  if (type === "image" && orientation) {
    return `${type}:${orientation}`;
  }
  const provider = asset.provider ? String(asset.provider) : "";
  const label = asset.label ? String(asset.label) : "";
  return `${type}:${provider}:${label}`;
}

function normalizeReceipt(
  receipt: Record<string, unknown> | undefined,
  tenantId: string,
  experienceId: string,
) {
  if (!receipt) return null;
  const receiptId =
    typeof receipt.receipt_id === "string" && receipt.receipt_id.trim()
      ? receipt.receipt_id.trim()
      : null;
  if (!receiptId) return null;

  const timestamp =
    typeof receipt.timestamp === "string" && receipt.timestamp.trim()
      ? receipt.timestamp
      : new Date().toISOString();
  const receiptType =
    typeof receipt.receipt_type === "string" && receipt.receipt_type.trim()
      ? receipt.receipt_type
      : "artifact.generated";
  const payload =
    receipt.payload && typeof receipt.payload === "object"
      ? { ...(receipt.payload as Record<string, unknown>) }
      : {};

  return {
    ...receipt,
    receipt_id: receiptId,
    tenant_id:
      typeof receipt.tenant_id === "string" && receipt.tenant_id.trim()
        ? receipt.tenant_id
        : tenantId,
    timestamp,
    receipt_type: receiptType,
    payload: {
      experience_id: experienceId,
      ...payload,
    },
  };
}

function toPersonaMediaRecord(
  experienceId: string,
  personaId: string,
  asset: PersistableGeneratedAsset,
): PersonaGeneratedMediaRecord {
  return {
    id: asset.id,
    experienceId,
    personaId,
    type: asset.type,
    label: asset.label,
    provider: asset.provider,
    orientation: asset.orientation,
    assetUrl: asset.assetUrl,
    storagePath: asset.storagePath,
    receiptRef: asset.receiptRef,
    prompt: asset.prompt,
    createdAt: asset.createdAt,
    updatedAt: new Date().toISOString(),
    lastAction: "generated",
  };
}

function mergePersonaMediaRecord(
  existing: PersonaGeneratedMediaRecord | undefined,
  next: PersonaGeneratedMediaRecord,
): PersonaGeneratedMediaRecord {
  return {
    ...existing,
    ...next,
    useCount: existing?.useCount || 0,
    lastUsedAt: existing?.lastUsedAt,
    lastUsedInExperienceId: existing?.lastUsedInExperienceId,
    lastAction: next.lastAction || existing?.lastAction || "generated",
    previewCount: existing?.previewCount || 0,
    launchCount: existing?.launchCount || 0,
    lastPreviewAt: existing?.lastPreviewAt,
    lastLaunchAt: existing?.lastLaunchAt,
    pinnedToExperienceId: existing?.pinnedToExperienceId,
    pinnedAt: existing?.pinnedAt,
  };
}

async function persistPersonaGeneratedMediaLibrary(options: {
  personaId?: string;
  experienceId: string;
  assets: PersistableGeneratedAsset[];
}) {
  const personaId = options.personaId?.trim();
  if (!personaId || options.assets.length === 0) return;

  const key = "composer_generated_media_library_v1";
  const existingResponse = await fetch(
    `/api/ops/state/user-preferences?userId=${encodeURIComponent(personaId)}&category=workflow&keys=${encodeURIComponent(key)}`,
    { cache: "no-store" }
  );

  let existingLibrary: PersonaGeneratedMediaRecord[] = [];
  if (existingResponse.ok) {
    const existingJson = await existingResponse.json().catch(() => null);
    const raw = existingJson?.preferences?.[key];
    if (Array.isArray(raw)) {
      existingLibrary = raw.filter(
        (item): item is PersonaGeneratedMediaRecord => Boolean(item && typeof item === "object")
      );
    }
  }

  const nextById = new Map<string, PersonaGeneratedMediaRecord>();
  existingLibrary.forEach((item) => nextById.set(item.id, item));
  options.assets.forEach((asset) => {
    const nextRecord = toPersonaMediaRecord(options.experienceId, personaId, asset);
    nextById.set(
      asset.id,
      mergePersonaMediaRecord(nextById.get(asset.id), nextRecord)
    );
  });

  const nextLibrary = Array.from(nextById.values())
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 100);

  await fetch("/api/ops/state/user-preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: personaId,
      preferences: {
        [key]: nextLibrary,
      },
    }),
  });
}

export async function markPersonaGeneratedMediaUsage(options: {
  personaId?: string;
  mediaId: string;
  experienceId: string;
}) {
  const personaId = options.personaId?.trim();
  const mediaId = options.mediaId.trim();
  if (!personaId || !mediaId || !options.experienceId) return;

  const key = "composer_generated_media_library_v1";
  const existingResponse = await fetch(
    `/api/ops/state/user-preferences?userId=${encodeURIComponent(personaId)}&category=workflow&keys=${encodeURIComponent(key)}`,
    { cache: "no-store" }
  );

  let existingLibrary: PersonaGeneratedMediaRecord[] = [];
  if (existingResponse.ok) {
    const existingJson = await existingResponse.json().catch(() => null);
    const raw = existingJson?.preferences?.[key];
    if (Array.isArray(raw)) {
      existingLibrary = raw.filter(
        (item): item is PersonaGeneratedMediaRecord => Boolean(item && typeof item === "object")
      );
    }
  }

  const now = new Date().toISOString();
  const nextLibrary = existingLibrary.map((item) =>
    item.id === mediaId
      ? {
          ...item,
          updatedAt: now,
          useCount: (item.useCount || 0) + 1,
          lastUsedAt: now,
          lastUsedInExperienceId: options.experienceId,
          lastAction: "reused" as const,
        }
      : item
  );

  await fetch("/api/ops/state/user-preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: personaId,
      preferences: {
        [key]: nextLibrary,
      },
    }),
  });
}

export async function markPersonaGeneratedMediaLifecycle(options: {
  personaId?: string;
  experienceId: string;
  action: "experience_preview" | "experience_launch";
}) {
  const personaId = options.personaId?.trim();
  const experienceId = options.experienceId.trim();
  if (!personaId || !experienceId) return;

  const key = "composer_generated_media_library_v1";
  const existingResponse = await fetch(
    `/api/ops/state/user-preferences?userId=${encodeURIComponent(personaId)}&category=workflow&keys=${encodeURIComponent(key)}`,
    { cache: "no-store" }
  );

  let existingLibrary: PersonaGeneratedMediaRecord[] = [];
  if (existingResponse.ok) {
    const existingJson = await existingResponse.json().catch(() => null);
    const raw = existingJson?.preferences?.[key];
    if (Array.isArray(raw)) {
      existingLibrary = raw.filter(
        (item): item is PersonaGeneratedMediaRecord => Boolean(item && typeof item === "object")
      );
    }
  }

  const now = new Date().toISOString();
  const nextLibrary = existingLibrary.map((item) => {
    const matchesExperience =
      item.experienceId === experienceId || item.lastUsedInExperienceId === experienceId;
    if (!matchesExperience) return item;

    return {
      ...item,
      updatedAt: now,
      previewCount:
        options.action === "experience_preview"
          ? (item.previewCount || 0) + 1
          : item.previewCount || 0,
      launchCount:
        options.action === "experience_launch"
          ? (item.launchCount || 0) + 1
          : item.launchCount || 0,
      lastPreviewAt:
        options.action === "experience_preview" ? now : item.lastPreviewAt,
      lastLaunchAt:
        options.action === "experience_launch" ? now : item.lastLaunchAt,
    };
  });

  await fetch("/api/ops/state/user-preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: personaId,
      preferences: {
        [key]: nextLibrary,
      },
    }),
  });
}

export async function setPersonaGeneratedMediaPinned(options: {
  personaId?: string;
  mediaId: string;
  pinnedToExperienceId?: string | null;
}) {
  const personaId = options.personaId?.trim();
  const mediaId = options.mediaId.trim();
  if (!personaId || !mediaId) return;

  const key = "composer_generated_media_library_v1";
  const existingResponse = await fetch(
    `/api/ops/state/user-preferences?userId=${encodeURIComponent(personaId)}&category=workflow&keys=${encodeURIComponent(key)}`,
    { cache: "no-store" }
  );

  let existingLibrary: PersonaGeneratedMediaRecord[] = [];
  if (existingResponse.ok) {
    const existingJson = await existingResponse.json().catch(() => null);
    const raw = existingJson?.preferences?.[key];
    if (Array.isArray(raw)) {
      existingLibrary = raw.filter(
        (item): item is PersonaGeneratedMediaRecord => Boolean(item && typeof item === "object")
      );
    }
  }

  const now = new Date().toISOString();
  const nextLibrary = existingLibrary.map((item) =>
    item.id === mediaId
      ? {
          ...item,
          updatedAt: now,
          pinnedToExperienceId: options.pinnedToExperienceId || undefined,
          pinnedAt: options.pinnedToExperienceId ? now : undefined,
        }
      : item
  );

  await fetch("/api/ops/state/user-preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: personaId,
      preferences: {
        [key]: nextLibrary,
      },
    }),
  });
}

export async function persistGeneratedAssetsForExperience(options: {
  experienceId: string;
  assets: PersistableGeneratedAsset[];
  receipt?: Record<string, unknown>;
}) {
  if (!options.experienceId || options.assets.length === 0) return;

  const existingResponse = await fetch(`/api/composer/experiences/${options.experienceId}`, {
    cache: "no-store",
  });

  if (!existingResponse.ok) {
    throw new Error(`Failed to load experience ${options.experienceId}`);
  }

  const existingData = (await existingResponse.json()) as ExperienceQubeResponse;
  const tenantId = existingData.experience_qube?.tenant_id || "tnt_clawhack";
  const existingMetadata = (existingData.experience_qube?.metadata || {}) as ExperienceMetadata;
  const creatorPersonaId =
    typeof existingMetadata.creator_persona === "object" &&
    existingMetadata.creator_persona &&
    typeof (existingMetadata.creator_persona as Record<string, unknown>).id === "string"
      ? ((existingMetadata.creator_persona as Record<string, unknown>).id as string)
      : undefined;
  const existingAssets = Array.isArray(existingMetadata.generated_assets)
    ? existingMetadata.generated_assets
    : [];

  const nextAssetsByKey = new Map<string, Record<string, unknown>>();
  existingAssets.forEach((asset) => {
    nextAssetsByKey.set(assetMergeKey(asset), asset);
  });
  options.assets.map(toObjectAsset).forEach((asset) => {
    nextAssetsByKey.set(assetMergeKey(asset), asset);
  });

  const receiptId =
    typeof options.receipt?.receipt_id === "string" && options.receipt.receipt_id.trim()
      ? options.receipt.receipt_id.trim()
      : null;

  const nextReceipts = {
    ...(existingMetadata.generated_receipts || {}),
    ...(receiptId ? { [receiptId]: options.receipt } : {}),
  };
  const normalizedReceipt = normalizeReceipt(options.receipt, tenantId, options.experienceId);
  const existingDprReceipts = Array.isArray(existingMetadata.dprReceipts)
    ? existingMetadata.dprReceipts.filter(
        (item): item is Record<string, unknown> => Boolean(item && typeof item === "object"),
      )
    : [];
  const nextDprReceiptsById = new Map<string, Record<string, unknown>>();
  existingDprReceipts.forEach((receipt) => {
    const existingReceiptId =
      typeof receipt.receipt_id === "string" && receipt.receipt_id.trim()
        ? receipt.receipt_id.trim()
        : null;
    if (existingReceiptId) {
      nextDprReceiptsById.set(existingReceiptId, receipt);
    }
  });
  if (normalizedReceipt) {
    nextDprReceiptsById.set(normalizedReceipt.receipt_id, normalizedReceipt);
  }

  const now = new Date().toISOString();
  const previousLifecycle =
    existingMetadata.lifecycle_summary &&
    typeof existingMetadata.lifecycle_summary === "object"
      ? (existingMetadata.lifecycle_summary as LifecycleSummary)
      : {};
  const generatedImageCount =
    (previousLifecycle.generatedImageCount || 0) +
    options.assets.filter((asset) => asset.type === "image").length;
  const generatedVideoCount =
    (previousLifecycle.generatedVideoCount || 0) +
    options.assets.filter((asset) => asset.type === "video").length;

  const updateResponse = await fetch(`/api/composer/experiences/${options.experienceId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      metadata: {
        generated_assets: Array.from(nextAssetsByKey.values()),
        generated_receipts: nextReceipts,
        dprReceipts: Array.from(nextDprReceiptsById.values()).slice(-100),
        lifecycle_summary: {
          ...previousLifecycle,
          generatedImageCount,
          generatedVideoCount,
          lastGeneratedAt: now,
          lastGeneratedByPersonaId:
            creatorPersonaId || previousLifecycle.lastGeneratedByPersonaId,
        },
      },
    }),
  });

  if (!updateResponse.ok) {
    throw new Error(`Failed to persist generated assets for ${options.experienceId}`);
  }

  void persistPersonaGeneratedMediaLibrary({
    personaId: creatorPersonaId,
    experienceId: options.experienceId,
    assets: options.assets,
  }).catch(() => undefined);

  const assetTypes = new Set(options.assets.map((asset) => asset.type));
  if (assetTypes.has("image")) {
    void recordRuntimeLifecycleContribution({
      tenantId,
      personaId: creatorPersonaId,
      experienceId: options.experienceId,
      contributionType: "generated_image",
      source: "studio-generated-asset",
      units: options.assets.filter((asset) => asset.type === "image").length,
    }).catch(() => undefined);
  }
  if (assetTypes.has("video")) {
    void recordRuntimeLifecycleContribution({
      tenantId,
      personaId: creatorPersonaId,
      experienceId: options.experienceId,
      contributionType: "generated_video",
      source: "studio-generated-asset",
      units: options.assets.filter((asset) => asset.type === "video").length,
    }).catch(() => undefined);
  }
}
