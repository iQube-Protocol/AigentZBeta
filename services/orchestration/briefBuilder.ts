/**
 * Daily/Project Brief builder. Aigent Me Phase 3.
 *
 * Per PRD v0.2 §8 Golden Path 2 (Daily Command Brief).
 *
 * Deterministic generation in alpha — reads the user's PersonaQube hint,
 * ExperienceQube, journey state, and recent orchestration events, then
 * composes a structured Brief shape. No LLM in this phase; the structure
 * is the contract, and Phase 3.b will layer LLM enrichment for prose.
 *
 * Returns a shape mirroring the Brief Card displayed on the runtime
 * surface (PRD §9.2).
 */

import {
  getExperienceQube,
  type ActiveCartridgeSlug,
  type ExperienceStage,
} from '@/services/iqube/experienceQube';
import {
  selectNbeCandidates,
  selectTopNbeForCartridge,
  type NbeCandidate,
} from '@/services/orchestration/nbeCatalog';

// ─────────────────────────────────────────────────────────────────────────
// Public types — match the Brief Card render contract.
// ─────────────────────────────────────────────────────────────────────────

export type BriefType = 'daily' | 'project' | 'cartridge';

export interface BriefContext {
  activeCartridges: ActiveCartridgeSlug[];
  primaryGoal: string | null;
  currentStage: ExperienceStage;
  experienceName: string | null;
  /** Whether ExperienceQube is configured. Drives invitation copy. */
  experienceConfigured: boolean;
}

export interface BriefPriority {
  /** Stable id — used for receipts. */
  id: string;
  label: string;
  cartridge: ActiveCartridgeSlug;
}

export interface BriefNextBestAction {
  id: string;
  label: string;
  rationale: string;
  cartridge: ActiveCartridgeSlug;
  effort: NbeCandidate['effort'];
  impact: NbeCandidate['impact'];
  approvalRequired: boolean;
  specialist: NbeCandidate['specialist'] | null;
  suggestedArtifact: NbeCandidate['suggestedArtifact'] | null;
}

