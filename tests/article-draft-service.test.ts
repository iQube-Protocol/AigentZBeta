/**
 * articleDraftService canary (dogfood run 2026-07-13, CS-001 remediation).
 *
 * Pins the extraction: the pure builders moved VERBATIM from the route (the
 * fallback artifact + lenient validation), and the convergence contract —
 * one drafting seam, two presentations, honest degradation on both.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/services/constitutional/modelRouter', () => ({
  callSovereign: vi.fn(async () => {
    throw new Error('provider down');
  }),
}));

import {
  buildFallbackArticleDraftArtifact,
  asArticleDraftArtifact,
  draftArticleArtifact,
  draftCompanionMarkdown,
} from '@/services/composer/articleDraftService';

describe('fallback artifact (moved verbatim from the route)', () => {
  it('builds the deterministic structure from title + prompt', () => {
    const a = buildFallbackArticleDraftArtifact({
      title: 'Test',
      prompt: 'explain the thing',
      outputs: ['takeaways', 'glossary', 'next_action'],
      takeawaysCount: 3,
      mediaMode: 'video',
    });
    expect(a?.title).toBe('Test');
    expect(a?.sections).toHaveLength(3);
    expect(a?.sections[1].heading).toBe('How to watch this');
    expect(a?.takeaways).toHaveLength(3);
    expect(a?.glossary.length).toBeGreaterThan(0);
    expect(a?.nextAction).toBeTruthy();
  });

  it('returns null with neither title nor prompt (never invents)', () => {
    expect(buildFallbackArticleDraftArtifact({ title: null, prompt: null, experienceName: null })).toBeNull();
  });

  it('omits takeaways/glossary/nextAction when not requested', () => {
    const a = buildFallbackArticleDraftArtifact({ title: 'T', prompt: 'p', outputs: [] });
    expect(a?.takeaways).toEqual([]);
    expect(a?.glossary).toEqual([]);
    expect(a?.nextAction).toBeNull();
  });
});

describe('lenient artifact validation (moved verbatim)', () => {
  it('accepts a well-formed artifact and trims fields', () => {
    const a = asArticleDraftArtifact({
      title: ' T ',
      deck: 'd',
      opening: 'o',
      sections: [{ heading: ' h ', body: ' b ' }, { heading: '', body: 'x' }],
      takeaways: ['one', ''],
      glossary: [{ term: ' g ', definition: ' def ' }],
      nextAction: ' go ',
    });
    expect(a?.title).toBe('T');
    expect(a?.sections).toEqual([{ heading: 'h', body: 'b' }]);
    expect(a?.takeaways).toEqual(['one']);
    expect(a?.nextAction).toBe('go');
  });

  it('rejects empty shells', () => {
    expect(asArticleDraftArtifact({ title: 'only a title' })).toBeNull();
    expect(asArticleDraftArtifact('not an object')).toBeNull();
  });
});

describe('honest degradation (provider down)', () => {
  it('structured mode serves the fallback artifact with provider "fallback"', async () => {
    const r = await draftArticleArtifact({ title: 'T', prompt: 'p' });
    expect(r.provider).toBe('fallback');
    expect(r.articleDraft?.title).toBe('T');
  });

  it('companion mode returns null — the caller applies its own fallback', async () => {
    const r = await draftCompanionMarkdown({ systemMandate: 's', userPrompt: 'u' });
    expect(r).toBeNull();
  });
});
