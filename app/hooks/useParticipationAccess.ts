"use client";

/**
 * useParticipationAccess — client hook for the caller's own participation
 * grants, the signal behind the Tier 2 tab gate (Horizen Phase 3, audit §B.3).
 *
 * Mirrors `useCartridgeAdminGrants` deliberately: same spine transport, same
 * fail-CLOSED loading posture, same "loaded" flag so a surface can tell "not
 * answered yet" from "answered: nothing". A participation-gated tab stays
 * hidden during the loading window rather than flashing in and out.
 *
 * Transport: `personaFetch` only. `/api/participation/my-access` resolves the
 * caller through `getActivePersona` — it is a spine endpoint, so neither raw
 * `fetch` nor `authedFetchHeaders` is acceptable (CLAUDE.md). Where the surface
 * knows the active persona, pass it as `personaIdHint` so every read on that
 * surface resolves the SAME persona.
 *
 * Privacy: the response carries the caller's own domains and roles only — no
 * persona identifier of any tier.
 */

import { useEffect, useState } from "react";
import { personaFetch } from "@/utils/personaSpine";
import {
  EMPTY_PARTICIPATION_ACCESS,
  type ParticipationAccessState,
  type ParticipationGrantSignal,
} from "@/services/passport/participationTabGate";

export function useParticipationAccess(personaIdHint?: string | null): ParticipationAccessState {
  const [state, setState] = useState<ParticipationAccessState>(EMPTY_PARTICIPATION_ACCESS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await personaFetch("/api/participation/my-access", {
          cache: "no-store",
          ...(personaIdHint ? { personaIdHint } : {}),
        });
        if (!res.ok) {
          // Answered, with nothing. Distinct from "still asking".
          if (!cancelled) setState({ loaded: true, grants: [] });
          return;
        }
        const payload = (await res.json()) as { grants?: ParticipationGrantSignal[] };
        if (cancelled) return;
        const grants = Array.isArray(payload.grants)
          ? payload.grants.filter(
              (g): g is ParticipationGrantSignal =>
                typeof g?.accessDomain === "string" && typeof g?.role === "string",
            )
          : [];
        setState({ loaded: true, grants });
      } catch {
        if (!cancelled) setState({ loaded: true, grants: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [personaIdHint]);

  return state;
}
