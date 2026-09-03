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
    generation: 0,
    panel: 'financial-profile',
    personaId: 'persona-1',
    environment: 'simulation',
    role: 'ADVISOR',
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

  it('a different role produces a different key (experience-coherence correction, 2026-09-03: role changes are context-relevant, per the operator directive "include role changes in stale-response invalidation")', () => {
    expect(computeContextVersionKey(version({ role: 'ARCHITECT' })))
      .not.toBe(computeContextVersionKey(version({ role: 'ADVISOR' })));
  });

  it('a different generation produces a different key, even when every other axis is identical', () => {
    expect(computeContextVersionKey(version({ generation: 1 })))
      .not.toBe(computeContextVersionKey(version({ generation: 0 })));
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

  it('scenario 4 (experience-coherence correction, 2026-09-03): a delayed response after an Advisor -> Architect role switch is stale, even on the same panel/persona/environment/profileRevision', () => {
    const sentVersion = computeContextVersionKey(version({ role: 'ADVISOR' }));
    const currentVersion = computeContextVersionKey(version({ role: 'ARCHITECT' }));
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

describe('isResponseContextStale — generation hardening (2026-09-02): two tasks on the same panel, and A -> B -> A', () => {
  it('two tasks on the SAME panel/persona/environment/profileRevision are distinct — the first task\'s late response cannot be mistaken for the second\'s', () => {
    // Task 1 is dispatched at generation 5 (nothing else about the context differs).
    const task1SentVersion = computeContextVersionKey(version({ generation: 5 }));
    // Task 2 is dispatched later, same panel — the host bumps generation to 6
    // for the new dispatch, per contextVersioning.ts's own generation contract.
    const task2SentVersion = computeContextVersionKey(version({ generation: 6 }));
    // Task 2 is now the most recent — "current" generation is 6.
    const currentVersion = computeContextVersionKey(version({ generation: 6 }));
    // Task 1's late response no longer matches current — correctly stale,
    // even though panel/persona/environment/profileRevision never changed.
    expect(isResponseContextStale(task1SentVersion, currentVersion)).toBe(true);
    // Task 2's own response DOES match current — correctly fresh.
    expect(isResponseContextStale(task2SentVersion, currentVersion)).toBe(false);
  });

  it('an old response cannot become valid again after an A -> B -> A context switch (the ABA problem)', () => {
    // Operator is on panel A; a request is dispatched at generation 3.
    const originalASentVersion = computeContextVersionKey(version({ panel: 'financial-profile', generation: 3 }));
    // Operator navigates A -> B: generation bumps to 4.
    // ...then B -> A: generation bumps again to 5. Panel is A again, exactly
    // as it was when the original request was sent — but generation is NOT.
    const currentVersionAfterRoundTrip = computeContextVersionKey(version({ panel: 'financial-profile', generation: 5 }));
    // A bare (panel, personaId, environment, profileRevision) tuple with no
    // generation axis would consider these EQUAL (same panel, same everything
    // else) and wrongly treat the stale response as current. The generation
    // axis is what correctly keeps them distinct.
    expect(isResponseContextStale(originalASentVersion, currentVersionAfterRoundTrip)).toBe(true);
  });

  it('a response for a genuinely single, unchanged task IS fresh — generation hardening does not create false positives', () => {
    const sentVersion = computeContextVersionKey(version({ generation: 7 }));
    const currentVersion = computeContextVersionKey(version({ generation: 7 }));
    expect(isResponseContextStale(sentVersion, currentVersion)).toBe(false);
  });
});

describe('SC-04 wiring — MoneyPennyCopilotWorkspace discards stale responses without overwriting current state', () => {
  const src = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx'));

  it('imports the shared contextVersioning module — no parallel ad-hoc versioning logic', () => {
    expect(src).toMatch(/from '@\/services\/moneypenny\/contextVersioning'/);
    expect(src).toMatch(/computeContextVersionKey/);
    expect(src).toMatch(/isResponseContextStale/);
  });

  it('embeds contextVersion into groundContext via the SAME computeCurrentVersionKey() every staleness check uses', () => {
    expect(src).toMatch(/contextVersion: computeCurrentVersionKey\(\)/);
  });

  it('wires onRequestContext to bump generation and capture the version a request is using, before dispatch', () => {
    expect(src).toMatch(/onRequestContext=\{handleRequestContext\}/);
    expect(src).toMatch(/pendingRequestVersionRef\.current = computeContextVersionKey\(\{/);
  });

  it('handleRequestContext bumps generationRef BEFORE capturing — so this request gets its own fresh, never-reused identity', () => {
    const handlerBody = src.match(/const handleRequestContext = useCallback\(\(\) => \{([\s\S]*?)\}, \[activePanel, personaId, environment, role\]\);/)?.[1] ?? '';
    const bumpIndex = handlerBody.indexOf('generationRef.current += 1;');
    const captureIndex = handlerBody.indexOf('pendingRequestVersionRef.current = computeContextVersionKey(');
    expect(bumpIndex).toBeGreaterThan(-1);
    expect(captureIndex).toBeGreaterThan(bumpIndex);
  });

  it('discards a stale response before it can touch suggestion state — a bare return, never a state write', () => {
    const handlerBody = src.match(/const handleSuggestedLayouts = useCallback\(\(hints: SuggestedLayoutHint\[\]\) => \{([\s\S]*?)\}, \[activePanel, computeCurrentVersionKey\]\);/)?.[1] ?? '';
    expect(handlerBody).toMatch(/if \(isResponseContextStale\(pendingRequestVersionRef\.current, computeCurrentVersionKey\(\)\)\) return;/);
    // The stale-guard return must precede any setSuggestedPanel call.
    const guardIndex = handlerBody.indexOf('if (isResponseContextStale');
    const setStateIndex = handlerBody.indexOf('setSuggestedPanel(');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(setStateIndex).toBeGreaterThan(guardIndex);
  });

  it('a financial-profile revision bumps profileRevisionRef AND generationRef so a stale in-flight response is caught', () => {
    expect(src).toMatch(/profileRevisionRef\.current \+= 1;\s*\n\s*generationRef\.current \+= 1;/);
  });

  it('panel/persona/environment changes each bump generationRef via their own effect', () => {
    expect(src).toMatch(/useEffect\(\(\) => \{ generationRef\.current \+= 1; \}, \[activePanel\]\);/);
    expect(src).toMatch(/useEffect\(\(\) => \{ generationRef\.current \+= 1; \}, \[personaId\]\);/);
    expect(src).toMatch(/useEffect\(\(\) => \{ generationRef\.current \+= 1; \}, \[environment\]\);/);
  });

  it('protects conversation output too — shouldSuppressResponse wired onto SmartTriadCopilotLayer, using the SAME pendingRequestVersionRef', () => {
    expect(src).toMatch(/shouldSuppressResponse=\{shouldSuppressResponse\}/);
    const handlerBody = src.match(/const shouldSuppressResponse = useCallback\(\(\) => \{([\s\S]*?)\}, \[computeCurrentVersionKey\]\);/)?.[1] ?? '';
    expect(handlerBody).toMatch(/isResponseContextStale\(pendingRequestVersionRef\.current, computeCurrentVersionKey\(\)\)/);
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

  it('shouldSuppressResponse is optional — every existing caller that does not wire it is unaffected', () => {
    expect(src).toMatch(/shouldSuppressResponse\?: \(sentGroundContext: Record<string, unknown> \| null\) => boolean;/);
  });

  it('protects CONVERSATION OUTPUT specifically: checked right before the assistant message is appended, and only its content is swapped for an honest placeholder — suggested_layouts/stage_proposals still fire unconditionally so a host guard on those is never skipped', () => {
    const appendBlock = src.match(/const suppressed = shouldSuppressResponse\?\.\(currentGroundContext\) \?\? false;([\s\S]{0,900})updateMessages\(\(prev\) => \[\.\.\.prev, assistantMessage\]\);/)?.[1] ?? '';
    expect(appendBlock).toMatch(/content: suppressed/);
    expect(appendBlock).toMatch(/This response was generated for an earlier context and is no longer current/);
    // onSuggestedLayouts/onStageProposals calls are NOT inside this block —
    // they fire later, unconditionally, regardless of `suppressed`.
    expect(appendBlock).not.toMatch(/onSuggestedLayouts/);
  });
});
