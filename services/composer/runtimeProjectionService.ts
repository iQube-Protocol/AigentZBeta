import {
  getExperienceRecord,
  listExperienceRecords,
  updateExperienceRecord,
} from "@/services/composer/composerPersistence";
import {
  runtimeProjectionToCapsuleRecord,
  type RuntimeCapsuleProjection,
  type RuntimeProjectionStatus,
} from "@/services/composer/runtimeProjectionShared";
import type { RuntimeCapsuleRecord } from "@/types/runtimeCapsules";

type RecordLike = Record<string, unknown>;

function asRecord(value: unknown): RecordLike | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordLike) : null;
}

/**
 * Ensures `projection.experience_context.acceptedBlockOutputs.article_draft.generated`
 * is populated. If the projection was published before the article existed (or the article
 * was generated/edited after publish), falls back to the live experience configuration.
 */
function resolveArticleDraftFallback(
  projection: RuntimeCapsuleProjection,
  experience: { configuration: Record<string, unknown>; metadata: unknown }
): RuntimeCapsuleProjection {
  const ctx = asRecord(projection.experience_context);
  const existing = asRecord(
    asRecord(asRecord(ctx?.acceptedBlockOutputs)?.article_draft)?.generated
  );
  if (existing) return projection;

  // Try configuration.article_draft.generated (most up-to-date — updated on every save)
  const fromConfig = asRecord(asRecord(experience.configuration?.article_draft)?.generated);
  // Fallback: metadata.editable_generation.article_draft.generated
  const meta = asRecord(experience.metadata as unknown);
  const fromEditGen = asRecord(
    asRecord(asRecord(asRecord(meta?.editable_generation)?.article_draft)?.generated)
  );

  const fallback = fromConfig ?? fromEditGen;
  if (!fallback) return projection;

  return {
    ...projection,
    experience_context: {
      ...(ctx ?? {}),
      acceptedBlockOutputs: {
        ...(asRecord(ctx?.acceptedBlockOutputs) ?? {}),
        article_draft: {
          ...(asRecord(asRecord(ctx?.acceptedBlockOutputs)?.article_draft) ?? {}),
          generated: fallback,
        },
      },
    },
  };
}

export async function listPublishedRuntimeCapsuleRecords(params: {
  tenantId?: string;
  codexId?: string | null;
  codexTab?: string | null;
  cartridge?: string | null;
  limit?: number;
}): Promise<RuntimeCapsuleRecord[]> {
  const result = await listExperienceRecords({
    tenant_id: params.tenantId || undefined,
    limit: Math.max(50, params.limit || 200),
    offset: 0,
  });

  return result.items
    .map((experience) => {
      const metadata = asRecord(experience.metadata) ?? {};
      const projection = asRecord(metadata.runtime_publication) as RuntimeCapsuleProjection | null;
      if (!projection || projection.status !== "published") return null;
      if (params.codexId && projection.primary_codex_id !== params.codexId) return null;
      if (params.codexTab && projection.primary_codex_tab !== params.codexTab) return null;
      if (params.cartridge && projection.cartridge_id !== params.cartridge) return null;
      const projectionWithArticle = resolveArticleDraftFallback(projection, {
        configuration: experience.configuration as Record<string, unknown>,
        metadata: experience.metadata,
      });
      return runtimeProjectionToCapsuleRecord({
        experience,
        projection: projectionWithArticle,
      });
    })
    .filter((item): item is RuntimeCapsuleRecord => Boolean(item));
}

export interface RuntimeProjectionAdminRecord {
  experienceId: string;
  projectionId: string;
  title: string;
  status: RuntimeProjectionStatus;
  cartridge: string;
  codexId: string;
  codexTab: string;
  menuIntent: string;
  thumbUrl: string | null;
  publishedAt: string | null;
}

/**
 * Lists every experience that carries a runtime_publication projection,
 * normalized for the metaMe admin controller. Unlike
 * listPublishedRuntimeCapsuleRecords this returns ALL statuses (so the admin
 * can see pending_review items awaiting promotion, plus published / unpublished
 * / archived) — gating is the admin's job, not this reader's.
 */
export async function listRuntimeProjectionAdminRecords(params?: {
  tenantId?: string;
  statuses?: RuntimeProjectionStatus[];
  limit?: number;
}): Promise<RuntimeProjectionAdminRecord[]> {
  const result = await listExperienceRecords({
    tenant_id: params?.tenantId || undefined,
    limit: Math.max(50, params?.limit || 200),
    offset: 0,
  });
  const statusFilter = params?.statuses ? new Set(params.statuses) : null;

  return result.items
    .map((experience) => {
      const metadata = asRecord(experience.metadata) ?? {};
      const projection = asRecord(metadata.runtime_publication) as RuntimeCapsuleProjection | null;
      if (!projection || !projection.experience_id) return null;
      const status = (projection.status ?? "draft") as RuntimeProjectionStatus;
      if (statusFilter && !statusFilter.has(status)) return null;
      const thumbUrl =
        projection.preview_asset ||
        projection.landscape_asset ||
        projection.portrait_asset ||
        projection.preferred_asset ||
        null;
      return {
        experienceId: experience.id,
        projectionId: projection.projection_id,
        title: (experience as { name?: string }).name || "Published Experience",
        status,
        cartridge: projection.cartridge_id || projection.primary_codex_slug || "metame",
        codexId: projection.primary_codex_id,
        codexTab: projection.primary_codex_tab,
        menuIntent: projection.menu_intent,
        thumbUrl,
        publishedAt: projection.published_at ?? null,
      } satisfies RuntimeProjectionAdminRecord;
    })
    .filter((item): item is RuntimeProjectionAdminRecord => Boolean(item));
}

/**
 * Flips a single experience's runtime_publication.status. The metadata merge in
 * updateExperienceRecord is shallow at the metadata level, so we re-send the
 * full projection object with the new status (and stamp published_at when
 * publishing). Returns false when the experience or its projection is missing.
 */
export async function setRuntimeProjectionStatus(
  experienceId: string,
  status: RuntimeProjectionStatus,
): Promise<boolean> {
  const existing = await getExperienceRecord(experienceId);
  if (!existing) return false;
  const metadata = asRecord(existing.metadata) ?? {};
  const projection = asRecord(metadata.runtime_publication) as RuntimeCapsuleProjection | null;
  if (!projection) return false;

  const nextProjection: RuntimeCapsuleProjection = {
    ...projection,
    status,
    ...(status === "published" ? { published_at: new Date().toISOString() } : {}),
  };

  const updated = await updateExperienceRecord(experienceId, {
    metadata: {
      ...metadata,
      runtime_publication: nextProjection,
    },
  } as Parameters<typeof updateExperienceRecord>[1]);
  return Boolean(updated);
}
