"use client";

/**
 * TerraTab — KNYT Cartridge
 *
 * Renders metaKNYT content pulled from the Qriptopian:
 *   - scrolls section (non-synthsims) via /api/codex/knyt/terra
 *   - any section with placement.tab = 'metaknyts' (hero, knowdz, news, etc.)
 *
 * Content access (Watch/Read) routes through the SmartTriad contentViewer drawer.
 * Engagement signals (Value/Spark/Share) route to /api/codex/qriptopian/signal.
 * Share events are Herald-reward eligible ($KNYT).
 */

import React, { useEffect, useState, useCallback } from "react";
import { Play, Loader2, Newspaper, Share2, ThumbsUp, Zap } from "lucide-react";
import { useSmartTriad } from "@/app/components/content/SmartTriadProvider";
import { CodexActionRow } from "@/app/triad/components/codex/CodexActionRow";
import type { TerraItem } from "@/app/api/codex/knyt/terra/route";

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
  item: TerraItem;
  personaId?: string;
}) {
  const { actions } = useSmartTriad();

  const [liked, setLiked] = useState(false);
  const [sparked, setSparked] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "sharing" | "done">("idle");
  const [rewardEarned, setRewardEarned] = useState<number | null>(null);

  const openContent = useCallback(async (modality: "read" | "watch" | null) => {
    await actions.loadContent(item.id);
    actions.setContentAccessGranted(true);
    actions.setViewerModality(modality);
    actions.setActiveDrawer("contentViewer");
  }, [actions, item.id]);

  const handleShare = useCallback(async () => {
    if (shareState !== "idle") return;
    setShareState("sharing");

    const shareUrl =
      item.socialUrl ??
      (typeof window !== "undefined" ? window.location.href : "");

    const hasNativeShare = typeof navigator !== "undefined" && "share" in navigator;
    if (hasNativeShare) {
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
      platform: hasNativeShare ? "native_share" : "clipboard",
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

      {/* Cover / video thumbnail */}
      {item.coverImageUrl && (
        <div className="relative h-36 w-full bg-slate-900 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.coverImageUrl}
            alt={item.title}
            className="absolute inset-0 h-full w-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Video play overlay */}
          {item.hasWatch && (
            <button
              type="button"
              onClick={() => openContent("watch")}
              className="absolute inset-0 flex items-center justify-center group"
              aria-label="Watch"
            >
              <div className="rounded-full bg-black/50 p-3 border border-white/20 group-hover:bg-black/70 group-hover:scale-110 transition-all backdrop-blur-sm">
                <Play className="h-5 w-5 text-white fill-white" />
              </div>
            </button>
          )}

          {item.featured && (
            <span className="absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-wide text-amber-400 bg-black/60 border border-amber-400/30 rounded-full px-2 py-0.5 backdrop-blur-sm">
              Featured
            </span>
          )}

          {item.section && item.section !== "scrolls" && (
            <span className="absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wide text-cyan-300 bg-black/60 border border-cyan-400/20 rounded-full px-2 py-0.5 backdrop-blur-sm">
              {item.section}
            </span>
          )}
        </div>
      )}

      {/* Content body */}
      <div className="p-4 space-y-3">

        {!item.coverImageUrl && item.featured && (
          <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5">
            Featured
          </span>
        )}

        <div className={!item.coverImageUrl && item.featured ? "pr-16" : ""}>
          <p className="text-sm font-semibold text-slate-100 leading-snug">{item.title}</p>
          {item.description && (
            <p className="text-xs text-slate-400 mt-1 leading-snug line-clamp-2">
              {item.description}
            </p>
          )}
        </div>

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

        {/* Smart content access buttons (Watch / Read / View) */}
        <CodexActionRow
          showWatch={item.hasWatch}
          showRead={item.hasRead}
          showView={!item.hasWatch && !item.hasRead}
          variant="indigo"
          onWatch={() => openContent("watch")}
          onRead={() => openContent("read")}
          onView={() => openContent(null)}
        />

        {/* KNYT engagement signals */}
        <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
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
  );
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

export function TerraTab({ personaId }: TerraTabProps) {
  const [items, setItems] = useState<TerraItem[]>([]);
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
        Share earns Herald of the Order rewards · Value and Spark signal to the community
      </p>
    </div>
  );
}
