/**
 * Founders Club — Phase 1 interim matching heuristic.
 *
 * PRD-FDC-001 (Founders Club) §5 (`codexes/packs/agentiq/updates/
 * 2026-07-22_prd-fdc-001-founders-club.md`), built as Increment 2 of the
 * implementation plan (`codexes/packs/agentiq/updates/
 * 2026-07-22_prd-foi-001-implementation-plan.md`, §2 "Increment 2").
 *
 * ── What this is ────────────────────────────────────────────────────────
 * The ratified Phase 1 signal list (PRD-FDC-001 §5, §11 item 2), deliberately
 * NOT machine learning or an opaque black-box recommender — an explainable
 * score composed from named, inspectable signals:
 *
 *   1. Venture stage            — VentureQubeRecord.stage
 *   2. Industry / domain        — VentureThesisLayer.industryTags
 *   3. Geography                — VentureThesisLayer.geographicScope
 *   4. Current Action Modes     — ConstitutionalActionMode[] (Increment 1,
 *                                 `services/iqube/experienceQube.ts`) — OPTIONAL,
 *                                 per this session's file-scope note (see below)
 *   5. Standing                 — computeStandingScore() (services/standing/standingScore.ts)
 *   6. Current objectives       — VentureExecutionLayer.phases[].objectives
 *   7. Active challenges        — NO dedicated data source exists in this
 *                                 codebase today (see honesty note below)
 *   8. Shared interests         — NO dedicated data source exists in this
 *                                 codebase today (see honesty note below)
 *   9. Constitutional compatibility — a Phase 1 PROXY only (see below), never
 *                                 a claim of true constitutional proximity
 *
 * Every match result carries a mandatory, non-empty "I matched you
 * because..." rationale string citing which of the above signals
 * contributed (PRD-FDC-001 §5's explainability requirement — not optional
 * polish, a hard requirement).
 *
 * ── Honesty notes (do not silently paper over these) ────────────────────
 * - "Active challenges" and "shared interests" have NO existing field in
 *   `VentureQubeV1`, `ExperienceQubeMeta`, or any other service read for this
 *   module. This module does NOT invent a fake data source for them — the
 *   pure `computeFoundersClubMatch` function accepts them as OPTIONAL
 *   caller-supplied arrays; when omitted, they simply contribute nothing to
 *   the score (never penalised, never fabricated).
 * - "Constitutional compatibility" is named in PRD-FDC-001 §5 as one of the
 *   nine Phase 1 signals, but the real Constitutional Coordinates engine
 *   (CFS-037/IRE) is itself "proposed, not yet built or ratified" (PRD-FDC-001
 *   §0.6/§5). This module's `constitutionalCompatibility` contribution is
 *   therefore an explicit, labelled PROXY: a bonus that fires only when
 *   several of the other eight signals already aligned, whose rationale
 *   fragment always says "(Phase 1 proxy)" so nobody downstream mistakes it
 *   for the ratified engine's output.
 * - "Current Action Modes" is imported from `services/iqube/experienceQube.ts`
 *   as an OPTIONAL, loosely-typed signal (accepts `ConstitutionalActionMode[]`
 *   OR bare `string[]`) per this session's sibling-agent file-scope
 *   constraint: a concurrent Increment 1 session owns that file. At the time
 *   this module was written, `ConstitutionalActionMode` and
 *   `VALID_ACTION_MODES` were ALREADY present in `experienceQube.ts` (the
 *   sibling's Increment 1 had landed), so the import resolves cleanly today.
 *   If a future edit to `experienceQube.ts` ever removes that export, this
 *   module's `string[]` fallback keeps it compiling and functioning —
 *   verify this wiring once both increments are merged (see this session's
 *   final report).
 *
 * ── Two layers ───────────────────────────────────────────────────────────
 * `computeFoundersClubMatch` — a PURE function (no DB/network access) over
 * two `FoundersClubMatchCandidate` objects. This is what the canary test
 * exercises and what the Community Concierge shell can safely import
 * client-side (no server-only dependency).
 *
 * `buildFoundersClubCandidate` — a SERVER-ONLY helper that assembles a
 * candidate by reading the real services PRD-FDC-001 §0.8 names: Standing
 * via `computeStandingScore()`, venture stage/industry/geography/objectives
 * via a `VentureQubeRecord` (from `services/venture/ventureQubeService.ts`).
 * This is the "reuse, don't reinvent" seam — it does not recompute Standing
 * or venture data, only reads what those services already produce.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { VENTURE_STAGES, type VentureStage } from '@/types/ventureQube';
import type { VentureQubeRecord } from '@/services/venture/ventureQubeService';
import { computeStandingScore } from '@/services/standing/standingScore';

// ─────────────────────────────────────────────────────────────────────────
// Pure matching core.
// ─────────────────────────────────────────────────────────────────────────

export interface FoundersClubMatchCandidate {
  /** VentureQubeRecord.stage, when the founder has an active venture. */
  ventureStage?: VentureStage | null;
  /** VentureThesisLayer.industryTags. */
  industryTags?: string[];
  /** VentureThesisLayer.geographicScope. */
  geographicScope?: string | null;
  /**
   * Zero-to-many active Constitutional Action Modes (Increment 1). Typed
   * loosely as `string[]` here (rather than importing the sibling's
   * `ConstitutionalActionMode` union directly into the exported candidate
   * shape) so this module keeps functioning even if that type's export
   * shape changes before both increments are merged — see the module doc's
   * honesty note above.
   */
  activeActionModes?: string[];
  /** computeStandingScore().score — 0..100. */
  standingScore?: number | null;
  /** Flattened VentureExecutionLayer.phases[].objectives. */
  currentObjectives?: string[];
  /**
   * No dedicated data source exists in this codebase today (module doc).
   * Caller-supplied only; never fabricated by this module.
   */
  activeChallenges?: string[];
  /** Same caveat as `activeChallenges`. */
  sharedInterests?: string[];
}

