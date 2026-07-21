/**
 * Render instrumentation — CFS-017 v1, OBSERVE MODE (ratified 2026-07-06).
 *
 * The a2ui surface-plan path's constitutional seam: grounding + ontology
 * drift detection + receipts + Reach citation on every plan build. Observe
 * mode's contract: a render is NEVER blocked — every failure path degrades
 * to "uninstrumented", and gating (fail-closed per CFS-014 §7) is a separate
 * v2 ratification backed by the observation data this module produces.
 *
 * Honest limits, per the CFS-017 v1.0 implementation amendments:
 *  - The coherence engine is brief-shaped (no plan-generic validator yet), so
 *    the semantic-integrity signal here is the ontology drift check; the
 *    CoherenceResult slot ships `evaluated: false` with the reason.
 *  - The plan route resolves no persona (mechanical by design), so receipts
 *    emit only when the spine can resolve the caller; unauthenticated calls
 *    are instrumented but unreceipted (`receipted: false` says so).
 *  - This seam governs the a2ui path only — the liquid path is a client-side
 *    registry lookup with no server chokepoint (CFS-017 v1.1 design item).
 *
 * Server-only.
 */

import type { NextRequest } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  resolveOntology,
  citeResolvedConcepts,
} from '@/services/constitutional/ontologyResolver';
import { citeInvariants } from '@/services/invariants/grounding';
import { groundReasoning } from '@/services/invariants/engine';
import { getInvariantsBySeedIds } from '@/services/invariants/store';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import type { ResolvedTerm } from '@/types/constitutional';

export interface PlanConstitutionalBlock {
  mode: 'observe';
  /** Grounding refs (seed ids) — populates the CFS-007 contract's
   * long-empty invariantSeedIds semantics for the a2ui path. */
  invariantSeedIds: string[];
  resolvedTerms: ResolvedTerm[];
  /** Non-canonical drift terms detected in the plan's text — surfaced, never dropped. */
  unresolved: string[];
  canonVersion: string;
  coherence: {
    evaluated: false;
    reason: string;
  };
  /** False when no persona resolved (unauthenticated plan call) or the
   * receipt write failed — stated, never implied. */
  receipted: boolean;
}

export async function instrumentPlanRender(input: {
  request: NextRequest;
  intent: unknown;
  cartridge: unknown;
  modules: Array<Record<string, unknown>>;
}): Promise<PlanConstitutionalBlock | null> {
  try {
    const planText = [
      typeof input.intent === 'string' ? input.intent : JSON.stringify(input.intent ?? ''),
      typeof input.cartridge === 'string' ? input.cartridge : '',
      ...input.modules.flatMap((m) => [
        typeof m.module_type === 'string' ? m.module_type : '',
        typeof m.label === 'string' ? m.label : '',
        typeof m.title === 'string' ? m.title : '',
      ]),
    ]
      .filter((t) => t.trim().length > 0)
      .join('\n');

    const domain = typeof input.cartridge === 'string' ? input.cartridge : undefined;
    const [resolution, slice] = await Promise.all([
      resolveOntology(planText).catch(() => null),
      // CFS-035 Phase 1 — through the Reasoning-face seam (returns a snapshot).
      groundReasoning(domain ? { domains: [domain], limit: 6 } : { limit: 6 }).then((s) => s.slice).catch(() => null),
    ]);
    if (!resolution && !slice) return null;

    const seedIds = Array.from(
      new Set([
        ...(slice?.items.map((i) => i.seedId).filter((s): s is string => Boolean(s)) ?? []),
        ...(resolution?.resolvedTerms.flatMap((t) => t.invariantIds) ?? []),
      ]),
    );

    // Reach (Law XII) — a plan that consumes invariants is adoption.
    if (slice && slice.citedIds.length > 0) void citeInvariants(slice.citedIds).catch(() => {});
    if (resolution) void citeResolvedConcepts(resolution).catch(() => {});

    // Receipt — only when the spine resolves the caller (the plan route
    // itself is mechanical and unauthenticated by design).
    let receipted = false;
    const persona = await getActivePersona(input.request).catch(() => null);
    if (persona) {
      const conceptRows = resolution
        ? await getInvariantsBySeedIds(
            Array.from(new Set(resolution.resolvedTerms.flatMap((t) => t.invariantIds))),
          ).catch(() => [])
        : [];
      const invariantsUsed = Array.from(
        new Set([...(slice?.citedIds ?? []), ...conceptRows.map((r) => r.id)]),
      );
      const receipt = await createActivityReceipt({
        personaId: persona.personaId,
        actionType: 'experience_render_validated',
        summary: `a2ui surface plan instrumented (observe, CFS-017) — modules=${input.modules.length} drift=${resolution?.unresolved.length ?? 0} seeds=${seedIds.length}`,
        activeCartridge: 'agentiq',
        ...(invariantsUsed.length > 0 ? { invariantsUsed } : {}),
      }).catch(() => null);
      receipted = Boolean(receipt);
    }

    return {
      mode: 'observe',
      invariantSeedIds: seedIds,
      resolvedTerms: resolution?.resolvedTerms ?? [],
      unresolved: resolution?.unresolved ?? [],
      canonVersion: resolution?.canonVersion ?? 'unknown',
      coherence: {
        evaluated: false,
        reason:
          'no plan-shaped coherence validator yet — the engine is brief-shaped (CFS-017 v1.1 gap); semantic integrity in v1 is the ontology drift check above',
      },
      receipted,
    };
  } catch (err) {
    console.warn(
      '[renderInstrumentation] failed (non-fatal, observe mode):',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
