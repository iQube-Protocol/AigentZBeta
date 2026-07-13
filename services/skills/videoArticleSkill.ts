/**
 * videoArticleSkill — the 24-second video + corresponding article skill
 * (Implementation Pack "Develop a skill that generates a 24-second video and a
 * corresponding article", executed 2026-07-13 per CFS-015).
 *
 * COMPOSES, never re-implements (Extend-Don't-Duplicate):
 *   - `buildVideoInvariantBrief` (services/video/invariantVideoBrief.ts) — the
 *     invariant-grounded per-segment brief (CFS-011/012).
 *   - `validateVideoBriefCoherence` (services/coherence) — the quality gate the
 *     pack's validation plan names ("meet quality standards").
 *   - `callSovereign('draft', …)` (services/constitutional/modelRouter.ts) —
 *     sovereign, invariant-governed drafting for the article.
 *   - The (fixed) SkillVideoPlayer produces + stitches the actual clips
 *     client-side, exactly as the EXP-002 runner does.
 *
 * THE 24-SECOND CONTRACT: SkillVideoPlayer generates ≤12-second clips
 * (SEGMENT_SECONDS = 12, provider cap) and stitches them. 24 seconds is
 * therefore EXACTLY 2 segments × 12s — the brief is built at segmentCount 2
 * and the player is driven at duration 24. The validation plan's "verify the
 * video is 24 seconds" holds by construction: 2 prompts, 2 clips, one stitch.
 *
 * THE CORRESPONDENCE CONTRACT: the article is drafted from the SAME brief the
 * video segments are generated from — same continuity block, same beats, same
 * invariant markers. The drafter is mandated to write ONLY from that material
 * (No-Guessing applied to prose), so "the article corresponds to the video"
 * is structural, not aspirational.
 *
 * Receipts (the pack's receipt plan) are emitted at the ROUTE layer
 * (app/api/skills/video-article): one on article generation, one on video
 * completion. This module stays receipt-free and drillable.
 */

import {
  buildVideoInvariantBrief,
  type GroundingRef,
  type VideoInvariantBrief,
} from '@/services/video/invariantVideoBrief';
import { validateVideoBriefCoherence } from '@/services/coherence';
import { callSovereign } from '@/services/constitutional/modelRouter';

/** The skill's fixed production length (the pack's goal). */
export const VIDEO_ARTICLE_TOTAL_SECONDS = 24;
/** Provider clip cap mirrored from SkillVideoPlayer (SEGMENT_SECONDS = 12). */
export const VIDEO_ARTICLE_SEGMENT_SECONDS = 12;
/** 24s ÷ 12s — the brief's segment count, by construction. */
export const VIDEO_ARTICLE_SEGMENT_COUNT = VIDEO_ARTICLE_TOTAL_SECONDS / VIDEO_ARTICLE_SEGMENT_SECONDS;

export interface VideoArticlePlanInput {
  groundings: GroundingRef[];
  productionTitle?: string;
  /** false forces the deterministic template path (tests / no provider key). */
  useLlm?: boolean;
}

export interface DraftedArticle {
  title: string;
  /** Markdown body — headline + standfirst + one section per video segment. */
  body: string;
  composedBy: 'llm' | 'template';
  provider?: string;
  model?: string;
  sovereignFloor?: boolean;
}

