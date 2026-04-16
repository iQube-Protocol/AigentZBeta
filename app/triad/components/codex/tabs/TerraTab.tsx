"use client";

/**
 * TerraTab — KNYT Cartridge
 *
 * Renders Qriptopian content that is tagged or related to KNYT / metaKNYT.
 * Content comes from /api/codex/knyt/terra which queries:
 *   1. content table with placement {section:"scrolls", tab:"metaknyts"}
 *   2. content table with title ilike %knyt% / %metaknyt% sweep
 *
 * Engagement signals (share, like, spark) route to
 * POST /api/codex/qriptopian/signal which logs to Qc event ledger,
 * emits DVN receipts, and grants HeraldCuriosityClicks reward on share.
 */

import React, { useEffect, useState, useCallback } from "react";
import { Share2, ThumbsUp, Zap, ExternalLink, Loader2, Newspaper } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TerraContentItem {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  type: string;
  featured: boolean;
  coverImageUrl?: string;
  socialUrl?: string;
  createdAt: string;
}

type SignalType = "share" | "like" | "spark";

interface TerraTabProps {
  theme?: "light" | "dark";
  density?: "narrow" | "wide";
  personaId?: string;
}

// ─── Signal helper ────────────────────────────────────────────────────────────

async function emitSignal(
  contentId: string,
  signalType: SignalType,
  options: { personaId?: string; platform?: string }
): Promise<{ granted: boolean; amount?: number }> {
  try {
    const res = await fetch("/api/codex/qriptopian/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personaId: options.personaId ?? null,
        contentId,
        signalType,
        platform: options.platform ?? "direct",
      }),
    });
    const json = await res.json();
    return (json.data?.reward as { granted: boolean; amount?: number }) ?? { granted: false };
  } catch {
    return { granted: false };
  }
}

// ─── Card ────────────────────────────────────────────────────────────────────

function ContentCard({
  item,
  personaId,
}: {
  item: TerraContentItem;
  personaId?: string;
}) {
  const [liked, setLiked] = useState(false);
  const [sparked, setSparked] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "sharing" | "done">("idle");
  const [rewardEarned, setRewardEarned] = useState<number | null>(null);

  const handleShare = useCallback(async () => {
    if (shareState !== "idle") return;
    setShareState("sharing");

    const shareUrl =
      item.socialUrl ??
      (typeof window !== "undefined" ? window.location.href : "");

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          text: item.description ?? item.title,
          url: shareUrl,
        });
      } catch {
        // cancelled or unsupported — still log the intent
      }
    } else if (typeof navigator !== "undefined") {
      await navigator.clipboard.writeText(shareUrl).catch(() => null);
    }

    const reward = await emitSignal(item.id, "share", {
      personaId,
      platform: typeof navigator !== "undefined" && navigator.share
        ? "native_share"
        : "clipboard",
    });

    if (reward.granted && reward.amount) {
      setRewardEarned(reward.amount);
      setTimeout(() => setRewardEarned(null), 3000);
    }

    setShareState("done");
    setTimeout(() => setShareState("idle"), 2500);
  }, [item, personaId, shareState]);

  const handleLike = useCallback(async () => {
    if (liked) return;
    setLiked(true);
    await emitSignal(item.id, "like", { personaId });
  }, [item.id, personaId, liked]);

  const handleSpark = useCallback(async () => {
    if (sparked) return;
    setSparked(true);
    await emitSignal(item.id, "spark", { personaId });
  }, [item.id, personaId, sparked]);

  return (
    <div className="relative rounded-xl border border-white/10 bg-white/[0.04] overflow-hidden hover:border-white/20 transition-colors">

      {/* Cover image */}
      {item.coverImageUrl && (
        <div className="relative h-32 w-full bg-slate-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.coverImageUrl}
            alt={item.title}
            className="absolute inset-0 h-full w-full object-cover opacity-80"
          />
          {item.featured && (
            <span className="absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-wide text-amber-400 bg-black/60 border border-amber-400/30 rounded-full px-2 py-0.5 backdrop-blur-sm">
              Featured
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-3">

        {/* Featured badge (when no cover image) */}
        {!item.coverImageUrl && item.featured && (
          <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5">
            Featured
          </span>
        )}

        {/* Title + description */}
        <div className={!item.coverImageUrl && item.featured ? "pr-16" : ""}>
          <p className="text-sm font-semibold text-slate-100 leading-snug">{item.title}</p>
          {item.description && (
            <p className="text-xs text-slate-400 mt-1 leading-snug line-clamp-2">
              {item.description}
            </p>
          )}
        </div>

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-[10px] text-slate-400 bg-white/[0.06] rounded px-1.5 py-0.5 border border-white/[0.08]"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLike}
              title="Signal value"
              className={`flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 border transition-all ${
                liked
                  ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-400"
                  : "border-white/10 bg-white/[0.04] text-slate-400 hover:text-slate-200 hover:border-white/20"
              }`}
            >
              <ThumbsUp className="h-3 w-3" />
              <span>{liked ? "Valued" : "Value"}</span>
            </button>

            <button
              type="button"
              onClick={handleSpark}
              title="Spark this"
              className={`flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 border transition-all ${
                sparked
                  ? "border-yellow-400/40 bg-yellow-500/10 text-yellow-300"
                  : "border-white/10 bg-white/[0.04] text-slate-400 hover:text-slate-200 hover:border-white/20"
              }`}
            >
              <Zap className="h-3 w-3" />
              <span>{sparked ? "Sparked" : "Spark"}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {item.socialUrl && (
              <a
                href={item.socialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 border border-white/10 bg-white/[0.04] hover:border-white/20 rounded-lg px-2.5 py-1.5 transition-all"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            <button
              type="button"
              onClick={handleShare}
              title="Share — earn Herald rewards"
              className={`relative flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 border transition-all ${
                shareState === "done"
                  ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-300"
                  : "border-white/10 bg-white/[0.04] text-slate-400 hover:text-slate-200 hover:border-white/20"
              }`}
            >
              {shareState === "sharing" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Share2 className="h-3 w-3" />
              )}
              <span>{shareState === "done" ? "Shared" : "Share"}</span>

              {rewardEarned !== null && (
                <span className="absolute -top-7 right-0 text-[10px] font-bold text-amber-300 bg-amber-900/80 border border-amber-500/30 rounded-full px-2 py-0.5 whitespace-nowrap">
                  +{rewardEarned} $KNYT
                </span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

export function TerraTab({ personaId }: TerraTabProps) {
  const [items, setItems] = useState<TerraContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/codex/knyt/terra")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          setItems(json.data ?? []);
        } else {
          setError("Could not load content.");
        }
      })
      .catch(() => setError("Could not load content."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500">
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500 px-6 text-center">
        <Newspaper className="h-8 w-8 opacity-40" />
        <p className="text-sm font-medium text-slate-400">No metaKNYT content yet</p>
        <p className="text-xs leading-relaxed">
          Qriptopian content tagged with KNYT themes will appear here as it&apos;s published.
          Share this tab with others to help build the signal.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          metaKNYT — Qriptopian Signal
        </h3>
        <span className="text-[10px] text-slate-500">{items.length} items</span>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <ContentCard key={item.id} item={item} personaId={personaId} />
        ))}
      </div>

      <p className="text-[10px] text-slate-600 text-center pt-2">
        Sharing earns Herald of the Order rewards · Like and Spark signal value to the community
      </p>
    </div>
  );
}
