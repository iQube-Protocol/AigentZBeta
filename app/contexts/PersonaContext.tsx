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
 *
 * Phase 4 additions:
 * - cartridgeDefaults: per-user, per-cartridge preferred persona map
 * - personaDisplayNames: lightweight id→label registry populated by wallet/selector
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const LS_KEY = "currentPersonaId";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PersonaDisplayEntry {
  id: string;
  displayName?: string;
  fioHandle?: string;
}

interface PersonaContextValue {
  /** The active persona ID, or null when no persona is selected. */
  activePersonaId: string | null;
  /**
   * Switch the active persona.
   * Writes canonical localStorage key + sessionStorage, dispatches a
   * synthetic storage event so same-tab subscribers react, and broadcasts
   * aa-persona-change-v1 to every child iframe.
   */
  setActivePersonaId: (id: string) => void;

  // ── Phase 4: cartridge defaults ──────────────────────────────────────────
  /** slug → personaId map loaded from the server. */
  cartridgeDefaults: Record<string, string>;
  /** Return the preferred persona ID for a cartridge, or null if not set. */
  getCartridgeDefault: (slug: string) => string | null;
  /**
   * Persist a cartridge default to the server and update local state.
   * No-ops silently if unauthenticated.
   */
  setCartridgeDefault: (slug: string, personaId: string) => Promise<void>;

  // ── Phase 4: lightweight persona name registry ───────────────────────────
  /** personaId → display label (displayName or fioHandle). */
  personaDisplayNames: Record<string, string>;
  /**
   * Register display names from a freshly-loaded persona list.
   * Called by PersonaSelector after API fetch — no extra round-trips.
   */
  registerPersonaNames: (personas: PersonaDisplayEntry[]) => void;
}

const PersonaContext = createContext<PersonaContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Auth helper (mirrors PersonaSelector's getAuthHeaders)
// ─────────────────────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { getSupabaseBrowserClient } = await import("@/utils/supabaseBrowser");
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    if (data.session?.access_token) {
      return { Authorization: `Bearer ${data.session.access_token}` };
    }
  } catch { /* ignore */ }
  return {};
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage helpers
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

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [activePersonaId, setLocalState] = useState<string | null>(() =>
    readFromStorage()
  );
  const [cartridgeDefaults, setCartridgeDefaults] = useState<Record<string, string>>({});
  const [personaDisplayNames, setPersonaDisplayNames] = useState<Record<string, string>>({});
  const defaultsLoadedRef = useRef(false);

  // ── Load cartridge defaults once on mount (if authenticated) ──────────────
  useEffect(() => {
    if (defaultsLoadedRef.current) return;
    defaultsLoadedRef.current = true;

    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers.Authorization) return;
        const res = await fetch("/api/wallet/persona/cartridge-defaults", { headers });
        if (!res.ok) return;
        const json = await res.json();
        if (json?.defaults && typeof json.defaults === "object") {
          setCartridgeDefaults(json.defaults as Record<string, string>);
        }
      } catch { /* non-fatal */ }
    })();
  }, []);

  // ── Cross-tab sync ────────────────────────────────────────────────────────
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY && e.newValue !== activePersonaId) {
        setLocalState(e.newValue || null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [activePersonaId]);

  // ── Persona switch ────────────────────────────────────────────────────────
  const setActivePersonaId = useCallback((id: string) => {
    localStorage.setItem(LS_KEY, id);
    sessionStorage.setItem(LS_KEY, id);
    setLocalState(id);

    // Same-document hooks react without page reload
    window.dispatchEvent(
      new StorageEvent("storage", { key: LS_KEY, newValue: id })
    );

    // Broadcast to all child iframes
    const msg = { type: "aa-persona-change-v1", personaId: id };
    try {
      const frames = document.querySelectorAll<HTMLIFrameElement>("iframe");
      frames.forEach((frame) => {
        try { frame.contentWindow?.postMessage(msg, "*"); } catch { /* cross-origin */ }
      });
    } catch { /* SSR guard */ }
  }, []);

  // ── Cartridge defaults ────────────────────────────────────────────────────
  const getCartridgeDefault = useCallback(
    (slug: string): string | null => cartridgeDefaults[slug] ?? null,
    [cartridgeDefaults]
  );

  const setCartridgeDefault = useCallback(
    async (slug: string, personaId: string): Promise<void> => {
      // Optimistic local update
      setCartridgeDefaults((prev) => ({ ...prev, [slug]: personaId }));
      try {
        const headers = await getAuthHeaders();
        if (!headers.Authorization) return;
        await fetch("/api/wallet/persona/cartridge-defaults", {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ slug, personaId }),
        });
      } catch { /* non-fatal — local state already updated */ }
    },
    []
  );

  // ── Persona name registry ─────────────────────────────────────────────────
  const registerPersonaNames = useCallback((personas: PersonaDisplayEntry[]) => {
    if (!personas.length) return;
    setPersonaDisplayNames((prev) => {
      const next = { ...prev };
      for (const p of personas) {
        if (!p.id) continue;
        next[p.id] = p.displayName || p.fioHandle || p.id;
      }
      return next;
    });
  }, []);

  return (
    <PersonaContext.Provider
      value={{
        activePersonaId,
        setActivePersonaId,
        cartridgeDefaults,
        getCartridgeDefault,
        setCartridgeDefault,
        personaDisplayNames,
        registerPersonaNames,
      }}
    >
      {children}
    </PersonaContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

export function usePersona(): PersonaContextValue {
  const ctx = useContext(PersonaContext);
  if (!ctx) throw new Error("usePersona must be used within a PersonaProvider");
  return ctx;
}

/** Safe variant — works outside the provider tree (returns no-op defaults). */
export function usePersonaSafe(): PersonaContextValue {
  return (
    useContext(PersonaContext) ?? {
      activePersonaId: null,
      setActivePersonaId: () => {},
      cartridgeDefaults: {},
      getCartridgeDefault: () => null,
      setCartridgeDefault: async () => {},
      personaDisplayNames: {},
      registerPersonaNames: () => {},
    }
  );
}
