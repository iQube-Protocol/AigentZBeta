/**
 * coherentBundleSkill — Invariant-Coherent Bundle Generation (Studio skill).
 *
 * OPERATIONALIZES a proven capability. EXP-001 was the science: it PROVED that
 * one invariant substrate yields a semantically coherent bundle of assets.
 * Production does not re-run the proof — it produces. This skill takes a
 * grounding + a composition spec and generates N mutually-coherent assets
 * (constitutional-video plan + companion article) from ONE shared
 * VideoInvariantBrief, so coherence is BY CONSTRUCTION (the assets literally
 * derive from the same brief object). A cheap, DETERMINISTIC coherence score
 * rides along and feeds the invariant engine — no judge calls on the
 * generation path.
 *
 * Judging is a SEPARATE, opt-in capability (services/skills/bundleJudgement.ts,
 * route action 'judge') — never part of generation, never mandatory. This is
 * the operationalization stage of hypothesis -> research -> reproduce -> ship;
 * it is not experiment land, and no experiment vocabulary belongs in
 * creator-facing copy.
 *
 * COMPOSES, never re-implements:
 *   - buildConstitutionalVideoPlan (constitutionalVideoSkill) — the video plan.
 *   - buildVideoInvariantBrief — the shared substrate for article-only bundles.
 *   - draftArticleFromBrief + alignArticleToBrief (videoArticleSkill /
 *     alignmentService) — the companion article, drafted from the SAME brief.
 *   - validateVideoBriefCoherence (coherence) — the cheap quality signal.
 *   - recordConsequence / citeInvariants — the invariant-engine feedback seam.
 *
 * Receipts + tiering + feedback fire at the ROUTE layer
 * (app/api/skills/coherent-bundle). This module is receipt-free. Server-only.
 */

import {
  buildVideoInvariantBrief,
  type GroundingRef,
  type VideoInvariantBrief,
} from '@/services/video/invariantVideoBrief';
import { validateVideoBriefCoherence } from '@/services/coherence';
import { alignArticleToBrief, type AlignmentReport } from '@/services/content/alignmentService';
import { draftArticleFromBrief, type DraftedArticle } from '@/services/skills/videoArticleSkill';
import {
  buildConstitutionalVideoPlan,
  type ConstitutionalVideoPlan,
  type ConstitutionalCta,
  type ConstitutionalDuration,
  type ContentDirection,
} from '@/services/skills/constitutionalVideoSkill';

/** v1 asset kinds. The union is extensible — no speculative kinds added. */
export type BundleAssetKind = 'constitutional_video_plan' | 'article';

export interface CoherentBundleInput {
  groundings: GroundingRef[];
  /** What the whole bundle is about — shared across every asset (blank canvas). */
  contentDirection: ContentDirection;
  /** Which assets to produce from the ONE shared brief. */
  assets: BundleAssetKind[];
  /** Required iff 'constitutional_video_plan' is requested. */
  video?: { durationSeconds: ConstitutionalDuration; cta: ConstitutionalCta };
  /** Article-only bundles: the brief's segment count (default 4). */
  articleSections?: number;
  productionTitle?: string;
  useLlm?: boolean;
}

/** The cheap, deterministic coherence signal — NO judge calls. */
export interface BundleCoherenceScore {
  method: 'coherence-score/built-in';
  briefCoherence: { constitutionalScore: number | null; pass: boolean } | null;
  grammar: { pass: boolean; violations: number } | null;
  articleAlignment: { score: number; pass: boolean } | null;
  /** Mean of the present numeric signals (0–100), or null if none present. */
  composite: number | null;
  /** True when every PRESENT signal passes (absent signals never fake a pass). */
  pass: boolean;
  /** The grounded invariants this bundle foregrounds — the feedback targets. */
  foregroundedInvariantIds: string[];
}

