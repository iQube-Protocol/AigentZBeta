/**
 * Horizen Pilot Closure item 5 (2026-08-09) — the journey's own narration
 * must be agent-generic, not hardcoded to MoneyPenny.
 */

import { describe, it, expect } from 'vitest';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { renderJourneyCopy, AGENT_DISPLAY_NAME_TOKEN } from '@/services/journey/journeyCopyTemplate';
import { resolveRegistrableAgent } from '@/services/horizen/registrableAgents';

function collectNarrationStrings(): string[] {
  const strings: string[] = [];
  for (const stage of HORIZEN_MONEYPENNY_JOURNEY.stages) {
    if (stage.description) strings.push(stage.description);
    const companion = (stage as { companion?: { before?: string; complete?: string } }).companion;
    if (companion?.before) strings.push(companion.before);
    if (companion?.complete) strings.push(companion.complete);
    for (const surface of stage.surfaces ?? []) {
      if (typeof (surface as { note?: unknown }).note === 'string') {
        strings.push((surface as { note: string }).note);
      }
    }
  }
  return strings;
}

describe('renderJourneyCopy', () => {
  it('substitutes the token for the agent\'s own displayName', () => {
    const nakamoto = resolveRegistrableAgent('nakamoto')!;
    expect(renderJourneyCopy(`${AGENT_DISPLAY_NAME_TOKEN} is ready.`, nakamoto)).toBe('Aigent Nakamoto is ready.');
  });

  it('leaves text with no token untouched', () => {
    const moneypenny = resolveRegistrableAgent('moneypenny')!;
    expect(renderJourneyCopy('No token here.', moneypenny)).toBe('No token here.');
  });

  it('substitutes every occurrence, not just the first', () => {
    const moneypenny = resolveRegistrableAgent('moneypenny')!;
    const rendered = renderJourneyCopy(`${AGENT_DISPLAY_NAME_TOKEN} and ${AGENT_DISPLAY_NAME_TOKEN} again`, moneypenny);
    expect(rendered).toBe('Aigent MoneyPenny and Aigent MoneyPenny again');
  });
});

describe('HORIZEN_MONEYPENNY_JOURNEY narration is agent-generic', () => {
  it('no rendered narration field contains the literal "MoneyPenny" — every mention uses the token', () => {
    const offenders = collectNarrationStrings().filter((s) => s.includes('MoneyPenny'));
    expect(offenders, `found hardcoded "MoneyPenny" in: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  it('renders correctly for every registrable agent — the same stage copy, a different subject', () => {
    const nakamoto = resolveRegistrableAgent('nakamoto')!;
    const moneypenny = resolveRegistrableAgent('moneypenny')!;
    for (const raw of collectNarrationStrings()) {
      if (!raw.includes(AGENT_DISPLAY_NAME_TOKEN)) continue;
      expect(renderJourneyCopy(raw, nakamoto)).toContain('Aigent Nakamoto');
      expect(renderJourneyCopy(raw, moneypenny)).toContain('Aigent MoneyPenny');
    }
  });
});
