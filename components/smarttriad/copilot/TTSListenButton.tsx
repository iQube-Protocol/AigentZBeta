"use client";

/**
 * TTSListenButton — the shared "read the latest assistant reply aloud"
 * icon/button (WPA-3 finishing pass, operator brief 2026-08-17, item 2).
 *
 * Presentational only — state comes from useTTSListen (co-located in this
 * directory), which both SmartTriadCopilotLayer and CodexCopilotLayer call
 * so the busy state is also available to each caller's own R/T-dots pulse
 * computation (CLAUDE.md's documented busy-pulse convention). Same icon,
 * same disabled/title/aria-label logic, same classes, in both mounts.
 */

import { Volume2, VolumeX } from "lucide-react";

export interface TTSListenButtonProps {
  isSpeaking: boolean;
  isLoading: boolean;
  hasContent: boolean;
  onToggle: () => void;
  className?: string;
}

export function TTSListenButton({ isSpeaking, isLoading, hasContent, onToggle, className }: TTSListenButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!hasContent || isLoading}
      title={
        !hasContent
          ? "No reply to read yet"
          : isLoading
            ? "Fetching Cartesia voice…"
            : isSpeaking
              ? "Stop reading"
              : "Read the latest reply aloud (Cartesia voice)"
      }
      aria-label={isSpeaking ? "Stop reading the latest reply aloud" : "Read the latest reply aloud"}
      className={
        className ??
        `p-1 rounded-md transition-colors ${
          isSpeaking ? "text-cyan-300 bg-cyan-500/15" : "text-white/50 hover:text-cyan-300 hover:bg-white/5"
        } disabled:opacity-30 disabled:cursor-not-allowed`
      }
    >
      {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
    </button>
  );
}
