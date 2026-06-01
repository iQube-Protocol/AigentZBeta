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
import { evaluateStageProgression } from '@/services/strategy/stageProgression';
import { llmRerankNbeCandidates } from '@/services/orchestration/nbeLlmRerank';
import type { PreflightContext } from '@/services/capabilities/preflight';
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
  /**
   * Optional ≤140-char rationale for why nextBestActions[0] is the top
   * pick — produced by the Phase 3.b LLM rerank pass. Null when no LLM
   * call ran or the call failed.
   */
  topNbeReason?: string | null;
  /**
   * Optional per-NBA compose / action prompt hints keyed by NBA id.
   * Produced by the LLM rerank pass alongside `topNbeReason`. Empty
   * record when no LLM call ran or the call returned no usable hints.
   * Surfaces as the "aigentMe's take" italic line under each NBA card
   * and seeds composerInitialPrompt when Act maps to a compose modal.
   */
  nbaContextualTitles?: Record<string, string>;
  nbaPromptHints?: Record<string, string>;
  /** Counts of pending approvals. Surfaced in the brief header. */
  pendingApprovalsCount: number;
  /** iQube usage disclosure for the calling surface to render. */
  using: ('PersonaQube' | 'ExperienceQube' | 'IntentQube')[];
  /** Categories explicitly NOT shared. */
  notShared: string[];
  /**
   * Capability Gateway pre-flight result. Present only when
   * CAPABILITY_GATEWAY_PREFLIGHT is enabled for the `brief` surface and
   * the gather succeeded. Cards render `summary` as a small
   * "aigentMe researched: …" byline; `workOrderId` is for receipt
   * correlation, never displayed as a primary identifier.
   */
  preflightContext?: PreflightContext;
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
  /**
   * Optional fresh signal from the Capability Gateway pre-flight pass
   * (e.g. web-search digest). Routed into the LLM rerank prompt as
   * `liveContext` so the model can use it to break ties / boost a
   * candidate whose rationale lines up with the signal. Ignored when
   * the LLM rerank pass is off or the value is empty.
   */
  liveContext?: string | null;
}

const PRIORITY_LABELS_BY_CARTRIDGE: Record<ActiveCartridgeSlug, string> = {
  metame: 'Sharpen the metaMe operating space',
  knyt: 'Move KNYT forward',
  qriptopian: 'Advance The Qriptopian',
  marketa: 'Push partner / campaign motion',
  mvl: 'Tighten venture progress',
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
  const [qube, guide, workspaceConnected, strategy, stageEval] = await Promise.all([
    getExperienceQube(input.personaId),
    getPersonalGuide(input.personaId),
    readConnectedWorkspaceSources(input.personaId),
    inferStrategy(input.personaId).catch(() => null),
    evaluateStageProgression(input.personaId, { runAutoAdvance: false }).catch(() => null),
  ]);

  const activeCartridges =
    qube?.meta.activeCartridges ?? input.defaultActiveCartridges ?? ['metame'];
  const currentStage: ExperienceStage = qube?.meta.currentStage ?? 'setup';
  const experienceName = qube?.meta.experienceName ?? null;
  const primaryGoal = qube?.meta.primaryGoal ?? null;
  const experienceConfigured = !!qube;
  const stageAdvanceEligible = !!stageEval?.eligible;
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

  // ── Next-best actions — deterministic filter, then optional LLM rerank.
  let nbeCandidates = input.scopedCartridge
    ? selectNbeCandidates({
        activeCartridges,
        currentStage,
        scopedCartridge: input.scopedCartridge,
        limit: 3,
        workspaceConnected,
        experienceGoals,
        stageAdvanceEligible,
      })
    : selectNbeCandidates({
        activeCartridges,
        currentStage,
        limit: 5,
        workspaceConnected,
        experienceGoals,
        stageAdvanceEligible,
      });

  const rerank = await llmRerankNbeCandidates(nbeCandidates, {
    currentStage,
    activeCartridges,
    primaryGoal,
    experienceGoals,
    strategy,
    liveContext: input.liveContext ?? null,
  });
  nbeCandidates = rerank.ranked;
  const topNbeReason = rerank.topReason;
  const nbaPromptHints = rerank.nbaPromptHints;
  const nbaContextualTitles = rerank.nbaContextualTitles;

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
    topNbeReason,
    nbaContextualTitles,
    nbaPromptHints,
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
  /** ≤140-char rationale for the top pick from the LLM rerank pass. */
  topActionReason?: string | null;
  /** See `BriefShape.nbaPromptHints` — same shape, same meaning. */
  nbaContextualTitles?: Record<string, string>;
  nbaPromptHints?: Record<string, string>;
  using: BriefShape['using'];
  notShared: string[];
  /** See `BriefShape.preflightContext` — same shape, same meaning. */
  preflightContext?: PreflightContext;
}

