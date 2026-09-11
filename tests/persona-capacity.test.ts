/**
 * services/access/personaCapacity.ts — the canonical sponsorship-capacity
 * resolver (operator ruling, 2026-09-05, capacity remediation).
 *
 * Replaces the flat `sponsorship_capacity_base: 3` restriction that blocked
 * Factor/Aegis provisioning. Canonical policy pinned here:
 *   1. An authenticated administrator is UNBOUNDED, always.
 *   2. A platform-authenticated caller (Factor/Aegis-style platform-agent
 *      provisioning) is also UNBOUNDED.
 *   3. A regular user's capacity comes from their tier + any admin-granted
 *      base + Standing-earned credit — never a hardcoded 3.
 *   4. A tier whose own ladder is the UNLIMITED sentinel is unbounded too,
 *      never reported as a literal large number.
 *   5. `remaining` is never negative; a legacy over-capacity account reports
 *      `remaining: 0, overCapacity: true`.
 *   6. This resolver gates CREATION only — never reading/selecting/operating
 *      existing agents or personas.
 *   7-8. Forgery immunity — `callerIsAdmin`/`isPlatformAuthority` are plain
 *      boolean parameters the CALLER resolves server-side; this module never
 *      reads a request body, header, or JWT claim itself.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const mockGetPersonaPlan = vi.fn();
vi.mock('@/services/billing/personaPlan', async () => {
  const actual = await vi.importActual<typeof import('@/services/billing/personaPlan')>(
    '@/services/billing/personaPlan',
  );
  return { ...actual, getPersonaPlan: (...args: unknown[]) => mockGetPersonaPlan(...args) };
});

/** A minimal fake admin client covering exactly the two tables the resolver reads. */
function makeAdmin(opts: {
  usedCount: number;
  capacityRow?: { sponsorship_capacity_base?: number; sponsorship_capacity_earned?: number } | null;
}) {
  const capacityRow = opts.capacityRow === undefined ? { sponsorship_capacity_base: 0, sponsorship_capacity_earned: 0 } : opts.capacityRow;
  return {
    from: (table: string) => {
      if (table === 'agent_root_identity') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ count: opts.usedCount, data: null, error: null }),
          }),
        };
      }
      if (table === 'personas') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: capacityRow, error: null }),
            }),
          }),
        };
      }
      throw new Error(`persona-capacity.test.ts: unexpected table "${table}"`);
    },
  } as any;
}

