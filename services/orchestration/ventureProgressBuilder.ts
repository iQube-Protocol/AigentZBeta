/**
 * Venture Progress builder. Aigent Me Phase 4.
 * Per PRD v0.2 §8 Golden Path 4 (Review Venture Progress) and §9.2
 * (Venture Progress Card render contract).
 *
 * Aigent Me's read-only window into AgentiQ Venture Lab (AVL):
 *   - active venture / project name + stage
 *   - operational + commercial goal counts (BlakQube T1-safe counts only)
 *   - KPI counts (never values)
 *   - recent IntentQube activity (acted-upon NBEs)
 *   - blockers (alpha: empty; Phase 6 wires pending-approval queue)
 *   - linked cartridges
 *   - recommended NBE actions (AVL-tier from the catalogue)
 *
 * Deterministic generation; LLM-enriched prose lands in Phase 4.b alongside
 * the brief enrichment work. Structure is the contract.
 *
 * Privacy:
 *   - ExperienceQube meta slice surfaces directly (T1).
 *   - BlakQube fields surface as **counts only** (PRD §7.2 alpha rule).
 *   - Recent intents surface only their public fields (intentName,
 *     cartridge, status, createdAt). No rationale text on the wire.
 */

import {
  getExperienceQube,
  type ActiveCartridgeSlug,
  type ExperienceStage,
} from '@/services/iqube/experienceQube';
import {
  listRecentIntentsForPersona,
  type IntentStatus,
} from '@/services/iqube/intentQube';
import {
  selectNbeCandidates,
  type NbeCandidate,
} from '@/services/orchestration/nbeCatalog';
import type { BriefNextBestAction } from '@/services/orchestration/briefBuilder';
import { coerceKpisToRichShape, type KpiRecord } from '@/services/strategy/kpiTypes';
import { resolveKpis } from '@/services/strategy/kpiResolver';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

// ─────────────────────────────────────────────────────────────────────────
// Public shape — matches the Venture Progress Card render contract.
// ─────────────────────────────────────────────────────────────────────────

export interface VentureProgressKpiSummary {
  /** How many KPI entries live in the BlakQube. Values stay server-side. */
  activeKpisCount: number;
  /** How many operational goals are tracked. */
  operationalGoalsCount: number;
  /** How many commercial goals are tracked. */
  commercialGoalsCount: number;
  /** True when BlakQube has a populated franchise proposition. */
  hasFranchiseProposition: boolean;
  /** True when BlakQube has confidential strategy notes (T1-safe flag). */
  hasConfidentialNotes: boolean;
}

export interface VentureProgressRecentActivity {
  intentId: string;
  intentName: string;
  cartridge: string;
  status: IntentStatus;
  createdAt: string;
}

export interface VentureProgressShape {
  generatedAt: string;
  ventureName: string | null;
  primaryGoal: string | null;
  currentStage: ExperienceStage;
  experienceConfigured: boolean;
  linkedCartridges: ActiveCartridgeSlug[];

  kpiSummary: VentureProgressKpiSummary;
  /**
   * Phase 2 B.1 — rich KPI records (id / name / target / current /
   * unit / trend / source / lastUpdatedAt). Resolved per-source by
   * `services/strategy/kpiResolver.ts`. Empty when no KPIs declared.
   */
  activeKpis: import('@/services/strategy/kpiTypes').KpiRecord[];

  /** Operational goal labels — count only, no values (BlakQube). */
  operationalGoalsCount: number;
  /** Commercial goal labels — count only, no values (BlakQube). */
  commercialGoalsCount: number;

  /** Most recent IntentQubes acted upon by this persona. */
  recentActivity: VentureProgressRecentActivity[];

  /** Pending blockers count. Alpha: 0; Phase 6 populates from approvals. */
  blockersCount: number;

  /** Recommended next NBEs (AVL-tier from the catalogue, then top mixed). */
  recommendedActions: BriefNextBestAction[];

  /** Suggested artifact types the user could create now. */
  suggestedArtifacts: Array<NonNullable<NbeCandidate['suggestedArtifact']>>;

