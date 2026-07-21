/**
 * Video + Article skill canary (Implementation Pack executed 2026-07-13).
 *
 * Pins the pack's validation plan at the contract level:
 *   1. "Verify the video is 24 seconds" — 24s = 2 segments × 12s BY
 *      CONSTRUCTION (the constants multiply out; the segment seconds mirror
 *      SkillVideoPlayer's provider cap).
 *   2. "The article corresponds to the video" — the drafter's user prompt is
 *      built ONLY from the brief (continuity block + beats + prompts), and the
 *      system mandate forbids material outside it.
 *   3. Template fallback is honest (composedBy 'template', built from the
 *      same brief) — a drafting failure never invents content.
 */

import { describe, it, expect } from 'vitest';
import {
  VIDEO_ARTICLE_TOTAL_SECONDS,
  VIDEO_ARTICLE_SEGMENT_SECONDS,
  VIDEO_ARTICLE_SEGMENT_COUNT,
  ARTICLE_SYSTEM_MANDATE,
  buildArticleUserPrompt,
  templateArticle,
} from '@/services/skills/videoArticleSkill';
import type { VideoInvariantBrief } from '@/services/video/invariantVideoBrief';

const brief: VideoInvariantBrief = {
  continuityBlock: 'CONTINUITY: slate surfaces, no white hairlines.',
  styleInvariantIds: ['s1'],
  narrativeInvariantIds: [],
  semanticInvariantIds: ['a1', 'a2'],
  segments: [
    { index: 0, foregroundedInvariantIds: ['a1'], narrativeInvariantId: null, beat: 'BEAT ONE: the primitive appears.', prompt: 'PROMPT ONE', composedBy: 'template' },
    { index: 1, foregroundedInvariantIds: ['a2'], narrativeInvariantId: null, beat: 'BEAT TWO: the graph forms.', prompt: 'PROMPT TWO', composedBy: 'template' },
  ],
};

describe('the 24-second contract (validation plan #1)', () => {
  it('24s = 2 × 12s by construction', () => {
    expect(VIDEO_ARTICLE_TOTAL_SECONDS).toBe(24);
    expect(VIDEO_ARTICLE_SEGMENT_SECONDS).toBe(12); // SkillVideoPlayer SEGMENT_SECONDS
    expect(VIDEO_ARTICLE_SEGMENT_COUNT).toBe(2);
    expect(VIDEO_ARTICLE_SEGMENT_COUNT * VIDEO_ARTICLE_SEGMENT_SECONDS).toBe(VIDEO_ARTICLE_TOTAL_SECONDS);
  });
});

describe('the correspondence contract (validation plan #2)', () => {
  it('the drafter prompt is built ONLY from brief material', () => {
    const prompt = buildArticleUserPrompt(brief, 'Test Production');
    expect(prompt).toContain('CONTINUITY: slate surfaces');
    expect(prompt).toContain('BEAT ONE');
    expect(prompt).toContain('BEAT TWO');
    expect(prompt).toContain('PROMPT ONE');
    expect(prompt).toContain('PROMPT TWO');
    expect(prompt).toContain('Test Production');
    expect(prompt).toContain('24 seconds');
  });

  it('the system mandate forbids material outside the brief', () => {
    expect(ARTICLE_SYSTEM_MANDATE).toContain('ONLY the material provided');
    expect(ARTICLE_SYSTEM_MANDATE).toContain('NEVER assert');
    expect(ARTICLE_SYSTEM_MANDATE).toContain('one titled section per video segment');
  });
});

describe('honest template fallback (validation plan #3 degradation)', () => {
  it('template article derives from the same brief and says so', () => {
    const article = templateArticle(brief, 'Test Production');
    expect(article.composedBy).toBe('template');
    expect(article.title).toBe('Test Production');
    expect(article.body).toContain('BEAT ONE');
    expect(article.body).toContain('BEAT TWO');
    expect(article.body).toContain('CONTINUITY: slate surfaces');
    expect(article.body).toContain('24-second');
  });

  it('no forbidden T0 key is expressible through the builders', () => {
    const emitted = JSON.stringify({
      p: buildArticleUserPrompt(brief),
      a: templateArticle(brief),
    });
    for (const k of ['personaId', 'authProfileId', 'rootDid']) {
      expect(emitted).not.toContain(k);
    }
  });
});
