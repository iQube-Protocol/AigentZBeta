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
 * event buffer, the `observe` appender, the compacted ground observation, and
 * (D3) the SUGGEST-ONLY affordance derivation — nothing else. NO auto-act, NO
 * persistence, NO cross-session memory live here. The `affordances` this hook
 * returns are pure recommendation candidates (services/dcir/affordances.ts):
 * every one is capsule-scoped (Containment) and the hook NEVER renders, gates,
 * or executes any of them — activation (a chip click, or the opt-in bounded
 * auto-act boundaried to the navigation class by `resolveAutoActable`) stays a
 * CONSUMER concern on each surface, exactly as `events` consumers do (the Dev
 * Command Center's auto-act loop, aigentMe's intelligent-suggestion gate). The
 * hook never blocks a render, gates an affordance, or mutates the surface it
 * watches.
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
import { generateAffordances, type Affordance } from '@/services/dcir/affordances';

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
  /**
   * D3 — the SUGGEST-ONLY affordances derived from the observed events + the D2
   * snapshot (services/dcir/affordances.ts `generateAffordances`). Available by
   * declaration on every DCIR surface. Each is capsule-scoped and LIVE
   * (relevance > 0); completed/irrelevant actions are not emitted. The hook does
   * NOT render, gate, or execute them — a surface renders them capsule-contained
   * and owns activation (chip click, or the opt-in navigation-only auto-act).
   */
  affordances: Affordance[];
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

  // D3 — suggest-only affordances derived from the SAME events + D2 snapshot.
  // Pure and deterministic; the hook exposes candidates only (no render, no
  // gate, no execution). Memoized on the snapshot the ground observation already
  // built, so a surface migrating off its own generateAffordances() call gets a
  // byte-identical array.
  const affordances = useMemo<Affordance[]>(
    () => generateAffordances(events, groundObservation.stateSnapshot),
    [events, groundObservation.stateSnapshot],
  );

  return { events, observe, groundObservation, affordances };
}
