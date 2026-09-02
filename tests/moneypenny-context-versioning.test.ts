/**
 * SC-04 — task/context versioning (Cartridge spec: "Both panes consume
 * the same versioned task context and correlated outcomes. Late responses
 * cannot overwrite a different task, agent, or environment.").
 *
 * Real, callable unit tests of the pure logic in
 * services/moneypenny/contextVersioning.ts, exercising the three required
 * scenarios directly: a delayed response after a context change (panel),
 * a financial-profile revision, and a simulation/live switch. A
 * source-shape section proves the wiring point (MoneyPennyCopilotWorkspace,
 * SmartTriadCopilotLayer) actually uses this module rather than a parallel
 * ad-hoc mechanism.
 */
import { describe, it, expect } from 'vitest';
import {
  computeContextVersionKey,
  isResponseContextStale,
  type MoneyPennyContextVersion,
} from '../services/moneypenny/contextVersioning';
import { readSource, stripComments } from './_lib/sourceAuthority';

function version(overrides: Partial<MoneyPennyContextVersion> = {}): MoneyPennyContextVersion {
  return {
    panel: 'financial-profile',
    personaId: 'persona-1',
    environment: 'simulation',
    profileRevision: 0,
    ...overrides,
  };
}

describe('computeContextVersionKey — deterministic, sensitive to every axis', () => {
  it('the same inputs always produce the same key', () => {
    expect(computeContextVersionKey(version())).toBe(computeContextVersionKey(version()));
  });

  it('a different panel produces a different key', () => {
    expect(computeContextVersionKey(version({ panel: 'portfolio' })))
      .not.toBe(computeContextVersionKey(version({ panel: 'financial-profile' })));
  });

  it('a different persona produces a different key', () => {
    expect(computeContextVersionKey(version({ personaId: 'persona-2' })))
      .not.toBe(computeContextVersionKey(version({ personaId: 'persona-1' })));
  });

  it('an undefined persona is distinguishable from any real persona id', () => {
    expect(computeContextVersionKey(version({ personaId: undefined })))
      .not.toBe(computeContextVersionKey(version({ personaId: 'persona-1' })));
  });

  it('a different environment produces a different key', () => {
    expect(computeContextVersionKey(version({ environment: 'live' })))
      .not.toBe(computeContextVersionKey(version({ environment: 'simulation' })));
  });

  it('a different profileRevision produces a different key', () => {
    expect(computeContextVersionKey(version({ profileRevision: 1 })))
      .not.toBe(computeContextVersionKey(version({ profileRevision: 0 })));
  });
});

describe('isResponseContextStale — the three required SC-04 scenarios', () => {
  it('scenario 1: a delayed response after the operator navigated to a different panel is stale', () => {
    const sentVersion = computeContextVersionKey(version({ panel: 'financial-profile' }));
    // Operator asked something in Financial Profile, then navigated to
    // Portfolio before the response arrived.
    const currentVersion = computeContextVersionKey(version({ panel: 'portfolio' }));
    expect(isResponseContextStale(sentVersion, currentVersion)).toBe(true);
  });

  it('scenario 1b: a response that arrives before any navigation is NOT stale', () => {
    const sentVersion = computeContextVersionKey(version({ panel: 'financial-profile' }));
    const currentVersion = computeContextVersionKey(version({ panel: 'financial-profile' }));
    expect(isResponseContextStale(sentVersion, currentVersion)).toBe(false);
  });

  it('scenario 2: a delayed response after a financial-profile revision is stale, even on the same panel', () => {
    const sentVersion = computeContextVersionKey(version({ panel: 'financial-profile', profileRevision: 0 }));
    // Operator revised/recomputed their profile while the request was in flight.
    const currentVersion = computeContextVersionKey(version({ panel: 'financial-profile', profileRevision: 1 }));
    expect(isResponseContextStale(sentVersion, currentVersion)).toBe(true);
  });

  it('scenario 3: a delayed response after a simulation/live environment switch is stale, even on the same panel and profile revision', () => {
    const sentVersion = computeContextVersionKey(version({ environment: 'simulation' }));
    const currentVersion = computeContextVersionKey(version({ environment: 'live' }));
    expect(isResponseContextStale(sentVersion, currentVersion)).toBe(true);
  });

  it('a response with no captured request context (null) is fail-closed stale, never assumed current', () => {
    const currentVersion = computeContextVersionKey(version());
    expect(isResponseContextStale(null, currentVersion)).toBe(true);
  });

  it('a persona switch mid-flight (e.g. account change) is stale', () => {
    const sentVersion = computeContextVersionKey(version({ personaId: 'persona-1' }));
    const currentVersion = computeContextVersionKey(version({ personaId: 'persona-2' }));
    expect(isResponseContextStale(sentVersion, currentVersion)).toBe(true);
  });
});

