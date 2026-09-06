"use client";

/**
 * useUseCaseZeroReadiness — the ONE controller hook every Use Case Zero
 * presentation surface consumes (mirrors services/factor/useBankrTokenLaunch.ts's
 * own contract). Calls the two real REST routes
 * (app/api/moneypenny/factor/use-case-zero/{readiness,advance}/route.ts) —
 * never a second client-side readiness computation.
 */

import { useCallback, useState } from "react";
import { personaFetch } from "@/utils/personaSpine";
import type { UseCaseZeroPath, UseCaseZeroReadiness } from "@/services/factor/useCaseZeroReadinessProjection";
import type { AdvanceUseCaseZeroResult } from "@/services/factor/useCaseZeroOrchestrator";

export interface UseUseCaseZeroReadinessOptions {
  agentSlug: string;
  tenantId?: string;
}

export function useUseCaseZeroReadiness({ agentSlug, tenantId }: UseUseCaseZeroReadinessOptions) {
  const [path, setPath] = useState<UseCaseZeroPath | null>(null);
  const [caseId, setCaseId] = useState<string | undefined>(undefined);
  const [readiness, setReadiness] = useState<UseCaseZeroReadiness | null>(null);
  const [lastAdvance, setLastAdvance] = useState<AdvanceUseCaseZeroResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        if (result.caseId) setCaseId(result.caseId);
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
  }, []);

  return { path, readiness, lastAdvance, loading, error, choosePath, advance, reset, caseId, setCaseId };
}
