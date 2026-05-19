/**
 * Static catalogue of Next-Best-Experience (NBE) candidates per cartridge
 * and per stage. Aigent Me Phase 3.
 *
 * Used by:
 *   - services/orchestration/briefBuilder.ts → daily/project brief
 *   - app/api/assistant/move-forward/route.ts → cartridge-scoped NBE pick
 *
 * Design choice (alpha):
 *   Deterministic. Each NBE candidate is scored by simple stage/cartridge
 *   matching plus a static `weight`. Phase 3.b layers LLM enrichment on
 *   top — selection logic stays here, prose lives there.
 *
 * The catalogue is **not** a content surface. Adding/removing entries is
 * a code change reviewable by the operator. For user-authored intents
 * (PRD §6 IntentQube), the IntentQube service is the canonical writer.
 */

import type { ActiveCartridgeSlug, ExperienceStage } from '@/services/iqube/experienceQube';
import type { GoogleSource } from '@/services/google/oauth';

// ─────────────────────────────────────────────────────────────────────────
// Types.
// ─────────────────────────────────────────────────────────────────────────

export type NbeImpact = 'low' | 'medium' | 'high';
export type NbeEffort = 'light' | 'standard' | 'deep';

export interface NbeCandidate {
  /** Stable identifier — used in receipts + IntentQube records. */
  id: string;
  /** User-facing label. Short imperative phrase. */
  label: string;
  /** One-sentence rationale. Used in the card body. */
  rationale: string;
  /** Cartridge that owns this NBE. metame = cross-cartridge. */
  cartridge: ActiveCartridgeSlug;
  /** Stages where this NBE is relevant. Empty = all stages. */
  stages?: ExperienceStage[];
  /** Specialist most relevant to coordinate. Optional. */
  specialist?: 'marketa' | 'quill' | 'kn0w1' | 'aigent-z' | 'aigent-c' | 'aigent-nakamoto';
  /** Suggested artifact type to produce. */
  suggestedArtifact?:
    | 'google-doc'
    | 'gmail-draft'
    | 'calendar-block'
    | 'brief'
    | 'post-set'
    | 'image-prompt'
    | 'video-script'
    | 'slide-outline'
    | 'venture-report';
  /** Whether this NBE requires an Approval Card before any external action. */
  approvalRequired: boolean;
  /** Static weight (1-100). Higher = more likely to surface. */
  weight: number;
  /** Effort level. */
  effort: NbeEffort;
  /** Impact level. */
  impact: NbeImpact;
  /**
   * Hard prerequisites. The candidate is hidden when not satisfied.
   * - `workspaceConnected`: ALL listed Google sources must be connected.
   * - `workspaceNotConnected`: hides the candidate once the user has
   *   connected at least one of the listed sources (used to retire the
   *   generic "connect workspace" suggestion once it's redundant).
   */
  requires?: {
    workspaceConnected?: GoogleSource[];
    workspaceNotConnected?: GoogleSource[];
    /** Only surface when the persona is eligible to advance their ExperienceStage. */
    stageAdvanceEligible?: boolean;
  };
  /**
   * Soft signals for goals-aware re-ranking. Case-insensitive substring
   * match against the persona's `experienceGoals` adds a weight boost
   * before sort. Deterministic baseline ahead of Phase 3.b LLM rerank.
   */
  goalKeywords?: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// Catalogue.
// ─────────────────────────────────────────────────────────────────────────

export const NBE_CATALOGUE: NbeCandidate[] = [
  // ── metaMe (cross-cartridge / setup) ─────────────────────────────────
  {
    id: 'metame.update-experience-goals',
    label: 'Update active ExperienceGoals',
    rationale: 'Refresh the goals Aigent Me uses for every brief and recommendation.',
    cartridge: 'metame',
    approvalRequired: false,
    weight: 60,
    effort: 'light',
    impact: 'medium',
  },
  {
    id: 'metame.activate-workspace-source',
    label: 'Connect a Google Workspace source',
    rationale:
      'Opt in to Gmail, Calendar, or Drive so Aigent Me can include relevant context in your brief. Each source is approved separately.',
    cartridge: 'metame',
    approvalRequired: true,
    weight: 50,
    effort: 'light',
    impact: 'medium',
    // Retire this prompt as soon as the user has linked any one source —
    // the follow-on "use workspace to…" NBEs take over.
    requires: { workspaceNotConnected: ['gmail', 'calendar', 'drive', 'docs', 'sheets', 'slides'] },
  },
  {
    id: 'metame.advance-stage',
    label: 'Advance to the next ExperienceStage',
    rationale:
      'You have hit every criterion for the next stage. Advancing locks in progress and re-targets briefs and NBEs to the new posture.',
    cartridge: 'metame',
    approvalRequired: false,
    weight: 95,
    effort: 'light',
    impact: 'high',
    requires: { stageAdvanceEligible: true },
    goalKeywords: ['progress', 'advance', 'milestone'],
  },
  {
    id: 'metame.use-workspace-gmail',
    label: 'Draft a Gmail outreach via workspace',
    rationale:
      'You have Gmail connected — Aigent Me can draft a contextual outreach against your active goals and partner list.',
    cartridge: 'metame',
    specialist: 'marketa',
    suggestedArtifact: 'gmail-draft',
    approvalRequired: true,
    weight: 70,
    effort: 'light',
    impact: 'medium',
    requires: { workspaceConnected: ['gmail'] },
    goalKeywords: ['email', 'outreach', 'partner', 'investor', 'follow up'],
  },
  {
    id: 'metame.use-workspace-doc',
    label: 'Create a working doc in Drive',
    rationale:
      'Drive is connected — spin up a goal-aligned doc Aigent Me can iterate on with you.',
    cartridge: 'metame',
    suggestedArtifact: 'google-doc',
    approvalRequired: true,
    weight: 65,
    effort: 'light',
    impact: 'medium',
    requires: { workspaceConnected: ['drive', 'docs'] },
    goalKeywords: ['brief', 'plan', 'spec', 'memo', 'narrative', 'doc'],
  },
  {
    id: 'metame.use-workspace-event',
    label: 'Block focus time on your calendar',
    rationale:
      'Calendar is connected — reserve a deep-work block for the strongest move on your current goals.',
    cartridge: 'metame',
    suggestedArtifact: 'calendar-block',
    approvalRequired: true,
    weight: 55,
    effort: 'light',
    impact: 'medium',
    requires: { workspaceConnected: ['calendar'] },
    goalKeywords: ['focus', 'deep work', 'review', 'sync', 'block'],
  },

  // ── KNYT ─────────────────────────────────────────────────────────────
  {
    id: 'knyt.zero-investor-update',
    label: 'Create a Zero KNYT investor update',
    rationale:
      'High-leverage move during alpha activation — connects to the KNYT Wheel and primes a Qriptopian teaser.',
    cartridge: 'knyt',
    stages: ['alpha_activation', 'launch'],
    specialist: 'kn0w1',
    suggestedArtifact: 'google-doc',
    approvalRequired: false,
    weight: 90,
    effort: 'standard',
    impact: 'high',
    goalKeywords: ['investor', 'fundraise', 'capital', 'knyt', 'update'],
  },
  {
    id: 'knyt.kn0w1-mission-recommendation',
    label: 'Ask Kn0w1 for the next mission',
    rationale:
      'Surface a KNYT-side participation opportunity scoped to your ExperienceModel.',
    cartridge: 'knyt',
    specialist: 'kn0w1',
    approvalRequired: false,
    weight: 70,
    effort: 'light',
    impact: 'medium',
  },
  {
    id: 'knyt.cartridge-activation-checkpoint',
    label: 'Run the KNYT cartridge activation checkpoint',
    rationale:
      'Verify wheel state, treasury readiness, and active correspondents before the next push.',
    cartridge: 'knyt',
    stages: ['alpha_activation'],
    approvalRequired: false,
    weight: 65,
    effort: 'standard',
    impact: 'medium',
  },

  // ── Qriptopian ───────────────────────────────────────────────────────
  {
    id: 'qriptopian.ask-quill-angle',
    label: 'Ask Quill for the Qriptopian angle',
    rationale:
      'Frame the next launch, partner activity, or KNYT moment as an editorial piece.',
    cartridge: 'qriptopian',
    specialist: 'quill',
    approvalRequired: false,
    weight: 75,
    effort: 'light',
    impact: 'medium',
  },
  {
    id: 'qriptopian.create-issue-brief',
    label: 'Create a Qriptopian issue brief',
    rationale:
      'Group the active angle with adjacent content for the next issue.',
    cartridge: 'qriptopian',
    specialist: 'quill',
    suggestedArtifact: 'brief',
    approvalRequired: false,
    weight: 60,
    effort: 'standard',
    impact: 'medium',
  },

  // ── Marketa ──────────────────────────────────────────────────────────
  {
    id: 'marketa.ask-partner-proposal',
    label: 'Ask Marketa for a partner proposal',
    rationale:
      'Draft a campaign or partnership proposal for one of your priority partners (e.g. Metayé Media).',
    cartridge: 'marketa',
    specialist: 'marketa',
    suggestedArtifact: 'brief',
    approvalRequired: false,
    weight: 80,
    effort: 'standard',
    impact: 'high',
    goalKeywords: ['partner', 'partnership', 'campaign', 'go-to-market', 'gtm', 'distribution'],
  },
  {
    id: 'marketa.create-campaign-brief',
    label: 'Create a campaign brief',
    rationale:
      'Turn the strongest active partner conversation into a structured brief Aigent Me can hand off.',
    cartridge: 'marketa',
    specialist: 'marketa',
    suggestedArtifact: 'brief',
    approvalRequired: false,
    weight: 65,
    effort: 'standard',
    impact: 'medium',
  },

  // ── AgentiQ Venture Lab (AVL) ────────────────────────────────────────
  {
    id: 'avl.generate-progress-report',
    label: 'Generate a venture progress report',
    rationale:
      'Snapshot operational + commercial KPI movement, blockers, and the next strongest commercial action.',
    cartridge: 'avl',
    suggestedArtifact: 'venture-report',
    approvalRequired: false,
    weight: 70,
    effort: 'standard',
    impact: 'high',
    goalKeywords: ['venture', 'progress', 'kpi', 'milestone', 'investor'],
  },
  {
    id: 'avl.schedule-review-block',
    label: 'Schedule a venture review block',
    rationale:
      'Reserve focused time to review AVL progress with the people who unblock it.',
    cartridge: 'avl',
    suggestedArtifact: 'calendar-block',
    approvalRequired: true,
    weight: 50,
    effort: 'light',
    impact: 'medium',
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Selection helpers.
// ─────────────────────────────────────────────────────────────────────────

export interface NbeSelectionContext {
  activeCartridges: ActiveCartridgeSlug[];
  currentStage: ExperienceStage;
  /** When set, restricts to one cartridge (move-forward flow). */
  scopedCartridge?: ActiveCartridgeSlug;
  /** How many candidates to return. Default 5. */
  limit?: number;
  /** Google sources the persona has connected — drives workspace-aware gating. */
  workspaceConnected?: GoogleSource[];
  /** Persona's active ExperienceGoals — drives goal-keyword reranking. */
  experienceGoals?: string[];
  /** True when the persona meets every criterion for the next stage. */
  stageAdvanceEligible?: boolean;
}

/** Goal-keyword boost applied per keyword match. Capped at 3 hits per candidate. */
const GOAL_BOOST_PER_HIT = 12;
const GOAL_BOOST_CAP = 3;

function countGoalHits(candidate: NbeCandidate, goals: string[]): number {
  if (!candidate.goalKeywords || candidate.goalKeywords.length === 0 || goals.length === 0) {
    return 0;
  }
  const haystack = goals.join(' \n ').toLowerCase();
  let hits = 0;
  for (const kw of candidate.goalKeywords) {
    if (kw && haystack.includes(kw.toLowerCase())) hits++;
    if (hits >= GOAL_BOOST_CAP) break;
  }
  return hits;
}

function passesRequires(
  candidate: NbeCandidate,
  ctx: { connected: GoogleSource[]; stageAdvanceEligible: boolean },
): boolean {
  const r = candidate.requires;
  if (!r) return true;
  if (r.workspaceConnected && r.workspaceConnected.length > 0) {
    for (const src of r.workspaceConnected) {
      if (!ctx.connected.includes(src)) return false;
    }
  }
  if (r.workspaceNotConnected && r.workspaceNotConnected.length > 0) {
    for (const src of r.workspaceNotConnected) {
      if (ctx.connected.includes(src)) return false;
    }
  }
  if (r.stageAdvanceEligible === true && !ctx.stageAdvanceEligible) return false;
  return true;
}

/**
 * Deterministic selection: filter by active cartridges + stage match +
 * workspace prerequisites, then sort by effective weight (static weight +
 * goal-keyword boost). Phase 3.b layers an LLM re-rank on top using the
 * user's BlakQube; this baseline gives a predictable, testable result.
 */
export function selectNbeCandidates(ctx: NbeSelectionContext): NbeCandidate[] {
  const {
    activeCartridges,
    currentStage,
    scopedCartridge,
    limit = 5,
    workspaceConnected = [],
    experienceGoals = [],
    stageAdvanceEligible = false,
  } = ctx;

  const cartridgeSet = scopedCartridge
    ? new Set<ActiveCartridgeSlug>([scopedCartridge])
    : new Set<ActiveCartridgeSlug>(activeCartridges);

  const filtered = NBE_CATALOGUE.filter((c) => {
    if (!cartridgeSet.has(c.cartridge)) return false;
    if (c.stages && c.stages.length > 0 && !c.stages.includes(currentStage)) {
      return false;
    }
    if (!passesRequires(c, { connected: workspaceConnected, stageAdvanceEligible })) return false;
    return true;
  });

  const scored = filtered.map((c) => ({
    candidate: c,
    score: c.weight + countGoalHits(c, experienceGoals) * GOAL_BOOST_PER_HIT,
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.candidate);
}

/**
 * Convenience: pick the single strongest NBE for a cartridge. Used by
 * the move-forward endpoint when the user asks "Move KNYT forward today".
 */
export function selectTopNbeForCartridge(
  cartridge: ActiveCartridgeSlug,
  currentStage: ExperienceStage,
  options?: {
    workspaceConnected?: GoogleSource[];
    experienceGoals?: string[];
    stageAdvanceEligible?: boolean;
  },
): NbeCandidate | null {
  const candidates = selectNbeCandidates({
    activeCartridges: [cartridge],
    currentStage,
    scopedCartridge: cartridge,
    limit: 1,
    workspaceConnected: options?.workspaceConnected ?? [],
    experienceGoals: options?.experienceGoals ?? [],
    stageAdvanceEligible: options?.stageAdvanceEligible ?? false,
  });
  return candidates[0] ?? null;
}
