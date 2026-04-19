"use client";

import { Play, Lock, ExternalLink, Video, Sparkles } from "lucide-react";
import { MarketaSequenceItem } from "@/types/marketaCampaigns";
import { cn } from "@/utils/cn";

interface Props {
  item: MarketaSequenceItem;
  theme?: "dark" | "light";
  onAssetClick?: (item: MarketaSequenceItem) => void;
  onCtaClick?: (item: MarketaSequenceItem) => void;
}

export function SequenceDayCard({ item, theme = "dark", onAssetClick, onCtaClick }: Props) {
  const dark = theme === "dark";
  const locked = item.status === "locked";
  const thumbnail = item.thumbnail_url || "/placeholder.svg";

  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border p-3 transition-all",
        dark
          ? "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
          : "border-black/[0.06] bg-black/[0.01] hover:bg-black/[0.03]",
        locked && "opacity-50 pointer-events-none"
      )}
    >
      {/* Thumbnail */}
      <div className="relative flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden bg-black/20 group">
        <img
          src={thumbnail}
          alt={item.title}
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
        />

        {/* Hover play overlay — clicking thumbnail opens video */}
        {!locked && item.cta_url && (
          <button
            onClick={() => {
              onAssetClick?.(item);
              window.open(item.cta_url!, "_blank", "noopener");
            }}
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Play className="w-6 h-6 text-rose-400 fill-rose-400" />
          </button>
        )}

        {/* Lock icon */}
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Lock className="w-5 h-5 text-white/50" />
          </div>
        )}

        {/* Explainer badge */}
        {item.explainer && (
          <div className="absolute top-1 left-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/80 text-white">
            <Sparkles className="w-2.5 h-2.5" />
            Explainer
          </div>
        )}

        {/* Day badge */}
        <div className="absolute bottom-1 right-1 rounded px-1.5 py-0.5 text-[10px] font-mono bg-black/60 text-white/80">
          Day {item.day_number}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col justify-between flex-1 min-w-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={cn("text-[10px] font-mono", dark ? "text-white/40" : "text-black/40")}>
              DAY {item.day_number}
            </span>
            {item.status === "viewed" && (
              <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400">
                Viewed
              </span>
            )}
            {item.status === "clicked" && (
              <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-rose-500/20 text-rose-400">
                Engaged
              </span>
            )}
          </div>
          <p className={cn("text-sm font-medium leading-tight truncate", dark ? "text-white/90" : "text-black/80")}>
            {item.title}
          </p>
          <p className={cn("text-xs leading-snug line-clamp-2", dark ? "text-white/50" : "text-black/50")}>
            {item.description}
          </p>
        </div>

        {/* Actions */}
        {!locked && item.cta_url && (
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => {
                onCtaClick?.(item);
                window.open(item.cta_url!, "_blank", "noopener");
              }}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors border border-rose-500/20"
            >
              <Video className="w-3 h-3" />
              {item.cta_url.match(/\.(mp4|mov|webm)/i) ? "Watch" : "Open"}
            </button>
            {item.asset_ref && !item.asset_ref.startsWith("smart_content_qubes:") && (
              <button
                onClick={() => {
                  onAssetClick?.(item);
                  window.open(item.asset_ref!, "_blank", "noopener");
                }}
                className={cn(
                  "flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors",
                  dark
                    ? "border-white/10 text-white/60 hover:text-white/90 hover:border-white/20"
                    : "border-black/10 text-black/50 hover:text-black/80 hover:border-black/20"
                )}
              >
                <ExternalLink className="w-3 h-3" />
                View Asset
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