  /** iQube usage disclosure. */
  using: ('PersonaQube' | 'ExperienceQube' | 'IntentQube')[];
  /** Categories explicitly not shared. */
  notShared: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers.
// ─────────────────────────────────────────────────────────────────────────

function toAction(c: NbeCandidate): BriefNextBestAction {
  return {
    id: c.id,
    label: c.label,
    rationale: c.rationale,
    cartridge: c.cartridge,
    effort: c.effort,
    impact: c.impact,
    approvalRequired: c.approvalRequired,
    specialist: c.specialist ?? null,
    suggestedArtifact: c.suggestedArtifact ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Build.
// ─────────────────────────────────────────────────────────────────────────

export interface BuildVentureProgressInput {
  personaId: string;
  /** Restrict recent activity to one cartridge. Default: all. */
  cartridge?: ActiveCartridgeSlug;
  /** How many recent intents to surface. Default 5; capped at 20. */
  recentLimit?: number;
}

export async function buildVentureProgress(
  input: BuildVentureProgressInput,
): Promise<VentureProgressShape> {
  const qube = await getExperienceQube(input.personaId);

  const linkedCartridges = qube?.meta.activeCartridges ?? ['metame', 'avl'];
  const currentStage: ExperienceStage = qube?.meta.currentStage ?? 'setup';
  const ventureName = qube?.meta.experienceName ?? null;
  const primaryGoal = qube?.meta.primaryGoal ?? null;
  const experienceConfigured = !!qube;

  // BlakQube counts — values never serialised.
  const blak = qube?.blak ?? {};
  const operationalGoalsCount = Array.isArray(blak.operationalGoals)
    ? (blak.operationalGoals as unknown[]).length
    : blak.operationalGoals && typeof blak.operationalGoals === 'object'
      ? Object.keys(blak.operationalGoals).length
      : 0;
  const commercialGoalsCount = Array.isArray(blak.commercialGoals)
    ? (blak.commercialGoals as unknown[]).length
    : blak.commercialGoals && typeof blak.commercialGoals === 'object'
      ? Object.keys(blak.commercialGoals).length
      : 0;
  const activeKpisCount = blak.activeKpis && typeof blak.activeKpis === 'object'
    ? Object.keys(blak.activeKpis).length
    : 0;

  // Phase 2 B.1 — resolve activation-bound KPI values.
  // 1) Coerce legacy `{name: target}` rows into the rich shape.
  // 2) Resolver checks each activation-bound KPI against the persona's
  //    active Activations + runs the metric query.
  // 3) Manual KPIs pass through. Failed lookups mark `unresolvedReason`.
  let resolvedKpis: KpiRecord[] = [];
  try {
    const raw = (blak.activeKpis ?? {}) as Record<string, unknown>;
    const rich = coerceKpisToRichShape(raw);
    const supabase = getSupabaseServer();
    if (supabase && Object.keys(rich).length > 0) {
      const resolved = await resolveKpis(supabase, {
        personaId: input.personaId,
        kpis: rich,
      });
      resolvedKpis = Object.values(resolved);
    } else {
      resolvedKpis = Object.values(rich);
    }
  } catch {
    // Never block the cockpit on a KPI resolver failure.
    resolvedKpis = [];
  }

  const kpiSummary: VentureProgressKpiSummary = {
    activeKpisCount,
    operationalGoalsCount,
    commercialGoalsCount,
    hasFranchiseProposition:
      !!blak.franchiseProposition && Object.keys(blak.franchiseProposition).length > 0,
    hasConfidentialNotes:
      typeof blak.confidentialStrategyNotes === 'string' &&
      blak.confidentialStrategyNotes.trim().length > 0,
  };

  // Recent activity — pulled from the IntentQube service.
  const recentLimit = Math.min(Math.max(input.recentLimit ?? 5, 1), 20);
  const intents = await listRecentIntentsForPersona(input.personaId, {
    limit: recentLimit,
    cartridge: input.cartridge,
  });
  const recentActivity: VentureProgressRecentActivity[] = intents.map((i) => ({
    intentId: i.id,
    intentName: i.intentName,
    cartridge: i.activeCartridge,
    status: i.status,
    createdAt: i.createdAt,
  }));

  // Recommended actions:
  //   1. AVL-tier candidates first (regardless of active cartridges, the user
  //      is reviewing AVL).
  //   2. Then the top 2 across the user's active cartridges to keep cross-
  //      cartridge motion visible.
  const avlActions = selectNbeCandidates({
    activeCartridges: ['avl'],
    currentStage,
    scopedCartridge: 'avl',
    limit: 3,
  });
  const mixedActions = selectNbeCandidates({
    activeCartridges: linkedCartridges,
    currentStage,
    limit: 5,
  }).filter((c) => c.cartridge !== 'avl').slice(0, 2);

  const recommendedActions = [...avlActions, ...mixedActions].map(toAction);

  const suggestedArtifacts = Array.from(
    new Set(
      [...avlActions, ...mixedActions]
        .map((c) => c.suggestedArtifact)
        .filter((v): v is NonNullable<NbeCandidate['suggestedArtifact']> => !!v),
    ),
  );

  return {
    generatedAt: new Date().toISOString(),
    ventureName,
    primaryGoal,
    currentStage,
    experienceConfigured,
    linkedCartridges,
    kpiSummary,
    activeKpis: resolvedKpis,
    operationalGoalsCount,
    commercialGoalsCount,
    recentActivity,
    blockersCount: 0, // Phase 6 wires this from the approval queue.
    recommendedActions,
    suggestedArtifacts,
    using: experienceConfigured
      ? ['PersonaQube', 'ExperienceQube', 'IntentQube']
      : ['PersonaQube', 'IntentQube'],
    notShared: [
      'confidential strategy notes',
      'private investor data',
      'unreleased IP',
    ],
  };
}