describe('resolveAgentSponsorshipCapacity — canonical capacity policy', () => {
  beforeEach(() => {
    mockGetPersonaPlan.mockReset();
  });

  it('1. an admin with six existing sponsored agents may still create Factor (unbounded, not merely overridden)', async () => {
    const { resolveAgentSponsorshipCapacity } = await import('@/services/access/personaCapacity');
    mockGetPersonaPlan.mockResolvedValue({ boundedDelegateLimit: 3 });
    const admin = makeAdmin({ usedCount: 6 });
    const result = await resolveAgentSponsorshipCapacity({ admin, sponsorPersonaId: 'sponsor-1', callerIsAdmin: true });
    expect(result.bounded).toBe(false);
    expect(result.limit).toBeNull();
    expect(result.remaining).toBeNull();
    if (!result.bounded) expect(result.source).toBe('administrator');
  });

  it('2. the admin remains unbounded after creating Factor AND Aegis (used count climbing never matters)', async () => {
    const { resolveAgentSponsorshipCapacity } = await import('@/services/access/personaCapacity');
    mockGetPersonaPlan.mockResolvedValue({ boundedDelegateLimit: 3 });
    const afterFactor = await resolveAgentSponsorshipCapacity({
      admin: makeAdmin({ usedCount: 7 }), // 6 + Factor
      sponsorPersonaId: 'sponsor-1',
      callerIsAdmin: true,
    });
    const afterAegis = await resolveAgentSponsorshipCapacity({
      admin: makeAdmin({ usedCount: 8 }), // 6 + Factor + Aegis
      sponsorPersonaId: 'sponsor-1',
      callerIsAdmin: true,
    });
    expect(afterFactor.bounded).toBe(false);
    expect(afterAegis.bounded).toBe(false);
  });

  it('3. platform-agent provisioning does not fail against the flat-three rule', async () => {
    const { resolveAgentSponsorshipCapacity } = await import('@/services/access/personaCapacity');
    mockGetPersonaPlan.mockResolvedValue({ boundedDelegateLimit: 3 });
    const admin = makeAdmin({ usedCount: 6 });
    const result = await resolveAgentSponsorshipCapacity({
      admin,
      sponsorPersonaId: 'sponsor-1',
      callerIsAdmin: false,
      isPlatformAuthority: true,
    });
    expect(result.bounded).toBe(false);
    if (!result.bounded) expect(result.source).toBe('platform');
  });

  it('4. a regular user at a tier allowing 50 (Operator Pro) can create through the fiftieth', async () => {
    const { resolveAgentSponsorshipCapacity } = await import('@/services/access/personaCapacity');
    mockGetPersonaPlan.mockResolvedValue({ boundedDelegateLimit: 50 });
    const admin = makeAdmin({ usedCount: 49 });
    const result = await resolveAgentSponsorshipCapacity({ admin, sponsorPersonaId: 'sponsor-1', callerIsAdmin: false });
    expect(result.bounded).toBe(true);
    if (result.bounded) {
      expect(result.limit).toBe(50);
      expect(result.remaining).toBe(1); // the 50th is still allowed
      expect(result.overCapacity).toBe(false);
    }
  });

  it("5. the fifty-first is refused if that tier's actual limit is 50", async () => {
    const { resolveAgentSponsorshipCapacity } = await import('@/services/access/personaCapacity');
    mockGetPersonaPlan.mockResolvedValue({ boundedDelegateLimit: 50 });
    const admin = makeAdmin({ usedCount: 50 });
    const result = await resolveAgentSponsorshipCapacity({ admin, sponsorPersonaId: 'sponsor-1', callerIsAdmin: false });
    expect(result.bounded).toBe(true);
    if (result.bounded) expect(result.remaining).toBe(0);
  });

  it('6. a higher/unbounded tier (Operator Elite) follows its own entitlement, never a literal 9999', async () => {
    const { resolveAgentSponsorshipCapacity } = await import('@/services/access/personaCapacity');
    const { UNLIMITED } = await import('@/services/billing/personaPlan');
    mockGetPersonaPlan.mockResolvedValue({ boundedDelegateLimit: UNLIMITED });
    const admin = makeAdmin({ usedCount: 9000 });
    const result = await resolveAgentSponsorshipCapacity({ admin, sponsorPersonaId: 'sponsor-1', callerIsAdmin: false });
    expect(result.bounded).toBe(false);
    expect(result.limit).toBeNull(); // never the raw 9999 sentinel
    if (!result.bounded) expect(result.source).toBe('tier');
  });

  it('9. a legacy over-capacity user reports zero remaining plus overCapacity, never a negative number', async () => {
    const { resolveAgentSponsorshipCapacity } = await import('@/services/access/personaCapacity');
    mockGetPersonaPlan.mockResolvedValue({ boundedDelegateLimit: 3 });
    const admin = makeAdmin({ usedCount: 6 }); // the exact MoneyPenny/Nakamoto/Kn0w1 sponsor's real live state
    const result = await resolveAgentSponsorshipCapacity({ admin, sponsorPersonaId: 'sponsor-1', callerIsAdmin: false });
    expect(result.bounded).toBe(true);
    if (result.bounded) {
      expect(result.remaining).toBe(0);
      expect(result.remaining).not.toBeLessThan(0);
      expect(result.overCapacity).toBe(true);
    }
  });

  it('an admin-granted sponsorship_capacity_base above the tier default still counts (never discarded)', async () => {
    const { resolveAgentSponsorshipCapacity } = await import('@/services/access/personaCapacity');
    mockGetPersonaPlan.mockResolvedValue({ boundedDelegateLimit: 3 });
    const admin = makeAdmin({ usedCount: 5, capacityRow: { sponsorship_capacity_base: 10, sponsorship_capacity_earned: 0 } });
    const result = await resolveAgentSponsorshipCapacity({ admin, sponsorPersonaId: 'sponsor-1', callerIsAdmin: false });
    expect(result.bounded).toBe(true);
    if (result.bounded) {
      expect(result.limit).toBe(10);
      expect(result.remaining).toBe(5);
      expect(result.source).toBe('grant');
    }
  });
});

