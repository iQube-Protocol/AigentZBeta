/**
 * Homecoming Phase II WP-A, Increment 1 (see
 * `codexes/packs/agentiq/updates/2026-08-16_homecoming-phase-ii-activation-pack.md`'s
 * WP-A Amendment) — Aletheon wired into the existing specialist-consult
 * seam (`services/agents/specialistRouter.ts` + `app/api/assistant/ask-agent/route.ts`),
 * the same pattern every other specialist (Marketa, MoneyPenny, Nakamoto,
 * Kn0w1, ...) already uses.
 *
 * This is explicitly NOT "Aletheon activated as aigentMe" — that is
 * Increment 2, deliberately deferred (it requires threading the resolved
 * `currentAigentMe` assignment through the aigentMe Copilot's chat backend,
 * a much larger change to shared, high-traffic infrastructure). This test
 * only proves Increment 1: Aletheon is reachable as an explicitly-consulted
 * specialist, and no identity/binding/grant row is touched to make that true.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('WP-A Increment 1 — Aletheon wired into the specialist router', () => {
  const routerSrc = stripComments(readSource('services/agents/specialistRouter.ts'));
  const recommenderSrc = stripComments(readSource('services/orchestration/specialistRecommender.ts'));
  const askAgentSrc = stripComments(readSource('app/api/assistant/ask-agent/route.ts'));
  const personasSrc = stripComments(readSource('app/data/personas.ts'));

  it('specialistRouter.ts: SpecialistId union includes aletheon', () => {
    const idx = routerSrc.indexOf('export type SpecialistId =');
    const block = routerSrc.slice(idx, routerSrc.indexOf(';', idx));
    expect(block).toContain("'aletheon'");
  });

  it('specialistRouter.ts: SPECIALIST_PERSONA_KEY and SPECIALIST_LABELS both carry an aletheon entry', () => {
    expect(routerSrc).toMatch(/SPECIALIST_PERSONA_KEY[\s\S]{0,400}aletheon:\s*'aigent-aletheon'/);
    expect(routerSrc).toMatch(/SPECIALIST_LABELS[\s\S]{0,400}aletheon:\s*'Aletheon'/);
  });

  it('specialistRouter.ts: templateResponse has a real aletheon branch, not a fallthrough to metaye', () => {
    const idx = routerSrc.indexOf("function templateResponse");
    // Fixed generous window rather than searching for a section-header comment
    // (comments are blanked to spaces by stripComments, so their text can't be
    // used as a delimiter here) — wide enough to cover the whole function body.
    const body = routerSrc.slice(idx, idx + 11000);
    expect(body).toContain("specialistId === 'aletheon'");
    expect(body).toContain('Constitutional context for');
  });

  it('specialistRecommender.ts: all three Record<SpecialistId,...> maps carry an aletheon entry', () => {
    expect(recommenderSrc).toMatch(/SPECIALIST_LABELS[\s\S]{0,400}aletheon:\s*'Aletheon'/);
    expect(recommenderSrc).toMatch(/SPECIALIST_DESCRIPTIONS[\s\S]{0,800}aletheon:/);
    expect(recommenderSrc).toMatch(/SPECIALIST_ACTIVATION_GATE[\s\S]{0,600}aletheon:\s*null/);
  });

  it('ask-agent route: VALID_SPECIALISTS includes aletheon so the route no longer 400s on it', () => {
    const idx = askAgentSrc.indexOf('const VALID_SPECIALISTS');
    const line = askAgentSrc.slice(idx, askAgentSrc.indexOf(';', idx));
    expect(line).toContain("'aletheon'");
  });

  it('app/data/personas.ts: a real aigent-aletheon persona entry exists, sourced from the Agent Card (motto present, no fabricated content)', () => {
    expect(personasSrc).toContain('"aigent-aletheon"');
    expect(personasSrc).toContain('Not to command the path, but to illuminate it.');
  });

  it('regression pin: no identity/binding/grant table is touched by this wiring (structural — router/recommender/route files only reference in-memory maps, never Supabase)', () => {
    for (const src of [routerSrc, recommenderSrc]) {
      expect(src).not.toMatch(/agent_root_identity|delegation_grants|persona_agent_assignments/);
    }
  });
});
