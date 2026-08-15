/**
 * envelopeViews — client-safe pure partitioning over envelope/consequence
 * data. Split out from `invariantEnvelope.ts` / `implementationContext.ts` on
 * 2026-08-15 after a production build failure: those two files each import
 * server-only modules (`resolutionRecords.ts` uses `node:fs`/`node:path`;
 * `resolution.ts` resolves through the Supabase server client) for their I/O
 * halves (`buildInvariantEnvelope`, `composeImplementationContext`'s budget
 * default). A client component that needs only the PURE partitioning logic —
 * `DevCommandCenterTab.tsx` rendering session state already in memory — has
 * no way to import just that half from either file: a static import pulls in
 * the whole module graph, and webpack tried to bundle `node:path` for the
 * browser and failed (4 consecutive Amplify deploy failures, 2026-08-15).
 *
 * This file holds ONLY the two partitioning functions a client surface needs,
 * with imports limited to type-only modules (`types/invariantEnvelope.ts`,
 * `types/devCommandCenter.ts`) that carry no I/O of their own. `invariantEnvelope.ts`
 * and `implementationContext.ts` both import from HERE and re-export, so
 * every existing consumer of either module keeps working unchanged — this is
 * a relocation, not a duplication (inv.engineering.036/037).
 */

import { mayBeCitedAsEstablished, type EnvelopeInvariant } from '@/types/invariantEnvelope';
import type { ConsequenceEntry } from '@/types/devCommandCenter';

// ---------------------------------------------------------------------------
// Epistemic partition — the shape prompt composition must preserve
// ---------------------------------------------------------------------------

export interface EpistemicPartition {
  /** Citable as established: constitutional + ratified/canonical members. */
  established: EnvelopeInvariant[];
  /** Real, relevant, and NOT established — candidates and proposals. */
  signals: EnvelopeInvariant[];
  /** Discovered this run, in no registry. */
  discoveries: EnvelopeInvariant[];
}

/**
 * Split an envelope into its epistemic populations.
 *
 * Operator requirement, 2026-08-15: "established invariants, candidate
 * signals, live discoveries, and constitutional constraints must remain
 * structurally distinct" all the way through prompt composition. A single
 * ranked list with markers keeps them DISTINGUISHABLE; this partition keeps
 * them SEPARATE, so a composer cannot merge them by accident even while
 * respecting the markers.
 *
 * Constitutional members land in `established` — they are established by
 * ratification, which is what the constitutional pass returns — while
 * remaining identifiable by `provenance` for a composer that wants to render
 * them under their own heading.
 */
export function partitionByEpistemicStanding(items: readonly EnvelopeInvariant[]): EpistemicPartition {
  const established: EnvelopeInvariant[] = [];
  const signals: EnvelopeInvariant[] = [];
  const discoveries: EnvelopeInvariant[] = [];
  for (const item of items) {
    if (item.provenance === 'live-discovery') discoveries.push(item);
    else if (mayBeCitedAsEstablished(item.lifecycle)) established.push(item);
    else signals.push(item);
  }
  return { established, signals, discoveries };
}

// ---------------------------------------------------------------------------
// Causal-claim partition — which consequences carry a falsification binding
// ---------------------------------------------------------------------------

/**
 * The consequences that carry a causal claim, and those that do not.
 *
 * Reported rather than enforced: whether a given consequence SHOULD carry one
 * is a judgement about the intent, not a property a function can compute.
 */
export function partitionByCausalClaim(entries: readonly ConsequenceEntry[]): {
  testable: ConsequenceEntry[];
  ordinary: ConsequenceEntry[];
} {
  const testable: ConsequenceEntry[] = [];
  const ordinary: ConsequenceEntry[] = [];
  for (const e of entries) (e.falsification ? testable : ordinary).push(e);
  return { testable, ordinary };
}
