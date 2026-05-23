"use client";

import React from "react";
import { Headphones, Loader2, Square } from "lucide-react";
import { useTTSPlayer } from "@/app/hooks/useTTSPlayer";

interface ListenButtonProps {
  getText: () => string;
  voice?: string;
  className?: string;
  compact?: boolean;
}

export function ListenButton({ getText, voice, className, compact }: ListenButtonProps) {
  const { ttsState, handleListen } = useTTSPlayer({ getText, voice });

  const base =
    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition";
  const tone =
    ttsState === "playing"
      ? "border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300"
      : ttsState === "error"
      ? "border border-red-500/40 bg-red-500/10 text-red-400"
      : "border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white";

  const title =
    ttsState === "playing"
      ? "Stop reading"
      : ttsState === "error"
      ? "TTS failed — click to dismiss"
      : "Listen with Marketa";

  return (
    <button
      type="button"
      onClick={() => void handleListen()}
      disabled={ttsState === "loading"}
      title={title}
      className={`${base} ${tone} ${className ?? ""}`}
    >
      {ttsState === "loading" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : ttsState === "playing" ? (
        <Square className="h-3.5 w-3.5" />
      ) : (
        <Headphones className="h-3.5 w-3.5" />
      )}
      {!compact && (
        <span>
          {ttsState === "playing"
            ? "Stop"
            : ttsState === "loading"
            ? "…"
            : ttsState === "error"
            ? "Error"
            : "Listen"}
        </span>
      )}
    </button>
  );
}
