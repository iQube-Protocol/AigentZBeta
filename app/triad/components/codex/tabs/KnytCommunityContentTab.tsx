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
}

export function KnytCommunityContentTab({ personaId, isAdmin: _isAdmin }: Props) {
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
      const res = await fetch(`/api/community-content/list?${params}`, { cache: "no-store" });
      const json = await res.json();
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
  }, [personaId, filter]);

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

  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-slate-900/60 overflow-hidden hover:border-white/20 transition-colors">
      <button type="button" onClick={onOpen} className="text-left">
        {item.imageUrl ? (
          <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden">
            <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
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
            {item.creator.firstName ?? item.creator.handle ?? "Creator"}
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
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {item.imageUrl && (
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-full rounded-2xl border border-white/10 object-cover max-h-96"
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
            By {item.creator.firstName ?? item.creator.handle ?? "Creator"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ShareMenu item={item} />
        </div>
      </div>

      <article className="prose prose-invert prose-sm max-w-none text-slate-200 whitespace-pre-wrap leading-relaxed">
        {item.articleBody || item.prompt}
      </article>

      <div className="pt-3 border-t border-white/[0.06]">
        <KnytReactionBar publicationId={item.id} personaId={personaId ?? null} />
      </div>
    </div>
  );
}

// ─── Share menu ──────────────────────────────────────────────────────────────

function ShareMenu({ item }: { item: CommunityContentItem }) {
  const [open, setOpen] = useState(false);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/community-content/${item.id}`
      : `/community-content/${item.id}`;
  const shareText = `${item.title} — read on the KNYT Cartridge`;

  function copy() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(shareUrl);
      setOpen(false);
    }
  }

  function shareToX() {
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  function shareEmail() {
    const url = `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`;
    if (typeof window !== "undefined") window.location.href = url;
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
      >
        <Share2 className="h-3.5 w-3.5" />
        Share
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-white/10 bg-slate-900 shadow-2xl z-10 overflow-hidden">
          <button
            type="button"
            onClick={copy}
            className="block w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/5"
          >
            Copy link
          </button>
          <button
            type="button"
            onClick={shareToX}
            className="block w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/5"
          >
            Share to X
          </button>
          <button
            type="button"
            onClick={shareEmail}
            className="block w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/5"
          >
            Email
          </button>
        </div>
      )}
    </div>
  );
}

export default KnytCommunityContentTab;
