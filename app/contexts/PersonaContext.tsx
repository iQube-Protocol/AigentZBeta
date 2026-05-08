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
   * True once the provider has read from localStorage on the client.
   * False on the very first render (server + initial client paint) before
   * the hydration effect runs. UI gating sign-in vs signed-in state should
   * suppress the sign-in prompt while !hydrated to avoid a flash.
   */
  hydrated: boolean;
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
  try {
    return (
      localStorage.getItem(LS_KEY) ||
      sessionStorage.getItem(LS_KEY) ||
      // legacy fallbacks — remove once all write paths are migrated
      localStorage.getItem("active_persona_id") ||
      localStorage.getItem("activePersonaId") ||
      null
    );
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  // The lazy initializer runs on the server (where window is undefined →
  // returns null) and React doesn't re-run it during client hydration. So we
  // start with null and re-read localStorage in a client-side useEffect on
  // mount. Without this, every PersonaProvider tree starts with null even
  // when localStorage has a valid currentPersonaId.
  const [activePersonaId, setLocalState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [cartridgeDefaults, setCartridgeDefaults] = useState<Record<string, string>>({});
  const [personaDisplayNames, setPersonaDisplayNames] = useState<Record<string, string>>({});
  const defaultsLoadedRef = useRef(false);

  // Hydrate activePersonaId from localStorage after mount. Runs once, before
  // first paint of children that depend on activePersonaId (synchronous-ish
  // because useEffect fires immediately after the first commit).
  useEffect(() => {
    const stored = readFromStorage();
    if (stored) setLocalState(stored);
    setHydrated(true);
  }, []);

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

  // ── Persona-change broadcast helper ───────────────────────────────────────
  //
  // Thin-client integration spec (2026-05-08, Lovable / metame.live):
  //
  //   Listeners want both an ID and a human-readable handle so the shell
  //   can render immediately without a follow-up fetch. Lovable's
  //   ShellContext.tsx personaSyncHandler accepts EITHER a top-level
  //   { type, personaId, displayLabel, ownFioHandle } shape OR a
  //   surface-nested { type, surface: {...} } shape — we send both so
  //   the receiver picks whichever it prefers.
  //
  //   Handle fallback chain (operator-decided): displayLabel ?? ownFioHandle ?? "Be"
  //
  // The broadcast is async because we need to fetch the surface from
  // /api/wallet/active-persona (which knows the persona's display_name +
  // fio_handle from the DB). The fetch is fail-open: if it errors or
  // returns null, we still broadcast the bare {type, personaId} envelope
  // so legacy receivers (codex embed bridge) keep working.
  //
  // Source attribution log line is emitted with a [SPINE] prefix so
  // operators can grep CloudWatch / dev terminal to see what handle
  // resolution produced for any given persona switch. Useful when
  // debugging "why is the shell rendering Be instead of my handle?".
  // ─────────────────────────────────────────────────────────────────────

  type BroadcastSurface = {
    personaSessionToken?: string;
    displayLabel?: string;
    ownFioHandle?: string;
    identifiability?: string;
    cartridgeFlags?: { isAdmin?: boolean; isPartner?: boolean };
    cohortMemberships?: string[];
    sessionExpiresAt?: string;
  };

  const fetchActivePersonaSurface = useCallback(async (): Promise<BroadcastSurface | null> => {
    if (typeof window === 'undefined') return null;
    try {
      // Read JWT directly from localStorage — same approach as
      // useActivePersona / spineGateClient. Avoids supabase-js getSession()
      // refresh chatter that emits AuthApiError on signed-out callers.
      const k = Object.keys(window.localStorage).find(
        (x) => x.startsWith('sb-') && x.endsWith('-auth-token'),
      );
      let jwt = '';
      if (k) {
        const raw = window.localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw) as
            | { access_token?: string; currentSession?: { access_token?: string } }
            | null;
          jwt = parsed?.access_token ?? parsed?.currentSession?.access_token ?? '';
        }
      }
      if (!jwt) return null;
      const res = await fetch('/api/wallet/active-persona', {
        headers: { Accept: 'application/json', Authorization: `Bearer ${jwt}` },
        credentials: 'include',
      });
      if (!res.ok) return null;
      return (await res.json()) as BroadcastSurface;
    } catch {
      return null;
    }
  }, []);

  const broadcastPersonaChange = useCallback(
    (personaId: string, surface: BroadcastSurface | null, source: 'switch' | 'initial' | 'refresh') => {
      const displayLabel = surface?.displayLabel;
      const ownFioHandle = surface?.ownFioHandle;
      const fallback = displayLabel ?? ownFioHandle ?? 'Be';

      // Compose envelope. Top-level fields for the simplest receivers,
      // surface-nested for receivers that prefer the typed object.
      const msg = {
        type: 'aa-persona-change-v1' as const,
        personaId,
        ...(displayLabel ? { displayLabel } : {}),
        ...(ownFioHandle ? { ownFioHandle } : {}),
        ...(surface ? { surface } : {}),
      };

      // Greppable handle-source log line for operator debug.
      console.log(
        `[SPINE] persona-change-broadcast source=${source} ` +
        `personaId=${personaId} ` +
        `displayLabel=${displayLabel ?? '(none)'} ` +
        `ownFioHandle=${ownFioHandle ?? '(none)'} ` +
        `resolvedHandle=${fallback}`,
      );

      // Down to all child iframes
      try {
        const frames = document.querySelectorAll<HTMLIFrameElement>('iframe');
        frames.forEach((frame) => {
          try { frame.contentWindow?.postMessage(msg, '*'); } catch { /* cross-origin */ }
        });
      } catch { /* SSR */ }

      // Up to the parent shell (when iframed inside a thin client)
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(msg, '*');
        }
      } catch { /* SSR / cross-origin */ }
    },
    [],
  );

  // ── Persona switch ────────────────────────────────────────────────────────
  const setActivePersonaId = useCallback((id: string) => {
    try { localStorage.setItem(LS_KEY, id); } catch { /* ignore */ }
    try { sessionStorage.setItem(LS_KEY, id); } catch { /* ignore */ }
    setLocalState(id);

    // Same-document hooks react without page reload
    window.dispatchEvent(
      new StorageEvent("storage", { key: LS_KEY, newValue: id })
    );

    // Async-fetch the surface (display_name + fio_handle from DB) and then
    // broadcast the enriched envelope. Fail-open: on fetch error, still
    // broadcast the bare envelope so legacy receivers keep working.
    void fetchActivePersonaSurface().then((surface) => {
      broadcastPersonaChange(id, surface, 'switch');
    });
  }, [fetchActivePersonaSurface, broadcastPersonaChange]);

  // ── Initial-load emit ─────────────────────────────────────────────────────
  //
  // Thin-client spec item (2): emit aa-persona-change-v1 on initial load
  // / auth restore, not just on user-driven switch. Without this, the
  // shell's header doesn't get the current persona's handle until the
  // user explicitly switches — which never happens in a typical session.
  //
  // Fires once after PersonaContext hydrates from localStorage AND we
  // have an activePersonaId in hand. Ref-guarded so token refreshes
  // (which can re-trigger the hydration effect) don't re-broadcast.
  const initialBroadcastedRef = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    if (!activePersonaId) return;
    if (initialBroadcastedRef.current) return;
    initialBroadcastedRef.current = true;
    void fetchActivePersonaSurface().then((surface) => {
      broadcastPersonaChange(activePersonaId, surface, 'initial');
    });
  }, [hydrated, activePersonaId, fetchActivePersonaSurface, broadcastPersonaChange]);

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
        hydrated,
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
      hydrated: true, // outside provider tree we have no hydration distinction
      setActivePersonaId: () => {},
      cartridgeDefaults: {},
      getCartridgeDefault: () => null,
      setCartridgeDefault: async () => {},
      personaDisplayNames: {},
      registerPersonaNames: () => {},
    }
  );
}
