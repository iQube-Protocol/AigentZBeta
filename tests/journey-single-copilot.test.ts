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
// The embed-src construction (including suppressCopilot) was extracted from
// RUNNER into a pure, unit-testable helper (al, 2026-08-04) — see
// tests/journey-agent-scoped-embed.test.ts for its own direct coverage. The
// invariant this file guards (read from the descriptor, never hardcode a
// cartridge) now lives here.
const REGISTRY = 'services/journey/journeySurfaceRegistry.ts';

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
  it('the embed-src builder reads the flag from the descriptor rather than naming a cartridge', () => {
    const src = stripComments(readSource(REGISTRY));
    expect(src).toContain('suppressCopilot: descriptor.suppressFloatingCopilot');
  });

  it('the journey runner itself no longer constructs the embed src inline — one builder, not two', () => {
    const src = stripComments(readSource(RUNNER));
    expect(
      src,
      'a second, hand-inlined suppressCopilot construction here would drift from the registry builder',
    ).not.toContain('suppressCopilot: descriptor.suppressFloatingCopilot');
    expect(src).toContain('buildEmbedSurfaceSrc(descriptor');
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

/**
 * TWO STAGES, TWO SURFACES, TWO INSTANCES (operator report ×2, 2026-08-02).
 *
 *   > "the Deploy and Standing tabs are still merged — the same page once one
 *   > is active … if standing is selected first then the deploy tab renders
 *   > standing content."
 *
 * The Deploy and Standing stages mount the SAME component (ParticipationStandingTab)
 * pinned to different views. Keyed by array position — `key={i}`, which is "0"
 * for both, since each stage has one surface — React saw the same component type
 * at the same key and RECONCILED rather than remounting. The changed `only` prop
 * arrived; the instance's first-mount state ignored it.
 *
 * Identity must come from WHAT is rendered, never from WHERE it sits in a list.
 * Two fixes, because either alone leaves a live footgun: the runner keys by
 * surface, and the component treats `only` as authoritative on every render
 * (tests/participation-standing-ingestion-tab.test.ts).
 */
describe('journey surfaces are identified by what they are, not by list position', () => {
  it('the runner keys each mounted surface by stage + surface ref', () => {
    const src = stripComments(readSource(RUNNER));
    expect(src).toMatch(/key=\{`\$\{activeStage\.id\}:\$\{surfaceRef\.ref\}`\}/);
  });

  it('no component surface is keyed by its array index', () => {
    const src = stripComments(readSource(RUNNER));
    const mountAt = src.indexOf('<Component personaId={personaId}');
    expect(mountAt).toBeGreaterThan(-1);
    const wrapper = src.slice(Math.max(0, mountAt - 400), mountAt);
    expect(
      wrapper,
      'key={i} makes every stage’s first surface key "0" — two stages sharing a component then share its state',
    ).not.toMatch(/key=\{i\}/);
  });

  it('Activate and Standing really are two distinct surfaces of the same component', async () => {
    const { HORIZEN_MONEYPENNY_JOURNEY } = await import('@/services/journey/horizenMoneyPennyJourney');
    // Was `deploy` — the registry-catalogue surface re-homed onto `activate`
    // (Activate Consolidation, 2026-08-11); `deploy` itself now carries no
    // surfaces (legacy/internal only — see its own header comment).
    const activate = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'activate');
    const standing = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'standing');
    // By ref, not position — Activate carries a second surface, its own
    // guided Ingest act ('ingest-into-factory-action', Horizen Pilot Closure
    // part 2, 2026-08-09), ahead of this one in the array. Identity must
    // come from what is being rendered, never from where it sits in the
    // list — this test's own point — so it must not itself assume position
    // either.
    const activateSurface = activate!.surfaces.find((s) => s.ref === 'venture-participate-standing')!;
    const standingSurface = standing!.surfaces.find((s) => s.ref === 'venture-participate-standing-only')!;
    // Different surface refs — so the new key differs even though both stages
    // render the same component.
    expect(activateSurface.ref).not.toBe(standingSurface.ref);
    // …pinned to different views, which is what made the shared instance visible.
    expect((activateSurface.props as { only?: string })?.only).toBe('registry');
    expect((standingSurface.props as { only?: string })?.only).toBe('standing');
    // …and both resolve to the SAME component (never a fork — inv.engineering.037).
    const d = JOURNEY_SURFACES[activateSurface.ref];
    const s = JOURNEY_SURFACES[standingSurface.ref];
    expect(d.kind).toBe('component');
    expect(s.kind).toBe('component');
    if (d.kind !== 'component' || s.kind !== 'component') throw new Error('unreachable');
    expect(d.component).toBe('ParticipationStandingTab');
    expect(s.component).toBe('ParticipationStandingTab');
  });
});
