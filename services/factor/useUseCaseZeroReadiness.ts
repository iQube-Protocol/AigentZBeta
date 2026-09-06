"use client";

/**
 * useUseCaseZeroReadiness — the ONE controller hook every Use Case Zero
 * presentation surface consumes (mirrors services/factor/useBankrTokenLaunch.ts's
 * own contract). Calls the two real REST routes
 * (app/api/moneypenny/factor/use-case-zero/{readiness,advance}/route.ts) —
 * never a second client-side readiness computation.
 */

import { useCallback, useEffect, useState } from "react";
import { personaFetch } from "@/utils/personaSpine";
import type { UseCaseZeroPath, UseCaseZeroReadiness } from "@/services/factor/useCaseZeroReadinessProjection";
import type { AdvanceUseCaseZeroResult } from "@/services/factor/useCaseZeroOrchestrator";

export interface UseUseCaseZeroReadinessOptions {
  agentSlug: string;
  tenantId?: string;
}

/**
 * Per-viewer resume convenience ONLY (CLAUDE.md "State Management
 * Boundaries": localStorage for UX reactivity, never canonical state) — a
 * page reload previously lost the in-memory caseId/path entirely, forcing
 * the operator to start over even though the REAL, canonical progress
 * (the Factor case + every established leg) was never lost server-side.
 * This never becomes a second source of truth: on mount, a stored
 * (path, caseId) pair is used only to re-run the SAME readiness read this
 * hook always performs — the server's own response is what actually
 * populates `readiness`.
 */
function storageKey(agentSlug: string) {
  return `use-case-zero:${agentSlug}`;
}
function readStoredResume(agentSlug: string): { path: UseCaseZeroPath; caseId?: string } | null {
  try {
    const raw = window.localStorage.getItem(storageKey(agentSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.path === "bring_own_agent" || parsed?.path === "create_and_establish") {
      return { path: parsed.path, caseId: typeof parsed.caseId === "string" ? parsed.caseId : undefined };
    }
    return null;
  } catch {
    return null;
  }
}
function writeStoredResume(agentSlug: string, value: { path: UseCaseZeroPath; caseId?: string } | null) {
  try {
    if (!value) window.localStorage.removeItem(storageKey(agentSlug));
    else window.localStorage.setItem(storageKey(agentSlug), JSON.stringify(value));
  } catch {
    // Private browsing / storage disabled — resume convenience only, never
    // block on it.
  }
}

export function useUseCaseZeroReadiness({ agentSlug, tenantId }: UseUseCaseZeroReadinessOptions) {
  const [path, setPath] = useState<UseCaseZeroPath | null>(null);
  const [caseId, setCaseId] = useState<string | undefined>(undefined);
  const [readiness, setReadiness] = useState<UseCaseZeroReadiness | null>(null);
  const [lastAdvance, setLastAdvance] = useState<AdvanceUseCaseZeroResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resume-on-mount: re-fetch canonical readiness for a previously-chosen
  // (path, caseId) pair rather than leaving the capsule looking reset when
  // real, server-side progress still exists.
  useEffect(() => {
    const stored = readStoredResume(agentSlug);
    if (!stored) return;
    setLoading(true);
    personaFetch("/api/moneypenny/factor/use-case-zero/readiness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentSlug, path: stored.path, tenantId, caseId: stored.caseId }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!json.ok) throw new Error(json.error ?? "resume readiness read failed");
        setPath(stored.path);
        setCaseId(stored.caseId);
        setReadiness(json.readiness as UseCaseZeroReadiness);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
    // Mount-only: a stale closure over agentSlug/tenantId here is fine —
    // this effect exists purely to hydrate from a PRIOR mount's storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choosePath = useCallback(
    async (chosen: UseCaseZeroPath) => {
      setLoading(true);
      setError(null);
      try {
        const res = await personaFetch("/api/moneypenny/factor/use-case-zero/readiness", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentSlug, path: chosen, tenantId, caseId }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "readiness assessment failed");
        setPath(chosen);
        setReadiness(json.readiness as UseCaseZeroReadiness);
        writeStoredResume(agentSlug, { path: chosen, caseId });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [agentSlug, tenantId, caseId],
  );

  const advance = useCallback(
    async (launchSpec?: { chain: string; tokenName: string; tokenSymbol: string; description?: string }) => {
      if (!path) return;
      setLoading(true);
      setError(null);
      try {
        const res = await personaFetch("/api/moneypenny/factor/use-case-zero/advance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentSlug, path, tenantId, caseId, launchSpec }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "advance failed");
        const result = json.result as AdvanceUseCaseZeroResult;
        setLastAdvance(result);
        setReadiness(result.readiness);
        if (result.caseId) {
          setCaseId(result.caseId);
          writeStoredResume(agentSlug, { path, caseId: result.caseId });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [agentSlug, path, tenantId, caseId],
  );

  const reset = useCallback(() => {
    setPath(null);
    setReadiness(null);
    setLastAdvance(null);
    setError(null);
    // Bug fix (2026-09-06, operator review): "Start over" previously left
    // the in-memory caseId in place — choosing a path again reused the OLD
    // case instead of genuinely starting over, silently contradicting the
    // button's own label.
    setCaseId(undefined);
    writeStoredResume(agentSlug, null);
  }, [agentSlug]);

  return { path, readiness, lastAdvance, loading, error, choosePath, advance, reset, caseId, setCaseId };
}
