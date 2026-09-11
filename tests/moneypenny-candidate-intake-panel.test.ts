/**
 * MoneyPenny Aigent Factor / Aegis specialist surfaces (specialist-surfaces
 * separation, operator directive 2026-09-05: "Separate Aigent Factor and
 * Aegis into first-class specialist surfaces inside the MoneyPenny
 * cartridge").
 *
 * Supersedes the prior combined-panel canary
 * (tests/moneypenny-candidate-intake-panel.test.ts's own history) now that
 * CandidateIntakePanel.tsx no longer exists — FactorPanel.tsx and
 * AegisPanel.tsx are the two first-class destinations, both built on the
 * ONE reusable SpecialistWorkspace primitive (never a per-specialist
 * FactorChat/AegisChat fork).
 *
 * Pins: both panels call the SAME /api/assistant/ask-agent path every other
 * specialist consultation in this codebase uses (via personaFetch,
 * CLAUDE.md PARAMOUNT — never a raw fetch against a spine endpoint), and
 * render through the SAME SpecialistResponseCard every other specialist
 * response renders with.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('SpecialistWorkspace — the one reusable specialist conversation primitive', () => {
  const src = stripComments(readSource('app/(shell)/moneypenny/components/specialistWorkspace/SpecialistWorkspace.tsx'));

  it('calls /api/assistant/ask-agent — the one canonical specialist-consult endpoint', () => {
    expect(src).toContain('/api/assistant/ask-agent');
  });

  it('uses personaFetch, never a raw fetch, against the spine endpoint (CLAUDE.md PARAMOUNT)', () => {
    expect(src).toContain('personaFetch(');
    expect(src).toContain('from "@/utils/personaSpine"');
  });

  it('renders responses with the canonical SpecialistResponseCard, never a second card shape', () => {
    expect(src).toContain('SpecialistResponseCard');
    expect(src).toContain('from "@/components/metame/cards/SpecialistResponseCard"');
  });

  it('supports Enter-to-submit / Shift+Enter-for-newline composer semantics', () => {
    expect(src).toMatch(/e\.key === "Enter" && !e\.shiftKey/);
  });

  it('persists the conversation (append-only) via the shared thread store, never an ad hoc storage key', () => {
    expect(src).toContain('specialistThreadKey');
    expect(src).toContain('loadThread');
    expect(src).toContain('saveThread');
  });
});

describe('FactorPanel and AegisPanel both build on SpecialistWorkspace — no per-specialist fork', () => {
  const factorSrc = stripComments(readSource('app/(shell)/moneypenny/components/FactorPanel.tsx'));
  const aegisSrc = stripComments(readSource('app/(shell)/moneypenny/components/AegisPanel.tsx'));

  it('FactorPanel never claims to decide admission — advisory framing only, and defers admission to MoneyPenny', () => {
    expect(factorSrc).toContain('SpecialistWorkspace');
    expect(factorSrc).toMatch(/advisory only|Advisory guidance/i);
    expect(factorSrc).toMatch(/MoneyPenny admission decision/);
  });

  it('AegisPanel never renders an admission-decision control — that authority belongs to MoneyPenny alone', () => {
    expect(aegisSrc).toContain('SpecialistWorkspace');
    expect(aegisSrc).not.toMatch(/decide-admission/);
    expect(aegisSrc).toMatch(/admission decision is made in Aigent\s+Factor/);
  });

  it('there is no second, parallel CandidateIntakePanel left in the codebase', () => {
    expect(() => readSource('app/(shell)/moneypenny/components/CandidateIntakePanel.tsx')).toThrow();
  });
});

describe('MoneyPenny capability-rail / cartridge wiring — Aigent Factor and Aegis as separate destinations', () => {
  it('Aigent Factor and Aegis are each their own capability item, pointing at their own panel — never a shared combined destination', async () => {
    const { MONEYPENNY_CAPABILITY_GROUPS } = await import('@/app/(shell)/moneypenny/components/moneypennyCapabilities');
    const items = MONEYPENNY_CAPABILITY_GROUPS.flatMap((g) => g.items);
    const factorItem = items.find((i) => i.id === 'factor');
    const aegisItem = items.find((i) => i.id === 'aegis');
    expect(factorItem).toBeDefined();
    expect(aegisItem).toBeDefined();
    expect(factorItem!.panel).toBe('factor');
    expect(aegisItem!.panel).toBe('aegis');
    expect(factorItem!.panel).not.toBe(aegisItem!.panel);
    // The prior combined destination no longer exists.
    expect(items.some((i) => i.id === 'candidate-intake')).toBe(false);
  });

  it('"factor" and "aegis" are real MoneyPennyPanelKey values, each mapped into the Activity area', async () => {
    const panelTabSrc = stripComments(readSource('app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx'));
    expect(panelTabSrc).toContain('factor: FactorPanel,');
    expect(panelTabSrc).toContain('aegis: AegisPanel,');
    const { areaForPanel } = await import('@/app/(shell)/moneypenny/components/moneypennyCapabilities');
    expect(areaForPanel('factor')).toBe('activity');
    expect(areaForPanel('aegis')).toBe('activity');
  });

  it('the Activity native tab exists and is the area Factor/Aegis resolve under', async () => {
    const { MONEYPENNY_CARTRIDGE } = await import('@/data/codex-configs');
    const activityTab = MONEYPENNY_CARTRIDGE.tabs.find((t) => t.slug === 'activity');
    expect(activityTab).toBeDefined();
    expect((activityTab!.config.props as { area?: string }).area).toBe('activity');
  });

  it('the Home specialist cards target Factor\'s and Aegis\'s own panels, not a shared one', async () => {
    const { MONEYPENNY_SPECIALIST_CARDS } = await import('@/app/(shell)/moneypenny/components/moneypennyCapabilities');
    const factorCard = MONEYPENNY_SPECIALIST_CARDS.find((c) => c.id === 'factor');
    const aegisCard = MONEYPENNY_SPECIALIST_CARDS.find((c) => c.id === 'aegis');
    expect(factorCard!.panel).toBe('factor');
    expect(aegisCard!.panel).toBe('aegis');
  });
});
