import { describe, it, expect } from 'vitest';
import {
  isHorizenTrigger,
  JOURNEY_INTRO_TEXT,
  VENTURE_LAB_CODEX_ID,
  VENTURE_LAB_CODEX_SLUG,
  PARTNER_JOURNEY_TAB_SLUG,
} from '@/services/journey/journeyCompanionTrigger';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { VENTURE_LAB_CODEX } from '@/data/codex-configs';

// PRD-GJR-001 §11.4 — the canonical Companion trigger. Recognition is a pure
// string check (no window/DOM dependency), so it's testable without jsdom,
// unlike focusJourneyStage's dispatch/navigation side effects (manually
// verified per CLAUDE.md's UI-change testing rule — this repo has no jsdom
// test precedent to extend for that half).

describe('isHorizenTrigger — the canonical Companion trigger', () => {
  it('recognizes the exact word, case-insensitively', () => {
    expect(isHorizenTrigger('Horizen')).toBe(true);
    expect(isHorizenTrigger('horizen')).toBe(true);
    expect(isHorizenTrigger('HORIZEN')).toBe(true);
  });

  it('tolerates surrounding whitespace only', () => {
    expect(isHorizenTrigger('  horizen  ')).toBe(true);
    expect(isHorizenTrigger('\nHorizen\n')).toBe(true);
  });

  it('does not fire on a near-miss — this is a fixed trigger, not a fuzzy intent match', () => {
    expect(isHorizenTrigger('horizen please')).toBe(false);
    expect(isHorizenTrigger('tell me about horizen')).toBe(false);
    expect(isHorizenTrigger('horizen?')).toBe(false);
    expect(isHorizenTrigger('')).toBe(false);
  });
});

describe('journey trigger constants stay consistent with the live registry', () => {
  it('the Venture Lab codex id/slug the trigger navigates to actually exist', () => {
    expect(VENTURE_LAB_CODEX.id).toBe(VENTURE_LAB_CODEX_ID);
    expect(VENTURE_LAB_CODEX.slug).toBe(VENTURE_LAB_CODEX_SLUG);
  });

  it('the Partner Journey tab slug the trigger navigates to is a real, enabled tab', () => {
    const tab = VENTURE_LAB_CODEX.tabs.find((t: { slug: string }) => t.slug === PARTNER_JOURNEY_TAB_SLUG);
    expect(tab, 'partner-pilot-journey tab was renamed/removed — update the trigger target').toBeTruthy();
  });

  it('the intro copy names all seven stages, in order, and nothing else', () => {
    for (const stage of HORIZEN_MONEYPENNY_JOURNEY.stages) {
      expect(JOURNEY_INTRO_TEXT).toContain(stage.label);
    }
    expect(HORIZEN_MONEYPENNY_JOURNEY.stages).toHaveLength(7);
  });

  it("names 'Register' as where the journey begins — the trigger auto-selects it", () => {
    expect(HORIZEN_MONEYPENNY_JOURNEY.stages[0].id).toBe('register');
  });
});
