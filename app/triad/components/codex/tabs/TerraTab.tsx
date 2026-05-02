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
import { Play, Loader2, Newspaper, Share2, ThumbsUp, Zap, TrendingUp } from "lucide-react";
import { CodexCopilotLayer, type CopilotMessage } from "@/app/components/codex/CodexCopilotLayer";
import { useSmartTriad } from "@/app/components/content/SmartTriadProvider";
import { CodexActionRow } from "@/app/triad/components/codex/CodexActionRow";
import type { TerraItem } from "@/app/api/codex/knyt/terra/route";

type SignalType = "share" | "like" | "spark";

interface SignalData {
  hotContentIds: string[];
  signalSummary: { totalLikes: number; totalSparks: number; totalCurations: number };
  totalSignals: number;
}

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
  isHot,
}: {
  item: TerraItem;
  personaId?: string;
  isHot?: boolean;
}) {
  const { actions } = useSmartTriad();

  const [liked, setLiked] = useState(false);
  const [sparked, setSparked] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "sharing" | "done">("idle");
  const [rewardEarned, setRewardEarned] = useState<number | null>(null);

  const openContent = useCallback(async (modality: "read" | "watch" | null) => {
    await actions.loadContent(item.id);
    // Token-gate: only mark access as granted when the viewer truly owns the
    // asset. Unowned content opens the drawer in locked-state which renders
    // the purchase CTA instead of the body.
    const owned = actions.checkOwnership(item.id);
    if (owned) actions.setContentAccessGranted(true);
    else       actions.setContentAccessGranted(false);
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
        <div className="relative h-24 w-full bg-slate-900 overflow-hidden">
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

          {isHot && (
            <span className={`absolute ${item.featured ? "top-8" : "top-2"} right-2 flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-300 bg-black/60 border border-orange-400/30 rounded-full px-2 py-0.5 backdrop-blur-sm`}>
              <TrendingUp className="h-2.5 w-2.5" />
              Trending
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
      <div className="p-2.5 space-y-2">

        {!item.coverImageUrl && item.featured && (
          <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5">
            Featured
          </span>
        )}
        {!item.coverImageUrl && isHot && (
          <span className={`absolute ${item.featured ? "top-9" : "top-3"} right-3 flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-300 bg-orange-500/10 border border-orange-400/20 rounded-full px-2 py-0.5`}>
            <TrendingUp className="h-2.5 w-2.5" />
            Trending
          </span>
        )}

        <div className={!item.coverImageUrl && item.featured ? "pr-12" : ""}>
          <p className="text-xs font-semibold text-slate-100 leading-snug line-clamp-2">{item.title}</p>
          {item.description && (
            <p className="text-[10px] text-slate-400 mt-0.5 leading-snug line-clamp-1">
              {item.description}
            </p>
          )}
        </div>

        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-[9px] text-slate-400 bg-white/[0.06] rounded px-1 py-0.5 border border-white/[0.08]"
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

        {/* KNYT engagement signals — compact row */}
        <div className="flex items-center gap-1 pt-1 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={handleLike}
            title="Signal value"
            className={`flex items-center gap-1 text-[10px] rounded px-1.5 py-1 border transition-all flex-1 justify-center ${
              liked
                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-400"
                : "border-white/10 bg-white/[0.04] text-slate-400 hover:text-slate-200"
            }`}
          >
            <ThumbsUp className="h-2.5 w-2.5" />
            <span>{liked ? "✓" : "Value"}</span>
          </button>

          <button
            type="button"
            onClick={handleSpark}
            title="Spark this"
            className={`flex items-center gap-1 text-[10px] rounded px-1.5 py-1 border transition-all flex-1 justify-center ${
              sparked
                ? "border-yellow-400/40 bg-yellow-500/10 text-yellow-300"
                : "border-white/10 bg-white/[0.04] text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="h-2.5 w-2.5" />
            <span>{sparked ? "✓" : "Spark"}</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            title="Share — earn Herald rewards"
            className={`relative flex items-center gap-1 text-[10px] rounded px-1.5 py-1 border transition-all flex-1 justify-center ${
              shareState === "done"
                ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-300"
                : "border-white/10 bg-white/[0.04] text-slate-400 hover:text-slate-200"
            }`}
          >
            {shareState === "sharing" ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <Share2 className="h-2.5 w-2.5" />
            )}
            <span>{shareState === "done" ? "✓" : "Share"}</span>

            {rewardEarned !== null && (
              <span className="absolute -top-6 right-0 text-[9px] font-bold text-amber-300 bg-amber-900/80 border border-amber-500/30 rounded-full px-1.5 py-0.5 whitespace-nowrap">
                +{rewardEarned}
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
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);
  const [items, setItems] = useState<TerraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signal, setSignal] = useState<SignalData | null>(null);

  useEffect(() => {
    // Fetch content and KNYT participation signals in parallel
    Promise.all([
      fetch("/api/codex/knyt/terra").then((r) => r.json()),
      fetch("/api/codex/qriptopian/signal").then((r) => r.json()).catch(() => null),
    ]).then(([contentJson, signalJson]) => {
      if (contentJson.ok) setItems(contentJson.data ?? []);
      else setError("Could not load content.");
      if (signalJson?.ok && signalJson.data) setSignal(signalJson.data);
    }).catch(() => setError("Could not load content."))
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

  const hotSet = new Set(signal?.hotContentIds ?? []);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          metaKNYT — Qriptopian Signal
        </h3>
        <span className="text-[10px] text-slate-500">{items.length} items</span>
      </div>

      {/* KNYT participation pulse — outbound signal from KNYT back to Qriptopian */}
      {signal && signal.totalSignals > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-400/20 bg-orange-500/[0.06] px-3 py-2">
          <TrendingUp className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-orange-300 font-medium">KNYT community is active</span>
            <span className="text-[10px] text-slate-500 ml-2">
              {signal.signalSummary.totalLikes} values · {signal.signalSummary.totalSparks} sparks · {signal.signalSummary.totalCurations} curations
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((item) => (
          <ContentCard
            key={item.id}
            item={item}
            personaId={personaId}
            isHot={hotSet.has(item.id)}
          />
        ))}
      </div>

      <p className="text-[10px] text-slate-600 text-center pt-2">
        Share earns Herald of the Order rewards · Value and Spark signal to the community
      </p>

      <CodexCopilotLayer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        onOpen={() => setCopilotOpen(true)}
        variant="floating"
        enableInferenceRendering
        personaId={personaId}
        contextId="knyt-terra"
        messages={copilotMessages}
        onMessagesChange={setCopilotMessages}
      />
    </div>
  );
}
