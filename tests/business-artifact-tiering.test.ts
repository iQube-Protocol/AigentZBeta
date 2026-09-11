/**
 * businessArtifactTiering canary (CFS-025 increment 3).
 *
 * Pins the PURE classification map for AgentMe's business-artifact production:
 * a gmail draft is disposable (never persisted); docs/sheets/slides/calendar
 * are operational; NOTHING is born constitutional (business artifacts are
 * promoted by the operator later, never birthed canonical). The impure record
 * path (Supabase) is best-effort and exercised by a post-deploy drive, not here.
 */

import { describe, it, expect } from 'vitest';
import { classifyBusinessArtifact } from '@/services/artifact/businessArtifactTiering';

describe('businessArtifactTiering — the pinned classification map', () => {
  it('a gmail draft is disposable — scratch until sent, never persisted', () => {
    expect(classifyBusinessArtifact('google.gmail.draft')).toEqual({
      profile: 'documentation',
      consequenceClass: 'disposable',
    });
  });

  it('docs, sheets, and calendar events are operational documentation', () => {
    expect(classifyBusinessArtifact('google.drive.create-doc')).toEqual({
      profile: 'documentation',
      consequenceClass: 'operational',
    });
    expect(classifyBusinessArtifact('google.sheets.create')).toEqual({
      profile: 'documentation',
      consequenceClass: 'operational',
    });
    expect(classifyBusinessArtifact('google.calendar.create-event')).toEqual({
      profile: 'documentation',
      consequenceClass: 'operational',
    });
  });

  it('a slides deck is an operational presentation', () => {
    expect(classifyBusinessArtifact('google.slides.create')).toEqual({
      profile: 'presentation',
      consequenceClass: 'operational',
    });
  });

  it('an unknown connector falls to disposable — never persist the unnamed', () => {
    expect(classifyBusinessArtifact('some.future.connector').consequenceClass).toBe('disposable');
    expect(classifyBusinessArtifact('').consequenceClass).toBe('disposable');
  });

  it('NOTHING is born constitutional — promotion is a later, deliberate act', () => {
    const ids = [
      'google.gmail.draft',
      'google.drive.create-doc',
      'google.sheets.create',
      'google.slides.create',
      'google.calendar.create-event',
      'anything.else',
    ];
    for (const id of ids) {
      expect(classifyBusinessArtifact(id).consequenceClass).not.toBe('constitutional');
    }
  });
});
