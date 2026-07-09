/**
 * Chrysalis Homecoming — contract canaries (CFS-023).
 *
 * Pins the order-constant constitutional data (eras, sovereignties, workstreams,
 * the Constitutional Presence ladder, the Homecoming Test dimensions, the
 * knowledge sources) and the PURE scorer logic (contiguous presence resolution +
 * summary). The impure table reads in constitutionalPresence.ts are not exercised.
 */

import { describe, it, expect } from 'vitest';
import {
  CHRYSALIS_ERAS,
  CONSTITUTIONAL_SOVEREIGNTIES,
  SOVEREIGNTY_PROGRAMME,
  HOMECOMING_SOVEREIGNTIES,
  HOMECOMING_WORKSTREAMS,
  CONSTITUTIONAL_PRESENCE_LADDER,
  PRESENCE_SIGNAL,
  presenceLevelIndex,
  resolvePresenceLevel,
  HOMECOMING_TEST_DIMENSIONS,
  HOMECOMING_DELEGATES,
  DELEGATE_CHARTER_STATUS,
  KNOWLEDGE_HOMECOMING_SOURCES,
  knowledgeSourceIsNew,
  CONSTITUTIONALIZATION_IDIOMS,
} from '@/types/homecoming';
import { assembleRungs, summarizePresence, type DelegatePresence } from '@/services/homecoming/constitutionalPresence';

describe('Chrysalis Homecoming — order-pinned constitutional data', () => {
  it('sequences the Chrysalis eras with Homecoming strictly between 2.0 and 3.0', () => {
    expect([...CHRYSALIS_ERAS]).toEqual(['chrysalis-1.x', 'chrysalis-2.0', 'chrysalis-homecoming', 'chrysalis-3.0']);
    expect(CHRYSALIS_ERAS.indexOf('chrysalis-2.0')).toBeLessThan(CHRYSALIS_ERAS.indexOf('chrysalis-homecoming'));
    expect(CHRYSALIS_ERAS.indexOf('chrysalis-homecoming')).toBeLessThan(CHRYSALIS_ERAS.indexOf('chrysalis-3.0'));
  });

  it('pins the five sovereignties and attributes agent+knowledge to Homecoming', () => {
    expect([...CONSTITUTIONAL_SOVEREIGNTIES]).toEqual(['computing', 'development', 'agent', 'knowledge', 'operational']);
    expect(SOVEREIGNTY_PROGRAMME.agent).toBe('chrysalis-homecoming');
    expect(SOVEREIGNTY_PROGRAMME.knowledge).toBe('chrysalis-homecoming');
    expect(SOVEREIGNTY_PROGRAMME.computing).toBe('chrysalis-2.0');
    expect(SOVEREIGNTY_PROGRAMME.operational).toBe('operation-leap');
    expect([...HOMECOMING_SOVEREIGNTIES].sort()).toEqual(['agent', 'knowledge']);
    // every sovereignty is attributed to exactly one programme
    for (const s of CONSTITUTIONAL_SOVEREIGNTIES) expect(SOVEREIGNTY_PROGRAMME[s]).toBeTruthy();
  });

  it('orders the four workstreams knowledge → agent → harness → operational', () => {
    expect([...HOMECOMING_WORKSTREAMS]).toEqual(['knowledge', 'agent', 'harness', 'operational']);
  });

  it('pins the Presence ladder L0→L5 with contiguous 0..5 signal indices', () => {
    expect([...CONSTITUTIONAL_PRESENCE_LADDER]).toEqual([
      'card',
      'knowledge',
      'reasoning',
      'studio',
      'development',
      'sovereign',
    ]);
    CONSTITUTIONAL_PRESENCE_LADDER.forEach((level, i) => {
      expect(PRESENCE_SIGNAL[level].level).toBe(i);
      expect(presenceLevelIndex(level)).toBe(i);
    });
    expect(presenceLevelIndex('nonexistent')).toBe(-1);
  });

  it('pins the three Homecoming Test dimensions', () => {
    expect([...HOMECOMING_TEST_DIMENSIONS]).toEqual(['continuity', 'knowledge', 'capability']);
  });

  it('roster is honestly graded — 3 concrete, 1 archetype, 2 conceptual', () => {
    expect([...HOMECOMING_DELEGATES]).toEqual(['aigent-z', 'marketa', 'kn0w1', 'aletheon', 'moneypenny', 'nakamoto']);
    const byStatus = (s: string) =>
      HOMECOMING_DELEGATES.filter((d) => DELEGATE_CHARTER_STATUS[d].status === s);
    expect(byStatus('concrete').sort()).toEqual(['aigent-z', 'kn0w1', 'marketa']);
    expect(byStatus('archetype')).toEqual(['aletheon']);
    expect(byStatus('conceptual').sort()).toEqual(['moneypenny', 'nakamoto']);
  });

  it('only chatgpt-export is a genuinely-new knowledge intake path', () => {
    expect(KNOWLEDGE_HOMECOMING_SOURCES[0]).toBe('chatgpt-export');
    expect(knowledgeSourceIsNew('chatgpt-export')).toBe(true);
    expect(knowledgeSourceIsNew('venture-qubes')).toBe(false);
    expect(knowledgeSourceIsNew('standing')).toBe(false);
    expect([...CONSTITUTIONALIZATION_IDIOMS]).toEqual(['invariant-extraction', 'meta-blak-split']);
  });
});

