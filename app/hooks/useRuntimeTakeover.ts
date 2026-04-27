"use client";

/**
 * useRuntimeTakeover
 *
 * Manages the Runtime Takeover session for a cartridge.
 *
 * On mount (or when cartridgeSlug / personaId changes):
 *   1. Checks sessionStorage for a cached manifest within TTL
 *   2. If none, calls POST /api/runtime/takeover/infer
 *   3. Stores the result in sessionStorage
 *
 * Exposes:
 *   manifest       — the active RuntimeTakeoverManifest (null while loading)
 *   isLoading      — true during the first inference call
 *   isPersonalised — true if the manifest was built from live user state
 *   priorityCapsuleIds — ordered list of capsule IDs from the manifest (for host to re-sort)
 *   fireSignal     — call when the user takes an action; writes to the cartridge
 *                    signal endpoint and re-infers if triggersReInference: true
 *   refresh        — force a new inference call (e.g. after wallet sign-in)
 *   dismiss        — clear the manifest from state and sessionStorage
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CODEX_DEFINITIONS } from "@/data/codex-configs";
import type {
  RuntimeTakeoverManifest,
  TakeoverEntryPoint,
} from "@/types/runtimeTakeover";

interface UseRuntimeTakeoverOptions {
  /** Slug of the cartridge owning the takeover (e.g. 'knyt-codex'). */
  cartridgeSlug: string;
  /** Active persona ID — if absent, Tier 1 anonymous manifest is generated. */
  personaId: string | null;
  /** Entry point for welcome copy variant selection. Default: 'arrival'. */
  entryPoint?: TakeoverEntryPoint;
  /** Set false to disable inference (e.g. when feature flag is off). */
  enabled?: boolean;
}

interface UseRuntimeTakeoverResult {
  manifest: RuntimeTakeoverManifest | null;
  isLoading: boolean;
  isPersonalised: boolean;
  /** Ordered capsule IDs from manifest — use to pin/prioritise in capsule grid. */
  priorityCapsuleIds: string[];
  fireSignal: (action: string, payload?: Record<string, unknown>) => void;
  refresh: (nextEntryPoint?: TakeoverEntryPoint) => void;
  dismiss: () => void;
}

function storageKey(cartridgeSlug: string, personaId: string | null): string {
  return `rtakeover:${cartridgeSlug}:${personaId ?? "anon"}`;
}

interface StoredManifest {
  manifest: RuntimeTakeoverManifest;
  expiresAt: string; // ISO
}

function loadFromStorage(key: string): RuntimeTakeoverManifest | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredManifest;
    if (new Date(stored.expiresAt) < new Date()) {
      sessionStorage.removeItem(key);
      return null;
    }
    return stored.manifest;
  } catch {
    return null;
  }
}

function saveToStorage(
  key: string,
  manifest: RuntimeTakeoverManifest,
  ttlMinutes: number,
): void {
  try {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
    sessionStorage.setItem(key, JSON.stringify({ manifest, expiresAt } satisfies StoredManifest));
  } catch { /* sessionStorage unavailable — non-fatal */ }
}

export function useRuntimeTakeover({
  cartridgeSlug,
  personaId,
  entryPoint = "arrival",
  enabled = true,
}: UseRuntimeTakeoverOptions): UseRuntimeTakeoverResult {
  const [manifest, setManifest] = useState<RuntimeTakeoverManifest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inferringRef = useRef(false);
  const currentKeyRef = useRef<string>("");

  // Resolve takeover config for TTL and signal targets
  const takeoverConfig = CODEX_DEFINITIONS.find(
    (c) => c.slug === cartridgeSlug || c.id === cartridgeSlug
  )?.runtimeTakeover ?? null;

  const ttlMinutes = takeoverConfig?.manifestTtlMinutes ?? 30;

  const infer = useCallback(
    async (ep: TakeoverEntryPoint = entryPoint) => {
      if (!enabled || !cartridgeSlug) return;
      if (inferringRef.current) return;
      inferringRef.current = true;
      setIsLoading(true);

      const key = storageKey(cartridgeSlug, personaId);
      currentKeyRef.current = key;

      try {
        const res = await fetch("/api/runtime/takeover/infer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartridgeSlug, personaId, entryPoint: ep }),
        });
        if (!res.ok) return;
        const data = await res.json() as { ok: boolean; manifest?: RuntimeTakeoverManifest };
        if (data.ok && data.manifest) {
          setManifest(data.manifest);
          saveToStorage(key, data.manifest, ttlMinutes);
        }
      } catch { /* network error — non-fatal, manifest stays null */ }
      finally {
        setIsLoading(false);
        inferringRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cartridgeSlug, personaId, enabled, ttlMinutes]
  );

  // On mount / slug+persona change: check sessionStorage first, infer if needed
  useEffect(() => {
    if (!enabled || !cartridgeSlug) return;
    const key = storageKey(cartridgeSlug, personaId);
    const cached = loadFromStorage(key);
    if (cached) {
      setManifest(cached);
      return;
    }
    void infer(entryPoint);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartridgeSlug, personaId, enabled]);

  // Signal emitter — writes to cartridge signal endpoint + re-infers if flagged
  const fireSignal = useCallback(
    (action: string, payload?: Record<string, unknown>) => {
      if (!takeoverConfig) return;
      const target = takeoverConfig.signalTargets.find((t) => t.action === action);
      if (!target) return;

      // Write signal (fire-and-forget)
      void fetch(target.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId, action, ...payload }),
      });

      // Re-infer if this signal type triggers a manifest refresh
      if (target.triggersReInference) {
        sessionStorage.removeItem(storageKey(cartridgeSlug, personaId));
        void infer("return");
      }
    },
    [takeoverConfig, cartridgeSlug, personaId, infer]
  );

  // Manual refresh (e.g. called after wallet sign-in or toggle activation)
  const refresh = useCallback(
    (nextEntryPoint?: TakeoverEntryPoint) => {
      sessionStorage.removeItem(storageKey(cartridgeSlug, personaId));
      void infer(nextEntryPoint ?? entryPoint);
    },
    [cartridgeSlug, personaId, entryPoint, infer]
  );

  const dismiss = useCallback(() => {
    sessionStorage.removeItem(storageKey(cartridgeSlug, personaId));
    setManifest(null);
  }, [cartridgeSlug, personaId]);

  const priorityCapsuleIds = manifest?.capsules.map((c) => c.id) ?? [];
  const isPersonalised = manifest?.isPersonalised ?? false;

  return { manifest, isLoading, isPersonalised, priorityCapsuleIds, fireSignal, refresh, dismiss };
}
