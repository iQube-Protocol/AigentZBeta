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
import { getActiveActivationIds } from '@/services/activations/spineActivations';
import {
  actionsForActiveActivations,
  type ActivationAction,
} from '@/data/activation-catalog';

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

/**
 * Map a catalog action (declared on an activation entry the persona
 * has switched on) into the same `BriefNextBestAction` shape the
 * cockpit's Recommended row + the DecisionBoardLayout already render.
 *
 * Catalog-driven NBAs replace `selectNbeCandidates` as the primary
 * source for venture-progress recommendations. The static NBE catalog
 * stays as a fallback when the persona has no active activations
 * exposing actions yet — keeps the cockpit non-empty during ramp-up.
 *
 * Effort + impact default to 'standard' / 'medium' for activity-class
 * actions; outcome-class actions surface as 'high' impact so the
 * Recommended row visually prioritises value-bearing moves. Class
 * inference is best-effort from naming (the catalog doesn't carry
 * a per-action class yet — easy follow-on).
 */
function catalogActionToBrief(input: {
  activationId: string;
  cartridge: ActiveCartridgeSlug | 'metame';
  action: ActivationAction;
}): BriefNextBestAction {
  const cartridge = (input.cartridge === 'metame' ? 'metame' : input.cartridge) as ActiveCartridgeSlug;
  const impact: NbeCandidate['impact'] = input.action.approvalRequired ? 'high' : 'medium';
  return {
    id: `activation:${input.activationId}:${input.action.action}`,
    label: input.action.label,
    rationale: input.action.rationale,
    cartridge,
    effort: 'standard',
    impact,
    approvalRequired: !!input.action.approvalRequired,
    specialist: input.action.specialist ?? null,
    suggestedArtifact: null,
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

  // Recommended actions — Phase 2 B.2 (1/2):
  //
  // PRIMARY source = catalog actions exposed by the persona's active
  // activations. This is the activation-driven NBA pipeline that
  // mirrors B.1's KPI flow — what the persona has switched on is the
  // single source of truth for what they should be doing next.
  //
  // FALLBACK = the original static `selectNbeCandidates` output. Kept
  // alive so the cockpit stays non-empty during ramp-up when an
  // operator's active activations haven't yet declared actions, and
  // so AVL-stage moves still surface during alpha-activation.
  //
  // Order: catalog actions first (operator-chosen surface area), AVL
  // candidates next (operator's current review context), mixed
  // candidates last (cross-cartridge motion). Capped at 8 total to
  // keep the Recommended row scannable.
  const activeActivationIds = await getActiveActivationIds(input.personaId).catch(
    () => new Set<string>(),
  );
  const catalogActions = actionsForActiveActivations(activeActivationIds).map((row) =>
    catalogActionToBrief({
      activationId: row.activationId,
      cartridge: row.cartridge,
      action: row.action,
    }),
  );

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

  // Dedupe by id so a fallback NbeCandidate doesn't duplicate a
  // catalog action with the same key. Catalog wins on conflict.
  const seen = new Set(catalogActions.map((a) => a.id));
  const fallback = [...avlActions, ...mixedActions]
    .map(toAction)
    .filter((a) => !seen.has(a.id));
  const recommendedActions = [...catalogActions, ...fallback].slice(0, 8);

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