describe('resolvePresenceLevel — the ladder is contiguous (a gap stops the climb)', () => {
  it('returns null when even L0 (card) is unmet', () => {
    expect(resolvePresenceLevel({})).toBeNull();
    expect(resolvePresenceLevel({ card: false, knowledge: true })).toBeNull();
  });

  it('returns the highest contiguous rung', () => {
    expect(resolvePresenceLevel({ card: true })).toBe('card');
    expect(resolvePresenceLevel({ card: true, knowledge: true, reasoning: true })).toBe('reasoning');
  });

  it('a gap below a satisfied rung caps presence — cannot skip', () => {
    // studio satisfied but reasoning NOT → capped at knowledge (the last contiguous)
    expect(resolvePresenceLevel({ card: true, knowledge: true, reasoning: false, studio: true })).toBe('knowledge');
  });

  it('full ladder resolves to sovereign', () => {
    const all = Object.fromEntries(CONSTITUTIONAL_PRESENCE_LADDER.map((l) => [l, true]));
    expect(resolvePresenceLevel(all)).toBe('sovereign');
  });
});

describe('assembleRungs + summarizePresence — pure scorer core', () => {
  it('a pending rung is NOT satisfied for the climb (undetermined ≠ reached)', () => {
    const { presenceLevel, rungs } = assembleRungs({ card: 'reached', knowledge: 'reached', reasoning: 'pending' });
    expect(presenceLevel).toBe('knowledge'); // pending reasoning stops the climb
    expect(rungs.find((r) => r.level === 'reasoning')?.status).toBe('pending');
    // rungs are always the full ordered ladder
    expect(rungs.map((r) => r.level)).toEqual([...CONSTITUTIONAL_PRESENCE_LADDER]);
  });

  it('missing statuses default to pending', () => {
    const { rungs } = assembleRungs({ card: 'reached' });
    expect(rungs.find((r) => r.level === 'sovereign')?.status).toBe('pending');
  });

  it('summarises presence across delegates by threshold', () => {
    const mk = (presenceIndex: number): DelegatePresence => ({
      delegate: 'marketa',
      agentClass: 'guide-agent',
      charterStatus: 'concrete',
      presenceLevel: null,
      presenceIndex,
      rungs: [],
    });
    const summary = summarizePresence([mk(5), mk(2), mk(1), mk(-1)]);
    expect(summary.total).toBe(4);
    expect(summary.present).toBe(3); // index >= 0
    expect(summary.reasoning).toBe(2); // index >= 2
    expect(summary.sovereign).toBe(1); // index >= 5
    expect(summary.conceptual).toBe(1); // index < 0
  });
});
