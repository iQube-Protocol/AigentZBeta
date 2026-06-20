"use client";

/**
 * ActivationsProvider — canonical client-side store for the persona's
 * activated runtime surfaces.
 *
 * Aligned with the metaMe PersonaSpine protocol:
 *   - All reads/writes go through `personaFetch` so the Supabase bearer
 *     token + personaIdHint are attached automatically.
 *   - personaId is resolved from PersonaContext (single source of truth);
 *     the provider re-fetches when the active persona changes.
 *
 * Aligned with the inter-cartridge / iQriptoSpine pattern:
 *   - Activation state lives in one React context. Any cartridge surface
 *     can consume `useActivations()` to gate its tabs or react to changes.
 *   - No window events, no per-component fetches, no race between
 *     `CodexPanelDynamic` and `ActivationsTab`. Optimistic writes flow
 *     through the provider; server confirms via the next refresh.
 *
 * Failure model:
 *   - Mutation throws → optimistic state reverts, `error` populated.
 *   - Reads fail → previous surfaces preserved, `error` populated.
 *   - Consumed outside the provider → hook returns a no-op shape so
 *     non-metaMe codex viewers still render (activation-gated tabs simply
 *     stay hidden — admins keep adminOnly access via the existing flag).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { personaFetch } from "@/utils/personaSpine";
import { usePersonaSafe } from "@/app/contexts/PersonaContext";
import type {
  ActivationSurface,
  ActivationStatus,
} from "@/services/activations/spineActivations";

export type ActivationAction = "activate" | "request" | "revoke";

export interface ActivationsContextValue {
  /** Full catalog overlaid with this persona's status. */
  surfaces: ActivationSurface[];
  /** Set of activation ids with status="active" — drives tab visibility. */
  activeIds: Set<string>;
  /** True while the initial fetch is in flight. */
  loading: boolean;
  /** Last user-facing error, or null. */
  error: string | null;
  /** True while a mutation is in flight for this id. */
  isMutating: (id: string) => boolean;
  /** Force a fresh read from /api/assistant/activations. */
  refresh: () => Promise<void>;
  activate: (id: string) => Promise<void>;
  requestAccess: (id: string) => Promise<void>;
  revoke: (id: string) => Promise<void>;
  /** Clear `error` (e.g. when the user dismisses the banner). */
  clearError: () => void;
}

const NOOP_VALUE: ActivationsContextValue = {
  surfaces: [],
  activeIds: new Set(),
  loading: false,
  error: null,
  isMutating: () => false,
  refresh: async () => {},
  activate: async () => {},
  requestAccess: async () => {},
  revoke: async () => {},
  clearError: () => {},
};

const ActivationsContext = createContext<ActivationsContextValue | null>(null);

interface ProviderProps {
  /**
   * Explicit override for the persona id. When omitted, the provider reads
   * from PersonaContext. Useful in the embed surface when the URL `personaId`
   * has been resolved by the parent before PersonaContext hydrates.
   */
  personaId?: string;
  children: React.ReactNode;
}