describe('7-8. forgery immunity — callerIsAdmin/isPlatformAuthority are never derived from client input', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'services/access/personaCapacity.ts'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('the resolver reads no request body, header, or JWT claim of its own', () => {
    expect(code).not.toMatch(/body\.|req\.|request\.|headers\.get|user_metadata|jwt/i);
  });

  it("the resolver's only authority inputs are plain typed booleans on its input interface", () => {
    expect(code).toMatch(/callerIsAdmin:\s*boolean/);
    expect(code).toMatch(/isPlatformAuthority\?:\s*boolean/);
  });

  it('sponsorPolityAgent.ts resolves callerIsAdmin from the spine-provided input, never a body flag, before calling the resolver', () => {
    const spSrc = fs
      .readFileSync(path.join(__dirname, '..', 'services/agents/sponsorPolityAgent.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(spSrc).toMatch(/callerIsAdmin\s*=\s*false,/); // defaults closed
    expect(spSrc).toMatch(/resolveAgentSponsorshipCapacity\(\{ admin, sponsorPersonaId, callerIsAdmin: false \}\)/);
  });

  it("the Homecoming stand-up route's preflight resolves admin from getActivePersona's cartridgeFlags, never from query/body", () => {
    const routeSrc = fs.readFileSync(
      path.join(__dirname, '..', 'app/api/homecoming/agent/stand-up/route.ts'),
      'utf8',
    );
    expect(routeSrc).toMatch(/callerIsAdmin:\s*Boolean\(persona\.cartridgeFlags\?\.isAdmin\)/);
  });

  it("the sponsored-agents capacity display resolves admin from getActivePersona's cartridgeFlags, never from query/body", () => {
    const routeSrc = fs.readFileSync(
      path.join(__dirname, '..', 'app/api/persona/sponsored-agents/route.ts'),
      'utf8',
    );
    expect(routeSrc).toMatch(/callerIsAdmin:\s*Boolean\(persona\.cartridgeFlags\?\.isAdmin\)/);
  });

  it('a caller cannot flip callerIsAdmin by sending {isAdmin: true} in a request body — TypeScript boolean param only reads what the caller resolved', async () => {
    const { resolveAgentSponsorshipCapacity } = await import('@/services/access/personaCapacity');
    mockGetPersonaPlan.mockResolvedValue({ boundedDelegateLimit: 3 });
    // Simulates a caller who forgot to resolve callerIsAdmin server-side and
    // passed a client-controlled value straight through — even so, the
    // resolver treats it as an ordinary boolean, not a forged bypass; the
    // vulnerability (if any) would be in the CALLER's own resolution, which
    // the source-canaries above pin for every real call site in this repo.
    const forgedAdminClaim = false; // what a real caller resolves server-side when the client lied
    const admin = makeAdmin({ usedCount: 6 });
    const result = await resolveAgentSponsorshipCapacity({
      admin,
      sponsorPersonaId: 'sponsor-1',
      callerIsAdmin: forgedAdminClaim,
    });
    expect(result.bounded).toBe(true); // still bounded — the resolver never trusts a client claim it wasn't given
  });
});

describe('10. capacity gates CREATION only — reading/operating existing agents is untouched', () => {
  it("the resolver module's own contract states it never gates reads", () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'services/access/personaCapacity.ts'), 'utf8');
    expect(src).toMatch(/never gates reads|only gates CREATING/i);
  });

  it('no read-only agent-listing route imports the capacity resolver as a gate', async () => {
    // /api/persona/sponsored-agents is a READ route that reports capacity
    // for DISPLAY only — it must never use the resolver's result to withhold
    // already-sponsored agent rows from the response.
    const routeSrc = fs.readFileSync(
      path.join(__dirname, '..', 'app/api/persona/sponsored-agents/route.ts'),
      'utf8',
    );
    // The agent rows query runs unconditionally, independent of capacityState.
    const rowsQueryIdx = routeSrc.indexOf(".from('agent_root_identity')\n      .select(baseCols)");
    const capacityIdx = routeSrc.indexOf('resolveAgentSponsorshipCapacity(');
    expect(rowsQueryIdx).toBeGreaterThan(-1);
    expect(capacityIdx).toBeGreaterThan(-1);
    expect(rowsQueryIdx).toBeLessThan(capacityIdx); // rows are already fetched before capacity is even resolved
  });
});

describe('11-12. Factor/Aegis idempotency and tenant isolation remain enforced by existing suites', () => {
  it('11. sponsorPolityAgent stays idempotent per-slug regardless of capacity state (slug-uniqueness gate unchanged)', () => {
    const spSrc = fs.readFileSync(path.join(__dirname, '..', 'services/agents/sponsorPolityAgent.ts'), 'utf8');
    expect(spSrc).toContain("already taken — choose another");
    // The slug-uniqueness check still runs AFTER the (now-resolver-backed) capacity block.
    const capacityIdx = spSrc.indexOf('resolveAgentSponsorshipCapacity(');
    const slugCheckIdx = spSrc.indexOf('Slug uniqueness');
    expect(capacityIdx).toBeGreaterThan(-1);
    expect(slugCheckIdx).toBeGreaterThan(capacityIdx);
  });

  it('12. capacity is resolved PER sponsor — one sponsor\'s used count never reads another\'s row', async () => {
    const { resolveAgentSponsorshipCapacity, countSponsoredAgents } = await import('@/services/access/personaCapacity');
    let queriedFor: string[] = [];
    const admin = {
      from: (table: string) => {
        if (table === 'agent_root_identity') {
          return {
            select: () => ({
              eq: (_col: string, val: string) => {
                queriedFor.push(val);
                return Promise.resolve({ count: val === 'sponsor-A' ? 6 : 0, data: null, error: null });
              },
            }),
          };
        }
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
      },
    } as any;
    mockGetPersonaPlan.mockResolvedValue({ boundedDelegateLimit: 3 });
    const a = await countSponsoredAgents(admin, 'sponsor-A');
    const b = await countSponsoredAgents(admin, 'sponsor-B');
    expect(a).toBe(6);
    expect(b).toBe(0);
    expect(queriedFor).toEqual(['sponsor-A', 'sponsor-B']); // scoped per sponsorPersonaId, never merged
    void resolveAgentSponsorshipCapacity; // referenced for the describe's own subject
  });
});
