"use client";

/**
 * useUseCaseZeroReadiness — the ONE controller hook every Use Case Zero
 * presentation surface consumes (mirrors services/factor/useBankrTokenLaunch.ts's
 * own contract). Calls the two real REST routes
 * (app/api/moneypenny/factor/use-case-zero/{readiness,advance}/route.ts) —
 * never a second client-side readiness computation.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { personaFetch, usePersonaSpine } from "@/utils/personaSpine";
import type { UseCaseZeroPath, UseCaseZeroReadiness } from "@/services/factor/useCaseZeroReadinessProjection";
import type { AdvanceUseCaseZeroResult } from "@/services/factor/useCaseZeroOrchestrator";

export type UseCaseZeroJourneyProfile = "standard" | "financial_intelligence";

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
 * This never becomes a second source of truth: a stored (path, caseId) pair
 * is used only to re-run the SAME readiness read this hook always
 * performs — the server's own response is what actually populates
 * `readiness`.
 *
 * Item 6 fix (2026-09-06): previously keyed by `agentSlug` alone — a
 * persona switch (or tenant switch) with the SAME agentSlug would silently
 * resume a DIFFERENT identity's in-progress case. Scoped here by
 * tenantId + the active persona's OWN `personaSessionToken` (the T1 handle
 * — never the raw T0 personaId, which must never touch browser state per
 * the identity spine tiers) + agentSlug, so two different identities never
 * share a resume slot.
 */
