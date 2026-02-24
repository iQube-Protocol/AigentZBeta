"use client";

/**
 * DrawerTabBar
 * 
 * Tab navigation component for drawer tabs.
 * Supports icons, labels, and modality indicators.
 */

import React from "react";
import {
  Wallet,
  BookOpen,
  CheckSquare,
  Trophy,
  Gift,
  Target,
  Compass,
  Settings,
  Bot,
  Sparkles,
  Video,
  Headphones,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Users,
  Zap,
} from "lucide-react";
import type { DrawerTab, Modality } from "@/types/smartDrawer";

// =============================================================================
// TYPES
// =============================================================================

export interface DrawerTabBarProps {
  /** Available tabs */
  tabs: DrawerTab[];
  
  /** Currently active tab ID */
  activeTabId?: string;
  
  /** Callback when tab changes */
  onTabChange?: (tabId: string) => void;
  
  /** Custom class name */
  className?: string;
}

// =============================================================================
// ICON MAPPING
// =============================================================================

const TAB_ICONS: Record<string, React.ElementType> = {
  wallet: Wallet,
  library: BookOpen,
  tasks: CheckSquare,
  reputation: Trophy,
  rewards: Gift,
  quests: Target,
  explore: Compass,
  settings: Settings,
  copilot: Bot,
  ai: Sparkles,
  video: Video,
  audio: Headphones,
  articles: FileText,
  images: ImageIcon,
  chat: MessageSquare,
  social: Users,
  activity: Zap,
  default: FileText,
};

const MODALITY_COLORS: Record<Modality, string> = {
  watch: "text-blue-400",
  read: "text-emerald-400",
  listen: "text-purple-400",
  interact: "text-amber-400",
};

const getTabIcon = (tab: DrawerTab): React.ElementType => {
  // Infer from tab ID
  const idKey = tab.id.toLowerCase();
  if (TAB_ICONS[idKey]) {
    return TAB_ICONS[idKey];
  }
  
  // Infer from label
  const labelKey = tab.label?.toLowerCase() ?? "";
  if (TAB_ICONS[labelKey]) {
    return TAB_ICONS[labelKey];
  }
  
  return TAB_ICONS.default;
};

// =============================================================================
// COMPONENT
// =============================================================================

export function DrawerTabBar({
  tabs,
  activeTabId,
  onTabChange,
  className = "",
}: DrawerTabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className={`flex items-center justify-around px-2 py-2 bg-black/20 border-b border-white/10 ${className}`}>
      {tabs.map((tab) => {
        const Icon = getTabIcon(tab);
        const isActive = tab.id === activeTabId;
        const primaryModality = tab.modalityFocus?.[0];
        const modalityColor = primaryModality ? MODALITY_COLORS[primaryModality] : "";

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange?.(tab.id)}
            className={`relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all ${
              isActive
                ? "bg-white/10 text-white"
                : "text-white/50 hover:text-white/80 hover:bg-white/5"
            }`}
            title={tab.label}
          >
            <Icon className={`w-4 h-4 ${isActive && modalityColor ? modalityColor : ""}`} />
            
            {/* Label (only show if few tabs) */}
            {tabs.length <= 5 && (
              <span className="text-[10px] uppercase tracking-wider">
                {tab.label}
              </span>
            )}

            {/* Active indicator */}
            {isActive && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-purple-400" />
            )}

            {/* Modality indicator dot */}
            {primaryModality && !isActive && (
              <div
                className={`absolute top-0 right-0 w-1.5 h-1.5 rounded-full ${
                  primaryModality === "watch" ? "bg-blue-400" :
                  primaryModality === "read" ? "bg-emerald-400" :
                  primaryModality === "listen" ? "bg-purple-400" :
                  primaryModality === "interact" ? "bg-amber-400" :
                  "bg-gray-400"
                }`}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default DrawerTabBar;
