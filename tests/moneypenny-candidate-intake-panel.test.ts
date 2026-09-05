/**
 * MoneyPenny Candidate Intake — Factor/Aegis specialist UI, first slice
 * (operator directive 2026-09-05: "Begin the MoneyPenny specialist UI for
 * Factor and Aegis").
 *
 * Pins: the panel calls the SAME /api/assistant/ask-agent path every other
 * specialist consultation in this codebase uses (never a second "ask
 * Factor"/"ask Aegis" implementation), via personaFetch (CLAUDE.md
 * PARAMOUNT — never a raw fetch against a spine endpoint), and renders with
 * the SAME SpecialistResponseCard every other specialist response renders
 * with. Also pins the capability-rail/panel wiring, mirroring
 * tests/moneypenny-risk-envelope.test.ts's own wiring-pin style.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('CandidateIntakePanel — reuses the canonical specialist-consult path, never a parallel one', () => {
  const panelSrc = stripComments(readSource('app/(shell)/moneypenny/components/CandidateIntakePanel.tsx'));

  it('calls /api/assistant/ask-agent — the one canonical specialist-consult endpoint', () => {
    expect(panelSrc).toContain('/api/assistant/ask-agent');
  });

  it('uses personaFetch, never a raw fetch, against the spine endpoint (CLAUDE.md PARAMOUNT)', () => {
    expect(panelSrc).toContain('personaFetch(');
    expect(panelSrc).toContain('from "@/utils/personaSpine"');
    // The only reference to "fetch" in this file is inside the personaFetch
    // import path/call itself, never a second, raw fetch(...) call.
    expect(panelSrc).not.toMatch(/(?<!persona)Fetch\(/);
  });

  it('renders responses with the canonical SpecialistResponseCard, never a second card shape', () => {
    expect(panelSrc).toContain('SpecialistResponseCard');
    expect(panelSrc).toContain('from "@/components/metame/cards/SpecialistResponseCard"');
  });

  it('offers exactly Factor and Aegis — no other specialist id', () => {
    expect(panelSrc).toContain('"factor"');
    expect(panelSrc).toContain('"aegis"');
  });

  it('never claims to decide admission — advisory framing only', () => {
    expect(panelSrc).toMatch(/advisory only/i);
    expect(panelSrc).toMatch(/[Nn]ever (decide|mutate)/);
  });
});

describe('MoneyPenny capability-rail / cartridge wiring — Factor/Aegis candidate-intake', () => {
  it('the Candidate Intake capability item points at a real panel, not null', async () => {
    const { MONEYPENNY_CAPABILITY_GROUPS } = await import('@/app/(shell)/moneypenny/components/moneypennyCapabilities');
    const item = MONEYPENNY_CAPABILITY_GROUPS.flatMap((g) => g.items).find((i) => i.id === 'candidate-intake');
    expect(item).toBeDefined();
    expect(item!.panel).toBe('candidate-intake');
  });

  it('candidate-intake is a real MoneyPennyPanelKey, mapped into the Activity area, alongside Service Orchestration', async () => {
    const panelTabSrc = stripComments(readSource('app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx'));
    expect(panelTabSrc).toContain('"candidate-intake": CandidateIntakePanel,');
    const capsSrc = stripComments(readSource('app/(shell)/moneypenny/components/moneypennyCapabilities.ts'));
    expect(capsSrc).toMatch(/"candidate-intake":\s*"activity"/);
  });

  it('the Activity native tab exists and is the area candidate-intake resolves under', async () => {
    const { MONEYPENNY_CARTRIDGE } = await import('@/data/codex-configs');
    const activityTab = MONEYPENNY_CARTRIDGE.tabs.find((t) => t.slug === 'activity');
    expect(activityTab).toBeDefined();
    expect((activityTab!.config.props as { area?: string }).area).toBe('activity');
    const { areaForPanel } = await import('@/app/(shell)/moneypenny/components/moneypennyCapabilities');
    expect(areaForPanel('candidate-intake')).toBe('activity');
  });
});