export interface BriefShape {
  briefType: BriefType;
  generatedAt: string;
  context: BriefContext;
  /** Top 1-3 priorities surfaced from active cartridges + primary goal. */
  topPriorities: BriefPriority[];
  /** 3-5 next-best actions, deterministically ranked. */
  nextBestActions: BriefNextBestAction[];
  /** Counts of pending approvals. Surfaced in the brief header. */
  pendingApprovalsCount: number;
  /** iQube usage disclosure for the calling surface to render. */
  using: ('PersonaQube' | 'ExperienceQube' | 'IntentQube')[];
  /** Categories explicitly NOT shared. */
  notShared: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// Build.
// ─────────────────────────────────────────────────────────────────────────

export interface BuildBriefInput {
  personaId: string;
  briefType: BriefType;
  /**
   * Optional cartridge scope. Set for `briefType: 'cartridge'`. Ignored
   * for daily/project — those range across the user's active cartridges.
   */
  scopedCartridge?: ActiveCartridgeSlug;
  /** Defaults — if no ExperienceQube configured we still produce a useful brief. */
  defaultActiveCartridges?: ActiveCartridgeSlug[];
}

const PRIORITY_LABELS_BY_CARTRIDGE: Record<ActiveCartridgeSlug, string> = {
  metame: 'Sharpen the metaMe operating space',
  knyt: 'Move KNYT forward',
  qriptopian: 'Advance The Qriptopian',
  marketa: 'Push partner / campaign motion',
  avl: 'Tighten venture progress',
};

export async function buildBrief(input: BuildBriefInput): Promise<BriefShape> {
  const qube = await getExperienceQube(input.personaId);

  const activeCartridges =
    qube?.meta.activeCartridges ?? input.defaultActiveCartridges ?? ['metame'];
  const currentStage: ExperienceStage = qube?.meta.currentStage ?? 'setup';
  const experienceName = qube?.meta.experienceName ?? null;
  const primaryGoal = qube?.meta.primaryGoal ?? null;
  const experienceConfigured = !!qube;

  // ── Top priorities — derived from active cartridges + primary goal.
  // Cartridge-shaped first; if scopedCartridge is set, that one wins.
  const orderedCartridges = input.scopedCartridge
    ? [input.scopedCartridge]
    : activeCartridges.slice(0, 3);

  const topPriorities: BriefPriority[] = orderedCartridges.map((c) => ({
    id: `priority.${c}`,
    label: PRIORITY_LABELS_BY_CARTRIDGE[c] ?? `Advance ${c}`,
    cartridge: c,
  }));

  // ── Next-best actions — deterministic, weighted, capped at 5.
  const nbeCandidates = input.scopedCartridge
    ? // Cartridge brief: pick the strongest NBE for that cartridge plus
      // its next 2 alternates.
      selectNbeCandidates({
        activeCartridges,
        currentStage,
        scopedCartridge: input.scopedCartridge,
        limit: 3,
      })
    : selectNbeCandidates({ activeCartridges, currentStage, limit: 5 });

  const nextBestActions: BriefNextBestAction[] = nbeCandidates.map((c) => ({
    id: c.id,
    label: c.label,
    rationale: c.rationale,
    cartridge: c.cartridge,
    effort: c.effort,
    impact: c.impact,
    approvalRequired: c.approvalRequired,
    specialist: c.specialist ?? null,
    suggestedArtifact: c.suggestedArtifact ?? null,
  }));

  // ── iQube usage disclosure.
  const using: BriefShape['using'] = ['PersonaQube'];
  if (experienceConfigured) using.push('ExperienceQube');
  // IntentQube is created when an action is taken; surface it in the
  // disclosure once a brief leads to an action.
  using.push('IntentQube');

  return {
    briefType: input.briefType,
    generatedAt: new Date().toISOString(),
    context: {
      activeCartridges,
      primaryGoal,
      currentStage,
      experienceName,
      experienceConfigured,
    },
    topPriorities,
    nextBestActions,
    pendingApprovalsCount: 0, // Phase 6 wires this.
    using,
    notShared: [
      'confidential strategy notes',
      'private investor data',
      'unreleased IP',
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Move-forward — narrower variant. One strong NBE + 2 alternates for one
// cartridge. PRD §8 Golden Path 3.
// ─────────────────────────────────────────────────────────────────────────

export interface MoveForwardShape {
  cartridge: ActiveCartridgeSlug;
  context: BriefContext;
  topAction: BriefNextBestAction | null;
  alternates: BriefNextBestAction[];
  using: BriefShape['using'];
  notShared: string[];
}

export async function buildMoveForward(input: {
  personaId: string;
  cartridge: ActiveCartridgeSlug;
}): Promise<MoveForwardShape> {
  const qube = await getExperienceQube(input.personaId);

  const activeCartridges = qube?.meta.activeCartridges ?? [input.cartridge];
  const currentStage: ExperienceStage = qube?.meta.currentStage ?? 'setup';
  const experienceName = qube?.meta.experienceName ?? null;
  const primaryGoal = qube?.meta.primaryGoal ?? null;
  const experienceConfigured = !!qube;

  const top = selectTopNbeForCartridge(input.cartridge, currentStage);
  const alts = selectNbeCandidates({
    activeCartridges,
    currentStage,
    scopedCartridge: input.cartridge,
    limit: 3,
  }).filter((c) => c.id !== top?.id);

  const toAction = (c: NbeCandidate): BriefNextBestAction => ({
    id: c.id,
    label: c.label,
    rationale: c.rationale,
    cartridge: c.cartridge,
    effort: c.effort,
    impact: c.impact,
    approvalRequired: c.approvalRequired,
    specialist: c.specialist ?? null,
    suggestedArtifact: c.suggestedArtifact ?? null,
  });

  return {
    cartridge: input.cartridge,
    context: {
      activeCartridges,
      primaryGoal,
      currentStage,
      experienceName,
      experienceConfigured,
    },
    topAction: top ? toAction(top) : null,
    alternates: alts.slice(0, 2).map(toAction),
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
