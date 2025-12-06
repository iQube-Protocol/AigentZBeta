/**
 * useOrchestration Hook
 * 
 * React hook for calling orchestration API and applying results to layout store
 */

import { useState } from "react";
import { useLayoutStore, type LayoutState } from "@/stores/layoutStore";
import type { NarrativeHints } from "@/orchestration/types";

export function useOrchestration() {
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [narrativeHints, setNarrativeHints] = useState<NarrativeHints | null>(null);
  
  const applyDrawerDelta = useLayoutStore((state: LayoutState) => state.applyDrawerDelta);
  
  const orchestrate = async (params: {
    appId: string;
    tenantId: string;
    personaId: string;
    activeAgentId?: string;
    smartContentId?: string;
    explicitGoal?: string;
  }) => {
    setIsOrchestrating(true);
    setError(null);
    
    try {
      const response = await fetch("/api/orchestrate-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Orchestration failed");
      }
      
      const data = await response.json();
      
      // Apply drawer changes to layout store
      if (data.drawerDelta) {
        applyDrawerDelta(data.drawerDelta);
      }
      
      // Store narrative hints for UI display
      if (data.narrativeHints) {
        setNarrativeHints(data.narrativeHints);
      }
      
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("[useOrchestration]", err);
      throw err;
    } finally {
      setIsOrchestrating(false);
    }
  };
  
  return {
    orchestrate,
    isOrchestrating,
    error,
    narrativeHints,
  };
}
