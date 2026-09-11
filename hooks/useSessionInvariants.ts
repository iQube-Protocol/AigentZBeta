"use client";

import { useCallback, useRef } from "react";

/** A T2-safe citable invariant — seed id + statement only. */
export interface SessionInvariant {
  seedId: string;
  statement: string;
}

/**
 * Client-side ceiling for carried session invariants.
 *
 * Must equal `INVARIANT_BUDGET.withSessionMemory` in
 * `services/invariants/resolution.ts`. It is duplicated rather than imported
 * because that module is server-only (it reaches the invariant store); the
 * duplication is held honest by a parity canary in
 * `tests/copilot-invariant-grounding.test.ts` rather than by convention.
 */
export const SESSION_INVARIANT_CAP = 12;

export interface SessionInvariantsApi {
  /**
   * Fold a turn's `resolved_invariants` echo into the session's carried
   * memory. Newest resolution leads; prior memory tops up to the cap.
   */
  ingest: (incoming: unknown) => void;
  /**
   * Attach constitutional memory to an outbound ground context.
   *
   * Applies to EVERY surface that sends a ground context. The predecessor of
   * this hook gated the attachment on `groundContext.surface === "smart-triad"`,
   * so constitutional memory travelled for exactly one mount while every other
   * copilot restarted from zero each turn. Surface identity selects a
   * cartridge overlay; it was never a statement about whether the operator has
   * a session worth remembering.
   */
  decorate: <T extends Record<string, unknown> | null | undefined>(
    groundContext: T,
  ) => T | (Record<string, unknown> & { sessionMarker: string });
}

/**
 * Constitutional memory v0 (SmartTriad Phase 3 + CFS-045-A2) for a copilot
 * mount: the invariants the IRE resolved on earlier turns, accumulated from
 * `resolved_invariants` echoes and sent back as
 * `groundContext.sessionInvariants` so guidance stays constitutionally
 * consistent across a session.
 *
 * Deliberately a HOOK, not a provider: `sessionMarker` identifies one mount's
 * reasoning session for trajectory capture, so hoisting this state above the
 * mount would silently merge distinct sessions into one.
 */
export function useSessionInvariants(): SessionInvariantsApi {
  const invariantsRef = useRef<SessionInvariant[]>([]);

  // Opaque random token grouping this mount's turns into one reasoning
  // session. NEVER derived from any identifier.
  const markerRef = useRef<string>("");
  if (!markerRef.current) {
    markerRef.current = Math.random().toString(36).slice(2, 12);
  }

  const ingest = useCallback((incoming: unknown) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    const merged: SessionInvariant[] = [];
    const seen = new Set<string>();
    for (const inv of [...(incoming as Array<Record<string, unknown>>), ...invariantsRef.current]) {
      const seedId = String(inv?.seedId ?? "");
      const statement = String(inv?.statement ?? "");
      if (!seedId || !statement || seen.has(seedId) || merged.length >= SESSION_INVARIANT_CAP) {
        continue;
      }
      seen.add(seedId);
      merged.push({ seedId, statement });
    }
    invariantsRef.current = merged;
  }, []);

  const decorate = useCallback(
    <T extends Record<string, unknown> | null | undefined>(groundContext: T) => {
      if (!groundContext) return groundContext;
      return {
        ...groundContext,
        sessionMarker: markerRef.current,
        ...(invariantsRef.current.length > 0
          ? { sessionInvariants: invariantsRef.current }
          : {}),
      };
    },
    [],
  );

  return { ingest, decorate };
}