export interface VideoArticlePlan {
  brief: VideoInvariantBrief;
  article: DraftedArticle;
  coherence: Awaited<ReturnType<typeof validateVideoBriefCoherence>> | null;
  totalSeconds: number;
  segmentCount: number;
  segmentSeconds: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Pure prompt builders (canary-pinned in tests/video-article-skill.test.ts)
// ─────────────────────────────────────────────────────────────────────────

/** The drafter's system mandate — the article may use ONLY brief material. */
export const ARTICLE_SYSTEM_MANDATE =
  'You write a short companion article for a multi-segment generated video. ' +
  'You may use ONLY the material provided: the continuity block, the per-segment beats and prompts, ' +
  'and the invariant markers. You NEVER assert a claim, fact, or principle that is not in that material. ' +
  'Structure: a headline, a one-sentence standfirst, one titled section per video segment (in segment order, ' +
  'each section describing what that segment shows and the principle it dramatizes), and a one-paragraph close. ' +
  'Markdown. 250-450 words. No preamble, no meta-commentary.';

/** Fold the brief into the drafter's user prompt. Pure + deterministic. */
export function buildArticleUserPrompt(brief: VideoInvariantBrief, productionTitle?: string): string {
  const segments = brief.segments
    .map(
      (s) =>
        `Segment ${s.index + 1} of ${brief.segments.length} (${VIDEO_ARTICLE_SEGMENT_SECONDS}s)\n` +
        `Beat:\n${s.beat}\n` +
        `Visual prompt:\n${s.prompt}`,
    )
    .join('\n\n---\n\n');
  return [
    productionTitle ? `Production title: ${productionTitle}` : null,
    `Total runtime: ${VIDEO_ARTICLE_TOTAL_SECONDS} seconds (${brief.segments.length} segments).`,
    `Continuity block (applies to every segment):\n${brief.continuityBlock}`,
    segments,
    'Write the companion article now.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Deterministic template article — the honest no-LLM fallback (mirrors the
 *  brief generator's own template path). Pure. */
export function templateArticle(brief: VideoInvariantBrief, productionTitle?: string): DraftedArticle {
  const title = productionTitle?.trim() || 'A 24-second production';
  const sections = brief.segments
    .map((s) => `## Segment ${s.index + 1}\n\n${s.beat}`)
    .join('\n\n');
  return {
    title,
    body: `# ${title}\n\n_A ${VIDEO_ARTICLE_TOTAL_SECONDS}-second production in ${brief.segments.length} segments._\n\n${sections}\n\n---\n\n${brief.continuityBlock}`,
    composedBy: 'template',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// The skill
// ─────────────────────────────────────────────────────────────────────────

/** Draft the corresponding article from the SAME brief the video uses. */
export async function draftArticleFromBrief(
  brief: VideoInvariantBrief,
  productionTitle?: string,
  useLlm = true,
): Promise<DraftedArticle> {
  if (!useLlm) return templateArticle(brief, productionTitle);
  try {
    const result = await callSovereign(
      'draft',
      ARTICLE_SYSTEM_MANDATE,
      buildArticleUserPrompt(brief, productionTitle),
      1400,
      0.4,
    );
    const body = result.text?.trim();
    if (!body) return templateArticle(brief, productionTitle);
    return {
      title: productionTitle?.trim() || body.split('\n')[0].replace(/^#+\s*/, '').slice(0, 120),
      body,
      composedBy: 'llm',
      provider: result.provider,
      model: result.model,
      sovereignFloor: result.sovereignFloor,
    };
  } catch {
    // Honest fallback — a drafting failure never sinks the plan.
    return templateArticle(brief, productionTitle);
  }
}

/**
 * Build the full plan: the 2-segment/24s invariant-grounded brief, its
 * coherence validation (quality gate), and the corresponding article drafted
 * from the same brief. The caller drives SkillVideoPlayer with
 * `duration: totalSeconds` + `segment_prompts` from the brief.
 */
export async function buildVideoArticlePlan(input: VideoArticlePlanInput): Promise<VideoArticlePlan> {
  const brief = await buildVideoInvariantBrief({
    groundings: input.groundings,
    segmentCount: VIDEO_ARTICLE_SEGMENT_COUNT,
    productionTitle: input.productionTitle,
    useLlm: input.useLlm,
  });

  // Quality gate (validation plan #3) — best-effort: an evaluator failure
  // degrades to null, never fakes a pass.
  let coherence: VideoArticlePlan['coherence'] = null;
  try {
    coherence = await validateVideoBriefCoherence(brief);
  } catch {
    coherence = null;
  }

  const article = await draftArticleFromBrief(brief, input.productionTitle, input.useLlm ?? true);

  return {
    brief,
    article,
    coherence,
    totalSeconds: VIDEO_ARTICLE_TOTAL_SECONDS,
    segmentCount: VIDEO_ARTICLE_SEGMENT_COUNT,
    segmentSeconds: VIDEO_ARTICLE_SEGMENT_SECONDS,
  };
}
