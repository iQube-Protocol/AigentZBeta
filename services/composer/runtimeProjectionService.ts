import { listExperienceRecords } from "@/services/composer/composerPersistence";
import {
  runtimeProjectionToCapsuleRecord,
  type RuntimeCapsuleProjection,
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
