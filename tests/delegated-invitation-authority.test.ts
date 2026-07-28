/**
 * Delegated invitation authority canaries (operator, 2026-07-28).
 *
 * THE REQUIREMENT. "There should be an admin gate on our side, which enables
 * partners and various parties to be invited. But a partner operator … should
 * be able to have rights to invite others to a pilot project or a research
 * programme accordingly … so that we don't become the gate for that."
 *
 * Two authorities, not one gate with two audiences:
 *   platform  — a platform admin. Any domain, any role. Admits a party and
 *               confers invitation authority. THE GATE STAYS ON OUR SIDE.
 *   delegated — a persona holding a STEWARD grant. Their domain only, their
 *               pilots only, and never a steward role.
 *
 * WHAT THESE CANARIES PROTECT — the three classic delegation defects:
 *
 *  1. FORGED DOMAIN. A delegated inviter names a domain they do not administer.
 *     If the route trusted the request body, they would grant access to a
 *     programme they have no part in. The domain must be checked against the
 *     caller's OWN grants, resolved server-side through the spine.
 *  2. GRANT UPWARD / SELF-GRANT. A delegated inviter confers the steward role
 *     itself, minting a peer with their authority and removing the platform
 *     from the loop it is supposed to hold. The issuable set must exclude every
 *     steward role for the delegated tier.
 *  3. SCOPE WIDENING. A steward scoped to one pilot issues an invitation naming
 *     another pilot — or naming NOTHING, which means "all". Both are widenings.
 *
 * And the property that must survive all of it: the ratified tab gate does not
 * move. `venture-participate-steward` stays adminOnly; delegation reaches the
 * Tier 2 Partner Collaborate surface instead. A delegation feature that
 * silently opened the Tier 0 tab would be the failure this file exists to catch.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import {
  ACCESS_DOMAINS,
  DOMAIN_ROLES,
  DOMAIN_STEWARD_ROLES,
  issuableRoles,
  resolveInvitationAuthority,
  scopeWithinAuthority,
} from '../services/passport/participationAccess';

const grant = (accessDomain: string, role: string, allowedScopes: string[] | null = null) => ({
  accessDomain,
  role,
  allowedScopes,
});

describe('the two tiers are two authorities', () => {
  it('a platform admin may issue into every domain', () => {
    const a = resolveInvitationAuthority(true, []);
    expect(a.tier).toBe('platform');
    expect(a.domains).toEqual([...ACCESS_DOMAINS]);
    for (const d of ACCESS_DOMAINS) expect(a.scopes[d]).toBe('all');
  });

  it('a non-steward participant has no invitation authority at all', () => {
    // Membership is not stewardship. This is the fail-closed direction.
    const a = resolveInvitationAuthority(false, [grant('venture-lab', 'observer')]);
    expect(a.tier).toBe('none');
    expect(a.domains).toEqual([]);
  });

  it('a steward grant confers delegated authority in that domain only', () => {
    const a = resolveInvitationAuthority(false, [grant('venture-lab', 'workspace-steward')]);
    expect(a.tier).toBe('delegated');
    expect(a.domains).toEqual(['venture-lab']);
    // FORGED DOMAIN — the defect this refuses.
    expect(a.domains).not.toContain('research-lab');
    expect(a.domains).not.toContain('passport');
  });

  it('every domain names a steward role, and every one is a real role of that domain', () => {
    // A domain whose steward roles drifted out of DOMAIN_ROLES would silently
    // become un-delegatable — an inert mechanism (CB-1), not an error.
    for (const d of ACCESS_DOMAINS) {
      expect(DOMAIN_STEWARD_ROLES[d].length, `${d} has no steward role`).toBeGreaterThan(0);
      for (const r of DOMAIN_STEWARD_ROLES[d]) {
        expect(DOMAIN_ROLES[d], `${d} steward role '${r}' is not a role of ${d}`).toContain(r);
      }
    }
  });
});

describe('no role may grant itself, or grant upward', () => {
  it('a delegated steward can never confer a steward role', () => {
    for (const d of ACCESS_DOMAINS) {
      const issuable = issuableRoles(d, 'delegated');
      for (const steward of DOMAIN_STEWARD_ROLES[d]) {
        expect(issuable, `delegated tier can confer '${steward}' in ${d} — that is grant-upward`).not.toContain(
          steward,
        );
      }
      // …but it can still confer the ordinary roles, or delegation is useless.
      expect(issuable.length, `${d} delegated tier can confer nothing`).toBeGreaterThan(0);
    }
  });

  it('a platform admin retains the full catalogue — conferring authority is OUR act', () => {
    for (const d of ACCESS_DOMAINS) {
      expect(issuableRoles(d, 'platform')).toEqual(DOMAIN_ROLES[d]);
    }
  });

  it('tier "none" can confer nothing', () => {
    for (const d of ACCESS_DOMAINS) expect(issuableRoles(d, 'none')).toEqual([]);
  });
});

describe('scope containment — a delegated inviter cannot widen', () => {
  const scoped = resolveInvitationAuthority(false, [
    grant('venture-lab', 'workspace-steward', ['horizen-pilot-series-001']),
  ]);

  it('accepts a scope inside the issuer’s own', () => {
    expect(scopeWithinAuthority(scoped, 'venture-lab', ['horizen-pilot-series-001']).ok).toBe(true);
  });

  it('refuses a scope outside the issuer’s own', () => {
    const r = scopeWithinAuthority(scoped, 'venture-lab', ['some-other-pilot']);
    expect(r.ok).toBe(false);
  });

  it('refuses an UNSCOPED invitation from a scoped issuer — silence means "all"', () => {
    expect(scopeWithinAuthority(scoped, 'venture-lab', []).ok).toBe(false);
  });

  it('an unscoped steward grant is unrestricted within its domain', () => {
    const open = resolveInvitationAuthority(false, [grant('venture-lab', 'workspace-steward')]);
    expect(open.scopes['venture-lab']).toBe('all');
    expect(scopeWithinAuthority(open, 'venture-lab', []).ok).toBe(true);
  });

  it('two scoped grants union rather than one overwriting the other', () => {
    const two = resolveInvitationAuthority(false, [
      grant('venture-lab', 'workspace-steward', ['pilot-a']),
      grant('venture-lab', 'venture-steward', ['pilot-b']),
    ]);
    expect(scopeWithinAuthority(two, 'venture-lab', ['pilot-a', 'pilot-b']).ok).toBe(true);
    expect(scopeWithinAuthority(two, 'venture-lab', ['pilot-c']).ok).toBe(false);
  });

  it('an unscoped grant beside a scoped one opens the domain — the wider grant wins', () => {
    const mixed = resolveInvitationAuthority(false, [
      grant('venture-lab', 'workspace-steward', ['pilot-a']),
      grant('venture-lab', 'venture-steward', null),
    ]);
    expect(mixed.scopes['venture-lab']).toBe('all');
  });
});

describe('the server is the enforcement point, not the surface', () => {
  const ROUTE = 'app/api/steward/participation/invitations/route.ts';

  it('the issue route resolves the caller through the spine and checks the body against it', () => {
    const src = stripComments(readSource(ROUTE));
    expect(src, 'the route does not resolve the caller through the spine').toMatch(/getActivePersona\(req\)/);
    expect(src, 'the route does not read the caller’s own grants').toMatch(/resolveParticipationSelfView/);
    expect(src, 'the route does not derive an authority').toMatch(/resolveInvitationAuthority/);
    // The three refusals, each present.
    expect(src, 'no domain containment').toMatch(/authority\.domains\.includes\(domain\)/);
    expect(src, 'no role containment').toMatch(/issuableRoles\(domain, authority\.tier\)/);
    expect(src, 'no scope containment').toMatch(/scopeWithinAuthority\(/);
    expect(src).toMatch(/status: 403/);
  });

  it('the issuer is the resolved persona, never a client-supplied one', () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/issuerPersonaId: personaId/);
    expect(src, 'an issuer id from the request body would be forgeable').not.toMatch(
      /issuerPersonaId:\s*body\./,
    );
  });

  it('a delegated steward revokes only what they issued, in the update predicate', () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/authority\.tier === 'platform' \? undefined : personaId/);
    const store = stripComments(readSource('services/passport/participationAccess.ts'));
    expect(store).toMatch(/issuerPersonaId\) q = q\.eq\('issuer_persona_id', issuerPersonaId\)/);
  });

  it('the read route narrows to the caller’s domains and hides the platform-only queue', () => {
    const src = stripComments(readSource('app/api/steward/participation/route.ts'));
    expect(src).toMatch(/resolveInvitationAuthority/);
    // The application queue is estate-wide — platform admins only.
    expect(src).toMatch(/if \(isAdmin\) try/);
    // Only the domains the caller may steward are returned, each with only the
    // roles they may confer, so the surface cannot offer a refused control.
    expect(src).toMatch(/authority\.domains\.map/);
    expect(src).toMatch(/roles: issuableRoles\(d, authority\.tier\)/);
  });
});

describe('delegation did not move the ratified tab gate', () => {
  it('the Venture Lab Steward tab is still Tier 0', async () => {
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const steward = VENTURE_LAB_CODEX.tabs.find(
      (t: { id: string }) => t.id === 'venture-participate-steward',
    );
    expect(steward, 'the Steward tab is gone').toBeTruthy();
    expect(steward!.adminOnly, 'the Steward tab lost its platform gate').toBe(true);
    expect(
      steward!.participationDomain,
      'the Steward tab took a membership gate — the two tiers collapsed onto one surface',
    ).toBeUndefined();
  });

  it('the delegated surface is the ratified Tier 2 Partner Collaborate tab', async () => {
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const collab = VENTURE_LAB_CODEX.tabs.find((t: { id: string }) => t.id === 'partner-collaborate');
    expect(collab, 'the Tier 2 delegated surface is gone').toBeTruthy();
    expect(collab!.participationDomain).toBe('venture-lab');
    expect(collab!.adminOnly, 'the delegated surface became admin-only — the bottleneck is back').toBeFalsy();
    // …and it is the surface that actually mounts the invitation workspace.
    const src = stripComments(readSource('app/triad/components/codex/tabs/PartnerProgrammesTab.tsx'));
    expect(src).toMatch(/<StewardParticipationTab initialDomain="venture-lab"/);
  });
});

describe('pilot programmes are scoped the way experiments are — one mechanism, two catalogues', () => {
  it('the Venture Lab pilot catalogue is derived from the workspace registry', async () => {
    const { ASSIGNABLE_PILOTS, PARTNER_WORKSPACES } = await import('../services/venture/partnerWorkspace');
    expect(ASSIGNABLE_PILOTS.length).toBe(PARTNER_WORKSPACES.length);
    expect(ASSIGNABLE_PILOTS.map((p) => p.id).sort()).toEqual(PARTNER_WORKSPACES.map((w) => w.id).sort());
    // Derived, not hand-listed: the source file must not contain a literal id.
    const src = stripComments(readSource('services/venture/partnerWorkspace.ts'));
    const literal = src.match(/ASSIGNABLE_PILOTS[\s\S]{0,300}/)?.[0] ?? '';
    expect(literal, 'ASSIGNABLE_PILOTS hand-lists a pilot id').toMatch(/PARTNER_WORKSPACES\.map/);
  });

  it('the steward route serves both catalogues through the same field', async () => {
    const src = stripComments(readSource('app/api/steward/participation/route.ts'));
    expect(src).toMatch(/'research-lab': ASSIGNABLE_EXPERIMENTS/);
    expect(src).toMatch(/'venture-lab': ASSIGNABLE_PILOTS/);
    expect(src).toMatch(/assignableScopes/);
  });

  it('the surface branches on the catalogue, never on a hardcoded domain id', () => {
    // The RL-only version stayed RL-only precisely because it tested
    // `activeDomain === 'research-lab'` in five places.
    const src = stripComments(readSource('app/triad/components/codex/tabs/StewardParticipationTab.tsx'));
    const scopeBranches = src.match(/activeDomain === 'research-lab'/g) ?? [];
    // One legitimate remaining use: the result-publication queue really is a
    // research-lab surface, and it is platform-gated besides.
    expect(scopeBranches.length, 'scope rendering still branches on a hardcoded domain').toBeLessThanOrEqual(1);
    expect(src).toMatch(/scopesOffered/);
  });
});