export function ActivationsProvider({ personaId: explicitPersonaId, children }: ProviderProps) {
  const persona = usePersonaSafe();
  const personaId = explicitPersonaId ?? persona.activePersonaId ?? undefined;

  const [surfaces, setSurfaces] = useState<ActivationSurface[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mutatingIds, setMutatingIds] = useState<Set<string>>(new Set());

  // Hold the latest personaId in a ref so the mutate closure always sees the
  // current value — guards against stale closures during rapid persona switches.
  const personaRef = useRef<string | undefined>(personaId);
  useEffect(() => {
    personaRef.current = personaId;
  }, [personaId]);

  // Mirror mutatingIds in a ref so the refresh() callback can read it
  // without a dependency — avoids re-creating refresh on every mutation.
  const mutatingIdsRef = useRef<Set<string>>(new Set());

  // Mutation generation counter — incremented when a mutation starts,
  // checked when a background refresh completes. Prevents stale refresh
  // responses (fired by the personaId useEffect or a prior mutation) from
  // overwriting optimistic state set by an in-flight mutation.
  const mutationGenRef = useRef(0);

  const refresh = useCallback(async () => {
    const pid = personaRef.current;
    if (!pid) {
      setLoading(false);
      return;
    }
    const genAtStart = mutationGenRef.current;
    setLoading(true);
    try {
      const url = `/api/assistant/activations?_t=${Date.now()}`;
      const res = await personaFetch(url, {
        personaIdHint: pid,
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 401) {
          throw new Error(
            'Not signed in for this window — the activations API needs your Supabase session. Sign in at dev-beta (or reload after signing in) and try again.',
          );
        }
        throw new Error((body as { detail?: string }).detail ?? `activations fetch failed (${res.status})`);
      }
      const data = (await res.json()) as { activations: ActivationSurface[] };
      if (Array.isArray(data.activations)) {
        if (mutationGenRef.current === genAtStart) {
          setSurfaces((prev) => {
            const currentMutating = mutatingIdsRef.current;
            if (currentMutating.size === 0) return data.activations;
            const serverMap = new Map(data.activations.map((s) => [s.id, s]));
            return prev.map((s) => {
              if (currentMutating.has(s.id)) return s;
              return serverMap.get(s.id) ?? s;
            }).concat(
              data.activations.filter(
                (s) => !prev.some((p) => p.id === s.id) && !currentMutating.has(s.id),
              ),
            );
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch whenever the active persona changes.
  useEffect(() => {
    void refresh();
  }, [personaId, refresh]);

  const mutate = useCallback(
    async (id: string, action: ActivationAction) => {
      const pid = personaRef.current;
      if (!pid) return;

      // Bump the generation so any in-flight refresh() calls discard
      // their results rather than overwriting our optimistic state.
      mutationGenRef.current += 1;

      setMutatingIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        mutatingIdsRef.current = next;
        return next;
      });
      setError(null);

      // Optimistic — flip status locally so every consumer (Activations
      // panel, top menu, future surfaces) updates in the same render tick.
      let snapshot: ActivationSurface[] = [];
      const optimisticStatus: ActivationStatus =
        action === "activate" ? "active"
        : action === "request" ? "pending"
        : "revoked";
      setSurfaces((prev) => {
        snapshot = prev;
        return prev.map((s) =>
          s.id === id
            ? {
                ...s,
                status: optimisticStatus,
                grantedAt: action === "activate" ? new Date().toISOString() : s.grantedAt,
                revokedAt: action === "revoke" ? new Date().toISOString() : s.revokedAt,
              }
            : s,
        );
      });

      try {
        const res = await personaFetch(`/api/assistant/activations/${id}?action=${action}`, {
          personaIdHint: pid,
          method: "POST",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (res.status === 401) {
            throw new Error(
              'Not signed in for this window — the activations API needs your Supabase session. Sign in at dev-beta (or reload after signing in) and try again.',
            );
          }
          throw new Error((body as { detail?: string }).detail ?? `mutation failed (${res.status})`);
        }
        // Server confirms — bump gen again so the refresh we fire is the
        // authoritative read. Short delay lets Supabase read-after-write
        // settle across connections before we re-sync.
        mutationGenRef.current += 1;
        await new Promise((r) => setTimeout(r, 300));
        await refresh();
      } catch (err) {
        // Revert optimistic write.
        setSurfaces(snapshot);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setMutatingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          mutatingIdsRef.current = next;
          return next;
        });
      }
    },
    [refresh],
  );

  const activeIds = useMemo(() => {
    const s = new Set<string>();
    for (const surf of surfaces) {
      if (surf.status === "active") s.add(surf.id);
    }
    return s;
  }, [surfaces]);

  const value = useMemo<ActivationsContextValue>(
    () => ({
      surfaces,
      activeIds,
      loading,
      error,
      isMutating: (id: string) => mutatingIds.has(id),
      refresh,
      activate: (id: string) => mutate(id, "activate"),
      requestAccess: (id: string) => mutate(id, "request"),
      revoke: (id: string) => mutate(id, "revoke"),
      clearError: () => setError(null),
    }),
    [surfaces, activeIds, loading, error, mutatingIds, refresh, mutate],
  );

  return <ActivationsContext.Provider value={value}>{children}</ActivationsContext.Provider>;
}

/**
 * Read the activations store. Returns a no-op shape when called outside an
 * `ActivationsProvider` so non-metaMe surfaces (which don't mount it) still
 * compile and render.
 */
export function useActivations(): ActivationsContextValue {
  const ctx = useContext(ActivationsContext);
  return ctx ?? NOOP_VALUE;
}
