import path from "path";
import { promises as fs } from "fs";
import { CodexConfig, CodexListItem, CodexTab } from "@/types/codex";

interface PackMetaOwner {
  system?: string;
  customer_counterweight?: string;
}

interface PackMeta {
  pack_id?: string;
  name?: string;
  description?: string;
  tags?: string[];
  orientation?: string;
  version?: string;
  owner?: PackMetaOwner | string;
}

interface PackCollection {
  id: string;
  title: string;
  items?: string[];
  collections?: PackCollection[];
}

interface PackCollectionsFile {
  collections?: PackCollection[];
}

const PACKS_ROOT = path.join(process.cwd(), "codexes", "packs");

function normalizePackId(packId: string): { canonicalPackId: string; codexId: string; slug: string; nameOverride?: string } {
  const lowered = packId.toLowerCase();
  if (lowered === "aigency" || lowered === "aigentiq" || lowered === "agentiq") {
    return {
      canonicalPackId: "agentiq",
      codexId: "agentiq-codex",
      slug: "agentiq",
      nameOverride: "AgentiQ Codex",
    };
  }
  return {
    canonicalPackId: packId,
    codexId: `${packId}-codex`,
    slug: packId,
  };
}

const PACK_ICON_BY_ID: Record<string, string> = {
  agentiq: "Brain",
  knyt: "BookOpen",
  qripto: "Newspaper",
  qriptopian: "Newspaper",
  marketa: "TrendingUp",
  moneypenny: "DollarSign",
  nakamoto: "GitBranch",
};

const PACK_COLOR_BY_ID: Record<string, string> = {
  agentiq: "blue",
  knyt: "purple",
  qripto: "indigo",
  qriptopian: "indigo",
  marketa: "rose",
  moneypenny: "green",
  nakamoto: "orange",
};

const COLLECTION_ICON_BY_ID: Record<string, string> = {
  col_start_here: "Home",
  col_system_map: "BookOpen",
  col_decisions: "Code",
  col_work_allocation: "Shield",
  col_pr_briefs: "FileText",
  col_updates: "Sparkles",
  col_retrieval_index: "BookMarked",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeOwner(owner?: PackMetaOwner | string): string {
  if (!owner) return "system";
  if (typeof owner === "string") {
    return slugify(owner);
  }
  if (owner.system) return slugify(owner.system);
  if (owner.customer_counterweight) return slugify(owner.customer_counterweight);
  return "system";
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return null;
    }
    console.error(`Failed to read JSON: ${filePath}`, error);
    return null;
  }
}

function tabFromCollection(collection: PackCollection, packId: string, order: number): CodexTab {
  const slugBase = collection.id.replace(/^col_/, "").replace(/_/g, "-");
  const slug = slugify(slugBase);
  const icon = COLLECTION_ICON_BY_ID[collection.id] || "FileText";

  const hasNestedCollections = (collection.collections?.length ?? 0) > 0;

  // Special handling for Marketa codex
  if (packId === "marketa") {
    return {
      id: `${packId}-tab-${slug}`,
      label: collection.title,
      slug,
      enabled: true,
      order,
      type: "static",
      config: {
        component: "MarketaTab",
        props: {},
      },
      metadata: {
        icon: "TrendingUp",
        description: collection.title,
      },
    };
  }

  // Special handling for MoneyPenny codex
  if (packId === "moneypenny") {
    return {
      id: `${packId}-tab-${slug}`,
      label: collection.title,
      slug,
      enabled: true,
      order,
      type: "static",
      config: {
        component: "MoneyPennyTab",
        props: {},
      },
      metadata: {
        icon: "DollarSign",
        description: collection.title,
      },
    };
  }

  // Special handling for KNYT codex
  if (packId === "knyt") {
    return {
      id: `${packId}-tab-${slug}`,
      label: collection.title,
      slug,
      enabled: true,
      order,
      type: "static",
      config: {
        component: "KnytTab",
        props: {},
      },
      metadata: {
        icon: "BookOpen",
        description: collection.title,
      },
    };
  }

  // Special handling for Nakamoto codex
  if (packId === "nakamoto") {
    return {
      id: `${packId}-tab-${slug}`,
      label: collection.title,
      slug,
      enabled: true,
      order,
      type: "static",
      config: {
        component: "NakamotoTab",
        props: {},
      },
      metadata: {
        icon: "GitBranch",
        description: collection.title,
      },
    };
  }

  return {
    id: `${packId}-tab-${slug}`,
    label: collection.title,
    slug,
    enabled: true,
    order,
    type: hasNestedCollections ? "dynamic" : "static",
    config: hasNestedCollections
      ? {
          props: {
            packId,
            collectionId: collection.id,
          },
        }
      : {
          component: "AgentiqCartridgeTab",
          props: {
            packId,
            collectionId: collection.id,
          },
        },
    metadata: {
      icon,
      description: collection.title,
    },
  };
}

