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
  getPersonalGuide,
  type ActiveCartridgeSlug,
  type ExperienceStage,
} from '@/services/iqube/experienceQube';
import {
  selectNbeCandidates,
  selectTopNbeForCartridge,
  type NbeCandidate,
} from '@/services/orchestration/nbeCatalog';
import { getConnectionStatuses, type GoogleSource } from '@/services/google/oauth';
import { inferStrategy } from '@/services/strategy/strategyInference';
import {
  ALIGNMENT_LABEL,
  SPHERE_LABEL,
  type AlignmentState,
  type PrecedenceMode,
  type SphereAxis,
} from '@/types/experienceGuide';

/**
 * Helper: list the Google sources this persona has linked. Tolerant — if
 * the OAuth status query fails (env not configured, table missing) we
 * return an empty array and the NBE filter degrades to its pre-workspace
 * baseline rather than failing the brief.
 */
async function readConnectedWorkspaceSources(personaId: string): Promise<GoogleSource[]> {
  try {
    const statuses = await getConnectionStatuses(personaId);
    return statuses.filter((s) => s.connected).map((s) => s.source);
  } catch {
    return [];
  }
}

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
  /** Personal ExperienceGuide context — T1 safe summary only. */
  personalGuide?: {
    alignmentState: AlignmentState;
    precedenceMode: PrecedenceMode;
    focusIntent?: string;
    /** One-line framing for the brief header. */
    guidanceNote: string;
  };
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

function buildGuidanceNote(
  alignmentState: AlignmentState,
  precedenceMode: PrecedenceMode,
  focusIntent?: string,
): string {
  const alignLabel = ALIGNMENT_LABEL[alignmentState];
  const sphereLabel =
    precedenceMode !== 'auto'
      ? `${SPHERE_LABEL[precedenceMode as SphereAxis]} sphere leading`
      : 'auto precedence';
  const focusPart = focusIntent ? ` · Focus: ${focusIntent}` : '';
  return `ExperienceGuide: ${alignLabel} · ${sphereLabel}${focusPart}`;
}

export async function buildBrief(input: BuildBriefInput): Promise<BriefShape> {
  const [qube, guide, workspaceConnected, strategy] = await Promise.all([
    getExperienceQube(input.personaId),
    getPersonalGuide(input.personaId),
    readConnectedWorkspaceSources(input.personaId),
    inferStrategy(input.personaId).catch(() => null),
  ]);

  const activeCartridges =
    qube?.meta.activeCartridges ?? input.defaultActiveCartridges ?? ['metame'];
  const currentStage: ExperienceStage = qube?.meta.currentStage ?? 'setup';
  const experienceName = qube?.meta.experienceName ?? null;
  const primaryGoal = qube?.meta.primaryGoal ?? null;
  const experienceConfigured = !!qube;
  // Merge raw goal strings with the inference keyword hints — gives the
  // NBE rerank a richer signal than the goal strings alone.
  const experienceGoals = [
    ...(qube?.blak.experienceGoals ?? []),
    ...(strategy?.nbeHints.keywords ?? []),
  ];

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
        workspaceConnected,
        experienceGoals,
      })
    : selectNbeCandidates({
        activeCartridges,
        currentStage,
        limit: 5,
        workspaceConnected,
        experienceGoals,
      });

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

  const personalGuideContext: BriefContext['personalGuide'] = guide
    ? {
        alignmentState: guide.alignmentState,
        precedenceMode: guide.precedenceMode,
        ...(guide.focusIntent ? { focusIntent: guide.focusIntent } : {}),
        guidanceNote: buildGuidanceNote(
          guide.alignmentState,
          guide.precedenceMode,
          guide.focusIntent,
        ),
      }
    : undefined;

  return {
    briefType: input.briefType,
    generatedAt: new Date().toISOString(),
    context: {
      activeCartridges,
      primaryGoal,
      currentStage,
      experienceName,
      experienceConfigured,
      ...(personalGuideContext ? { personalGuide: personalGuideContext } : {}),
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
  /**
   * Optional cartridge scope. When omitted, the builder picks the strongest
   * NBE across the user's active cartridges (Aigent Me's default move).
   * Use the explicit form when the user has steered to a specific cartridge.
   */
  cartridge?: ActiveCartridgeSlug;
}): Promise<MoveForwardShape> {
  const [qube, guide, workspaceConnected, strategy] = await Promise.all([
    getExperienceQube(input.personaId),
    getPersonalGuide(input.personaId),
    readConnectedWorkspaceSources(input.personaId),
    inferStrategy(input.personaId).catch(() => null),
  ]);

  const activeCartridges = qube?.meta.activeCartridges ?? (input.cartridge ? [input.cartridge] : ['metame']);
  const currentStage: ExperienceStage = qube?.meta.currentStage ?? 'setup';
  const experienceName = qube?.meta.experienceName ?? null;
  const primaryGoal = qube?.meta.primaryGoal ?? null;
  const experienceConfigured = !!qube;
  const experienceGoals = [
    ...(qube?.blak.experienceGoals ?? []),
    ...(strategy?.nbeHints.keywords ?? []),
  ];

  // Auto-pick mode: select the strongest NBE across all active cartridges,
  // then return its sibling 2 (highest-weighted) as alternates. Otherwise
  // honour the cartridge scope the caller requested.
  let topCandidate: NbeCandidate | null;
  let altsRaw: NbeCandidate[];

  if (input.cartridge) {
    topCandidate = selectTopNbeForCartridge(input.cartridge, currentStage, {
      workspaceConnected,
      experienceGoals,
    });
    altsRaw = selectNbeCandidates({
      activeCartridges,
      currentStage,
      scopedCartridge: input.cartridge,
      limit: 3,
      workspaceConnected,
      experienceGoals,
    }).filter((c) => c.id !== topCandidate?.id);
  } else {
    const ranked = selectNbeCandidates({
      activeCartridges,
      currentStage,
      limit: 5,
      workspaceConnected,
      experienceGoals,
    });
    topCandidate = ranked[0] ?? null;
    altsRaw = ranked.slice(1);
  }

  const resolvedCartridge: ActiveCartridgeSlug =
    input.cartridge ?? topCandidate?.cartridge ?? activeCartridges[0] ?? 'metame';

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

  const personalGuideContext: BriefContext['personalGuide'] = guide
    ? {
        alignmentState: guide.alignmentState,
        precedenceMode: guide.precedenceMode,
        ...(guide.focusIntent ? { focusIntent: guide.focusIntent } : {}),
        guidanceNote: buildGuidanceNote(
          guide.alignmentState,
          guide.precedenceMode,
          guide.focusIntent,
        ),
      }
    : undefined;

  return {
    cartridge: resolvedCartridge,
    context: {
      activeCartridges,
      primaryGoal,
      currentStage,
      experienceName,
      experienceConfigured,
      ...(personalGuideContext ? { personalGuide: personalGuideContext } : {}),
    },
    topAction: topCandidate ? toAction(topCandidate) : null,
    alternates: altsRaw.slice(0, 2).map(toAction),
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