function storageKey(tenantId: string | undefined, personaSessionToken: string | null | undefined, agentSlug: string) {
  return `use-case-zero:${tenantId ?? "no-tenant"}:${personaSessionToken ?? "no-persona"}:${agentSlug}`;
}
interface StoredResume {
  path: UseCaseZeroPath;
  caseId?: string;
  /** Item 2 (2026-09-07): the operator's explicit journey-profile choice
   *  persists alongside path/caseId — a reload must not silently reset it
   *  back to 'standard'. Absent (older stored entries) is treated as
   *  'standard', never as 'financial_intelligence'. */
  journeyProfile?: UseCaseZeroJourneyProfile;
}
function readStoredResume(
  tenantId: string | undefined,
  personaSessionToken: string | null | undefined,
  agentSlug: string,
): StoredResume | null {
  try {
    const raw = window.localStorage.getItem(storageKey(tenantId, personaSessionToken, agentSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.path === "bring_own_agent" || parsed?.path === "create_and_establish") {
      return {
        path: parsed.path,
        caseId: typeof parsed.caseId === "string" ? parsed.caseId : undefined,
        journeyProfile: parsed.journeyProfile === "financial_intelligence" ? "financial_intelligence" : "standard",
      };
    }
    return null;
  } catch {
    return null;
  }
}
function writeStoredResume(
  tenantId: string | undefined,
  personaSessionToken: string | null | undefined,
  agentSlug: string,
  value: StoredResume | null,
) {
  try {
    const key = storageKey(tenantId, personaSessionToken, agentSlug);
    if (!value) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing / storage disabled — resume convenience only, never
    // block on it.
  }
}

export function useUseCaseZeroReadiness({ agentSlug, tenantId }: UseUseCaseZeroReadinessOptions) {
  const { personaSessionToken, status: personaStatus } = usePersonaSpine();
  const [path, setPath] = useState<UseCaseZeroPath | null>(null);
  const [caseId, setCaseId] = useState<string | undefined>(undefined);
  const [journeyProfile, setJourneyProfileState] = useState<UseCaseZeroJourneyProfile>("standard");
  const [readiness, setReadiness] = useState<UseCaseZeroReadiness | null>(null);
  const [lastAdvance, setLastAdvance] = useState<AdvanceUseCaseZeroResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resume-on-identity-change: re-fetch canonical readiness for a
  // previously-chosen (path, caseId) pair scoped to the CURRENT
  // tenant+persona+agent triple, rather than leaving the capsule looking
  // reset when real, server-side progress still exists for THIS identity —
  // and, critically, rather than resuming a DIFFERENT identity's case
  // (item 6). Keyed on [agentSlug, tenantId, personaSessionToken] so a
  // persona or agent switch on the SAME mounted component re-runs this
  // without requiring a remount; still waits for the persona spine to
  // settle out of 'loading' before resolving a key, so a resume never
  // fires against a not-yet-resolved persona.
  const lastIdentityKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (personaStatus === "loading" || personaStatus === "idle") return;
    const identityKey = storageKey(tenantId, personaSessionToken, agentSlug);
    if (lastIdentityKeyRef.current === identityKey) return;
    lastIdentityKeyRef.current = identityKey;

    // Identity changed (or this is the first resolved identity) — never
    // carry the PRIOR identity's path/case/readiness/error forward, even
    // for the instant before the new read resolves.
    setPath(null);
    setCaseId(undefined);
    setJourneyProfileState("standard");
    setReadiness(null);
    setLastAdvance(null);
    setError(null);

    const stored = readStoredResume(tenantId, personaSessionToken, agentSlug);
    if (!stored) return;
    setLoading(true);
    personaFetch("/api/moneypenny/factor/use-case-zero/readiness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentSlug, path: stored.path, tenantId, caseId: stored.caseId, journeyProfile: stored.journeyProfile }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!json.ok) throw new Error(json.error ?? "resume readiness read failed");
        setPath(stored.path);
        setCaseId(stored.caseId);
        setJourneyProfileState(stored.journeyProfile ?? "standard");
        setReadiness(json.readiness as UseCaseZeroReadiness);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [agentSlug, tenantId, personaSessionToken, personaStatus]);

  // Item 2 (2026-09-07): the operator's explicit journey-profile choice —
  // changing it persists immediately (even before a path/case exists) so a
  // reload never silently reverts it, and re-runs the readiness read when a
  // path is already chosen so the projection reflects the new profile right
  // away rather than waiting for the next unrelated action.
  const setJourneyProfile = useCallback(
    (next: UseCaseZeroJourneyProfile) => {
      setJourneyProfileState(next);
      if (path) {
        writeStoredResume(tenantId, personaSessionToken, agentSlug, { path, caseId, journeyProfile: next });
        setLoading(true);
        setError(null);
        personaFetch("/api/moneypenny/factor/use-case-zero/readiness", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentSlug, path, tenantId, caseId, journeyProfile: next }),
        })
          .then((res) => res.json())
          .then((json) => {
            if (!json.ok) throw new Error(json.error ?? "readiness assessment failed");
            setReadiness(json.readiness as UseCaseZeroReadiness);
          })
          .catch((e) => setError(e instanceof Error ? e.message : String(e)))
          .finally(() => setLoading(false));
      }
    },
    [agentSlug, tenantId, caseId, path, personaSessionToken],
  );

  const choosePath = useCallback(
    async (chosen: UseCaseZeroPath) => {
      setLoading(true);
      setError(null);
      try {
        const res = await personaFetch("/api/moneypenny/factor/use-case-zero/readiness", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentSlug, path: chosen, tenantId, caseId, journeyProfile }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "readiness assessment failed");
        setPath(chosen);
        setReadiness(json.readiness as UseCaseZeroReadiness);
        writeStoredResume(tenantId, personaSessionToken, agentSlug, { path: chosen, caseId, journeyProfile });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [agentSlug, tenantId, caseId, personaSessionToken, journeyProfile],
  );

  const advance = useCallback(
    async (
      launchSpec?: { chain: string; tokenName: string; tokenSymbol: string; description?: string },
      agentGenesis?: { sponsorPassportId: string; displayName: string; description: string; origin?: string },
    ) => {
      if (!path) return;
      setLoading(true);
      setError(null);
      try {
        const res = await personaFetch("/api/moneypenny/factor/use-case-zero/advance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentSlug, path, tenantId, caseId, journeyProfile, launchSpec, agentGenesis }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "advance failed");
        const result = json.result as AdvanceUseCaseZeroResult;
        setLastAdvance(result);
        setReadiness(result.readiness);
        if (result.caseId) {
          setCaseId(result.caseId);
          writeStoredResume(tenantId, personaSessionToken, agentSlug, { path, caseId: result.caseId, journeyProfile });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [agentSlug, path, tenantId, caseId, personaSessionToken, journeyProfile],
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
    setJourneyProfileState("standard");
    writeStoredResume(tenantId, personaSessionToken, agentSlug, null);
  }, [agentSlug, tenantId, personaSessionToken]);

  return { path, readiness, lastAdvance, loading, error, choosePath, advance, reset, caseId, setCaseId, journeyProfile, setJourneyProfile };
}
