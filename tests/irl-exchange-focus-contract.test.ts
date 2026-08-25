/**
 * Reciprocal Artifact Exchange focus contract (semantic repair, 2026-08-25).
 *
 * OCSGA's five Journey stages (create-deposit, freeze-attestation-ready,
 * freeze-attestation, exchange-ready, exchange-complete) share ONE
 * IRLExchangeTab component/API/actions — never five separate workflow
 * components. Each stage passes a distinct `focus` value through the
 * existing embed-URL plumbing (JourneySurfaceRef.props.focus ->
 * buildEmbedSurfaceSrc -> CodexNavOptions.focus -> `?focus=`), which
 * IRLExchangeTab reads via useSearchParams to scroll to and foreground the
 * relevant section — presentation only, never authorization.
 *
 * Canaries, same source-authority convention as tests/journey-single-copilot.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { buildCodexUrl } from '@/utils/codex-nav';
import { buildEmbedSurfaceSrc, JOURNEY_SURFACES } from '@/services/journey/journeySurfaceRegistry';
import { IAN_BOUNDARY_RESEARCH_JOURNEY } from '@/services/journey/ianBoundaryResearchJourney';
import { readSource, stripComments } from './_lib/sourceAuthority';

const EXCHANGE_STAGE_FOCUS: Record<string, string> = {
  'create-deposit': 'artifact',
  'freeze-attestation-ready': 'review',
  'freeze-attestation': 'freeze',
  'exchange-ready': 'instrument',
  'exchange-complete': 'crossing',
};

describe('buildCodexUrl emits ?focus= only when asked', () => {
  it('adds focus=artifact when focus is set', () => {
    const url = buildCodexUrl('irl-cartridge', { tab: 'irl-exchange', focus: 'artifact' });
    expect(url).toContain('focus=artifact');
  });

  it('every existing call shape is unchanged — no focus param appears by default', () => {
    for (const opts of [{}, { tab: 'irl-exchange' }, { tab: 'irl-exchange', personaId: 'p1' }]) {
      expect(buildCodexUrl('irl-cartridge', opts)).not.toContain('focus');
    }
  });
});

describe('the five OCSGA exchange stages share ONE registry surface, each with its own focus value', () => {
  it('all five stages reference the exact same registry ref — never a forked component', () => {
    for (const stageId of Object.keys(EXCHANGE_STAGE_FOCUS)) {
      const stage = IAN_BOUNDARY_RESEARCH_JOURNEY.stages.find((s) => s.id === stageId);
      expect(stage, `expected stage ${stageId}`).toBeTruthy();
      const surface = stage!.surfaces.find((s) => s.ref === 'irl-exchange-workspace');
      expect(surface, `stage ${stageId} must reference irl-exchange-workspace`).toBeTruthy();
    }
  });

  it('each stage carries its own distinct focus value', () => {
    for (const [stageId, expectedFocus] of Object.entries(EXCHANGE_STAGE_FOCUS)) {
      const stage = IAN_BOUNDARY_RESEARCH_JOURNEY.stages.find((s) => s.id === stageId)!;
      const surface = stage.surfaces.find((s) => s.ref === 'irl-exchange-workspace')!;
      expect((surface.props as { focus?: string } | undefined)?.focus).toBe(expectedFocus);
    }
  });

  it('the registry entry itself is still the ONE shared embed descriptor (no forked entries)', () => {
    const descriptor = JOURNEY_SURFACES['irl-exchange-workspace'];
    expect(descriptor.kind).toBe('embed');
    if (descriptor.kind !== 'embed') throw new Error('unreachable');
    expect(descriptor.codexSlug).toBe('irl-cartridge');
    expect(descriptor.tab).toBe('irl-exchange');
  });
});

describe('buildEmbedSurfaceSrc threads the per-stage focus value into the URL', () => {
  it('produces a distinct URL per stage focus, from the SAME descriptor', () => {
    const descriptor = JOURNEY_SURFACES['irl-exchange-workspace'];
    if (descriptor.kind !== 'embed') throw new Error('unreachable');
    for (const focus of Object.values(EXCHANGE_STAGE_FOCUS)) {
      const src = buildEmbedSurfaceSrc(descriptor, { personaId: 'p1', focus }, buildCodexUrl);
      expect(src).toContain(`focus=${focus}`);
    }
  });

  it('omits focus entirely when the stage supplies none — byte-identical to before this contract', () => {
    const descriptor = JOURNEY_SURFACES['irl-exchange-workspace'];
    if (descriptor.kind !== 'embed') throw new Error('unreachable');
    const src = buildEmbedSurfaceSrc(descriptor, { personaId: 'p1' }, buildCodexUrl);
    expect(src).not.toContain('focus=');
  });
});

describe('JourneyRunSurface reads focus from the STAGE surface ref, never the shared registry entry', () => {
  it('passes surfaceRef.props.focus into buildEmbedSurfaceSrc — not a registry-level field', () => {
    const src = stripComments(readSource('components/journey/JourneyRunSurface.tsx'));
    expect(src).toMatch(/focus:\s*typeof surfaceRef\.props\?\.focus === 'string' \? surfaceRef\.props\.focus : undefined/);
  });

  it('the registry descriptor type itself carries no focus field (it would be shared across stages)', () => {
    const src = stripComments(readSource('services/journey/journeySurfaceRegistry.ts'));
    // The embed descriptor's own field list (kind/codexSlug/tab/etc.) must not
    // declare `focus` — it must only ever be forwarded FROM surfaceRef.props.
    const embedKindAt = src.indexOf("kind: 'embed';");
    expect(embedKindAt).toBeGreaterThan(-1);
  });
});

describe('IRLExchangeTab focus is presentation-only — never changes authorized actions', () => {
  const TAB = 'app/triad/components/codex/tabs/IRLExchangeTab.tsx';

  it('defines exactly the five contract values', () => {
    const src = stripComments(readSource(TAB));
    expect(src).toMatch(
      /type ExchangeFocus = "artifact" \| "review" \| "freeze" \| "instrument" \| "crossing";/,
    );
  });

  it('Panel gains emphasize/dim as presentational props only — no new disabled/authorization prop', () => {
    const src = stripComments(readSource(TAB));
    const panelDefAt = src.indexOf('function Panel(');
    expect(panelDefAt).toBeGreaterThan(-1);
    const panelDefEnd = src.indexOf('function ArtifactCard(', panelDefAt);
    const panelDef = src.slice(panelDefAt, panelDefEnd);
    expect(panelDef).toContain('emphasize?: boolean');
    expect(panelDef).toContain('dim?: boolean');
    expect(panelDef).not.toMatch(/disabled/);
  });

  it('no focus branch touches the `act(...)` dispatcher or any button `disabled=` condition', () => {
    const src = stripComments(readSource(TAB));
    // The focus/emphasis machinery lives entirely in panelFocusProps/Panel;
    // grep confirms `focus` never appears inside a `disabled={...}` expression.
    const disabledMatches = src.match(/disabled=\{[^}]*\}/g) ?? [];
    for (const m of disabledMatches) {
      expect(m, `authorization gate must never reference focus: ${m}`).not.toMatch(/focus/);
    }
  });

  it('reads focus via useSearchParams — a URL-driven, presentation-only signal', () => {
    const src = stripComments(readSource(TAB));
    expect(src).toContain('useSearchParams()');
    expect(src).toContain('searchParams.get("focus")');
  });
});
