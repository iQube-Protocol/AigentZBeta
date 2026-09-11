/**
 * financialServicesEntryPresentation — the ONE shared rule for how the
 * KNYTS/CI Bridge CHOOSE surfaces present the Financial Services entry card
 * (2026-09-01 Bridge refinement). Replaces the old "Apply to join the
 * Constitutional Financial Services Pilot" / "Join Financial Services"
 * application-framing with one adaptive presentation, derived from
 * authoritative Journey state — never a local heuristic duplicated across
 * KnytsBridgeChooseSurface and ConstitutionalInternetBridgeChooseSurface.
 *
 * "The destination remains stable; the invitation adapts." The underlying
 * mechanics are UNCHANGED by this module: both presentations activate the
 * SAME `financial-services` branch at the SAME `fs-discover` entry stage via
 * the SAME `activateJourneyBranch` call every existing caller already uses.
 * This module decides nothing about authority, evidence, or completion — it
 * is pure presentation over evidence resolveJourneyState already computed.
 *
 * Conservative rule (deliberately binary this pass, per the governing
 * ruling): a person reads as having "already meaningfully engaged" only if
 * one of the three stages that carry REAL, evidence-backed completion today
 * (fs-discover/fs-learn/fs-explore — see experienceObservationPromotion.ts)
 * is COMPLETE. fs-prepare/fs-cross are excluded on purpose: they are still
 * gate-less (no completionEvidence), so their runtime `state` carries no
 * real signal to read here. Passport, Standing, persona existence, or a
 * mere page visit NEVER qualify — this reuses only the evidence machinery
 * the FS branch itself already produces, no new receipt type, no new gate.
 *
 * CLIENT-BUNDLE SAFE BY DESIGN: pure function over `JourneyRuntimeState`
 * (types/journey.ts, plain types only) — no Supabase/server import, safe
 * for both 'use client' Choose surfaces to import directly.
 */

import type { JourneyRuntimeState } from '@/types/journey';

/** The three FS stages that carry real completion evidence today. */
const QUALIFYING_FS_STAGE_IDS = ['fs-discover', 'fs-learn', 'fs-explore'] as const;

export type FinancialServicesEntryIntent = 'LEARN_FINANCIAL_SERVICES' | 'JOIN_FINANCIAL_SERVICES';

export interface FinancialServicesEntryPresentation {
  label: string;
  intent: FinancialServicesEntryIntent;
}

const FIRST_TIME_PRESENTATION: FinancialServicesEntryPresentation = {
  label: 'Learn about Constitutional Financial Services',
  intent: 'LEARN_FINANCIAL_SERVICES',
};

const RETURNING_PRESENTATION: FinancialServicesEntryPresentation = {
  label: 'Constitutional Financial Services',
  intent: 'JOIN_FINANCIAL_SERVICES',
};

/**
 * Resolves which presentation to show. `runtimeState` may be undefined
 * (state not yet loaded, or a signed-out visitor with no resolvable state)
 * — that is honestly "no qualifying evidence yet," never an error, and
 * resolves to the first-time presentation exactly like a real first-time
 * visitor would see.
 */
export function resolveFinancialServicesEntryPresentation(
  runtimeState: JourneyRuntimeState | null | undefined,
): FinancialServicesEntryPresentation {
  const hasQualifyingEvidence = QUALIFYING_FS_STAGE_IDS.some(
    (stageId) => runtimeState?.stages.find((s) => s.stageId === stageId)?.state === 'COMPLETE',
  );
  return hasQualifyingEvidence ? RETURNING_PRESENTATION : FIRST_TIME_PRESENTATION;
}
