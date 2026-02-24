"use client";

/**
 * ContentActionIcons - SmartTriad Modality Action Icons
 * 
 * Reusable component for displaying content modality action icons (read, watch, listen, interact).
 * Icons only render when corresponding content exists for the content item.
 * 
 * Default Spec:
 * - Position: bottom-right corner of thumbnail (use with absolute positioning)
 * - Color: cyan with rollover to filled cyan
 * - Size: sm (w-6 h-6 button, w-3 h-3 icon)
 * - Style: Lucide icons (configurable per franchise/tenant)
 */

import React from "react";
import { BookOpen, Play, Headphones, MessageSquare } from "lucide-react";
import type { ContentModality } from "@/types/smartContent";

export type IconStyle = "lucide" | "emoji" | "custom";

export interface ContentModalityState {
  read?: boolean;
  watch?: boolean;
  listen?: boolean;
  interact?: boolean;
}

export interface ContentActionIconsProps {
  modalities: ContentModalityState;
  iconStyle?: IconStyle;
  customIcons?: Partial<Record<ContentModality, React.ReactNode>>;
  onRead?: () => void;
  onWatch?: () => void;
  onListen?: () => void;
  onInteract?: () => void;
  size?: "xs" | "sm" | "md" | "lg";
  direction?: "row" | "column";
  className?: string;
}

const LUCIDE_ICONS: Record<ContentModality, React.FC<{ className?: string }>> = {
  read: BookOpen, watch: Play, listen: Headphones, interact: MessageSquare,
};

const EMOJI_ICONS: Record<ContentModality, string> = {
  read: "📖", watch: "🎬", listen: "🎧", interact: "💬",
};

const MODALITY_LABELS: Record<ContentModality, string> = {
  read: "Read", watch: "Watch", listen: "Listen", interact: "Interact",
};

// Default: cyan color for all modalities (consistent branding)
const SIZE_CLASSES = {
  xs: { button: "w-5 h-5 rounded", icon: "w-2.5 h-2.5", emoji: "text-[10px]" },
  sm: { button: "w-6 h-6 rounded-md", icon: "w-3 h-3", emoji: "text-xs" },
  md: { button: "w-8 h-8 rounded-lg", icon: "w-4 h-4", emoji: "text-base" },
  lg: { button: "w-10 h-10 rounded-lg", icon: "w-5 h-5", emoji: "text-lg" },
};

// Cyan color scheme with hover behavior (default spec)
const BUTTON_CLASSES = "bg-black/60 backdrop-blur-sm flex items-center justify-center ring-1 ring-cyan-500/40 text-cyan-400 hover:bg-cyan-500 hover:text-white hover:ring-cyan-400 transition-all";

export function ContentActionIcons({
  modalities, iconStyle = "lucide", customIcons, onRead, onWatch, onListen, onInteract,
  size = "sm", direction = "row", className = "",
}: ContentActionIconsProps) {
  const sz = SIZE_CLASSES[size];
  const handlers: Record<ContentModality, (() => void) | undefined> = {
    read: onRead, watch: onWatch, listen: onListen, interact: onInteract,
  };

  const renderIcon = (mod: ContentModality) => {
    if (iconStyle === "custom" && customIcons?.[mod]) return customIcons[mod];
    if (iconStyle === "emoji") return <span className={sz.emoji}>{EMOJI_ICONS[mod]}</span>;
    const Icon = LUCIDE_ICONS[mod];
    return <Icon className={sz.icon} />;
  };

  const activeModalities = (Object.keys(modalities) as ContentModality[]).filter(m => modalities[m]);
  if (activeModalities.length === 0) return null;

  return (
    <div className={`flex ${direction === "row" ? "flex-row" : "flex-col"} gap-1 ${className}`}>
      {activeModalities.map((mod) => {
        const handler = handlers[mod];
        return (
          <button
            key={mod}
            className={`${sz.button} ${BUTTON_CLASSES}`}
            title={MODALITY_LABELS[mod]}
            onClick={(e) => { e.stopPropagation(); handler?.(); }}
          >
            {renderIcon(mod)}
          </button>
        );
      })}
    </div>
  );
}

export default ContentActionIcons;
