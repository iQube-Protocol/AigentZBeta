"use client";

/**
 * useNbePlan — client-side hook returning the canonical NBEPlan for a persona.
 *
 * Wraps GET /api/runtime/nbe (the canonical NBE source-of-truth that consults
 * the persona's journey_state + experience_matrices and persists the computed
 * plan with a 24h TTL). UI surfaces consume this rather than reaching into
 * cartridge-specific state shapes for NBE fields.
 *
 * Fire-and-forget: a missing personaId leaves `plan` null and `loading` false.
 * Cached non-expired plans return immediately as `source: 'cached'`.
 */

import { useCallback, useEffect, useState } from "react";
import { personaFetch } from "@/utils/personaSpine";
import type { AgentDisposition, ExperienceDepth } from "@/types/orchestration";

export interface NbePlan {
  id: string;
  persona_id: string;
  experience_id: string | null;
  disposition: AgentDisposition;
  next_experience_depth: ExperienceDepth;
  rationale: string;
  expires_at: string | null;
  created_at: string;
}

export interface UseNbePlanResult {
  plan: NbePlan | null;
  loading: boolean;
  source: "cached" | "computed" | null;
  error: Error | null;
  refetch: () => void;
}

export function useNbePlan(personaId: string | undefined | null): UseNbePlanResult {
  const [plan, setPlan] = useState<NbePlan | null>(null);
  const [source, setSource] = useState<"cached" | "computed" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPlan = useCallback(async () => {
    if (!personaId) {
      setPlan(null);
      setSource(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch(
        `/api/runtime/nbe?personaId=${encodeURIComponent(personaId)}`,
        { personaIdHint: personaId },
      );
      if (!res.ok) {
        throw new Error(`nbe fetch failed: ${res.status}`);
      }
      const data = await res.json();
      setPlan(data?.nbe ?? null);
      setSource(data?.source ?? null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    void fetchPlan();
  }, [fetchPlan]);

  return { plan, loading, source, error, refetch: fetchPlan };
}
