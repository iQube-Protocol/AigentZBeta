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
 * Privacy
 * -------
 *   - The endpoint resolves persona via the spine; no client-supplied
 *     persona id. This hook simply calls fetch with default credentials
 *     so the cookie / PST that getActivePersona reads is present.
 */
import { useEffect, useMemo, useState } from "react";

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
        const res = await fetch("/api/persona/cartridge-admin-grants", {
          cache: "no-store",
          credentials: "same-origin",
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
