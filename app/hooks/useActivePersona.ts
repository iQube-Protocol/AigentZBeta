"use client";

/**
 * useActivePersona — client-side hook returning ActivePersonaSurface (T1).
 *
 * Phase 1.1.c of the unified identity-content-access foundation plan.
 *
 * Privacy contract:
 *   - The browser only ever holds an opaque `personaSessionToken` (T1).
 *     Raw personaId / authProfileId / fioHandle are server-internal (T0)
 *     and are never returned by the issuance endpoint.
 *   - `aa-persona-change-v1` postMessage events trigger a refresh so a
 *     persona switch in the wallet is reflected on every embed surface
 *     within the trusted shell origin set.
 *   - The hook proactively refreshes a small TTL window before
 *     `sessionExpiresAt` so the token never expires in flight.
 *
 * Replaces the ad-hoc `currentPersonaId` localStorage reads scattered
 * across surface components. Surfaces should consume `surface` rather
 * than reach into storage directly.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { ActivePersonaSurface } from "@/types/access";

const ACTIVE_PERSONA_ENDPOINT = "/api/wallet/active-persona";

/** Refresh this many milliseconds before sessionExpiresAt. */
const REFRESH_LEAD_MS = 60 * 1000;

/** Minimum time between fetches even if multiple triggers fire. */
const FETCH_DEBOUNCE_MS = 250;

export interface UseActivePersonaResult {
  surface: ActivePersonaSurface | null;
  loading: boolean;
  error: Error | null;
  /** Force a fetch (e.g. after an action that may have rotated the token). */
  refresh: () => void;
}

export function useActivePersona(): UseActivePersonaResult {
  const [surface, setSurface] = useState<ActivePersonaSurface | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const lastFetchRef = useRef<number>(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef<boolean>(false);

  const fetchSurface = useCallback(async (signal?: AbortSignal) => {
    const now = Date.now();
    if (now - lastFetchRef.current < FETCH_DEBOUNCE_MS) return;
    lastFetchRef.current = now;

    setLoading(true);
    setError(null);
    try {
      // Acquire the Supabase access token the same way the rest of the
      // platform does (see PersonaSelector.tsx:getAuthHeaders, SmartWalletDrawer
      // line 703–706). Browser navigations don't carry this token; only
      // explicit fetches do. The /api/wallet/active-persona route resolves
      // the caller via getCallerIdentityContext which expects the Bearer.
      let authHeaders: Record<string, string> = {};
      try {
        const { getSupabaseBrowserClient } = await import('@/utils/supabaseBrowser');
        const { data } = await getSupabaseBrowserClient().auth.getSession();
        if (data.session?.access_token) {
          authHeaders = { Authorization: `Bearer ${data.session.access_token}` };
        }
      } catch { /* unauthenticated browsing; the route will return 401 */ }

      const res = await fetch(ACTIVE_PERSONA_ENDPOINT, {
        credentials: "include",
        headers: { Accept: "application/json", ...authHeaders },
        signal,
      });
      if (signal?.aborted) return;
      if (res.status === 401) {
        setSurface(null);
        return;
      }
      if (!res.ok) {
        throw new Error(`active-persona ${res.status}`);
      }
      const data = (await res.json()) as ActivePersonaSurface;
      if (signal?.aborted) return;
      if (!data?.personaSessionToken || !data?.sessionExpiresAt) {
        throw new Error("active-persona: malformed payload");
      }
      setSurface(data);
    } catch (err: unknown) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  const scheduleRefresh = useCallback(
    (expiresAtIso: string) => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      const expiresAt = Date.parse(expiresAtIso);
      if (!Number.isFinite(expiresAt)) return;
      const ms = Math.max(5_000, expiresAt - Date.now() - REFRESH_LEAD_MS);
      refreshTimerRef.current = setTimeout(() => {
        if (!cancelledRef.current) void fetchSurface();
      }, ms);
    },
    [fetchSurface],
  );

  // Initial load + cancellation safety
  useEffect(() => {
    cancelledRef.current = false;
    const controller = new AbortController();
    void fetchSurface(controller.signal);
    return () => {
      cancelledRef.current = true;
      controller.abort();
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [fetchSurface]);

  // Re-arm the refresh timer whenever the surface changes
  useEffect(() => {
    if (surface?.sessionExpiresAt) scheduleRefresh(surface.sessionExpiresAt);
  }, [surface?.sessionExpiresAt, scheduleRefresh]);

  // Cross-surface persona change broadcast (postMessage from wallet drawer / shell)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: MessageEvent) => {
      const data = event.data as { type?: string } | null;
      if (data?.type === "aa-persona-change-v1") {
        void fetchSurface();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [fetchSurface]);

  // Visibility change — refresh on tab return so we never operate on a
  // potentially-expired token after a long sleep.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => {
      if (document.visibilityState === "visible") void fetchSurface();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [fetchSurface]);

  const refresh = useCallback(() => {
    void fetchSurface();
  }, [fetchSurface]);

  return { surface, loading, error, refresh };
}