export async function buildMoveForward(input: {
  personaId: string;
  /**
   * Optional cartridge scope. When omitted, the builder picks the strongest
   * NBE across the user's active cartridges (Aigent Me's default move).
   * Use the explicit form when the user has steered to a specific cartridge.
   */
  cartridge?: ActiveCartridgeSlug;
  /** See `BuildBriefInput.liveContext` — same meaning. */
  liveContext?: string | null;
}): Promise<MoveForwardShape> {
  const [qube, guide, workspaceConnected, strategy, stageEval] = await Promise.all([
    getExperienceQube(input.personaId),
    getPersonalGuide(input.personaId),
    readConnectedWorkspaceSources(input.personaId),
    inferStrategy(input.personaId).catch(() => null),
    evaluateStageProgression(input.personaId, { runAutoAdvance: false }).catch(() => null),
  ]);

  const activeCartridges = qube?.meta.activeCartridges ?? (input.cartridge ? [input.cartridge] : ['metame']);
  const currentStage: ExperienceStage = qube?.meta.currentStage ?? 'setup';
  const experienceName = qube?.meta.experienceName ?? null;
  const primaryGoal = qube?.meta.primaryGoal ?? null;
  const experienceConfigured = !!qube;
  const stageAdvanceEligible = !!stageEval?.eligible;
  const experienceGoals = [
    ...(qube?.blak.experienceGoals ?? []),
    ...(strategy?.nbeHints.keywords ?? []),
  ];

  // Auto-pick mode: select the strongest NBE across all active cartridges,
  // then return its sibling 2 (highest-weighted) as alternates. Otherwise
  // honour the cartridge scope the caller requested.
  let topCandidate: NbeCandidate | null;
  let altsRaw: NbeCandidate[];
  let topActionReason: string | null = null;
  let nbaPromptHints: Record<string, string> = {};
  let nbaContextualTitles: Record<string, string> = {};

  if (input.cartridge) {
    topCandidate = selectTopNbeForCartridge(input.cartridge, currentStage, {
      workspaceConnected,
      experienceGoals,
      stageAdvanceEligible,
    });
    altsRaw = selectNbeCandidates({
      activeCartridges,
      currentStage,
      scopedCartridge: input.cartridge,
      limit: 3,
      workspaceConnected,
      experienceGoals,
      stageAdvanceEligible,
    }).filter((c) => c.id !== topCandidate?.id);
  } else {
    const baseline = selectNbeCandidates({
      activeCartridges,
      currentStage,
      limit: 5,
      workspaceConnected,
      experienceGoals,
      stageAdvanceEligible,
    });
    const rerank = await llmRerankNbeCandidates(baseline, {
      currentStage,
      activeCartridges,
      primaryGoal,
      experienceGoals,
      strategy,
      liveContext: input.liveContext ?? null,
    });
    topCandidate = rerank.ranked[0] ?? null;
    altsRaw = rerank.ranked.slice(1);
    topActionReason = rerank.topReason;
    nbaPromptHints = rerank.nbaPromptHints;
    nbaContextualTitles = rerank.nbaContextualTitles;
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
    topActionReason,
    nbaContextualTitles,
    nbaPromptHints,
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