async function buildCodexConfigFromPack(packId: string): Promise<CodexConfig | null> {
  const packRoot = path.join(PACKS_ROOT, packId);
  const metaPath = path.join(packRoot, "meta.json");
  const collectionsPath = path.join(packRoot, "collections.json");

  const meta = await readJson<PackMeta>(metaPath);
  if (!meta) return null;

  const collectionsFile = await readJson<PackCollectionsFile>(collectionsPath);
  const collections = collectionsFile?.collections ?? [];
  const tabs = collections.map((collection, index) => tabFromCollection(collection, packId, index));

  const metaStats = await fs.stat(metaPath).catch(() => null);
  const updatedAt = metaStats?.mtime?.toISOString() ?? new Date().toISOString();

  const owner = normalizeOwner(meta.owner);
  const normalized = normalizePackId(packId);
  const codexId = normalized.codexId;

  return {
    id: codexId,
    name: normalized.nameOverride || meta.name || packId,
    slug: normalized.slug,
    enabled: true,
    version: meta.version || "0.0.0",
    owner,
    metadata: {
      description: meta.description || "Codex pack content",
      icon: PACK_ICON_BY_ID[packId] || "BookOpen",
      color: PACK_COLOR_BY_ID[packId] || "indigo",
      category: meta.orientation || "pack",
      tags: meta.tags || [],
    },
    tabs,
    permissions: {
      view: ["*"],
      edit: [owner],
      admin: [owner],
    },
    liquidUI: {
      enabled: false,
    },
    createdAt: updatedAt,
    updatedAt,
  };
}

export async function loadPackCodexes(): Promise<CodexConfig[]> {
  try {
    const dirents = await fs.readdir(PACKS_ROOT, { withFileTypes: true });
    const codexes: CodexConfig[] = [];
    const seenIds = new Set<string>();

    for (const dirent of dirents) {
      if (!dirent.isDirectory()) continue;
      if (dirent.name.startsWith(".")) continue;

      // Avoid duplicate AgentiQ entries. Canonical pack for runtime/tests is 'agentiq'.
      const lowered = dirent.name.toLowerCase();
      if (lowered === "aigency" || lowered === "aigentiq") continue;

      const codex = await buildCodexConfigFromPack(dirent.name);
      if (!codex) continue;
      if (seenIds.has(codex.id)) continue;
      seenIds.add(codex.id);
      codexes.push(codex);
    }

    return codexes;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return [];
    }
    console.error("Failed to scan codex packs", error);
    return [];
  }
}

export async function getPackCodexById(codexId: string): Promise<CodexConfig | null> {
  const packId = codexId.endsWith("-codex") ? codexId.slice(0, -6) : codexId;
  const normalized = normalizePackId(packId);
  const codex = await buildCodexConfigFromPack(normalized.canonicalPackId);
  if (!codex || codex.id !== codexId) return null;
  return codex;
}

export function codexToListItem(codex: CodexConfig): CodexListItem {
  return {
    id: codex.id,
    name: codex.name,
    slug: codex.slug,
    enabled: codex.enabled,
    owner: codex.owner,
    metadata: codex.metadata,
    tabCount: codex.tabs.length,
    createdAt: codex.createdAt,
    updatedAt: codex.updatedAt,
  };
}
