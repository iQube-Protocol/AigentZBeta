import { NextRequest, NextResponse } from "next/server";
import { listPublishedRuntimeCapsuleRecords } from "@/services/composer/runtimeProjectionService";
import { listPromotedCommunityCapsuleRecords } from "@/services/community-content/promotedCapsules";
import { getSmartContentService } from "@/services/content";
import type { SmartContentQube } from "@/types/smartContent";
import type { RuntimeCapsuleAssetRef, RuntimeCapsuleRecord, RuntimeCapsulesResponse } from "@/types/runtimeCapsules";
import { runShadow } from "@/services/invariants/engine";
import { discoveryRankingProjector, getDiscoveryFieldSnapshot, DISCOVERY_RANKING_NODE_ID } from "@/services/invariants/nodes/discoveryRanking";
import { isNodeAuthoritativeCached } from "@/services/invariants/flipStore";
import fallbackContent from "@/qriptopian-content-export.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

const SHOWCASE_FOCUS = ["qripto", "knyt"];
const SHOWCASE_TOKENS = ["qripto", "qriptopian", "knyt", "metaknyt", "metaknyts"];
const UI_IMAGE_PATTERNS = [/^\/images\/demo\//i, /^\/icons\//i, /^\/assets\/ui\//i];
const PLACEHOLDER_IMAGE_PATTERNS = [/^https?:\/\/images\.unsplash\.com\//i];
const MEDIA_EXTENSIONS = /\.(png|jpg|jpeg|webp|gif|avif|svg|mp4|mov|webm|m3u8)(\?.*)?$/i;

type QriptoHomeResponse = {
  sections?: Record<string, any[]>;
};

type KnytStatusResponse = {
  episodes?: Array<{
    episodeNumber?: number;
    displayNumber?: string;
    title?: string;
    hasMotionMaster?: boolean;
    hasStillMaster?: boolean;
    coverThumbUrl?: string;
    coverImageCid?: string;
    motionMasterCid?: string;
  }>;
};

type KnytCardsResponse = {
  cards?: Array<{
    id: string;
    title?: string;
    assetKind?: "character_poster" | "powers_sheet";
    autoDriveCid?: string;
    characterName?: string;
    digiterraName?: string;
    affiliation?: string;
  }>;
};

type FallbackExportItem = {
  id?: string;
  title?: string;
  excerpt?: string;
  slug?: string;
  status?: string;
  thumbnail?: string;
  cover_image_url?: string;
  cover_image_uri?: string;
  image?: string;
  placement?: {
    section?: string;
  };
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAssetUri(value: unknown): string | null {
  const uri = normalizeString(value);
  if (!uri) return null;

  const explicitlyValid =
    uri.startsWith("http://") ||
    uri.startsWith("https://") ||
    uri.startsWith("ipfs://") ||
    uri.startsWith("/api/content/") ||
    uri.startsWith("/storage/v1/object/public/") ||
    uri.startsWith("/content/");
  const inferredValid = MEDIA_EXTENSIONS.test(uri) || uri.includes("supabase.co/storage") || uri.includes("/storage/");

  if (!explicitlyValid && !inferredValid) return null;
  if (UI_IMAGE_PATTERNS.some((pattern) => pattern.test(uri))) return null;
  if (PLACEHOLDER_IMAGE_PATTERNS.some((pattern) => pattern.test(uri))) return null;
  return uri;
}

function normalizeVideoUri(value: unknown): string | null {
  const uri = normalizeString(value);
  if (!uri) return null;
  if (
    uri.startsWith("http://") ||
    uri.startsWith("https://") ||
    uri.startsWith("/api/content/video/") ||
    /\.(mp4|mov|webm|m3u8)(\?.*)?$/i.test(uri)
  ) {
    return uri;
  }
  return null;
}

function toCoverEndpoint(cid: string | null): string | null {
  if (!cid) return null;
  const clean = cid.trim();
  if (!clean) return null;
  if (clean.startsWith("http://") || clean.startsWith("https://")) return clean;
  return `/api/content/cover/${encodeURIComponent(clean)}?variant=thumb`;
}

function extractDeepAssetUri(node: unknown, depth = 0): string | null {
  if (depth > 5 || node == null) return null;
  const direct = normalizeAssetUri(node);
  if (direct) return direct;

  if (Array.isArray(node)) {
    for (const entry of node) {
      const found = extractDeepAssetUri(entry, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof node !== "object") return null;
  const rec = node as Record<string, unknown>;
  const preferredKeys = [
    "coverImageUri",
    "cover_image_uri",
    "image",
    "imageUrl",
    "image_url",
    "heroImage",
    "hero_image",
    "thumbnailUri",
    "thumbnail_uri",
    "thumbnail",
    "poster",
    "posterUrl",
    "storageUri",
    "storage_uri",
  ];

  for (const key of preferredKeys) {
    const found = normalizeAssetUri(rec[key]);
    if (found) return found;
  }

  for (const value of Object.values(rec)) {
    const found = extractDeepAssetUri(value, depth + 1);
    if (found) return found;
  }
  return null;
}

function extractSmartContentVideoUri(content: SmartContentQube): string | null {
  const watchAssets = content.modalities?.watch?.videoAssets || [];
  for (const asset of watchAssets) {
    const video = normalizeVideoUri((asset as any)?.storageUri) || normalizeVideoUri((asset as any)?.uri);
    if (video) return video;
  }
  const deep = extractDeepAssetUri(content.modalities?.watch || null);
  return normalizeVideoUri(deep);
}

function extractSmartContentAsset(content: SmartContentQube): RuntimeCapsuleAssetRef | null {
  const candidates: Array<{ uri: string | null; kind: "hero" | "thumbnail" }> = [
    { uri: normalizeAssetUri(content.coverImageUri), kind: "hero" },
    { uri: extractDeepAssetUri(content.modalities?.watch?.videoAssets || []), kind: "thumbnail" },
    { uri: extractDeepAssetUri(content.modalities?.read?.panels || []), kind: "hero" },
    { uri: extractDeepAssetUri((content as any).mediaVariants || {}), kind: "hero" },
  ];
  const hit = candidates.find((candidate) => candidate.uri);
  if (!hit || !hit.uri) return null;
  return { uri: hit.uri, kind: hit.kind, origin: "smart-content" };
}

function inferSmartContentModalities(content: SmartContentQube): string[] {
  const modalities: string[] = [];
  if (content.modalities?.read?.enabled) modalities.push("read");
  if (content.modalities?.watch?.enabled) modalities.push("watch");
  if (content.modalities?.listen?.enabled) modalities.push("listen");
  if (content.modalities?.interact?.enabled) modalities.push("play");
  return modalities.length > 0 ? modalities : ["read"];
}

function mapSmartContentCapsules(contents: SmartContentQube[], codexSlug: "qripto" | "knyt"): RuntimeCapsuleRecord[] {
  const mapped: RuntimeCapsuleRecord[] = [];
  for (const content of contents) {
    const asset = extractSmartContentAsset(content);
    if (!asset) continue;

    const modalities = inferSmartContentModalities(content);
    const hasWatch = modalities.includes("watch");
    const contentKind = hasWatch ? "video" : "article";
    mapped.push({
      id: `smart-${content.id}`,
      sourceType: "smart-content",
      title: content.title || "Smart Content",
      description: content.description || `Visual capsule from ${codexSlug}`,
      heroAsset: asset,
      thumbnailAsset: { ...asset, kind: "thumbnail" },
      assetStatus: "resolved",
      metadata: {
        codexSlug,
        tenantId: content.tenantId,
        modalityHints: modalities,
        durationMinutes: content.modalities?.read?.estimatedReadMinutes || null,
        priceLabel: content.pricingModel?.tiers?.[0]?.kind === "free" ? "Free" : null,
        status: content.status,
        contentKind,
        previewMediaUri: extractSmartContentVideoUri(content),
      },
      launchTarget: {
        type: "content",
        href:
          codexSlug === "qripto"
            ? "/triad/embed/codex/qripto?tab=codex&theme=dark&density=wide"
            : "/triad/embed/codex/knyt?tab=scrolls&theme=dark&density=wide",
      },
    });
  }
  return mapped;
}

function buildCandidateOrigins(request: NextRequest): string[] {
  const candidates = new Set<string>();
  const addCandidate = (value: string | null | undefined) => {
    const candidate = normalizeString(value);
    if (!candidate) return;
    try {
      const parsed = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
      candidates.add(parsed.origin);
    } catch {
      // Ignore invalid origin fragments.
    }
  };

  addCandidate(request.nextUrl.origin);
  addCandidate(request.headers.get("origin"));
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = normalizeString(request.headers.get("x-forwarded-proto")) || "https";
  if (forwardedHost) addCandidate(`${forwardedProto}://${forwardedHost}`);
  addCandidate(request.headers.get("host"));

  return [...candidates];
}

async function fetchInternalJson<T>(request: NextRequest, path: string): Promise<T | null> {
  const origins = buildCandidateOrigins(request);
  const cookieHeader = request.headers.get("cookie");
  const authHeader = request.headers.get("authorization");

  for (const origin of origins) {
    try {
      const url = new URL(path, origin);
      const response = await fetch(url.toString(), {
        cache: "no-store",
        headers: {
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
          ...(authHeader ? { authorization: authHeader } : {}),
        },
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as T;
      if (payload && typeof payload === "object") return payload;
    } catch {
      // Try next origin candidate.
    }
  }

  return null;
}

function mapQriptoSectionCapsules(payload: QriptoHomeResponse | null): RuntimeCapsuleRecord[] {
  const sections = payload?.sections || {};
  const mapped: RuntimeCapsuleRecord[] = [];
  for (const [sectionKey, rows] of Object.entries(sections)) {
    for (const [rowIndex, row] of (rows || []).entries()) {
      const heroUri =
        normalizeAssetUri((row as any)?.image) ||
        normalizeAssetUri((row as any)?.thumbnail) ||
        normalizeAssetUri((row as any)?.cover_image_uri) ||
        normalizeAssetUri((row as any)?.cover_image_url);
      if (!heroUri) continue;

      const videoUri =
        normalizeVideoUri((row as any)?.modalities?.watch?.video_url) ||
        normalizeVideoUri((row as any)?.modalities?.watch?.uri) ||
        null;
      const hints: string[] = [];
      if ((row as any)?.modalities?.read?.available !== false) hints.push("read");
      if (videoUri || (row as any)?.modalities?.watch?.available) hints.push("watch");
      if ((row as any)?.modalities?.listen?.available) hints.push("listen");

      mapped.push({
        id: `qripto-${sectionKey}-${(row as any)?.id || (row as any)?.content_id || (row as any)?.slug || rowIndex}`,
        sourceType: "smart-content",
        title: normalizeString((row as any)?.title) || "Qriptopian Capsule",
        description:
          normalizeString((row as any)?.subtitle) ||
          normalizeString((row as any)?.excerpt) ||
          "Qriptopian visual capsule",
        heroAsset: { uri: heroUri, kind: "hero", origin: "codex" },
        thumbnailAsset: { uri: heroUri, kind: "thumbnail", origin: "codex" },
        assetStatus: "resolved",
        metadata: {
          codexSlug: "qripto",
          modalityHints: hints.length > 0 ? hints : ["read"],
          durationMinutes: null,
          priceLabel: normalizeString((row as any)?.badge) || null,
          status: normalizeString((row as any)?.status) || "published",
          contentKind: videoUri ? "video" : "article",
          previewMediaUri: videoUri,
        },
        launchTarget: {
          type: "content",
          href: "/triad/embed/codex/qripto?tab=codex&theme=dark&density=wide",
        },
      });
    }
  }
  return mapped;
}

function mapKnytEpisodeCapsules(payload: KnytStatusResponse | null): RuntimeCapsuleRecord[] {
  const episodes = payload?.episodes || [];
  const mapped: RuntimeCapsuleRecord[] = [];
  for (const [episodeIndex, episode] of episodes.entries()) {
    const heroUri = normalizeAssetUri(episode.coverThumbUrl) || toCoverEndpoint(episode.coverImageCid || null);
    if (!heroUri) continue;
    const titleStem = normalizeString(episode.title) || "metaKnyts Episode";
    const display = normalizeString(episode.displayNumber) || `#${episode.episodeNumber ?? "?"}`;
    const videoUri = normalizeVideoUri(
      episode.motionMasterCid ? `/api/content/video/${encodeURIComponent(episode.motionMasterCid)}` : null
    );
    const modalityHints = episode.hasMotionMaster ? ["watch", "read"] : ["read"];
    mapped.push({
      id: `knyt-episode-${episode.episodeNumber ?? episodeIndex}`,
      sourceType: "smart-content",
      title: `${display} ${titleStem}`.trim(),
      description: episode.hasMotionMaster ? "Episode with motion + still assets." : "Episode with still assets.",
      heroAsset: { uri: heroUri, kind: "hero", origin: "codex" },
      thumbnailAsset: { uri: heroUri, kind: "thumbnail", origin: "codex" },
      assetStatus: "resolved",
      metadata: {
        codexSlug: "knyt",
        modalityHints,
        durationMinutes: null,
        priceLabel: null,
        status: "published",
        contentKind: videoUri ? "video" : "episode",
        previewMediaUri: videoUri,
      },
      launchTarget: {
        type: "content",
        href: "/triad/embed/codex/knyt?tab=scrolls&theme=dark&density=wide",
      },
    });
  }
  return mapped;
}

function mapKnytCharacterCapsules(payload: KnytCardsResponse | null): RuntimeCapsuleRecord[] {
  const cards = payload?.cards || [];
  const mapped: RuntimeCapsuleRecord[] = [];
  for (const card of cards) {
    if (card.assetKind !== "character_poster") continue;
    const heroUri = toCoverEndpoint(card.autoDriveCid || null);
    if (!heroUri) continue;
    const title = normalizeString(card.digiterraName) || normalizeString(card.characterName) || normalizeString(card.title);
    mapped.push({
      id: `knyt-character-${card.id}`,
      sourceType: "smart-content",
      title: title || "metaKnyts Character",
      description: normalizeString(card.affiliation) || "Character card capsule",
      heroAsset: { uri: heroUri, kind: "hero", origin: "codex" },
      thumbnailAsset: { uri: heroUri, kind: "thumbnail", origin: "codex" },
      assetStatus: "resolved",
      metadata: {
        codexSlug: "knyt",
        modalityHints: ["read"],
        durationMinutes: null,
        priceLabel: null,
        status: "published",
        contentKind: "character",
        previewMediaUri: null,
      },
      launchTarget: {
        type: "content",
        href: "/triad/embed/codex/knyt?tab=characters&theme=dark&density=wide",
      },
    });
  }
  return mapped;
}

function mapFallbackExportCapsules(): RuntimeCapsuleRecord[] {
  const rows = (Array.isArray(fallbackContent) ? fallbackContent : []) as FallbackExportItem[];
  return rows
    .map((row, idx) => {
      const heroUri =
        normalizeAssetUri(row.thumbnail) ||
        normalizeAssetUri(row.cover_image_url) ||
        normalizeAssetUri(row.cover_image_uri) ||
        normalizeAssetUri(row.image);
      if (!heroUri) return null;
      return {
        id: `fallback-qripto-${row.id || row.slug || idx}`,
        sourceType: "smart-content",
        title: normalizeString(row.title) || "Qriptopian Capsule",
        description: normalizeString(row.excerpt) || "Fallback visual capsule from Qriptopian export.",
        heroAsset: { uri: heroUri, kind: "hero", origin: "codex" },
        thumbnailAsset: { uri: heroUri, kind: "thumbnail", origin: "codex" },
        assetStatus: "resolved",
        metadata: {
          codexSlug: "qripto",
          modalityHints: ["read"],
          durationMinutes: null,
          priceLabel: null,
          status: normalizeString(row.status) || "published",
          contentKind: "article",
          previewMediaUri: null,
        },
        launchTarget: {
          type: "content",
          href: "/triad/embed/codex/qripto?tab=codex&theme=dark&density=wide",
        },
      } satisfies RuntimeCapsuleRecord;
    })
    .filter(Boolean) as RuntimeCapsuleRecord[];
}

function scoreCapsule(capsule: RuntimeCapsuleRecord, prompt: string, intent: string): number {
  let score = 0;
  if (capsule.assetStatus === "resolved") score += 6;
  // Deployed experiences always surface above catalogue content — they were explicitly published.
  if (capsule.sourceType === "experience") score += 10;
  if (capsule.sourceType === "smart-content") score += 4;
  if (capsule.metadata.codexSlug && SHOWCASE_FOCUS.includes(capsule.metadata.codexSlug)) score += 3;

  if (intent === "watch" && capsule.metadata.modalityHints.includes("watch")) score += 4;
  if (intent === "read" && capsule.metadata.modalityHints.includes("read")) score += 3;
  if (intent === "play" && (capsule.metadata.contentKind === "video" || capsule.metadata.contentKind === "episode")) score += 3;
  if (intent === "make" && capsule.metadata.surfaceIntent === "make") score += 8;
  if (intent === "make" && capsule.sourceType === "experience") score += 5;
  if (intent === "make" && capsule.metadata.contentKind === "article") score += 2;
  if (intent === "make" && capsule.metadata.contentKind === "video") score += 3;

  const searchable = `${capsule.title} ${capsule.description} ${(capsule.metadata.modalityHints || []).join(" ")}`.toLowerCase();
  const words = prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);
  for (const word of words) {
    if (searchable.includes(word)) score += 1;
  }
  if (SHOWCASE_TOKENS.some((token) => searchable.includes(token))) score += 2;
  return score;
}

function dedupeCapsules(rows: RuntimeCapsuleRecord[]): RuntimeCapsuleRecord[] {
  const byImage = new Map<string, RuntimeCapsuleRecord>();
  const withoutImage: RuntimeCapsuleRecord[] = [];
  for (const row of rows) {
    const imageKey = (row.heroAsset?.uri || "").trim().toLowerCase();
    if (!imageKey) {
      withoutImage.push(row);
      continue;
    }
    const current = byImage.get(imageKey);
    if (!current) {
      byImage.set(imageKey, row);
      continue;
    }
    const currentWatch = current.metadata.modalityHints.includes("watch");
    const nextWatch = row.metadata.modalityHints.includes("watch");
    if (!currentWatch && nextWatch) {
      byImage.set(imageKey, row);
      continue;
    }
    if ((current.description || "").length < (row.description || "").length) {
      byImage.set(imageKey, row);
    }
  }
  return [...byImage.values(), ...withoutImage];
}

function slugForCodexFilter(codexId: string | null): string | null {
  if (!codexId) return null;
  if (codexId === "qripto-codex") return "qripto";
  if (codexId === "knyt-codex") return "knyt";
  return codexId.replace(/-codex$/i, "");
}

function shuffleWithSeed<T>(rows: T[], seed: number): T[] {
  const next = [...rows];
  let state = (Math.abs(seed || Date.now()) >>> 0) || 0x9e3779b9;
  const rand = () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rand() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const prompt = normalizeString(searchParams.get("q"));
    const intent = normalizeString(searchParams.get("intent")).toLowerCase() || "find";
    const nonce = Number(searchParams.get("nonce") || Date.now());
    const limit = Math.max(1, Math.min(60, Number(searchParams.get("limit") || 40)));
    const codexId = normalizeString(searchParams.get("codexId")) || null;
    const codexTab = normalizeString(searchParams.get("codexTab")) || null;
    const cartridge = normalizeString(searchParams.get("cartridge")) || null;

    const smartContentService = getSmartContentService();
    const [qriptoSmart, knytSmart] = await Promise.all([
      smartContentService
        .list({ app: "Qriptopian", status: "published", limit: 120, offset: 0 })
        .catch(() => ({ data: [] as SmartContentQube[] })),
      smartContentService
        .list({ app: "metaKnyts", status: "published", limit: 120, offset: 0 })
        .catch(() => ({ data: [] as SmartContentQube[] })),
    ]);

    const [qriptoHome, qriptoHomeHero, qriptoLatestNews, knytStatus, knytCards] = await Promise.all([
      fetchInternalJson<QriptoHomeResponse>(request, "/api/codex/qripto/home?issue=issue-1"),
      fetchInternalJson<{ content?: any[] }>(request, "/api/content/section/home-hero?issue=issue-1&scope=codex"),
      fetchInternalJson<{ content?: any[] }>(request, "/api/content/section/latest-news?issue=issue-1&scope=codex"),
      fetchInternalJson<KnytStatusResponse>(request, "/api/admin/codex/status?series=metaKnyts"),
      fetchInternalJson<KnytCardsResponse>(request, "/api/codex/knyt-cards?series=metaKnyts"),
    ]);

    // Use allSettled so a community-content DB failure never breaks the main response.
    const [experienceResult, communityResult] = await Promise.allSettled([
      listPublishedRuntimeCapsuleRecords({ codexId, codexTab, cartridge, limit: 200 }),
      listPromotedCommunityCapsuleRecords({ limit: 30 }),
    ]);
    const publishedExperienceCapsules = experienceResult.status === 'fulfilled' ? experienceResult.value : [];
    const promotedCommunityCapsules   = communityResult.status  === 'fulfilled' ? communityResult.value  : [];

    const primaryCapsules = [
      ...publishedExperienceCapsules,
      ...promotedCommunityCapsules,
      ...mapQriptoSectionCapsules(qriptoHome),
      ...mapQriptoSectionCapsules({
        sections: {
          homeHero: qriptoHomeHero?.content || [],
          latestNews: qriptoLatestNews?.content || [],
        },
      }),
      ...mapKnytEpisodeCapsules(knytStatus),
      ...mapKnytCharacterCapsules(knytCards),
      ...mapSmartContentCapsules(qriptoSmart.data || [], "qripto"),
      ...mapSmartContentCapsules(knytSmart.data || [], "knyt"),
    ];
    const capsules = primaryCapsules.length > 0 ? primaryCapsules : mapFallbackExportCapsules();
    const codexSlugFilter = slugForCodexFilter(codexId);
    const scopedCapsules = codexSlugFilter
      ? capsules.filter((capsule) => !capsule.metadata.codexSlug || capsule.metadata.codexSlug === codexSlugFilter)
      : capsules;

    const byId = scopedCapsules.filter(
      (capsule, index, rows) =>
        capsule.assetStatus === "resolved" &&
        rows.findIndex((row) => row.id === capsule.id) === index
    );
    const deduped = dedupeCapsules(byId);

    const scored =
      intent === "play"
        ? (() => {
            const playPool = deduped.filter((capsule) =>
              capsule.metadata.modalityHints.some((hint) => hint === "watch" || hint === "read" || hint === "play")
            );
            const preferred = playPool.length > 0 ? playPool : deduped;
            return shuffleWithSeed(preferred, nonce).slice(0, limit);
          })()
        : deduped
            .map((capsule) => ({
              capsule,
              score: scoreCapsule(capsule, prompt, intent),
            }))
            .sort((a, b) => b.score - a.score)
            .map((entry) => entry.capsule)
            .slice(0, limit);

    // CFS-035 — the discovery-ranking Invariant Decision Node. It ALWAYS runs in
    // SHADOW against the incumbent `scoreCapsule` order (re-expressing the same
    // signals as an importance/novelty/trust/need projection, emitting the
    // divergence for the Evolution face). When the node has been flipped to
    // AUTHORITATIVE (operator-gated, via /api/invariants/flip), the runtime serves
    // the projection's order instead of the incumbent — the shadow→authoritative
    // ratification. Faithful by default: absent/false flip ⇒ `scored` served,
    // unchanged. Guarded end-to-end (runShadow + cached flip check never throw).
    let served = scored;
    if (intent !== "play") {
      // Pass the cached discovery Field Snapshot so the projection's dimension
      // weights derive from the discovery invariants' EARNED standing once they
      // exist (faithful until then). Guarded — null snapshot ⇒ faithful.
      const discoverySnapshot = await getDiscoveryFieldSnapshot();
      runShadow(discoveryRankingProjector, { capsules: deduped, prompt, intent }, scored, (c) => c.id, discoverySnapshot);
      // Operator-gated flip — serve the projection when discovery.ranking is
      // authoritative. Cached (30s TTL) + fail-faithful, so the hot path stays fast
      // and defaults to the incumbent on any error.
      if (await isNodeAuthoritativeCached(DISCOVERY_RANKING_NODE_ID)) {
        served = discoveryRankingProjector({ capsules: deduped, prompt, intent }, discoverySnapshot).ranked.slice(0, limit);
      }
    }

    return NextResponse.json<RuntimeCapsulesResponse>(
      {
        success: true,
        capsules: served,
        total: served.length,
        focus: SHOWCASE_FOCUS,
      },
      {
        headers: {
          ...NO_STORE_HEADERS,
          "X-Runtime-Seed": String(nonce),
        },
      }
    );
  } catch (error: any) {
    console.error("Runtime capsules route failed:", error);
    return NextResponse.json<RuntimeCapsulesResponse>(
      {
        success: false,
        capsules: [],
        total: 0,
        focus: SHOWCASE_FOCUS,
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
