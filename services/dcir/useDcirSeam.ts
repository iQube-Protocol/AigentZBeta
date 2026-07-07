/**
 * DCIR D4 — the universal substrate hook (CFS-020 §5, §6, D4).
 *
 * One config-driven client hook that any surface adopts to gain the DCIR
 * observation seam BY DECLARATION, replacing the hand-wired state + callback +
 * three-field ground-context block that D1–D3 copied identically onto every
 * instrumented surface (Dev Command Center, aigentMe welcome, studio composer).
 * Adopting via this hook is the Extend-Don't-Duplicate discipline applied to
 * interaction: after D4, hand-wiring a fresh `[dcirEvents, setDcirEvents]` +
 * `observe` + `{ recentEvents, stateSnapshot, observedPatterns }` on a NEW
 * surface is an Extend-Don't-Duplicate violation — call `useDcirSeam` instead.
 *
 * SERVER CONTRACT — DO NOT RENAME (breaking change across every surface):
 * `groundObservation` exposes exactly three fields — `recentEvents`,
 * `stateSnapshot`, `observedPatterns`. The chat route's shared
 * `pushDcirObservationLines` (app/api/codex/chat/route.ts) reads exactly these
 * keys off each surface's `copilotGroundContext` (`gc.recentEvents`,
 * `gc.stateSnapshot`, `gc.observedPatterns`). Renaming any one silently drops
 * that surface's observations from the copilot's ground truth. Surfaces spread
 * `...groundObservation` into their existing ground-context memo, preserving
 * their own other fields.
 *
 * OBSERVE-MODE-ONLY (CFS-020 §9, the CFS-017 precedent): this hook owns the
 * event buffer, the `observe` appender, and the compacted ground observation —
 * nothing else. NO affordances, NO auto-act, NO persistence, NO cross-session
 * memory live here. Those are CONSUMERS of `events` (e.g. the Dev Command
 * Center's `generateAffordances` + auto-act loop, aigentMe's intelligent-
 * suggestion gate) and stay on their surfaces reading the same `events` array.
 * The hook never blocks a render, gates an affordance, or mutates the surface
 * it watches.
 *
 * Tier discipline: `events` are DcirEvents (T0 inexpressible by the contract,
 * types/dcir.ts); `groundObservation` carries only compacted labels, counts,
 * and event ids. No personaId/authProfileId/rootDid can enter this seam — the
 * snapshot's `persona` field is never populated on this path (buildStateSnapshot
 * takes no persona input here).
 *
 * Composition-only: this hook composes the EXISTING D1/D2 organs
 * (appendDcirEvent, compactDcirEvents, buildStateSnapshot,
 * mineBehaviouralInvariants, compactBehaviouralInvariants) — it never forks
 * their logic. React-bound (client-only) by design: it holds the in-session
 * ring buffer as React state, exactly as the hand-wired versions did.
 */

'use client';

import { useCallback, useMemo, useState } from 'react';

import type { ConstitutionalStateSnapshot, DcirEvent } from '@/types/dcir';
import { appendDcirEvent, compactDcirEvents } from '@/services/dcir/eventStream';
import {
  buildStateSnapshot,
  compactBehaviouralInvariants,
  mineBehaviouralInvariants,
} from '@/services/dcir/stateEngine';

/**
 * A surface's declaration of its observation context. `surface` is the stable
 * surface id (e.g. 'dev-command-center'); `workflowStage` and `activeCapsule`
 * are the surface's own authoritative workflow position (React state) — the
 * engine records them, it does not re-derive them.
 */
export interface DcirSeamConfig {
  surface: string;
  workflowStage?: string | null;
  activeCapsule?: string | null;
}

/**
 * The three-field ground observation — the SERVER CONTRACT (see module header).
 * Field names are load-bearing; `pushDcirObservationLines` reads them by name.
 */
export interface DcirGroundObservation {
  recentEvents: string[];
  stateSnapshot: ConstitutionalStateSnapshot;
  observedPatterns: string[];
}

export interface DcirSeam {
  /** The in-session ring buffer of observations — the array every consumer reads. */
  events: DcirEvent[];
  /** Append an observation; only appends, never blocks or mutates the surface. */
  observe: (event: DcirEvent) => void;
  /** The three-field ground observation to spread into copilotGroundContext. */
  groundObservation: DcirGroundObservation;
}

/**
 * The universal DCIR observation seam. Holds the session ring buffer, exposes
 * `observe` (drop-in for the hand-wired appender), and memoizes the compacted
 * three-field ground observation on `[events, surface, workflowStage,
 * activeCapsule]` — the exact memoization the hand-wired versions used.
 */
export function useDcirSeam(config: DcirSeamConfig): DcirSeam {
  const { surface, workflowStage = null, activeCapsule = null } = config;

  const [events, setEvents] = useState<DcirEvent[]>([]);
  const observe = useCallback((event: DcirEvent) => {
    setEvents((prev) => appendDcirEvent(prev, event));
  }, []);

  const groundObservation = useMemo<DcirGroundObservation>(
    () => ({
      recentEvents: compactDcirEvents(events),
      stateSnapshot: buildStateSnapshot(events, { surface, workflowStage, activeCapsule }),
      observedPatterns: compactBehaviouralInvariants(mineBehaviouralInvariants(events)),
    }),
    [events, surface, workflowStage, activeCapsule],
  );

  return { events, observe, groundObservation };
}
