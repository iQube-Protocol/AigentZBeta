/**
 * studioArtifactTiering canary (CVR-002).
 *
 * Pins the PURE classification map for Studio Composer's productions: a
 * completed image set / stitched video / immediately-completed generation is
 * operational multimedia; a completed prompted article draft is operational
 * documentation; simulated / failed / unprompted / merely-submitted
 * productions are disposable (never persisted); NOTHING is born
 * constitutional (Studio productions are promoted by the operator later,
 * never birthed canonical); unknown kinds fall to disposable. Also pins the
 * record-body builder's T0-inexpressibility: whitelist-copy only, verified
 * with findForbiddenObjectKey. The impure record path (Supabase) is
 * best-effort and exercised by a post-deploy drive, not here.
 */

import { describe, it, expect } from 'vitest';
import { classifyStudioArtifact, buildStudioRecordBody } from '@/services/composer/studioArtifactTiering';
import { findForbiddenObjectKey } from '@/types/constitutionalObject';

describe('studioArtifactTiering — the pinned classification map', () => {
  it('completed durable media is operational multimedia', () => {
    expect(classifyStudioArtifact('studio.image.set.completed')).toEqual({
      profile: 'multimedia',
      consequenceClass: 'operational',
    });
    expect(classifyStudioArtifact('studio.video.generation.completed')).toEqual({
      profile: 'multimedia',
      consequenceClass: 'operational',
    });
    expect(classifyStudioArtifact('studio.video.stitch.completed')).toEqual({
      profile: 'multimedia',
      consequenceClass: 'operational',
    });
  });

  it('a completed prompted article draft is operational documentation', () => {
    expect(classifyStudioArtifact('studio.article.draft.completed')).toEqual({
      profile: 'documentation',
      consequenceClass: 'operational',
    });
  });

  it('simulated, failed, unprompted, and merely-submitted productions are disposable — never persisted', () => {
    for (const kind of [
      'studio.image.set.simulated',
      'studio.article.draft.unprompted',
      'studio.article.draft.failed',
      'studio.video.generation.submitted',
      'studio.video.generation.simulated',
    ]) {
      expect(classifyStudioArtifact(kind).consequenceClass).toBe('disposable');
    }
  });

  it('an unknown kind falls to disposable — never persist the unnamed', () => {
    expect(classifyStudioArtifact('some.future.production').consequenceClass).toBe('disposable');
    expect(classifyStudioArtifact('').consequenceClass).toBe('disposable');
  });

  it('NOTHING is born constitutional — promotion is a later, deliberate act', () => {
    const kinds = [
      'studio.image.set.completed',
      'studio.image.set.simulated',
      'studio.article.draft.completed',
      'studio.article.draft.unprompted',
      'studio.article.draft.failed',
      'studio.video.generation.submitted',
      'studio.video.generation.simulated',
      'studio.video.generation.completed',
      'studio.video.stitch.completed',
      'anything.else',
    ];
    for (const kind of kinds) {
      expect(classifyStudioArtifact(kind).consequenceClass).not.toBe('constitutional');
    }
  });
});

describe('buildStudioRecordBody — T0-inexpressible by construction', () => {
  it('whitelist-copies named fields only: smuggled T0 keys are dropped', () => {
    const body = buildStudioRecordBody({
      kind: 'studio.image.set.completed',
      prompt: 'a slate skyline at dusk',
      provider: 'venice',
      model: 'venice-sd35',
      title: 'Skyline set',
      outputs: [{ url: 'https://storage.example/img.png', orientation: 'portrait' }],
      // Hostile extra properties — the builder must NOT copy these.
      ...( {
        personaId: 'p-000',
        authProfileId: 'a-000',
        rootDid: 'did:fio:000',
      } as unknown as Record<string, never>),
    });
    const parsed = JSON.parse(body);
    expect(findForbiddenObjectKey(parsed)).toBeNull();
    expect(parsed.prompt).toBe('a slate skyline at dusk');
    expect(parsed.outputs[0].url).toBe('https://storage.example/img.png');
    expect('personaId' in parsed).toBe(false);
  });

  it('nested output refs carry only url / orientation / label pointers', () => {
    const parsed = JSON.parse(
      buildStudioRecordBody({
        kind: 'studio.video.stitch.completed',
        outputs: [
          {
            url: 'https://storage.example/stitched.mp4',
            ...({ personaId: 'p-111' } as unknown as Record<string, never>),
          },
        ],
        stitchId: 'abc123',
        segments: 2,
      }),
    );
    expect(findForbiddenObjectKey(parsed)).toBeNull();
    expect(parsed.outputs).toEqual([
      { url: 'https://storage.example/stitched.mp4', orientation: null, label: null },
    ]);
    expect(parsed.segments).toBe(2);
  });

  it('carries the content-alignment verdict when present, whitelist-copied (remedy 2026-07-15 #2)', () => {
    const parsed = JSON.parse(
      buildStudioRecordBody({
        kind: 'studio.article.draft.completed',
        title: 'The Invariant Primitive, in 24 seconds',
        prompt: 'A continuity block',
        alignment: {
          score: 0.91,
          pass: true,
          basis: 'heuristic',
          segmentCoverage: [0.88, 0.94],
          // Hostile extra property — must not survive the whitelist copy.
          ...({ personaId: 'p-222' } as unknown as Record<string, never>),
        },
      }),
    );
    expect(findForbiddenObjectKey(parsed)).toBeNull();
    expect(parsed.alignment).toEqual({
      score: 0.91,
      pass: true,
      basis: 'heuristic',
      segmentCoverage: [0.88, 0.94],
    });
    expect('personaId' in parsed.alignment).toBe(false);
  });

  it('alignment is null for productions that carry none', () => {
    const parsed = JSON.parse(
      buildStudioRecordBody({ kind: 'studio.image.set.completed', prompt: 'a skyline' }),
    );
    expect(parsed.alignment).toBeNull();
  });
});