export type FoundersClubMatchSignal =
  | 'ventureStage'
  | 'industryDomain'
  | 'geography'
  | 'currentActionModes'
  | 'standing'
  | 'currentObjectives'
  | 'activeChallenges'
  | 'sharedInterests'
  | 'constitutionalCompatibility';

export interface FoundersClubSignalContribution {
  signal: FoundersClubMatchSignal;
  /** This signal's contribution to the 0..100 composite score. */
  weight: number;
  /** Human-readable fragment folded into the mandatory rationale string. */
  detail: string;
}

export interface FoundersClubMatchResult {
  /** Composite 0..100 — NOT a probability, an explainable relative score. */
  score: number;
  contributions: FoundersClubSignalContribution[];
  /**
   * Mandatory per PRD-FDC-001 §5 — "I matched you because...". ALWAYS
   * non-empty, even when no signal contributed (an honest "nothing shared
   * yet" rationale rather than an empty string).
   */
  rationale: string;
}

/** Per-signal weight ceiling. Sums to 100 across the eight primary signals;
 *  `constitutionalCompatibility` is an additional bonus proxy on top (see
 *  module doc), so a very well-aligned pair can exceed the eight-signal sum
 *  slightly before the final clamp to 100. */
const SIGNAL_WEIGHT: Record<Exclude<FoundersClubMatchSignal, 'constitutionalCompatibility'>, number> = {
  ventureStage: 15,
  industryDomain: 20,
  geography: 10,
  currentActionModes: 10,
  standing: 10,
  currentObjectives: 15,
  activeChallenges: 10,
  sharedInterests: 10,
};

