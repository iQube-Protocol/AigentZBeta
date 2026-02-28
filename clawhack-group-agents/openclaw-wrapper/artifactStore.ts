import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MintArtifactInput, MintedArtifactRef } from "./types";

interface ArtifactStoreConfig {
  baseDir?: string;
}

function hashPayload(payload: unknown): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(payload));
  return `sha256:${hash.digest("hex")}`;
}

export class ArtifactStore {
  private readonly baseDir: string;

  constructor(config: ArtifactStoreConfig = {}) {
    this.baseDir = config.baseDir ?? path.join(process.cwd(), ".data", "artifacts");
  }

  async mintArtifact(input: MintArtifactInput): Promise<MintedArtifactRef> {
    await mkdir(this.baseDir, { recursive: true });

    const createdTs = new Date().toISOString();
    const prefix = input.type === "MediaQube" ? "iq_media" : "iq_content";
    const iqubeId = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const contentHash = hashPayload(input.payload);
    const filename = `${iqubeId}.json`;
    const storagePath = path.join(this.baseDir, filename);

    const artifactDocument = {
      schema:
        input.type === "MediaQube"
          ? "metame.iqube.media.v0"
          : "metame.iqube.content.v0",
      iqube_id: iqubeId,
      tenant_id: input.tenantId,
      thread_key: input.threadKey,
      request_id: input.requestId,
      label: input.label,
      type: input.type,
      created_ts: createdTs,
      content_hash: contentHash,
      toolchain: input.toolchain,
      payload: input.payload,
      versions: [{ version: 1, ts: createdTs, hash: contentHash }],
    };

    await writeFile(storagePath, JSON.stringify(artifactDocument, null, 2), "utf8");

    return {
      iqube_id: iqubeId,
      type: input.type,
      label: input.label,
      version: 1,
      content_hash: contentHash,
      created_ts: createdTs,
      request_id: input.requestId,
      toolchain: input.toolchain,
      storage_path: storagePath,
    };
  }
}
