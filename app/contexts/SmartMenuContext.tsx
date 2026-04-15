"use client";

/**
 * SmartMenuContext — Mode bar state and MENU_ACTION dispatch
 *
 * Tracks the active Be/Earn/Play/Make/Share mode and fires:
 *   1. POST /api/aa/v1/runtime/menu-action  (AA-API runtime)
 *   2. postMessage MENU_ACTION via iframe-bridge  (any embedded MetaMe runtime iframes)
 *
 * Design parity with Lovable thin client smart menu contract.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { createShellMessage } from "@/packages/iframe-bridge/src";

// ─── Mode types (matching runtimeShell MENU_ITEMS ids) ─────────────────────

export type SmartMenuMode = "be" | "earn" | "play" | "make" | "share";

export interface SmartMenuModeItem {
  id: SmartMenuMode;
  label: string;
  icon: string;
  color: string;
  tooltip: string;
  intent: string;
}

export const SMART_MENU_MODES: SmartMenuModeItem[] = [
  {
    id: "be",
    label: "Be",
    icon: "users",
    color: "#cbd5e1",
    tooltip: "Identity, persona, and trust context",
    intent: "be",
  },
  {
    id: "earn",
    label: "Earn",
    icon: "coins",
    color: "#6ee7b7",
    tooltip: "Rewards, offers, and settlement opportunities",
    intent: "earn",
  },
  {
    id: "play",
    label: "Play",
    icon: "play-circle",
    color: "#67e8f9",
    tooltip: "Interactive experiences and capsule launch",
    intent: "play",
  },
  {
    id: "make",
    label: "Make",
    icon: "pencil",
    color: "#d8b4fe",
    tooltip: "Create, compose, and build",
    intent: "make",
  },
  {
    id: "share",
    label: "Share",
    icon: "share-2",
    color: "#cbd5e1",
    tooltip: "Distribute capsules and invite collaborators",
    intent: "share",
  },
];

// ─── Context value ──────────────────────────────────────────────────────────

interface SmartMenuContextValue {
  activeMode: SmartMenuMode | null;
  activateMode: (mode: SmartMenuMode) => Promise<void>;
  clearMode: () => void;
}

const SmartMenuContext = createContext<SmartMenuContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────

export function SmartMenuProvider({ children }: { children: ReactNode }) {
  const [activeMode, setActiveMode] = useState<SmartMenuMode | null>(null);

  const activateMode = useCallback(async (mode: SmartMenuMode) => {
    setActiveMode(mode);

    // 1. Notify AA-API runtime (fire and forget — don't block UI on this)
    fetch("/api/aa/v1/runtime/menu-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action_id: mode }),
    }).catch(() => {
      // Non-critical — runtime state update best-effort
    });

    // 2. Broadcast to any embedded MetaMe runtime iframes via postMessage
    const message = createShellMessage(
      "MENU_ACTION",
      { action_id: mode, intent: mode },
      {}
    );
    document.querySelectorAll<HTMLIFrameElement>("iframe[data-metame-runtime]").forEach(
      (frame) => {
        try {
          frame.contentWindow?.postMessage(message, "*");
        } catch {
          // Silently skip cross-origin frames that reject postMessage
        }
      }
    );
  }, []);

  const clearMode = useCallback(() => {
    setActiveMode(null);
  }, []);

  return (
    <SmartMenuContext.Provider value={{ activeMode, activateMode, clearMode }}>
      {children}
    </SmartMenuContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSmartMenu(): SmartMenuContextValue {
  const ctx = useContext(SmartMenuContext);
  if (!ctx) {
    throw new Error("useSmartMenu must be used within SmartMenuProvider");
  }
  return ctx;
}
