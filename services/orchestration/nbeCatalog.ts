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
}

/**
 * Deterministic selection: filter by active cartridges + stage match,
 * sort by static weight desc, take top N. Phase 3.b layers an LLM
 * re-ranking on top using the user's BlakQube; this baseline gives a
 * predictable, testable result.
 */
export function selectNbeCandidates(ctx: NbeSelectionContext): NbeCandidate[] {
  const { activeCartridges, currentStage, scopedCartridge, limit = 5 } = ctx;

  const cartridgeSet = scopedCartridge
    ? new Set<ActiveCartridgeSlug>([scopedCartridge])
    : new Set<ActiveCartridgeSlug>(activeCartridges);

  const filtered = NBE_CATALOGUE.filter((c) => {
    if (!cartridgeSet.has(c.cartridge)) return false;
    if (c.stages && c.stages.length > 0 && !c.stages.includes(currentStage)) {
      return false;
    }
    return true;
  });

  filtered.sort((a, b) => b.weight - a.weight);
  return filtered.slice(0, limit);
}

/**
 * Convenience: pick the single strongest NBE for a cartridge. Used by
 * the move-forward endpoint when the user asks "Move KNYT forward today".
 */
export function selectTopNbeForCartridge(
  cartridge: ActiveCartridgeSlug,
  currentStage: ExperienceStage,
): NbeCandidate | null {
  const candidates = selectNbeCandidates({
    activeCartridges: [cartridge],
    currentStage,
    scopedCartridge: cartridge,
    limit: 1,
  });
  return candidates[0] ?? null;
}