/** Case/whitespace-insensitive Jaccard overlap over two string lists. */
function overlapOf(a: string[] = [], b: string[] = []): { overlap: string[]; ratio: number } {
  const setA = new Set(a.map((s) => s.trim().toLowerCase()).filter(Boolean));
  const setB = new Set(b.map((s) => s.trim().toLowerCase()).filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return { overlap: [], ratio: 0 };
  const overlap = [...setA].filter((v) => setB.has(v));
  const union = new Set([...setA, ...setB]);
  return { overlap, ratio: union.size === 0 ? 0 : overlap.length / union.size };
}

/**
 * Compute an explainable Founders Club match between two candidates.
 * Pure — no I/O, safe to call from client or server code, and the function
 * the canary test exercises directly with fixture data.
 */
export function computeFoundersClubMatch(
  a: FoundersClubMatchCandidate,
  b: FoundersClubMatchCandidate,
): FoundersClubMatchResult {
  const contributions: FoundersClubSignalContribution[] = [];

  // 1. Venture stage — exact match scores full weight; one step apart on
  // the canonical VENTURE_STAGES ladder scores half.
  if (a.ventureStage && b.ventureStage) {
    const ia = VENTURE_STAGES.indexOf(a.ventureStage);
    const ib = VENTURE_STAGES.indexOf(b.ventureStage);
    if (ia >= 0 && ib >= 0) {
      const distance = Math.abs(ia - ib);
      if (distance === 0) {
        contributions.push({
          signal: 'ventureStage',
          weight: SIGNAL_WEIGHT.ventureStage,
          detail: `you're both at the ${a.ventureStage} stage`,
        });
      } else if (distance === 1) {
        contributions.push({
          signal: 'ventureStage',
          weight: SIGNAL_WEIGHT.ventureStage * 0.5,
          detail: `you're at adjacent venture stages (${a.ventureStage} / ${b.ventureStage})`,
        });
      }
    }
  }

  // 2. Industry / domain.
  {
    const { overlap, ratio } = overlapOf(a.industryTags, b.industryTags);
    if (overlap.length > 0) {
      contributions.push({
        signal: 'industryDomain',
        weight: SIGNAL_WEIGHT.industryDomain * ratio,
        detail: `you share an industry/domain: ${overlap.join(', ')}`,
      });
    }
  }

  // 3. Geography — exact scope match only (no distance model for Phase 1).
  if (
    a.geographicScope &&
    b.geographicScope &&
    a.geographicScope.trim().toLowerCase() === b.geographicScope.trim().toLowerCase()
  ) {
    contributions.push({
      signal: 'geography',
      weight: SIGNAL_WEIGHT.geography,
      detail: `you're in the same geographic scope: ${a.geographicScope}`,
    });
  }

  // 4. Current Action Modes — optional signal (see module doc).
  {
    const { overlap, ratio } = overlapOf(a.activeActionModes, b.activeActionModes);
    if (overlap.length > 0) {
      contributions.push({
        signal: 'currentActionModes',
        weight: SIGNAL_WEIGHT.currentActionModes * ratio,
        detail: `you're both currently in ${overlap.join('/')} mode`,
      });
    }
  }

  // 5. Standing — closeness, never identity/ranking (Standing is a
  // confidence measure, not popularity — inv.polity.162, PRD-FDC-001 §6.1).
  if (typeof a.standingScore === 'number' && typeof b.standingScore === 'number') {
    const delta = Math.abs(a.standingScore - b.standingScore);
    const CLOSENESS_WINDOW = 25;
    if (delta <= CLOSENESS_WINDOW) {
      const closeness = 1 - delta / CLOSENESS_WINDOW;
      contributions.push({
        signal: 'standing',
        weight: SIGNAL_WEIGHT.standing * closeness,
        detail: `you have comparable Standing (${a.standingScore} vs ${b.standingScore})`,
      });
    }
  }

  // 6. Current objectives.
  {
    const { overlap, ratio } = overlapOf(a.currentObjectives, b.currentObjectives);
    if (overlap.length > 0) {
      contributions.push({
        signal: 'currentObjectives',
        weight: SIGNAL_WEIGHT.currentObjectives * ratio,
        detail: `you share an objective: ${overlap.join(', ')}`,
      });
    }
  }

  // 7. Active challenges — no dedicated data source (module doc); only
  // scored when the caller explicitly supplies both sides.
  {
    const { overlap, ratio } = overlapOf(a.activeChallenges, b.activeChallenges);
    if (overlap.length > 0) {
      contributions.push({
        signal: 'activeChallenges',
        weight: SIGNAL_WEIGHT.activeChallenges * ratio,
        detail: `you're facing a shared challenge: ${overlap.join(', ')}`,
      });
    }
  }

  // 8. Shared interests — same caveat as activeChallenges.
  {
    const { overlap, ratio } = overlapOf(a.sharedInterests, b.sharedInterests);
    if (overlap.length > 0) {
      contributions.push({
        signal: 'sharedInterests',
        weight: SIGNAL_WEIGHT.sharedInterests * ratio,
        detail: `you share an interest: ${overlap.join(', ')}`,
      });
    }
  }

  // 9. Constitutional compatibility — Phase 1 PROXY only. Fires as a bonus
  // once at least 3 of the eight named signals above already aligned;
  // ALWAYS labelled as a proxy in its own rationale fragment so it is never
  // mistaken for the ratified Constitutional Coordinates engine's output
  // (PRD-FDC-001 §5's own honest limit, §0.6).
  const priorCount = contributions.length;
  if (priorCount >= 3) {
    contributions.push({
      signal: 'constitutionalCompatibility',
      weight: Math.min(10, priorCount * 2),
      detail:
        `${priorCount} independent signals align (Phase 1 proxy — not the ratified ` +
        `Constitutional Coordinates engine)`,
    });
  }

  const rawScore = contributions.reduce((sum, c) => sum + c.weight, 0);
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  const rationale =
    contributions.length > 0
      ? `I matched you because ${contributions.map((c) => c.detail).join('; ')}.`
      : 'No shared signals surfaced yet across venture stage, industry, geography, action ' +
        'modes, standing, objectives, challenges, or interests.';

  return { score, contributions, rationale };
}

// ─────────────────────────────────────────────────────────────────────────
// Server-only candidate builder — reads real services, never reinvents them.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Assemble a `FoundersClubMatchCandidate` from the real Founder Office /
 * VentureQube / Standing signals PRD-FDC-001 §0.8 names as the read surface
 * this module must consume, not duplicate.
 *
 * Server-only (calls `computeStandingScore`, which takes a Supabase admin
 * client). `activeChallenges` / `sharedInterests` are intentionally left
 * unset — no data source exists for them today (module doc); pass them in
 * via `extra` once a real source exists, without any change to
 * `computeFoundersClubMatch`'s contract.
 */
export async function buildFoundersClubCandidate(
  admin: SupabaseClient,
  personaId: string,
  venture?: VentureQubeRecord | null,
  extra?: {
    activeActionModes?: string[];
    activeChallenges?: string[];
    sharedInterests?: string[];
  },
): Promise<FoundersClubMatchCandidate> {
  const standing = await computeStandingScore(admin, personaId).catch(() => null);
  const objectives =
    venture?.layers?.execution?.phases?.flatMap((p) => p.objectives ?? []) ?? [];

  return {
    ventureStage: venture?.stage ?? null,
    industryTags: venture?.layers?.thesis?.industryTags ?? [],
    geographicScope: venture?.layers?.thesis?.geographicScope ?? null,
    activeActionModes: extra?.activeActionModes ?? [],
    standingScore: standing?.score ?? null,
    currentObjectives: objectives,
    activeChallenges: extra?.activeChallenges ?? [],
    sharedInterests: extra?.sharedInterests ?? [],
  };
}
