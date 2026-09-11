/**
 * Every registrable agent MUST declare a real runtime health surface —
 * Horizen Pilot Closure item 3 (2026-08-09).
 *
 * ── THE DEFECT THIS CANARY PREVENTS FROM RECURRING ──────────────────────────
 *
 * services/registry/runtimeDescriptor.ts and services/horizen/pulseEndpoint.ts
 * were already fully generic — neither hardcodes an agent. The actual gap was
 * silent: REGISTRABLE_AGENTS had no field that FORCED a new entry to also get
 * a runtime surface, so MoneyPenny was added, journeyed through Register/
 * Claim/Passport/Delegate, and only surfaced as "no metadata.runtime.endpoint"
 * when Ratify's Pulse/P&L section was audited — an undocumented migration
 * step nobody was reminded to take.
 *
 * `runtimeHealthPath` on `RegistrableAgentConfig` names what the surface
 * SHOULD be; this test fails the build if a listed agent either omits it or
 * names a route that does not actually exist on disk — the next agent cannot
 * silently skip this the way MoneyPenny did.
 *
 * This does NOT verify `registry_assets.metadata.runtime` was actually seeded
 * in the database (a live-infra fact this repo's unit tests do not reach) —
 * only that the AUTHORING step (declaring + building the health route) was
 * not skipped.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { listRegistrableAgents } from '@/services/horizen/registrableAgents';

describe('every registrable agent declares and ships a real runtime health surface', () => {
  const agents = listRegistrableAgents();

  it('is a non-vacuous check — at least one agent is actually registered', () => {
    expect(agents.length).toBeGreaterThan(0);
  });

  it.each(agents.map((a) => [a.slug, a] as const))('%s declares a runtimeHealthPath under /api/agents/', (_slug, agent) => {
    expect(typeof agent.runtimeHealthPath).toBe('string');
    expect(agent.runtimeHealthPath.length).toBeGreaterThan(0);
    expect(agent.runtimeHealthPath.startsWith('/api/agents/')).toBe(true);
  });

  it.each(agents.map((a) => [a.slug, a] as const))('%s\'s runtimeHealthPath resolves to a real route file on disk', (_slug, agent) => {
    const routeFile = path.join(process.cwd(), 'app', agent.runtimeHealthPath, 'route.ts');
    expect(fs.existsSync(routeFile), `expected ${routeFile} to exist for "${agent.slug}"`).toBe(true);
  });

  it('every runtimeHealthPath is distinct — no agent silently shares another\'s health surface', () => {
    const paths = agents.map((a) => a.runtimeHealthPath);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
