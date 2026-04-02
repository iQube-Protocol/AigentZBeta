/**
 * FetcherService — fetches and fingerprints source artifacts.
 *
 * For each intake, this service retrieves the source (GitHub repo metadata,
 * npm package manifest, MCP endpoint description, etc.) and records a
 * SourceQube with a content hash and detected manifest.
 *
 * IMPORTANT: This service only reads/describes external sources.
 * It does NOT execute any fetched code. Full content download is deferred
 * to a controlled worker environment (out of scope for MVP).
 */

import { createSource, updateSource, updateIntake, getIntake } from "./persistence";
import { emitReceipt } from "./receiptEmitter";
import { advanceIntakeStage } from "./intakeService";
import {
  IngestionSourceType,
  SourceManifest,
  SourceQube,
} from "@/types/registryIngestion";

function generateId(): string {
  return `src_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface FetchResult {
  ok: boolean;
  source?: SourceQube;
  error?: string;
}

/**
 * Fetches metadata for an intake. Each source type has a handler that
 * reads only public metadata — no code execution occurs here.
 */
export async function fetchAndFingerprint(intakeId: string): Promise<FetchResult> {
  const intake = await getIntake(intakeId);
  if (!intake) return { ok: false, error: `Intake not found: ${intakeId}` };

  await advanceIntakeStage(intakeId, "source.fetching", intake.stageHistory);
  await updateIntake(intakeId, { status: "fetching" });

  const sourceId = generateId();
  let manifest: SourceManifest = {};
  let rawRefs: string[] = [];

  try {
    const fetched = await dispatchFetch(
      intake.sourceType,
      intake.sourceUri,
      intake.sourcePayload
    );
    manifest = fetched.manifest;
    rawRefs = fetched.rawRefs;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Fetch failed";
    await advanceIntakeStage(intakeId, "ingestion.failed", intake.stageHistory, undefined, errMsg);
    await updateIntake(intakeId, { status: "failed", failureReason: errMsg });
    return { ok: false, error: errMsg };
  }

  const source = await createSource({
    sourceId,
    intakeId,
    sourceType: intake.sourceType,
    uri: intake.sourceUri,
    manifest,
    rawRefs,
    fetchStatus: "completed",
    fetchedAt: new Date().toISOString(),
  });

  await advanceIntakeStage(intakeId, "source.fetched", intake.stageHistory, { sourceId });
  await updateIntake(intakeId, { status: "fetching" });

  await emitReceipt({
    eventType: "source.fetched",
    actorId: "system",
    tenantId: intake.tenantId,
    intakeId,
    payload: {
      sourceId,
      sourceType: intake.sourceType,
      uri: intake.sourceUri,
      manifestName: manifest.name,
      manifestVersion: manifest.version,
      manifestLicense: manifest.license,
    },
  });

  return { ok: true, source };
}

// ─────────────────────────────────────────────────────────────────────────────
// Source-type dispatch — read-only metadata retrieval only
// ─────────────────────────────────────────────────────────────────────────────

async function dispatchFetch(
  sourceType: IngestionSourceType,
  uri?: string,
  payload?: Record<string, unknown>
): Promise<{ manifest: SourceManifest; rawRefs: string[] }> {
  switch (sourceType) {
    case "github_repo":
      return fetchGitHubRepoManifest(uri, payload);
    case "package_ref":
      return fetchPackageManifest(uri, payload);
    case "mcp_endpoint":
      return fetchMcpManifest(uri, payload);
    case "archive":
      return extractArchiveManifest(payload);
    case "manual_bundle":
      return extractManualBundleManifest(payload);
    case "workflow_def":
      return extractWorkflowDefManifest(payload);
    default:
      throw new Error(`Unsupported sourceType: ${sourceType}`);
  }
}

/** Reads GitHub repo metadata via public API (no code execution). */
async function fetchGitHubRepoManifest(
  uri?: string,
  payload?: Record<string, unknown>
): Promise<{ manifest: SourceManifest; rawRefs: string[] }> {
  if (!uri) return { manifest: {}, rawRefs: [] };

  // Parse owner/repo from URI
  const match = uri.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return { manifest: { repository: uri }, rawRefs: [uri] };

  const [, owner, repo] = match;
  const repoSlug = repo.replace(/\.git$/, "");

  // Attempt to read package.json or basic repo info via GitHub API
  // No auth required for public repos; this is read-only metadata
  const manifest: SourceManifest = {
    name: repoSlug,
    repository: uri,
    author: owner,
    keywords: (payload?.keywords as string[]) ?? [],
  };

  // Attempt to fetch package.json from default branch
  try {
    const pkgUrl = `https://raw.githubusercontent.com/${owner}/${repoSlug}/main/package.json`;
    const res = await fetch(pkgUrl, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const pkg = await res.json() as Record<string, unknown>;
      manifest.name = typeof pkg.name === "string" ? pkg.name : repoSlug;
      manifest.version = typeof pkg.version === "string" ? pkg.version : undefined;
      manifest.description = typeof pkg.description === "string" ? pkg.description : undefined;
      manifest.license = typeof pkg.license === "string" ? pkg.license : undefined;
      manifest.dependencies = typeof pkg.dependencies === "object" && pkg.dependencies
        ? pkg.dependencies as Record<string, string>
        : undefined;
      manifest.keywords = Array.isArray(pkg.keywords) ? pkg.keywords as string[] : [];
    }
  } catch {
    // Network error or timeout — continue with partial manifest
  }

  return {
    manifest,
    rawRefs: [uri, `https://github.com/${owner}/${repoSlug}/blob/main/package.json`],
  };
}

