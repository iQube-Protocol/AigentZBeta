"use client";

/**
 * KnytCommunityContentTab — KNYT cartridge tab that surfaces published
 * community-generated content (articles + stories the user remixed from
 * runtime experience capsules).
 *
 * Reuses the 21 Sats KnytReactionBar so each item carries the same
 * spark / like / question / canon-worthy reactions as canon publications.
 *
 * Filters: All / Mine. Promoted-to-runtime items get a small badge.
 * Per-item view shows the full article + image and a compact share menu
 * (copy link, X/Twitter, email).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Coins,
  FileText,
  Loader2,
  RefreshCw,
  Share2,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { KnytReactionBar } from "@/components/metame/KnytReactionBar";
import { SocialSharingModal } from "@/packages/smarttriad/src/SocialSharingModal";
import { ListenButton } from "@/components/shared/ListenButton";
import { useActivePersona } from "@/app/hooks/useActivePersona";

interface CommunityContentItem {
  id: string;
  title: string;
  prompt: string;
  skill: "article" | "story";
  articleBody: string | null;
  imageUrl: string | null;
  status: string;
  qcCost: number;
  generationIndex: number;
  sourceExperienceId: string | null;
  parentId: string | null;
  creator: {
    personaId: string;
    firstName: string | null;
    handle: string | null;
    fioHandle: string | null;
    isMe: boolean;
  };
  promotedToRuntime: boolean;
  createdAt: string;
}

type FilterMode = "all" | "mine";

interface Props {
  personaId?: string;
  isAdmin?: boolean;
  theme?: "light" | "dark";
  /**
   * Cartridge filter. When set, only rows where
   * community_generated_content.cartridge matches are returned by
   * /api/community-content/list?cartridge=<cartridge>. Defaults to
   * undefined (no filter — every cartridge) for back-compat with the
   * existing KNYT cartridge mount, which historically expected the
   * unfiltered list. The Qriptopian Pulse tab passes 'qripto'.
   */
  cartridge?: "knyt" | "qripto";
}

