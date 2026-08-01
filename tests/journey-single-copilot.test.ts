/**
 * One copilot inside the journey viewport (operator direction, 2026-08-02):
 *
 *   > "let's suppress the floating copilot for aigentMe JUST IN THIS JOURNEY
 *   > map so we don't have the two conflicting ones rendered at once."
 *
 * The journey composes real cartridges by iframe and runs its OWN companion
 * above them. `metame-codex` mounts a floating copilot on every tab, so the
 * aigentMe stage put two on screen — different agents, different context,
 * each believing it was the operator's conversational partner. That is MS-1
 * ("one navigation") and MS-2 ("one owner per surface") broken at once.
 *
 * ── What must stay true, and what must NOT become true ─────────────────────
 *
 * The dangerous over-correction is disabling the copilot for the CARTRIDGE.
 * metame-codex opened on its own still needs it, where it is the only one and
 * entirely correct. So the suppression is:
 *
 *   · per SURFACE   — declared in the journey's surface registry, because only
 *                     a cartridge that mounts its own copilot needs it;
 *   · per MOUNT     — a prop on CodexPanelDynamic, defaulting to false, so no
 *                     existing mount changes;
 *   · opt-IN        — `?copilot=off` is emitted only when asked for, so every
 *                     existing embed URL is byte-identical.
 */

import { describe, it, expect } from 'vitest';

import { JOURNEY_SURFACES } from '@/services/journey/journeySurfaceRegistry';
import { buildCodexUrl } from '@/utils/codex-nav';
import { readSource, stripComments } from './_lib/sourceAuthority';

const PANEL = 'app/triad/components/CodexPanelDynamic.tsx';
const EMBED_PAGE = 'app/(embed)/triad/embed/codex/[codexSlug]/page.tsx';
const RUNNER = 'components/journey/JourneyRunSurface.tsx';

describe('the aigentMe journey surface suppresses the cartridge’s own copilot', () => {
  it('is declared on the surface, where what-is-being-composed is recorded', () => {
    const surface = JOURNEY_SURFACES['aigentme-welcome'];
    expect(surface.kind).toBe('embed');
    if (surface.kind !== 'embed') throw new Error('unreachable');
    expect(surface.codexSlug).toBe('metame-codex');
    expect(surface.suppressFloatingCopilot).toBe(true);
  });

  it('is NOT declared on surfaces that compose a bare component — there is no second copilot to suppress', () => {
    for (const [ref, d] of Object.entries(JOURNEY_SURFACES)) {
      if (d.kind === 'embed') continue;
      expect(
        (d as Record<string, unknown>).suppressFloatingCopilot,
        `${ref} is ${d.kind}; a suppression flag there would be an inert mechanism (MS-7)`,
      ).toBeUndefined();
    }
  });
});

describe('buildCodexUrl emits the suppression only when asked', () => {
  it('adds copilot=off when suppressCopilot is set', () => {
    const url = buildCodexUrl('metame-codex', { tab: 'aigent-me', suppressCopilot: true });
    expect(url).toContain('copilot=off');
  });

  it('every existing call shape is unchanged — no copilot param appears by default', () => {
    for (const opts of [
      {},
      { tab: 'aigent-me' },
      { tab: 'aigent-me', personaId: 'p1' },
      { tab: 'aigent-me', shell: 'viewer' as const },
      { tab: 'aigent-me', suppressCopilot: false },
    ]) {
      expect(buildCodexUrl('metame-codex', opts)).not.toContain('copilot');
    }
  });
});

describe('the suppression travels end to end, and defaults to off at every hop', () => {
  it('the journey runner reads the flag from the descriptor rather than naming a cartridge', () => {
    const src = stripComments(readSource(RUNNER));
    expect(src).toContain('suppressCopilot: descriptor.suppressFloatingCopilot');
    expect(
      src,
      'hardcoding the cartridge here would put the rule in two places and drift from the registry',
    ).not.toContain("'metame-codex'");
  });

  it('the embed page treats only the exact value as the suppression', () => {
    const src = stripComments(readSource(EMBED_PAGE));
    expect(src).toMatch(/searchParams\?\.get\("copilot"\)\s*===\s*"off"/);
    expect(src).toContain('suppressFloatingCopilot={querySuppressCopilot || undefined}');
  });

  it('the panel prop defaults to false, so no other mount loses its copilot', () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/suppressFloatingCopilot\?:\s*boolean/);
    expect(src).toMatch(/suppressFloatingCopilot\s*=\s*false/);
  });

  it('the panel returns null BEFORE constructing the copilot, and only for this reason', () => {
    const src = stripComments(readSource(PANEL));
    const guardAt = src.indexOf('if (suppressFloatingCopilot) return null;');
    expect(guardAt).toBeGreaterThan(-1);
    const mountAt = src.indexOf('<CodexCopilotLayer');
    expect(mountAt).toBeGreaterThan(-1);
    expect(guardAt, 'the guard must precede the mount, or it suppresses nothing').toBeLessThan(mountAt);
    // Exactly one floating-copilot mount in the file — suppressing one of two
    // would leave the other on screen and look like the flag simply failed.
    expect((src.match(/<CodexCopilotLayer/g) ?? []).length).toBe(1);
  });

  it('the cartridge config is untouched — metame-codex keeps its copilot everywhere else', async () => {
    const { CODEX_DEFINITIONS } = await import('@/data/codex-configs');
    const metame = CODEX_DEFINITIONS.find((c) => c.id === 'metame-codex');
    expect(metame, 'metame-codex must still be registered').toBeTruthy();
    expect(
      metame?.copilot?.disabled,
      'disabling it in the cartridge config would remove the copilot from standalone use too',
    ).not.toBe(true);
  });
});
