"use client";

/**
 * PersonaContext — canonical active-persona state for the entire platform.
 *
 * Single source of truth: `currentPersonaId` in localStorage.
 * All surfaces (shell tabs, embed codexes, runtime client) subscribe here
 * instead of reading localStorage directly.
 *
 * Cross-tab sync: the native `storage` event fires when another tab writes
 * `currentPersonaId`, so every open tab/embed stays aligned automatically.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const LS_KEY = "currentPersonaId";

// ─────────────────────────────────────────────────────────────────────────────
// Context type
// ─────────────────────────────────────────────────────────────────────────────

interface PersonaContextValue {
  /** The active persona ID, or null when no persona is selected. */
  activePersonaId: string | null;
  /**
   * Switch the active persona.
   * Writes canonical localStorage key + sessionStorage, dispatches a
   * synthetic storage event so same-tab subscribers (e.g. useCodexEmbedAuthBridge)
   * also pick up the change.
   */
  setActivePersonaId: (id: string) => void;
}

const PersonaContext = createContext<PersonaContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

function readFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem(LS_KEY) ||
    sessionStorage.getItem(LS_KEY) ||
    // legacy fallbacks — remove once all write paths are migrated
    localStorage.getItem("active_persona_id") ||
    localStorage.getItem("activePersonaId") ||
    null
  );
}

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [activePersonaId, setLocalState] = useState<string | null>(() =>
    readFromStorage()
  );

  // Cross-tab sync: other tabs writing currentPersonaId fires the storage event
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY && e.newValue !== activePersonaId) {
        setLocalState(e.newValue || null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [activePersonaId]);

  const setActivePersonaId = useCallback((id: string) => {
    localStorage.setItem(LS_KEY, id);
    sessionStorage.setItem(LS_KEY, id);
    setLocalState(id);

    // Dispatch a synthetic storage event so same-document hooks
    // (useCodexEmbedAuthBridge) also react without page reload.
    window.dispatchEvent(
      new StorageEvent("storage", { key: LS_KEY, newValue: id })
    );

    // Broadcast to all child iframes (codex embeds, runtime thin client).
    // Each iframe's message handler listens for aa-persona-change-v1 and
    // updates its local persona state without requiring a reload.
    const msg = { type: "aa-persona-change-v1", personaId: id };
    try {
      const frames = document.querySelectorAll<HTMLIFrameElement>("iframe");
      frames.forEach((frame) => {
        try {
          frame.contentWindow?.postMessage(msg, "*");
        } catch {
          // cross-origin frames may throw — safe to ignore
        }
      });
    } catch {
      // document not available (SSR guard)
    }
  }, []);

  return (
    <PersonaContext.Provider value={{ activePersonaId, setActivePersonaId }}>
      {children}
    </PersonaContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function usePersona(): PersonaContextValue {
  const ctx = useContext(PersonaContext);
  if (!ctx) throw new Error("usePersona must be used within a PersonaProvider");
  return ctx;
}

/**
 * Safe variant — returns null values when called outside the provider tree
 * (useful for components shared between shell and embed routes).
 */
export function usePersonaSafe(): PersonaContextValue {
  return (
    useContext(PersonaContext) ?? {
      activePersonaId: null,
      setActivePersonaId: () => {},
    }
  );
}
