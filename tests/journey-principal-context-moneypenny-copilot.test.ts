/**
 * Journey Principal Context + Financial Services MoneyPenny Copilot
 * (2026-08-25) — structural/source-authority canaries, same convention as
 * tests/knyts-bridge-passport-delegate-affordance.test.ts (no
 * @testing-library/react usage anywhere in tests/, so behavior is proven
 * from source shape: which component is mounted, which handler is wired,
 * and in what order).
 *
 * Covers:
 *   1. JourneyRunSurface reuses the shared ActivePersonaControl — no second
 *      persona resolver inside the runner itself.
 *   2. A persona change re-derives journey state (personaId feeds refresh's
 *      own dependency array, which feeds personaFetch/buildEmbedSurfaceSrc).
 *   3. No active persona -> no inert badge (MS-9).
 *   4. The control opens the EXISTING SmartWalletDrawer, never a new wallet.
 *   5. Existing Journey callers (Validation Programme, Ian) compile
 *      unaffected — they never reference the new prop.
 *   6-9. The Financial Services Bridge mounts exactly one MoneyPenny
 *      copilot, identified by a static 'aigent-moneypenny' literal, and the
 *      embedded MoneyPenny Orchestration destination is always resolved
 *      with copilot suppression.
 *   10. MoneyPenny's canonical prompt carries Advisor/Architect/Runtime and
 *      delegate-not-principal semantics.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments, importAuthority } from './_lib/sourceAuthority';

const ACTIVE_PERSONA_CONTROL = 'components/persona/ActivePersonaControl.tsx';
const JOURNEY_RUN_SURFACE = 'components/journey/JourneyRunSurface.tsx';
const PILOT_JOURNEY_TAB = 'app/triad/components/codex/tabs/PilotJourneyTab.tsx';
const VALIDATION_PROGRAMME_TAB = 'app/triad/components/codex/tabs/ValidationProgrammeJourneyTab.tsx';
const IAN_JOURNEY_TAB = 'app/triad/components/codex/tabs/IanJourneyTab.tsx';
const FS_BRIDGE_FRONT_DOOR = 'components/journey/FinancialServicesBridgeFrontDoor.tsx';
const PERSONAS = 'app/data/personas.ts';

describe('ActivePersonaControl — the ONE shared active-persona chip', () => {
  it('resolves persona via the canonical useActivePersona hook, not a second resolver', () => {
    const src = readSource(ACTIVE_PERSONA_CONTROL);
    const graph = importAuthority(src);
    const hit = graph.records.find(
      (r) => r.specifier === '@/app/hooks/useActivePersona' && r.names.includes('useActivePersona'),
    );
    expect(hit, 'ActivePersonaControl must import the canonical useActivePersona hook').toBeTruthy();
  });

  it('opens the EXISTING SmartWalletDrawer — never a new Journey-specific wallet', () => {
    const src = readSource(ACTIVE_PERSONA_CONTROL);
    const graph = importAuthority(src);
    const hit = graph.dynamicSpecifiers.some((s) => s.includes('@/app/components/content/SmartWalletDrawer'));
    expect(hit, 'must dynamically import the canonical SmartWalletDrawer').toBe(true);
    const code = stripComments(src);
    expect(code).toContain('variant="overlay"');
    expect(code).toContain('initialTab="wallet"');
    // No second drawer/modal implementation.
    expect(code).not.toMatch(/function\s+\w*Wallet\w*Drawer/);
  });

  it('renders nothing when no active persona is resolved (MS-9)', () => {
    const code = stripComments(readSource(ACTIVE_PERSONA_CONTROL));
    expect(code).toContain('if (!label) return null;');
  });

  it('propagates persona changes via an onPersonaChange callback, never mutating anything itself', () => {
    const code = stripComments(readSource(ACTIVE_PERSONA_CONTROL));
    expect(code).toContain('onPersonaChange?.(newPersonaId)');
  });

  it('default copy says "Acting as", never "Principal"', () => {
    const code = stripComments(readSource(ACTIVE_PERSONA_CONTROL));
    expect(code).toContain("labelPrefix = 'Acting as'");
    expect(code).not.toMatch(/labelPrefix\s*=\s*['"]Principal/);
  });
});

describe('JourneyRunSurface — Active Persona control placement', () => {
  it('imports the shared ActivePersonaControl rather than a local implementation', () => {
    const src = readSource(JOURNEY_RUN_SURFACE);
    const graph = importAuthority(src);
    const hit = graph.records.find(
      (r) => r.specifier === '@/components/persona/ActivePersonaControl' && r.names.includes('ActivePersonaControl'),
    );
    expect(hit, 'JourneyRunSurface must import the shared ActivePersonaControl').toBeTruthy();
    // No second persona resolver bound directly inside the runner.
    expect(graph.boundNames.has('useActivePersona')).toBe(false);
  });

  it('places <ActivePersonaControl> immediately before the Refresh button in headerActions', () => {
    const code = stripComments(readSource(JOURNEY_RUN_SURFACE));
    const headerActionsAt = code.indexOf('const headerActions = (');
    expect(headerActionsAt).toBeGreaterThan(-1);
    const controlAt = code.indexOf('<ActivePersonaControl', headerActionsAt);
    const refreshButtonAt = code.indexOf("title=\"Refresh state\"", headerActionsAt);
    expect(controlAt, 'expected <ActivePersonaControl> inside headerActions').toBeGreaterThan(-1);
    expect(refreshButtonAt, 'expected the Refresh button inside headerActions').toBeGreaterThan(-1);
    expect(controlAt).toBeLessThan(refreshButtonAt);
  });

  it('accepts an optional onPersonaChange prop and relays it to the control', () => {
    const code = stripComments(readSource(JOURNEY_RUN_SURFACE));
    expect(code).toContain('onPersonaChange?: (newPersonaId: string) => void;');
    expect(code).toContain('onPersonaChange={onPersonaChange}');
  });

  it('a persona change re-derives journey state: personaId feeds the SAME refresh() this file already uses', () => {
    const code = stripComments(readSource(JOURNEY_RUN_SURFACE));
    // refresh() is memoized on [stateUrl, personaId] and personaFetch is
    // hinted with personaId — so a NEW personaId produces a NEW refresh
    // function, which the mount effect re-runs, rereading via personaFetch
    // and (for embed surfaces) buildEmbedSurfaceSrc — never a second fetch
    // mechanism for the persona-change case specifically.
    const refreshDefAt = code.indexOf('const refresh = useCallback(');
    expect(refreshDefAt).toBeGreaterThan(-1);
    const depsAt = code.indexOf('}, [stateUrl, personaId]);', refreshDefAt);
    expect(depsAt, 'refresh() must be memoized on [stateUrl, personaId]').toBeGreaterThan(-1);
    expect(code).toContain('personaIdHint: personaId');
    // Reciprocal Artifact Exchange focus contract (2026-08-25) widened this
    // call's input object to include a per-stage `focus` value — still the
    // ONE builder, just a multi-line object literal now.
    expect(code).toMatch(/personaId,\s*\n\s*selectedAgentSlug,/);
  });
});

describe('Existing Journey callers stay unaffected (additive default)', () => {
  it('PilotJourneyTab threads onPersonaChange through, purely additively', () => {
    const code = stripComments(readSource(PILOT_JOURNEY_TAB));
    expect(code).toContain("onPersonaChange?: JourneyRunSurfaceProps['onPersonaChange'];");
    expect(code).toContain('onPersonaChange={onPersonaChange}');
  });

  it('ValidationProgrammeJourneyTab and IanJourneyTab never reference the new prop', () => {
    for (const path of [VALIDATION_PROGRAMME_TAB, IAN_JOURNEY_TAB]) {
      const code = stripComments(readSource(path));
      expect(code, `${path} must be unaffected by the additive onPersonaChange prop`).not.toContain('onPersonaChange');
    }
  });
});

describe('Financial Services Bridge — one MoneyPenny copilot, always suppressed inside the embed', () => {
  it('mounts NO CodexCopilotLayer directly — the Journey Runtime copilot invariant (item 1, 2026-08-25) owns that job now', () => {
    const code = stripComments(readSource(FS_BRIDGE_FRONT_DOOR));
    const count = (code.match(/<CodexCopilotLayer/g) ?? []).length;
    expect(count).toBe(0);
  });

  it('the copilot identity resolves from the journey definition, never hand-copied here', () => {
    const journeySrc = stripComments(readSource('services/journey/horizenMoneyPennyJourney.ts'));
    expect(journeySrc).toMatch(/copilot:\s*\{\s*cartridgeSlug:\s*'moneypenny'\s*\}/);
    const cartridgeSrc = stripComments(readSource('data/codex-configs.ts'));
    const cartridgeAt = cartridgeSrc.indexOf("export const MONEYPENNY_CARTRIDGE");
    const cartridgeEnd = cartridgeSrc.indexOf('\n};', cartridgeAt);
    const cartridgeBlock = cartridgeSrc.slice(cartridgeAt, cartridgeEnd);
    expect(cartridgeBlock).toContain("agent: { id: 'aigent-moneypenny', name: 'MoneyPenny' }");
  });

  it('imports MetaAvatarProvider/MetaAvatarHost — required by CodexCopilotLayer on a bare page', () => {
    const graph = importAuthority(readSource(FS_BRIDGE_FRONT_DOOR));
    expect(graph.records.some((r) => r.specifier === '@/app/contexts/MetaAvatarContext' && r.names.includes('MetaAvatarProvider'))).toBe(true);
    expect(graph.records.some((r) => r.specifier === '@/app/components/metaVatar/MetaAvatarHost' && r.names.includes('MetaAvatarHost'))).toBe(true);
  });

  it('resolveJourneyOperatorDestination is always called with suppressCopilot: true', () => {
    const code = stripComments(readSource(FS_BRIDGE_FRONT_DOOR));
    const callAt = code.indexOf('resolveJourneyOperatorDestination({');
    expect(callAt).toBeGreaterThan(-1);
    const closeAt = code.indexOf('});', callAt);
    const callBody = code.slice(callAt, closeAt);
    expect(callBody).toContain('suppressCopilot: true');
  });

  it('wires onPersonaChange={setPersonaId} on PilotJourneyTab', () => {
    const code = stripComments(readSource(FS_BRIDGE_FRONT_DOOR));
    expect(code).toContain('onPersonaChange={setPersonaId}');
  });
});

describe('MoneyPenny prompt — reconciled with PRD-MPY-001', () => {
  it('names all three modes: Advisor, Architect, Runtime', () => {
    const code = stripComments(readSource(PERSONAS));
    const promptAt = code.indexOf('"aigent-moneypenny"');
    expect(promptAt).toBeGreaterThan(-1);
    const promptEndAt = code.indexOf('"aigent-metaye"', promptAt);
    const prompt = code.slice(promptAt, promptEndAt);
    expect(prompt).toContain('ADVISOR');
    expect(prompt).toContain('ARCHITECT');
    expect(prompt).toContain('RUNTIME');
  });

  it('states delegate-not-principal semantics', () => {
    const code = stripComments(readSource(PERSONAS));
    const promptAt = code.indexOf('"aigent-moneypenny"');
    const promptEndAt = code.indexOf('"aigent-metaye"', promptAt);
    const prompt = code.slice(promptAt, promptEndAt);
    expect(prompt).toMatch(/you are a delegate/i);
    expect(prompt).toMatch(/never\s+(?:be\s+)?(?:a\s+)?(?:the\s+)?principal|never authorize/i);
  });

  it('names the Vela attestation gate for Runtime money-moving', () => {
    const code = stripComments(readSource(PERSONAS));
    const promptAt = code.indexOf('"aigent-moneypenny"');
    const promptEndAt = code.indexOf('"aigent-metaye"', promptAt);
    const prompt = code.slice(promptAt, promptEndAt);
    expect(prompt).toMatch(/vela attestation/i);
  });

  it('preserves the existing Q¢ economics ground truth', () => {
    const code = stripComments(readSource(PERSONAS));
    const promptAt = code.indexOf('"aigent-moneypenny"');
    const promptEndAt = code.indexOf('"aigent-metaye"', promptAt);
    const prompt = code.slice(promptAt, promptEndAt);
    expect(prompt).toContain('$1 = 100 Q¢');
    expect(prompt).toContain('one Q¢ = $0.01');
  });
});
