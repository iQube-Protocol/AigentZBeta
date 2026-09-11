/**
 * `listCandidatesAcrossSubDomains` — the "EXP-P1 Crystal v2 sub-domain
 * invisibility" repair (2026-09-03), and the canary for
 * RES-2026-09-03-EXP-P1-SUBDOMAIN-INVISIBILITY-001 /
 * CI-2026-09-03-PROGRAMME-COHORT-READS-ALL-SUBDOMAINS-001.
 *
 * ── THE DEFECT THIS GUARDS AGAINST ──────────────────────────────────────────
 *
 * `listCandidates(admin, domain)` — called with no `subDomain` — deliberately
 * narrows to `sub_domain IS NULL` ("the domain baseline view", its own
 * comment). That is correct for a single scoped UI view. It is WRONG for any
 * "programme cohort" read: `loadTrack2ProgrammeState` (the orchestrator's own
 * signal composition, feeding the Copilot's population disclosure and the
 * advance-until-gate loop) and `resolveSuccessorConstructionCohort` (Stage 6
 * validate, Stage 7 relationships, relationship-adjudication) both called the
 * narrowed form, and every institution-driven discovery run
 * (`runDiscoveryForInstitution`) tags its candidates with a non-null
 * `sub_domain` (the institution's pillar/topic) — so 55 of 75 promoted
 * EXP-P1/financial-services candidates (73%) sat permanently invisible to
 * validation, relationships and crystal assignment. Live-DB confirmed via
 * Supabase project bsjhfvctmduxhohtllly, 2026-09-03.
 *
 * This test asserts the NEW function reads every `sub_domain` (never adds an
 * `is`/`eq` filter on that column), and that the two "programme cohort"
 * modules read through it rather than the narrowed baseline view.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';

import { listCandidatesAcrossSubDomains } from '@/services/invariants/discoveryEngine';

type Call = { method: string; args: unknown[] };

/** A minimal fake Supabase client that dispatches by table name and records
 *  every chain call made against the `discovery_candidates` builder, so the
 *  test can assert `sub_domain` was never filtered on. */
function fakeAdmin(rowsByTable: Record<string, Array<Record<string, unknown>>>): {
  client: SupabaseClient;
  callsFor: (table: string) => Call[];
} {
  const calls: Record<string, Call[]> = {};

  function builderFor(table: string) {
    calls[table] = calls[table] ?? [];
    const record = (method: string, ...args: unknown[]) => {
      calls[table].push({ method, args });
      return chainable;
    };
    const chainable: Record<string, unknown> = {
      select: (...a: unknown[]) => record('select', ...a),
      eq: (...a: unknown[]) => record('eq', ...a),
      is: (...a: unknown[]) => record('is', ...a),
      in: (...a: unknown[]) => record('in', ...a),
      or: (...a: unknown[]) => record('or', ...a),
      order: (...a: unknown[]) => record('order', ...a),
      then: (
        onfulfilled: (v: { data: unknown; error: null }) => unknown,
        onrejected?: (reason: unknown) => unknown,
      ) => Promise.resolve({ data: rowsByTable[table] ?? [], error: null }).then(onfulfilled, onrejected),
    };
    return chainable;
  }

  return {
    client: { from: (table: string) => builderFor(table) } as unknown as SupabaseClient,
    callsFor: (table: string) => calls[table] ?? [],
  };
}

describe('listCandidatesAcrossSubDomains', () => {
  it('reads every sub_domain (including null) — never narrows to the baseline view', async () => {
    const rows = [
      { id: 'a', domain: 'financial-services', sub_domain: null, status: 'promoted', scope_level: 'domain', discovery_provenance: {}, created_at: '2026-01-01' },
      { id: 'b', domain: 'financial-services', sub_domain: 'banking', status: 'promoted', scope_level: 'domain', discovery_provenance: {}, created_at: '2026-01-02' },
      { id: 'c', domain: 'financial-services', sub_domain: 'qriptocent', status: 'promoted', scope_level: 'domain', discovery_provenance: {}, created_at: '2026-01-03' },
    ];
    const { client, callsFor } = fakeAdmin({ discovery_candidates: rows, discovery_evidence: [] });

    const result = await listCandidatesAcrossSubDomains(client, 'financial-services');

    expect(result.map((r) => r.id).sort()).toEqual(['a', 'b', 'c']);
    expect(result.map((r) => r.subDomain).sort()).toEqual([null, 'banking', 'qriptocent'].sort());

    // The defect, made unrepresentable: no filter on `sub_domain` at all.
    const candidateCalls = callsFor('discovery_candidates');
    const subDomainFiltered = candidateCalls.some(
      (c) => (c.method === 'eq' || c.method === 'is') && c.args[0] === 'sub_domain',
    );
    expect(subDomainFiltered).toBe(false);

    // It still scopes to the requested domain — this is a widen, not an
    // unscope.
    const domainFiltered = candidateCalls.some((c) => c.method === 'eq' && c.args[0] === 'domain' && c.args[1] === 'financial-services');
    expect(domainFiltered).toBe(true);
  });

  it('throws on a genuine query error — never swallows to an empty cohort (RES-2026-09-01-TRACK2-FAIL-SOFT-SWALLOWED-001 discipline, applied to the new reader too)', async () => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    Object.assign(builder, {
      select: chain, eq: chain, order: chain,
      then: (
        onfulfilled: (v: { data: null; error: { message: string } }) => unknown,
        onrejected?: (reason: unknown) => unknown,
      ) => Promise.resolve({ data: null, error: { message: 'canceling statement due to statement timeout' } }).then(onfulfilled, onrejected),
    });
    const client = { from: () => builder } as unknown as SupabaseClient;

    await expect(listCandidatesAcrossSubDomains(client, 'financial-services')).rejects.toThrow();
  });
});

describe('programme-cohort readers use the across-sub-domains view (source-level canary)', () => {
  const repoRoot = join(__dirname, '..');

  it('researchProgrammeOrchestrator.ts composes Track2ProgrammeState via listCandidatesAcrossSubDomains, never the narrowed listCandidates(admin, acquisitionDomain) call', () => {
    const src = readFileSync(join(repoRoot, 'services/research/researchProgrammeOrchestrator.ts'), 'utf8');
    expect(src).toMatch(/listCandidatesAcrossSubDomains\(admin, acquisitionDomain\)/);
    // The narrowed baseline-view call must not reappear for this composition —
    // guards against a future edit silently reverting to the invisible slice.
    expect(src).not.toMatch(/[^s]listCandidates\(admin, acquisitionDomain\)/);
  });

  it('crystalCohortMembership.ts resolves the successor construction cohort via listCandidatesAcrossSubDomains', () => {
    const src = readFileSync(join(repoRoot, 'services/research/crystalCohortMembership.ts'), 'utf8');
    expect(src).toMatch(/listCandidatesAcrossSubDomains\(admin, acquisitionDomain\)/);
    expect(src).not.toMatch(/[^s]listCandidates\(admin, acquisitionDomain\)/);
  });
});