/** Reads npm package metadata via public registry API. */
async function fetchPackageManifest(
  uri?: string,
  payload?: Record<string, unknown>
): Promise<{ manifest: SourceManifest; rawRefs: string[] }> {
  const packageName = uri ?? (payload?.packageName as string) ?? "";
  if (!packageName) return { manifest: {}, rawRefs: [] };

  const manifest: SourceManifest = { name: packageName };

  try {
    const res = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const pkg = await res.json() as Record<string, unknown>;
      manifest.version = typeof pkg.version === "string" ? pkg.version : undefined;
      manifest.description = typeof pkg.description === "string" ? pkg.description : undefined;
      manifest.license = typeof pkg.license === "string" ? pkg.license : undefined;
      manifest.author = typeof pkg.author === "object" && pkg.author
        ? (pkg.author as { name?: string }).name
        : typeof pkg.author === "string" ? pkg.author : undefined;
      manifest.homepage = typeof pkg.homepage === "string" ? pkg.homepage : undefined;
      manifest.keywords = Array.isArray(pkg.keywords) ? pkg.keywords as string[] : [];
      manifest.dependencies = typeof pkg.dependencies === "object" && pkg.dependencies
        ? pkg.dependencies as Record<string, string>
        : undefined;
    }
  } catch {
    // Continue with partial manifest
  }

  return {
    manifest,
    rawRefs: [`https://registry.npmjs.org/${packageName}`],
  };
}

/** Describes an MCP endpoint based on submitted config. No execution. */
async function fetchMcpManifest(
  uri?: string,
  payload?: Record<string, unknown>
): Promise<{ manifest: SourceManifest; rawRefs: string[] }> {
  return {
    manifest: {
      name: (payload?.name as string) ?? uri ?? "mcp-connector",
      description: (payload?.description as string) ?? undefined,
      version: (payload?.version as string) ?? "0.1.0",
      keywords: ["mcp", "connector"],
    },
    rawRefs: uri ? [uri] : [],
  };
}

/** Reads manifest from a manually uploaded archive payload. No execution. */
async function extractArchiveManifest(
  payload?: Record<string, unknown>
): Promise<{ manifest: SourceManifest; rawRefs: string[] }> {
  return {
    manifest: {
      name: (payload?.name as string) ?? "archive-import",
      description: (payload?.description as string) ?? undefined,
      version: (payload?.version as string) ?? "0.1.0",
    },
    rawRefs: [],
  };
}

/** Reads manifest from a manual skill bundle payload. */
async function extractManualBundleManifest(
  payload?: Record<string, unknown>
): Promise<{ manifest: SourceManifest; rawRefs: string[] }> {
  return {
    manifest: {
      name: (payload?.name as string) ?? "manual-bundle",
      description: (payload?.description as string) ?? undefined,
      version: (payload?.version as string) ?? "0.1.0",
      license: (payload?.license as string) ?? undefined,
    },
    rawRefs: [],
  };
}

/** Reads manifest from a workflow definition payload. */
async function extractWorkflowDefManifest(
  payload?: Record<string, unknown>
): Promise<{ manifest: SourceManifest; rawRefs: string[] }> {
  return {
    manifest: {
      name: (payload?.name as string) ?? "workflow",
      description: (payload?.description as string) ?? undefined,
      version: (payload?.version as string) ?? "0.1.0",
      entryPoints: Array.isArray(payload?.triggers)
        ? (payload.triggers as string[])
        : [],
    },
    rawRefs: [],
  };
}
