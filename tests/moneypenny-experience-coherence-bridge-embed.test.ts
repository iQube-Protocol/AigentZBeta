/**
 * MoneyPenny experience-coherence correction (2026-09-03), item 1 —
 * "Correct MoneyPenny embedding in CI and Knightsbridge, reconciling
 * Horizen onto the same canonical cartridge."
 *
 * Confirmed defect (verified by direct code reading before this pass):
 * CI's and KNYTS's Prepare/Operate stages both used
 * `window.location.assign(buildCodexUrl('moneypenny', {tab}))` — a
 * same-tab navigate-away, not an embed, discarding the bridge's own
 * stepper/copilot. Horizen's own MoneyPenny embed (`moneypenny-
 * orchestration-focused`) used the real `kind: 'embed'` iframe mechanism
 * correctly, but showed the outer `JourneyCopilotHost` AND MoneyPenny's own
 * inline `SmartTriadCopilotLayer` at once — `suppressFloatingCopilot` only
 * kills a THIRD, unrelated floating copilot (`CodexCopilotLayer`).
 *
 * This file proves: (1) CI/KNYTS now embed via the SAME mechanism Horizen
 * established, never a navigate-away; (2) the NEW `suppressHostCopilot`
 * flag closes Horizen's own dual-copilot gap; (3) the same policy reaches
 * CI/KNYTS's bespoke-component embeds via the event-driven half of the
 * same mechanism, both converging on one `JourneyRunSurface` gate.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const EMBED = 'components/journey/MoneyPennyBridgeEmbed.tsx';
const PREPARE = 'components/journey/FinancialSovereigntyPrepareCrossStage.tsx';
const OPERATE = 'components/journey/FinancialSovereigntyOperateStage.tsx';
const RUNNER = 'components/journey/JourneyRunSurface.tsx';
const REGISTRY = 'services/journey/journeySurfaceRegistry.ts';

describe('MoneyPennyBridgeEmbed — the one shared in-frame mount, reusing the established focused-embed mechanism', () => {
  const src = stripComments(readSource(EMBED));

  it('builds its src via buildCodexUrl with focused chrome suppression — the SAME mechanism Horizen already uses, never a hand-built URL', () => {
    expect(src).toMatch(/import \{ buildCodexUrl \} from '@\/utils\/codex-nav'/);
    expect(src).toMatch(/focused: true,/);
    expect(src).toMatch(/focusedNavDepth: 0,/);
  });

  it('renders a real <iframe>, never window.location.assign/window.open', () => {
    expect(src).toMatch(/<iframe/);
    expect(src).not.toMatch(/window\.location\.assign/);
    expect(src).not.toMatch(/window\.open/);
  });

  it('dispatches journey:host-copilot-suppress on mount (true) and unmount (false) — an effect with a cleanup, not a fire-and-forget', () => {
    expect(src).toMatch(/useEffect\(\(\) => \{/);
    expect(src).toMatch(/detail: \{ suppressed: true \}/);
    expect(src).toMatch(/detail: \{ suppressed: false \}/);
    // Cleanup must exist so closing the embed restores the host's copilot.
    const effectBody = src.match(/useEffect\(\(\) => \{([\s\S]*?)\}, \[\]\);/)?.[1] ?? '';
    expect(effectBody).toMatch(/return \(\) => \{/);
  });
});

describe('CI/KNYTS Prepare/Operate now embed MoneyPenny in place — never a navigate-away', () => {
  it('FinancialSovereigntyPrepareCrossStage.tsx uses MoneyPennyBridgeEmbed, never window.location.assign', () => {
    const src = stripComments(readSource(PREPARE));
    expect(src).toMatch(/import \{ MoneyPennyBridgeEmbed \} from '@\/components\/journey\/MoneyPennyBridgeEmbed'/);
    expect(src).toMatch(/<MoneyPennyBridgeEmbed tab="financial-profile" personaId=\{personaId\}/);
    // CROSS mode's own handoff navigation (a genuinely different concern —
    // leaving the bridge journey entirely, not embedding MoneyPenny) still
    // legitimately navigates; only the Prepare-mode financial-profile
    // launch is asserted here.
    expect(src).not.toMatch(/buildCodexUrl\('moneypenny'/);
  });

  it('FinancialSovereigntyOperateStage.tsx uses MoneyPennyBridgeEmbed, never window.location.assign', () => {
    const src = stripComments(readSource(OPERATE));
    expect(src).toMatch(/import \{ MoneyPennyBridgeEmbed \} from '@\/components\/journey\/MoneyPennyBridgeEmbed'/);
    expect(src).toMatch(/<MoneyPennyBridgeEmbed tab="overview" personaId=\{personaId\}/);
    expect(src).not.toMatch(/window\.location\.assign/);
    expect(src).not.toMatch(/buildCodexUrl/);
  });

  it('both stages preserve "Continue"/"Continue to Operate" reachable while the embed is open — never trapping the visitor inside it', () => {
    const prepareSrc = stripComments(readSource(PREPARE));
    const operateSrc = stripComments(readSource(OPERATE));
    expect(prepareSrc).toMatch(/if \(embedOpen\) \{[\s\S]*?Continue to Operate[\s\S]*?<MoneyPennyBridgeEmbed/);
    expect(operateSrc).toMatch(/if \(embedOpen\) \{[\s\S]*?Continue[\s\S]*?<MoneyPennyBridgeEmbed/);
  });
});

describe('suppressHostCopilot — registry half (Horizen\'s existing embed) and event half (CI/KNYTS\'s bespoke embed) converge on one JourneyRunSurface gate', () => {
  it('moneypenny-orchestration-focused now declares suppressHostCopilot — closes the confirmed live dual-copilot defect', () => {
    const src = stripComments(readSource(REGISTRY));
    const at = src.indexOf("'moneypenny-orchestration-focused': {");
    expect(at).toBeGreaterThan(-1);
    const section = src.slice(at, at + 2200);
    expect(section).toMatch(/suppressHostCopilot: true,/);
  });

  it('JourneyRunSurface computes registry-driven suppression from the active stage\'s own descriptors — never hardcodes a surface ref', () => {
    const src = stripComments(readSource(RUNNER));
    expect(src).toMatch(/const registryRequestsHostCopilotSuppression = activeStageSurfaceRefs\.some\(\(ref\) => \{/);
    expect(src).toMatch(/descriptor\?\.kind === 'embed' && descriptor\.suppressHostCopilot === true;/);
  });

  it('JourneyRunSurface also listens for the event-driven half, resetting on stage change so a suppression request never leaks to the next stage', () => {
    const src = stripComments(readSource(RUNNER));
    expect(src).toMatch(/window\.addEventListener\('journey:host-copilot-suppress', handler\);/);
    expect(src).toMatch(/setComponentRequestsHostCopilotSuppression\(false\);\s*\}, \[activeStageId\]\);/);
  });

  it('JourneyCopilotHost is gated on the combined suppression flag, not rendered unconditionally', () => {
    const src = stripComments(readSource(RUNNER));
    expect(src).toMatch(/const suppressHostCopilot = registryRequestsHostCopilotSuppression \|\| componentRequestsHostCopilotSuppression;/);
    expect(src).toMatch(/\{!suppressHostCopilot && \(\s*<JourneyCopilotHost/);
  });

  it('suppressHostCopilot is declared only on embed descriptors — an inert flag on a non-embed surface would be MS-7 (an inert mechanism)', async () => {
    const { JOURNEY_SURFACES } = await import('@/services/journey/journeySurfaceRegistry');
    for (const [ref, d] of Object.entries(JOURNEY_SURFACES) as [string, Record<string, unknown>][]) {
      if (d.kind === 'embed') continue;
      expect(d.suppressHostCopilot, `${ref} is ${String(d.kind)}; suppressHostCopilot there would be inert`).toBeUndefined();
    }
  });
});
