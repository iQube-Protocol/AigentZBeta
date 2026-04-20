"use client";

import { Play, Lock, ExternalLink, Video, Sparkles } from "lucide-react";
import { MarketaSequenceItem } from "@/types/marketaCampaigns";
import { cn } from "@/utils/cn";

interface Props {
  item: MarketaSequenceItem;
  theme?: "dark" | "light";
  size?: "sm" | "lg";
  onAssetClick?: (item: MarketaSequenceItem) => void;
  onCtaClick?: (item: MarketaSequenceItem) => void;
  /** Called when the user clicks Play/Watch — parent opens in-app player */
  onPlay?: (item: MarketaSequenceItem) => void;
}

export function SequenceDayCard({ item, theme = "dark", size = "sm", onAssetClick, onCtaClick, onPlay }: Props) {
  const dark = theme === "dark";
  const locked = item.status === "locked" || item.status === "draft";
  const rawThumb = item.thumbnail_url;
  const thumbnail = (rawThumb && !rawThumb.startsWith("smart_content_qubes:")) ? rawThumb : "/placeholder.svg";
  const isLg = size === "lg";
  // A smart_content_qubes: token is not a navigable URL — only real URLs are playable
  const hasPlayableUrl = !!item.cta_url && !item.cta_url.startsWith("smart_content_qubes:");

  const statusColor =
    item.status === "ready"   ? (dark ? "text-emerald-400" : "text-emerald-600") :
    item.status === "viewed"  ? (dark ? "text-sky-400"     : "text-sky-600")     :
    item.status === "clicked" ? (dark ? "text-rose-400"    : "text-rose-600")    :
                                (dark ? "text-white/30"    : "text-black/30");

  function handlePlay(e: React.MouseEvent) {
    e.stopPropagation();
    onPlay?.(item);
    onCtaClick?.(item);
  }

  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border transition-all",
        isLg ? "p-0 overflow-hidden" : "p-3",
        dark
          ? "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
          : "border-black/[0.06] bg-white hover:bg-black/[0.02]",
        locked && "opacity-60"
      )}
    >
      {/* Thumbnail */}
      <div className={cn(
        "relative flex-shrink-0 overflow-hidden group",
        isLg ? "w-40 h-28 rounded-none" : "w-32 h-20 rounded-lg",
        "bg-black/20"
      )}>
        <img
          src={thumbnail}
          alt={item.title}
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
        />

        {/* Play overlay — only when there's a real playable URL */}
        {!locked && hasPlayableUrl && (
          <button
            onClick={handlePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Play className="w-6 h-6 text-rose-400 fill-rose-400" />
          </button>
        )}

        {/* Lock */}
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Lock className="w-5 h-5 text-white/50" />
          </div>
        )}

        {/* Explainer badge */}
        {item.explainer && (
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-rose-500 text-white">
            <Sparkles className="w-2.5 h-2.5" />
            Explainer
          </div>
        )}
      </div>

      {/* Content */}
      <div className={cn("flex flex-col justify-between flex-1 min-w-0", isLg ? "p-3" : "")}>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("text-xs", dark ? "text-white/40" : "text-black/40")}>
              Day {item.day_number}
            </span>
            <span className={cn("text-[10px] font-medium", statusColor)}>{item.status}</span>
          </div>
          <p className={cn("font-semibold leading-tight", isLg ? "text-sm" : "text-sm truncate", dark ? "text-white/90" : "text-black/80")}>
            {item.title}
          </p>
          <p className={cn("text-xs leading-snug", isLg ? "line-clamp-2" : "line-clamp-1", dark ? "text-white/50" : "text-black/50")}>
            {item.description}
          </p>
        </div>

        {/* Actions */}
        {!locked && hasPlayableUrl && (
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={(e) => { e.stopPropagation(); onAssetClick?.(item); onPlay?.(item); }}
              className={cn(
                "flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors",
                dark ? "border-white/10 text-white/60 hover:text-white/90 hover:border-white/20" : "border-black/10 text-black/50 hover:text-black/80"
              )}
            >
              <ExternalLink className="w-3 h-3" />
              View
            </button>
            <button
              onClick={handlePlay}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-rose-500/50 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition-colors backdrop-blur-sm"
            >
              <Video className="w-3 h-3" />
              Watch
            </button>
          </div>
        )}

        {/* Token ref — not yet linked to a playable URL */}
        {!locked && !hasPlayableUrl && item.cta_url?.startsWith("smart_content_qubes:") && (
          <span className={cn("text-[10px] mt-2", dark ? "text-white/25" : "text-black/25")}>
            Content pending link
          </span>
        )}
      </div>
    </div>
  );
}
