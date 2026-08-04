/**
 * Agent-scoped embed navigation (al, 2026-08-04) — the final hop of the
 * Nakamoto aigentMe disposition fix (see
 * tests/aigentme-disposition-agent-scoping.test.ts for the route-level half).
 *
 * ── THE CONTRACT ───────────────────────────────────────────────────────────
 *
 * `CodexNavOptions.agentSlug` is a single NAMED, TYPED field on the shared
 * cross-cartridge navigation contract — never a generic query-string escape
 * hatch. It is appended to an embed surface's URL ONLY when that surface's
 * own journeySurfaceRegistry descriptor opts in via `agentScoped: true`
 * (today: 'aigentme-welcome' alone). Every other embed surface
 * ('founder-office', 'passport-bureau-apply') must render byte-for-byte
 * identically whether or not a Journey agent is selected — proving that is
 * this file's negative canary.
 *
 * The receiving route never trusts the value directly: it is resolved
 * server-side through `resolveRegistrableAgent` (see
 * tests/aigentme-disposition-agent-scoping.test.ts), which is what this file
 * connects the generated URL's `agentSlug` value to.
 */

import { describe, it, expect } from 'vitest';
import { buildCodexUrl } from '@/utils/codex-nav';
import { JOURNEY_SURFACES, buildEmbedSurfaceSrc, type JourneySurfaceDescriptor } from '@/services/journey/journeySurfaceRegistry';
import { resolveRegistrableAgent } from '@/services/horizen/registrableAgents';

function embedDescriptor(ref: string): Extract<JourneySurfaceDescriptor, { kind: 'embed' }> {
  const descriptor = JOURNEY_SURFACES[ref];
  if (!descriptor || descriptor.kind !== 'embed') throw new Error(`"${ref}" is not a registered embed surface`);
  return descriptor;
}

describe('buildCodexUrl — agentSlug is a named field, not a passthrough', () => {
  it('omits agentSlug entirely when not supplied — every existing caller unaffected', () => {
    const url = buildCodexUrl('metame-codex', { tab: 'aigent-me', personaId: 'p1' });
    expect(new URL(url, 'https://example.test').searchParams.has('agentSlug')).toBe(false);
  });

  it('includes agentSlug, URL-encoded, when explicitly supplied', () => {
    const url = buildCodexUrl('metame-codex', { tab: 'aigent-me', personaId: 'p1', agentSlug: 'nakamoto' });
    expect(new URL(url, 'https://example.test').searchParams.get('agentSlug')).toBe('nakamoto');
  });

  it('does not add any OTHER new query params alongside agentSlug (no generic escape hatch)', () => {
    const withoutAgent = new URL(
      buildCodexUrl('metame-codex', { tab: 'aigent-me', personaId: 'p1' }),
      'https://example.test',
    ).searchParams;
    const withAgent = new URL(
      buildCodexUrl('metame-codex', { tab: 'aigent-me', personaId: 'p1', agentSlug: 'nakamoto' }),
      'https://example.test',
    ).searchParams;
    const withoutKeys = new Set(withoutAgent.keys());
    const withKeys = new Set(withAgent.keys());
    withKeys.delete('agentSlug');
    expect(withKeys).toEqual(withoutKeys);
  });
});

describe('buildEmbedSurfaceSrc — POSITIVE: the Journey ladder\'s aigentme-welcome iframe', () => {
  it('carries agentSlug=nakamoto through to the generated iframe URL', () => {
    const descriptor = embedDescriptor('aigentme-welcome');
    expect(descriptor.agentScoped).toBe(true); // the opt-in the whole fix depends on

    const src = buildEmbedSurfaceSrc(descriptor, { personaId: 'p1', selectedAgentSlug: 'nakamoto' }, buildCodexUrl);
    const agentSlugInUrl = new URL(src, 'https://example.test').searchParams.get('agentSlug');
    expect(agentSlugInUrl).toBe('nakamoto');

    // Connects the URL value to what the disposition route actually does
    // with it: resolve through resolveRegistrableAgent, never trust it as
    // the runtime id directly.
    const resolved = resolveRegistrableAgent(agentSlugInUrl);
    expect(resolved?.runtimeAgentId).toBe('aigent-nakamoto');
    expect(resolved?.runtimeAgentId).not.toBe('aigent-moneypenny');
  });

  it('omits agentSlug when no agent is selected — MoneyPenny-only legacy callers unaffected', () => {
    const descriptor = embedDescriptor('aigentme-welcome');
    const src = buildEmbedSurfaceSrc(descriptor, { personaId: 'p1' }, buildCodexUrl);
    expect(new URL(src, 'https://example.test').searchParams.has('agentSlug')).toBe(false);
  });
});

describe('buildEmbedSurfaceSrc — NEGATIVE: unrelated embed surfaces are untouched', () => {
  it.each(['founder-office', 'passport-bureau-apply'])(
    '"%s" never receives agentSlug, even when a Journey agent IS selected',
    (ref) => {
      const descriptor = embedDescriptor(ref);
      expect(descriptor.agentScoped).toBeUndefined();

      const src = buildEmbedSurfaceSrc(descriptor, { personaId: 'p1', selectedAgentSlug: 'nakamoto' }, buildCodexUrl);
      expect(new URL(src, 'https://example.test').searchParams.has('agentSlug')).toBe(false);
    },
  );

  it("founder-office's generated URL is IDENTICAL with or without a selected agent", () => {
    const descriptor = embedDescriptor('founder-office');
    const withAgent = buildEmbedSurfaceSrc(descriptor, { personaId: 'p1', selectedAgentSlug: 'nakamoto' }, buildCodexUrl);
    const withoutAgent = buildEmbedSurfaceSrc(descriptor, { personaId: 'p1' }, buildCodexUrl);
    expect(withAgent).toBe(withoutAgent);
  });
});