describe('SC-04 wiring — MoneyPennyCopilotWorkspace discards stale responses without overwriting current state', () => {
  const src = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx'));

  it('imports the shared contextVersioning module — no parallel ad-hoc versioning logic', () => {
    expect(src).toMatch(/from '@\/services\/moneypenny\/contextVersioning'/);
    expect(src).toMatch(/computeContextVersionKey/);
    expect(src).toMatch(/isResponseContextStale/);
  });

  it('embeds contextVersion into groundContext so SmartTriadCopilotLayer transmits it with the request', () => {
    expect(src).toMatch(/contextVersion: computeContextVersionKey\(\{/);
  });

  it('wires onRequestContext to capture the version a request is using, before dispatch', () => {
    expect(src).toMatch(/onRequestContext=\{handleRequestContext\}/);
    expect(src).toMatch(/pendingRequestVersionRef\.current =/);
  });

  it('discards a stale response before it can touch suggestion state — a bare return, never a state write', () => {
    const handlerBody = src.match(/const handleSuggestedLayouts = useCallback\(\(hints: SuggestedLayoutHint\[\]\) => \{([\s\S]*?)\}, \[activePanel, personaId, environment\]\);/)?.[1] ?? '';
    expect(handlerBody).toMatch(/if \(isResponseContextStale\(pendingRequestVersionRef\.current, currentVersionKey\)\) return;/);
    // The stale-guard return must precede any setSuggestedPanel call.
    const guardIndex = handlerBody.indexOf('if (isResponseContextStale');
    const setStateIndex = handlerBody.indexOf('setSuggestedPanel(');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(setStateIndex).toBeGreaterThan(guardIndex);
  });

  it('a financial-profile revision bumps profileRevisionRef so a stale in-flight response is caught', () => {
    expect(src).toMatch(/profileRevisionRef\.current \+= 1;/);
  });

  it('environment is real state (not a hardcoded literal) so C-11\/C-12\'s future live toggle plugs into the same guard', () => {
    expect(src).toMatch(/const \[environment\] = useState<MoneyPennyEnvironment>\('simulation'\);/);
  });
});

describe('SC-04 wiring — SmartTriadCopilotLayer additively exposes the request-time context, never forking a parallel channel', () => {
  const src = stripComments(readSource('components/smarttriad/copilot/SmartTriadCopilotLayer.tsx'));

  it('onRequestContext is optional — every existing caller that does not wire it is unaffected', () => {
    expect(src).toMatch(/onRequestContext\?: \(sentGroundContext: Record<string, unknown> \| null\) => void;/);
  });

  it('fires onRequestContext with the SAME currentGroundContext snapshot the POST body sends, before dispatch', () => {
    const dispatchBlock = src.match(/const currentGroundContext = groundContextRef\.current \?\? null;([\s\S]{0,500})const res = await fetch\('\/api\/codex\/chat'/)?.[1] ?? '';
    expect(dispatchBlock).toMatch(/onRequestContext\?\.\(currentGroundContext\);/);
  });
});
