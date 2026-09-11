/**
 * draftVentureReport — Gate D artifact generation for the AigentMe
 * Venture Report Brief. Pins that the drafter (a) never invents data —
 * everything in the body traces back to a field on the live
 * VentureProgressShape it was handed, (b) respects the operator's
 * scope selection, and (c) gates the Blockers section on
 * includeExperimental so a report scoped to "just the highlights"
 * doesn't surface at-risk items the operator didn't ask to see.
 */
import { describe, it, expect } from 'vitest';
import { draftVentureReport } from '@/services/venture/ventureReportDrafter';
import type { VentureReportBriefSpec } from '@/types/deliberativeArtifact';
import type { VentureProgressShape } from '@/services/orchestration/ventureProgressBuilder';

function baseProgress(overrides: Partial<VentureProgressShape> = {}): VentureProgressShape {
  return {
    generatedAt: new Date().toISOString(),
    ventureName: 'Aigent-Mondai',
    primaryGoal: 'Ship the alpha',
    currentStage: 'alpha_activation' as VentureProgressShape['currentStage'],
    experienceConfigured: true,
    linkedCartridges: ['metame'] as VentureProgressShape['linkedCartridges'],
    kpiSummary: { activeKpisCount: 0, operationalGoalsCount: 0, commercialGoalsCount: 0 } as VentureProgressShape['kpiSummary'],
    activeKpis: [],
    operationalGoalsCount: 2,
    commercialGoalsCount: 1,
    recentActivity: [],
    standingSignals: [],
    blockersCount: 3,
    recommendedActions: [],
    suggestedArtifacts: [],
    using: ['PersonaQube'],
    notShared: [],
    venturePublicRef: null,
    thesisSummary: null,
    signalSummary: null,
    operatingObjectives: [],
    nvaTotal: 12,
    standingGovScore: 80,
    ...overrides,
  } as VentureProgressShape;
}

function baseSpec(overrides: Partial<VentureReportBriefSpec> = {}): VentureReportBriefSpec {
  return {
    purpose: 'internal',
    disclosure: 'internal',
    scope: ['product', 'commercial'],
    periodStart: 'current',
    ...overrides,
  };
}

describe('draftVentureReport', () => {
  it('titles the report from the venture name and purpose, never a placeholder', () => {
    const draft = draftVentureReport({ briefSpec: baseSpec(), progress: baseProgress() });
    expect(draft.title).toBe('Aigent-Mondai — Internal Review');
    expect(draft.source).toBe('template');
    expect(draft.shareSuggestions).toEqual([]);
  });

  it('falls back to a generic subject when no venture name is resolved — never fabricates one', () => {
    const draft = draftVentureReport({ briefSpec: baseSpec(), progress: baseProgress({ ventureName: null }) });
    expect(draft.title).toBe('Venture — Internal Review');
  });

  it('only renders sections for scopes the operator actually selected', () => {
    const draft = draftVentureReport({
      briefSpec: baseSpec({ scope: ['commercial'] }),
      progress: baseProgress({ thesisSummary: { mission: 'Do the thing', problem: 'The problem' } }),
    });
    expect(draft.bodyText).toContain('KEY PERFORMANCE INDICATORS');
    expect(draft.bodyText).not.toContain('THESIS');
    expect(draft.bodyText).not.toContain('Do the thing');
  });

  it('includes the thesis section when product scope is selected and a thesis exists', () => {
    const draft = draftVentureReport({
      briefSpec: baseSpec({ scope: ['product'] }),
      progress: baseProgress({ thesisSummary: { mission: 'Do the thing', problem: 'The problem' } }),
    });
    expect(draft.bodyText).toContain('THESIS');
    expect(draft.bodyText).toContain('Do the thing');
  });

  it('omits the Blockers section when includeExperimental is explicitly false', () => {
    const draft = draftVentureReport({
      briefSpec: baseSpec({ includeExperimental: false }),
      progress: baseProgress({ blockersCount: 5 }),
    });
    expect(draft.bodyText).not.toContain('BLOCKERS');
  });

  it('includes the Blockers section by default when there are blockers', () => {
    const draft = draftVentureReport({ briefSpec: baseSpec(), progress: baseProgress({ blockersCount: 5 }) });
    expect(draft.bodyText).toContain('BLOCKERS');
    expect(draft.bodyText).toContain('5 item(s)');
  });

  it('omits the Blockers section entirely when there are none, rather than printing a zero', () => {
    const draft = draftVentureReport({ briefSpec: baseSpec(), progress: baseProgress({ blockersCount: 0 }) });
    expect(draft.bodyText).not.toContain('BLOCKERS');
  });

  it('produces plain text only — no Markdown headers or bold markers', () => {
    const draft = draftVentureReport({ briefSpec: baseSpec(), progress: baseProgress() });
    expect(draft.bodyText).not.toMatch(/^#/m);
    expect(draft.bodyText).not.toMatch(/\*\*/);
  });
});