export interface CoherentBundle {
  brief: VideoInvariantBrief;
  videoPlan: ConstitutionalVideoPlan | null;
  article: DraftedArticle | null;
  alignment: AlignmentReport | null;
  coherence: BundleCoherenceScore;
  totalSeconds: number | null;
  segmentCount: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Pure — canary-pinned in tests/coherent-bundle-skill.test.ts
// ─────────────────────────────────────────────────────────────────────────

/** Grammar → 0–100: a clean pass is 100; each violation costs 20, floored at 0. */
function grammarScore(violations: number, pass: boolean): number {
  return pass ? 100 : Math.max(0, 100 - violations * 20);
}

export function computeBundleCoherence(args: {
  brief: VideoInvariantBrief;
  videoPlan: ConstitutionalVideoPlan | null;
  briefCoherence: { constitutionalScore: number | null; pass: boolean } | null;
  alignment: AlignmentReport | null;
}): BundleCoherenceScore {
  const { brief, videoPlan, briefCoherence, alignment } = args;

  const grammar = videoPlan
    ? { pass: videoPlan.grammar.pass, violations: videoPlan.grammar.violations.length }
    : null;
  const articleAlignment = alignment
    ? { score: Math.round(alignment.score * 100), pass: alignment.pass }
    : null;

  // Present numeric signals, all normalised to 0–100.
  const signals: number[] = [];
  if (briefCoherence?.constitutionalScore != null) signals.push(briefCoherence.constitutionalScore);
  if (grammar) signals.push(grammarScore(grammar.violations, grammar.pass));
  if (articleAlignment) signals.push(articleAlignment.score);
  const composite = signals.length ? Math.round(signals.reduce((a, b) => a + b, 0) / signals.length) : null;

  // pass = every PRESENT verdict passes (absent signals are excluded, never faked).
  const verdicts: boolean[] = [];
  if (briefCoherence) verdicts.push(briefCoherence.pass);
  if (grammar) verdicts.push(grammar.pass);
  if (articleAlignment) verdicts.push(articleAlignment.pass);
  const pass = verdicts.length > 0 && verdicts.every(Boolean);

  const foregroundedInvariantIds = [
    ...new Set([...brief.styleInvariantIds, ...brief.narrativeInvariantIds, ...brief.semanticInvariantIds]),
  ];

  return {
    method: 'coherence-score/built-in',
    briefCoherence,
    grammar,
    articleAlignment,
    composite,
    pass,
    foregroundedInvariantIds,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// The skill
// ─────────────────────────────────────────────────────────────────────────

export async function buildCoherentBundle(input: CoherentBundleInput): Promise<CoherentBundle> {
  if (!input.contentDirection?.subject?.trim()) {
    throw new Error('contentDirection.subject is required — the bundle is a blank canvas');
  }
  if (!Array.isArray(input.assets) || input.assets.length === 0) {
    throw new Error('assets must name at least one asset kind');
  }
  const wantsVideo = input.assets.includes('constitutional_video_plan');
  const wantsArticle = input.assets.includes('article');
  if (wantsVideo && !input.video) {
    throw new Error("video config (durationSeconds + cta) is required for a 'constitutional_video_plan' asset");
  }

  const useLlm = input.useLlm ?? true;

  // 1. The shared substrate. When video is requested the plan owns the brief
  //    (grammar + brief coherence already computed inside); otherwise build the
  //    brief directly for the article.
  let brief: VideoInvariantBrief;
  let videoPlan: ConstitutionalVideoPlan | null = null;
  let briefCoherence: { constitutionalScore: number | null; pass: boolean } | null = null;

  if (wantsVideo && input.video) {
    videoPlan = await buildConstitutionalVideoPlan({
      groundings: input.groundings,
      contentDirection: input.contentDirection,
      durationSeconds: input.video.durationSeconds,
      cta: input.video.cta,
      productionTitle: input.productionTitle,
      useLlm,
    });
    brief = videoPlan.brief;
    briefCoherence = videoPlan.coherence
      ? { constitutionalScore: videoPlan.coherence.constitutionalScore, pass: videoPlan.coherence.pass }
      : null;
  } else {
    const segmentCount = input.articleSections && input.articleSections > 0 ? input.articleSections : 4;
    brief = await buildVideoInvariantBrief({
      groundings: input.groundings,
      segmentCount,
      productionTitle: input.productionTitle ?? input.contentDirection.subject,
      useLlm,
    });
    try {
      const c = await validateVideoBriefCoherence(brief);
      briefCoherence = { constitutionalScore: c.constitutionalScore, pass: c.pass };
    } catch {
      briefCoherence = null;
    }
  }

  // 2. Companion article — drafted from the SAME brief (correspondence is
  //    structural, not aspirational). Alignment measures per-segment coverage.
  let article: DraftedArticle | null = null;
  let alignment: AlignmentReport | null = null;
  if (wantsArticle) {
    article = await draftArticleFromBrief(brief, input.productionTitle ?? input.contentDirection.subject, useLlm);
    if (article.body) {
      alignment = alignArticleToBrief(
        brief.segments.map((s) => ({ index: s.index, beat: s.beat })),
        article.body,
      );
    }
  }

  const coherence = computeBundleCoherence({ brief, videoPlan, briefCoherence, alignment });

  return {
    brief,
    videoPlan,
    article,
    alignment,
    coherence,
    totalSeconds: videoPlan?.totalSeconds ?? null,
    segmentCount: brief.segments.length,
  };
}
