/**
 * AEE-XP-001 §10/XP-5 (2026-09-01) — proves the actual runtime PATH the
 * resolved companion identity travels, end to end, at the source level
 * (this codebase's established pattern for wiring proofs across files that
 * would otherwise need a live Supabase instance to exercise behaviorally —
 * see tests/journey-copilot-invariant-acceptance.test.ts, tests/ctp-channel-
 * singularity.test.ts):
 *
 *   journey `state` route (server, request-bearing)
 *     -> resolvePrimaryCompanionForJourney(req, journey)
 *     -> runtimeState.resolvedCompanionAgent
 *     -> JourneyRunSurface (client) reads runtimeState.resolvedCompanionAgent
 *     -> JourneyCopilotHost prop
 *     -> substitutes ONLY `agent`; accentColor/prompt/quickPrompts stay the
 *        journey's own static resolveJourneyCopilot() output.
 *
 * The resolver's own behavior (fallback vs override vs fail-open) is proven
 * separately and behaviorally in tests/journey-copilot-primary-companion.test.ts —
 * this file only pins that every hop in the path actually exists in source.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const STATE_ROUTES = [
  ['KNYTS Bridge', 'app/api/journey/knyts-bridge/state/route.ts', 'KNYTS_BRIDGE_CROSSING_JOURNEY'],
  ['Constitutional Internet Bridge', 'app/api/journey/constitutional-internet-bridge/state/route.ts', 'CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY'],
  ['Horizen MoneyPenny (Financial Services Bridge)', 'app/api/journey/moneypenny-horizen/state/route.ts', 'HORIZEN_MONEYPENNY_JOURNEY'],
] as const;

describe.each(STATE_ROUTES)('%s state route resolves and projects the companion identity', (_label, path, journeyConst) => {
  const src = stripComments(readSource(path));

  it('imports resolvePrimaryCompanionForJourney — the ONE existing resolver, never a second implementation', () => {
    expect(src).toMatch(/import\s*\{\s*resolvePrimaryCompanionForJourney\s*\}\s*from\s*['"]@\/services\/journey\/primaryCompanionResolver['"]/);
  });

  it(`calls it with the real request and ${journeyConst}, and sets resolvedCompanionAgent on the returned state`, () => {
    expect(src).toContain('resolvedCompanionAgent');
    expect(src).toMatch(new RegExp(`resolvePrimaryCompanionForJourney\\(req,\\s*${journeyConst}\\)`));
  });
});

describe('JourneyRunSurface projects the resolved companion from runtime state into JourneyCopilotHost', () => {
  const src = stripComments(readSource('components/journey/JourneyRunSurface.tsx'));

  it('passes resolvedCompanionAgent from runtimeState as a prop', () => {
    expect(src).toMatch(/resolvedCompanionAgent=\{runtimeState\?\.resolvedCompanionAgent\}/);
  });
});

describe('JourneyCopilotHost substitutes ONLY the agent identity — accent/prompt/quickPrompts stay the static resolution', () => {
  const src = stripComments(readSource('components/journey/JourneyCopilotHost.tsx'));

  it('accepts resolvedCompanionAgent and falls open to resolveJourneyCopilot()\'s own agent when absent', () => {
    expect(src).toMatch(/const agent = resolvedCompanionAgent \?\? resolved\.agent;/);
  });

  it('CodexCopilotLayer receives the overridable `agent` but the UNCHANGED static accentColor/promptPlaceholder/quickPrompts', () => {
    const mountStart = src.indexOf('<CodexCopilotLayer');
    const mountEnd = src.indexOf('/>', mountStart);
    const mount = src.slice(mountStart, mountEnd);
    expect(mount).toMatch(/accentColor=\{resolved\.accentColor\}/);
    expect(mount).toMatch(/agent=\{agent\}/);
    expect(mount).not.toMatch(/agent=\{resolved\.agent\}/);
    expect(mount).toMatch(/promptPlaceholder=\{resolved\.promptPlaceholder\}/);
    expect(mount).toMatch(/quickPrompts=\{resolved\.quickPrompts\}/);
  });

  it('never imports NextRequest or any server-side identity resolver directly — stays a plain client component receiving data as props', () => {
    expect(src).not.toMatch(/NextRequest/);
    expect(src).not.toMatch(/resolveAigentMeIdentity/);
    expect(src).not.toMatch(/resolvePrimaryCompanionForJourney/);
  });
});

/*
 * 2026-09-01 INCIDENT CANARY — 15 consecutive Amplify deploys failed with
 * `UnhandledSchemeError: Reading from "node:crypto" is not handled by
 * plugins` because `resolvePrimaryCompanionForJourney` (which statically
 * imports `resolveAigentMeIdentity` -> ... -> Node's `crypto` module) lived
 * in journeyCopilotResolver.ts — the SAME FILE `JourneyCopilotHost.tsx` (a
 * `'use client'` component) imports `resolveJourneyCopilot` from.
 *
 * The direct-import checks above (asserting JourneyCopilotHost.tsx's OWN
 * source never mentions `resolveAigentMeIdentity`) were NOT sufficient to
 * catch this — the leak was transitive, through the shared module's full
 * static import graph, which webpack must resolve for the client bundle
 * the moment ANY export is imported, whether or not it's ever called. The
 * real guard is on the shared file itself: it must carry NO server-only
 * import, ever, because a client component depends on it.
 */
describe('journeyCopilotResolver.ts stays CLIENT-BUNDLE-SAFE — no transitive server-only import, ever', () => {
  const src = stripComments(readSource('services/journey/journeyCopilotResolver.ts'));

  it('never imports next/server, resolveAigentMeIdentity, or anything from primaryCompanionResolver.ts', () => {
    expect(src).not.toMatch(/from\s*['"]next\/server['"]/);
    expect(src).not.toMatch(/NextRequest/);
    expect(src).not.toMatch(/resolveAigentMeIdentity/);
    expect(src).not.toMatch(/from\s*['"]@\/services\/journey\/primaryCompanionResolver['"]/);
  });

  it('only exports the pure, synchronous resolveJourneyCopilot (plus its return type) — resolvePrimaryCompanionForJourney lives elsewhere', () => {
    expect(src).toMatch(/export function resolveJourneyCopilot\(/);
    expect(src).not.toMatch(/export (async )?function resolvePrimaryCompanionForJourney/);
  });
});
