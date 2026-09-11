"use client";

/**
 * useResearchWorkspaceAccess — client hook for the CANONICAL research
 * workspace entitlement projection (2026-09-08, IRL OS Workspace
 * consolidation).
 *
 * `GET /api/participation/my-experiments` → `getParticipantResearchWorkspaceAccess`
 * (`services/passport/participationAccess.ts`) was built 2026-09-02 as "the
 * canonical answer to 'which research workspaces may THIS caller see'" but was
 * never actually wired into `PartnerProgrammesTab`'s "My Experiments" nav —
 * that nav instead composed `useParticipationAccess` + `scopesGrantedIn`
 * (`services/passport/participationTabGate.ts`), a client-side path that:
 *   (a) never resolves a grant scoped by raw `experimentId` (only by
 *       `workspaceId`) — the canonical resolver's own
 *       `canViewResearchWorkspace` DOES check `ws.experimentId`;
 *   (b) treats an empty `allowedScopes` as deny-by-default, the OPPOSITE of
 *       the canonical resolver's (and every research-lab reviewer grant's)
 *       "empty = unrestricted" convention.
 * Two divergent entitlement paths for the same question is exactly the
 * `inv.engineering.036`/`037` defect class — this hook is the fix: ONE
 * transport, the canonical server projection, for the research Lab's
 * workspace listing specifically. (The Venture Lab's `scopesGrantedIn` path
 * is untouched — SPEC-IRL-WORKSPACE-001 acceptance criterion 3, "existing
 * Venture Lab workspaces remain unchanged".)
 *
 * Fail-CLOSED, same discipline as `useParticipationAccess`: `loaded` is
 * explicit so a caller can tell "not answered yet" from "answered: nothing".
 */

import { useEffect, useState } from "react";
import { personaFetch } from "@/utils/personaSpine";

export interface ResearchWorkspaceAccessEntry {
  workspaceId: string;
  accessBasis: "public" | "membership" | "admin";
}

export interface ResearchWorkspaceAccessState {
  loaded: boolean;
  entries: ResearchWorkspaceAccessEntry[];
}

export const EMPTY_RESEARCH_WORKSPACE_ACCESS: ResearchWorkspaceAccessState = {
  loaded: false,
  entries: [],
};

export function useResearchWorkspaceAccess(personaIdHint?: string | null): ResearchWorkspaceAccessState {
  const [state, setState] = useState<ResearchWorkspaceAccessState>(EMPTY_RESEARCH_WORKSPACE_ACCESS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await personaFetch("/api/participation/my-experiments", {
          cache: "no-store",
          ...(personaIdHint ? { personaIdHint } : {}),
        });
        if (!res.ok) {
          if (!cancelled) setState({ loaded: true, entries: [] });
          return;
        }
        const payload = (await res.json()) as {
          experiments?: Array<{ id?: string; accessBasis?: string }>;
        };
        const entries = Array.isArray(payload.experiments)
          ? payload.experiments
              .filter(
                (e): e is { id: string; accessBasis: "public" | "membership" | "admin" } =>
                  typeof e?.id === "string" &&
                  (e?.accessBasis === "public" || e?.accessBasis === "membership" || e?.accessBasis === "admin"),
              )
              .map((e) => ({ workspaceId: e.id, accessBasis: e.accessBasis }))
          : [];
        if (!cancelled) setState({ loaded: true, entries });
      } catch {
        if (!cancelled) setState({ loaded: true, entries: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [personaIdHint]);

  return state;
}
