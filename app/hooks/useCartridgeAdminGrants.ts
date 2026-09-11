"use client";

/**
 * useCartridgeAdminGrants — client hook for the per-persona admin
 * grant set surfaced by /api/persona/cartridge-admin-grants.
 *
 * Returns the grants as a stable Set so getEnabledTabs can do an O(1)
 * lookup against tab.adminOfCartridge during filter passes.
 *
 * Failure / loading posture
 * -------------------------
 *   - While the fetch is in flight, returns the empty no-grants
 *     posture. This is fail-CLOSED — adminOfCartridge tabs stay
 *     hidden during the brief loading window rather than flashing in
 *     and out for non-admin personas.
 *   - On fetch error (401, 5xx, network), returns the same empty
 *     posture. Surfaces don't get to claim admin grants via a
 *     half-loaded state.
 *
 * Auth posture
 * ------------
 *   - Uses personaFetch from utils/personaSpine, which auto-attaches
 *     the Supabase Bearer token to outbound requests. The spine
 *     endpoint resolves callers via getCallerIdentityContext, which
 *     reads `Authorization: Bearer …` — cookies alone are NOT
 *     sufficient.
 *   - Initial bug 2026-05-26: this hook used raw `fetch` with
 *     `credentials: "same-origin"`. Cookies were sent but the Bearer
 *     token was missing, so the endpoint returned 401 for every
 *     caller — even global admins — and admin tabs never appeared.
 *     personaFetch wraps the same fetch with the token already
 *     attached.
 *
 * Privacy
 * -------
 *   - The endpoint resolves persona server-side via the spine; no
 *     client-supplied persona id. personaFetch is server-trust-safe.
 */
import { useEffect, useMemo, useState } from "react";
import { personaFetch } from "@/utils/personaSpine";

export interface CartridgeAdminGrantsState {
  isGlobalAdmin: boolean;
  cartridgeSlugs: Set<string>;
  loaded: boolean;
}

const EMPTY: CartridgeAdminGrantsState = {
  isGlobalAdmin: false,
  cartridgeSlugs: new Set<string>(),
  loaded: false,
};

interface ApiResponse {
  isGlobalAdmin: boolean;
  cartridgeSlugs: string[];
}

export function useCartridgeAdminGrants(): CartridgeAdminGrantsState {
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [cartridgeSlugsArr, setCartridgeSlugsArr] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await personaFetch("/api/persona/cartridge-admin-grants", {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const payload = (await res.json()) as Partial<ApiResponse>;
        if (cancelled) return;
        setIsGlobalAdmin(payload.isGlobalAdmin === true);
        setCartridgeSlugsArr(Array.isArray(payload.cartridgeSlugs) ? payload.cartridgeSlugs : []);
        setLoaded(true);
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Stable Set across renders unless the underlying slug list changes.
  const cartridgeSlugs = useMemo(() => new Set(cartridgeSlugsArr), [cartridgeSlugsArr]);

  if (!loaded) return EMPTY;
  return { isGlobalAdmin, cartridgeSlugs, loaded: true };
}
