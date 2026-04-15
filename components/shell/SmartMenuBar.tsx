"use client";

/**
 * SmartMenuBar — Be / Earn / Play / Make / Share horizontal mode bar
 *
 * Replicates the thin client's smart menu mode bar in the Next.js app shell.
 * Uses the platform's ring-1 glass pattern for active state (consistent with
 * CodexPanelDynamic and codex viewer tab styling).
 *
 * Wired to SmartMenuContext — activating a mode fires POST /api/aa/v1/runtime/menu-action
 * and broadcasts a MENU_ACTION postMessage to any embedded MetaMe runtime iframes.
 */

import React from "react";
import {
  Users,
  Coins,
  PlayCircle,
  Pencil,
  Share2,
} from "lucide-react";
import { useSmartMenu, SMART_MENU_MODES, type SmartMenuMode } from "@/app/contexts/SmartMenuContext";

// ─── Icon map ────────────────────────────────────────────────────────────────

const MODE_ICONS: Record<SmartMenuMode, React.ComponentType<{ className?: string }>> = {
  be: Users,
  earn: Coins,
  play: PlayCircle,
  make: Pencil,
  share: Share2,
};

// ─── Tailwind color map (safe classes — avoids dynamic class purging) ────────
// Colors are hex in SMART_MENU_MODES; we map to Tailwind ring/bg utilities here.

const MODE_TAILWIND: Record<SmartMenuMode, { ring: string; bg: string; text: string; dot: string }> = {
  be:    { ring: "ring-slate-400/30",   bg: "bg-slate-400/10",   text: "text-slate-300",   dot: "bg-slate-300" },
  earn:  { ring: "ring-emerald-400/30", bg: "bg-emerald-400/10", text: "text-emerald-300", dot: "bg-emerald-300" },
  play:  { ring: "ring-cyan-400/30",    bg: "bg-cyan-400/10",    text: "text-cyan-300",    dot: "bg-cyan-300" },
  make:  { ring: "ring-violet-400/30",  bg: "bg-violet-400/10",  text: "text-violet-300",  dot: "bg-violet-300" },
  share: { ring: "ring-amber-400/30",   bg: "bg-amber-400/10",   text: "text-amber-300",   dot: "bg-amber-300" },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function SmartMenuBar() {
  const { activeMode, activateMode } = useSmartMenu();

  return (
    <nav
      aria-label="Smart mode bar"
      className="flex items-center justify-center gap-1 px-3 py-1.5 border-b border-white/5 bg-slate-900/60 backdrop-blur-sm"
    >
      {SMART_MENU_MODES.map((mode) => {
        const isActive = activeMode === mode.id;
        const tw = MODE_TAILWIND[mode.id];
        const Icon = MODE_ICONS[mode.id];

        return (
          <button
            key={mode.id}
            type="button"
            title={mode.tooltip}
            onClick={() => activateMode(mode.id)}
            className={[
              "relative flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 select-none",
              isActive
                ? `ring-1 ${tw.ring} ${tw.bg} ${tw.text}`
                : "text-slate-400 hover:text-slate-300 hover:bg-white/5",
            ].join(" ")}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{mode.label}</span>
            {isActive && (
              <span
                aria-hidden
                className={`absolute -bottom-px left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${tw.dot}`}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