export function KnytCommunityContentTab({ personaId, isAdmin: _isAdmin, cartridge }: Props) {
  const [items, setItems] = useState<CommunityContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (personaId) params.set("personaId", personaId);
      if (filter === "mine") {
        params.set("mine", "1");
      } else {
        params.set("status", "shared,runtime_promoted");
      }
      if (cartridge) params.set("cartridge", cartridge);
      const res = await fetch(`/api/community-content/list?${params}`, { cache: "no-store" });
      let json: { ok?: boolean; items?: CommunityContentItem[]; error?: string };
      try {
        json = await res.json();
      } catch {
        // Empty body (e.g. Lambda payload limit, network drop) — keep
        // the error message readable instead of letting the raw
        // 'JSON.parse: unexpected end of data' through.
        setError(`Community list failed (${res.status || 'server error'}) — try again`);
        return;
      }
      if (!res.ok || !json.ok) {
        setError(json.error || `Failed to load (${res.status})`);
        return;
      }
      setItems((json.items || []) as CommunityContentItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [personaId, filter, cartridge]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeItem = useMemo(
    () => (activeId ? items.find((i) => i.id === activeId) ?? null : null),
    [activeId, items],
  );

  if (activeItem) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 border-b border-slate-800/60 bg-slate-900/40 px-4 py-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveId(null)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-slate-200 min-w-0 truncate">
            {activeItem.title}
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <ContentDetail item={activeItem} personaId={personaId} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex-shrink-0 border-b border-slate-800/60 bg-slate-900/40 px-4 py-2 flex items-center gap-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] transition ${
              filter === "all"
                ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
                : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("mine")}
            disabled={!personaId}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] transition disabled:opacity-30 ${
              filter === "mine"
                ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
                : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            Mine
          </button>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="ml-auto text-slate-400 hover:text-white transition disabled:opacity-30"
          title="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        ) : loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-8 text-center">
            <Sparkles className="h-6 w-6 mx-auto text-amber-400/60 mb-2" />
            <p className="text-sm text-slate-300 mb-1">
              {filter === "mine" ? "You haven't published any remixes yet." : "No community content yet."}
            </p>
            <p className="text-[11px] text-slate-500">
              Click <span className="text-amber-300">Remix</span> on any runtime experience to create one.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((item) => (
              <ContentCard key={item.id} item={item} personaId={personaId} onOpen={() => setActiveId(item.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

function ContentCard({
  item,
  personaId,
  onOpen,
}: {
  item: CommunityContentItem;
  personaId?: string;
  onOpen: () => void;
}) {
  const SkillIcon = item.skill === "story" ? Sparkles : FileText;
  const skillColor = item.skill === "story" ? "text-violet-300" : "text-cyan-300";

  // Image source — community list is stripped of base64 image_url
  // (Lambda 6MB cap). Fetch images individually via the proxy endpoint
  // which decodes the data URL and serves bytes with a 24h cache.
  // Only shared/runtime_promoted are publicly viewable; for drafts/mine
  // we still hit the proxy (it 403s and the <img> shows the alt/icon
  // fallback via onError).
  const imageSrc = `/api/community-content/${item.id}/image`;
  const [imageOk, setImageOk] = React.useState(true);

  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-slate-900/60 overflow-hidden hover:border-white/20 transition-colors">
      <button type="button" onClick={onOpen} className="text-left">
        {imageOk ? (
          <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden">
            <img
              src={imageSrc}
              alt={item.title}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={() => setImageOk(false)}
            />
            {item.promotedToRuntime && (
              <span className="absolute top-1 right-1 rounded-full border border-amber-400/40 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-200 backdrop-blur-sm">
                Runtime
              </span>
            )}
          </div>
        ) : (
          <div className="aspect-[4/3] bg-slate-950 flex items-center justify-center">
            <SkillIcon className={`h-8 w-8 ${skillColor}`} />
          </div>
        )}
        <div className="p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
            <SkillIcon className={`h-3 w-3 ${skillColor}`} />
            {item.skill}
            {item.creator.isMe && (
              <span className="ml-auto rounded-full border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-300">
                Mine
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-white leading-tight line-clamp-2">{item.title}</p>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <User className="h-3 w-3" />
            {item.creator.fioHandle ?? item.creator.handle ?? item.creator.firstName ?? "Creator"}
            {item.qcCost > 0 && (
              <span className="ml-auto inline-flex items-center gap-0.5">
                <Coins className="h-3 w-3 text-amber-400/60" />
                {item.qcCost} Q¢
              </span>
            )}
            {item.qcCost === 0 && (
              <span className="ml-auto inline-flex items-center gap-0.5 text-emerald-300/70">
                <Zap className="h-3 w-3" />
                Free
              </span>
            )}
          </div>
        </div>
      </button>
      <div className="px-3 pb-2">
        <KnytReactionBar publicationId={item.id} personaId={personaId ?? null} />
      </div>
    </div>
  );
}

// ─── Detail view ─────────────────────────────────────────────────────────────

function ContentDetail({ item, personaId }: { item: CommunityContentItem; personaId?: string }) {
  // Detail view also goes through the proxy. The 24h cache header on
  // the proxy means re-opening the detail after seeing the card thumb
  // pulls from the browser cache instantly.
  const detailImgSrc = `/api/community-content/${item.id}/image`;
  const [detailImgOk, setDetailImgOk] = React.useState(true);

  // T1 label for the share modal's 'Shared by <label>' badge. Comes
  // from useActivePersona's canonical surface so it's never a UUID.
  const { surface: activePersonaSurface } = useActivePersona();
  type SurfaceWithFio = typeof activePersonaSurface & { ownFioHandle?: string };
  const personaLabel =
    activePersonaSurface?.displayLabel ??
    (activePersonaSurface as SurfaceWithFio | null)?.ownFioHandle ??
    undefined;
  // List endpoint strips articleBody to avoid 413 (base64 images +
  // 600-900 word bodies blow Lambda's 6 MB ceiling). Hydrate the full
  // body from GET /[id] when the detail opens so we don't show just
  // the short prompt as a placeholder.
  const [fullBody, setFullBody] = React.useState<string | null>(item.articleBody);
  const [hydrating, setHydrating] = React.useState(false);
  React.useEffect(() => {
    if (fullBody) return;
    let cancelled = false;
    setHydrating(true);
    fetch(`/api/community-content/${item.id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { ok?: boolean; item?: { articleBody?: string | null } }) => {
        if (cancelled) return;
        if (j?.ok && j.item?.articleBody) setFullBody(j.item.articleBody);
      })
      .catch(() => { /* fall back to prompt below */ })
      .finally(() => { if (!cancelled) setHydrating(false); });
    return () => { cancelled = true; };
  }, [item.id, fullBody]);
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {detailImgOk && (
        <img
          src={detailImgSrc}
          alt={item.title}
          className="w-full rounded-2xl border border-white/10 object-cover max-h-96"
          onError={() => setDetailImgOk(false)}
        />
      )}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            {item.skill === "story" ? "KNYT Story" : "Article"}
            {item.promotedToRuntime && <span className="ml-2 text-amber-300">· Runtime promoted</span>}
          </p>
          <h1 className="text-xl font-bold text-white leading-tight">{item.title}</h1>
          <p className="text-xs text-slate-500 mt-1">
            By {item.creator.fioHandle ?? item.creator.handle ?? item.creator.firstName ?? "Creator"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(fullBody || item.prompt) ? (
            <ListenButton
              getText={() => `${item.title}. ${fullBody || item.prompt || ""}`}
            />
          ) : null}
          <ShareMenu item={item} personaId={personaId} personaLabel={personaLabel} />
        </div>
      </div>

      <article className="prose prose-invert prose-sm max-w-none text-slate-200 whitespace-pre-wrap leading-relaxed">
        {hydrating && !fullBody ? (
          <span className="text-slate-500 italic">Loading full article…</span>
        ) : (
          fullBody || item.prompt
        )}
      </article>

      <div className="pt-3 border-t border-white/[0.06]">
        <KnytReactionBar publicationId={item.id} personaId={personaId ?? null} />
      </div>
    </div>
  );
}

// ─── Share menu ──────────────────────────────────────────────────────────────

/**
 * Community Share button — replaces the legacy 3-option dropdown
 * (Copy / X / Email) with the canonical Qriptopian SocialSharingModal.
 * Persona attribution flows through the shareId server-side via
 * /api/social/track; raw personaId no longer travels in URLs (Step 1
 * of the share/invite consolidation).
 */
function ShareMenu({ item, personaId, personaLabel }: {
  item: CommunityContentItem;
  personaId?: string;
  personaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
      >
        <Share2 className="h-3.5 w-3.5" />
        Share
      </button>
      <SocialSharingModal
        isOpen={open}
        onClose={() => setOpen(false)}
        article={{
          id: item.id,
          title: item.title,
          description: undefined,
          section: item.skill,
          type: item.skill === 'story' ? 'text' : 'text',
          // Community item URL — clicks resolve back to the published
          // detail view via /community-content/<id>. shareId-based
          // attribution still works; we pass `url` so the deep link
          // points at the actual published surface.
          url: typeof window !== 'undefined'
            ? `${window.location.origin}/community-content/${item.id}`
            : `/community-content/${item.id}`,
        }}
        personaId={personaId}
        personaLabel={personaLabel}
      />
    </>
  );
}

export default KnytCommunityContentTab;
