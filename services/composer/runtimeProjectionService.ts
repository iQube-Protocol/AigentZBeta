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
      return runtimeProjectionToCapsuleRecord({
        experience,
        projection,
      });
    })
    .filter((item): item is RuntimeCapsuleRecord => Boolean(item));
}
