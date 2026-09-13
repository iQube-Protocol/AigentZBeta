/**
 * GET /api/steward/participation — the steward's consolidated participation
 * view (Constitutional Access Service).
 *
 * Returns, across the domains the CALLER may steward (or ?domain=<one>):
 *   - domains + role catalogues (configuration, for the create-invitation form)
 *   - assignableScopes — the projects an invitation may be scoped to, PER
 *     DOMAIN: research-lab → experiments, venture-lab → pilot programmes
 *     (operator, 2026-07-28: "VL Invitations should include pilot programs like
 *     RL includes experiments"). Both derive from their registry; neither is
 *     hand-listed here.
 *   - invitations (bounded bearer records — hashes only, never raw codes)
 *   - access grants (canonical records; holder as T2-safe commitment)
 *   - passport application queue counts — PLATFORM ADMIN ONLY
 *
 * TWO-TIER AUTHORITY (operator, 2026-07-28). A platform admin sees the estate.
 * A delegated steward sees only the domains their own grant covers, only the
 * invitations they issued, and only the roles/scopes they may confer — so the
 * surface never offers a control the issue route would refuse (MS-9). The
 * authority is derived server-side from the caller's own grants; the response
 * carries it so the UI has ONE source of truth for what to render.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ASSIGNABLE_EXPERIMENTS,
  DOMAIN_LABELS,
  DOMAIN_ROLES,
  getGrantPersonaIds,
  isAccessDomain,
  issuableRoles,
  listAccessGrants,
  listAccessInvitations,
  type AccessDomain,
} from '@/services/passport/participationAccess';
import { resolveStewardAuthority } from '@/app/api/steward/participation/_lib/resolveStewardAuthority';
import { getResearchPersonasByIds } from '@/services/passport/researchPersona';
import {
  CAPABILITY_SCOPE_TYPES,
  HIGH_RISK_CAPABILITIES,
  isHighRiskCapability,
  listCapabilitiesForGrant,
  ORDINARY_CAPABILITIES,
} from '@/services/research/accessCapabilities';
import { ASSIGNABLE_PILOTS } from '@/services/venture/partnerWorkspace';
import { ASSIGNABLE_RESEARCH_WORKSPACES } from '@/services/research/researchWorkspace';

export const dynamic = 'force-dynamic';

/**
 * What an invitation may be scoped to, per domain. ONE mechanism (the
 * `allowed_experiments` column both the invitation and the grant already
 * carry), two catalogues — the Research Lab's experiments and the Venture Lab's
 * pilot programmes. Each is DERIVED from its own registry, so neither can go
 * stale (inv.engineering.036).
 */
const SCOPE_CATALOGUES: Partial<Record<AccessDomain, { id: string; label: string }[]>> = {
  // TWO catalogues in one domain (2026-07-28 Research Workspace increment): an
  // experiment-scoped REVIEWER invitation and a workspace-scoped PARTICIPATION
  // invitation are different grants, and the steward chooses which to issue.
  // Composed, never replaced — an invitation scoped to a research workspace
  // confers workspace access and zero experiment runs (the workspace id matches
  // no experiment id in `getGrantedExperiments`), which is the fail-closed
  // direction. Both halves stay derivations of their own registry.
  'research-lab': [...ASSIGNABLE_EXPERIMENTS, ...ASSIGNABLE_RESEARCH_WORKSPACES],
  'venture-lab': ASSIGNABLE_PILOTS,
};

export async function GET(req: NextRequest) {
  const gate = await resolveStewardAuthority(req);
  if (!gate.ok) return gate.response;
  const { personaId, authority, admin } = gate;

  const domainParam = new URL(req.url).searchParams.get('domain') ?? undefined;
  const requested = domainParam && isAccessDomain(domainParam) ? domainParam : undefined;
  // A requested domain outside the caller's authority is refused, not silently
  // widened to "all" (which is what ignoring it would do).
  if (requested && !authority.domains.includes(requested)) {
    return NextResponse.json({ ok: false, error: `Not authorized for '${requested}'` }, { status: 403 });
  }
  const domain = requested;

  // A delegated steward reads only the invitations they issued.
  const issuerFilter = authority.tier === 'platform' ? undefined : personaId;
  const [allInvitations, allGrants] = await Promise.all([
    listAccessInvitations(admin, domain, issuerFilter),
    listAccessGrants(admin, domain),
  ]);
  const visibleDomains = new Set<string>(authority.domains);
  const invitations = allInvitations.filter((i) => visibleDomains.has(i.accessDomain));
  const grants = allGrants.filter((g) => {
    if (!visibleDomains.has(g.accessDomain)) return false;
    const own = authority.scopes[g.accessDomain];
    if (own === 'all' || own === undefined) return true;
    // A scoped steward sees only grants inside their own scope.
    const gs = g.allowedExperiments ?? [];
    return gs.length > 0 && gs.some((s) => own.includes(s));
  });

  // Research Persona legibility (item 3) + per-grant capabilities (item 10)
  // — the steward-participant card needs both alongside the grant itself.
  // Both maps are keyed by grantId, NEVER by personaId: `getGrantPersonaIds`
  // is server-internal only (see its own doc comment) and its values are
  // consumed here, never re-serialised — the client sees a grantId key and
  // a T2-safe display payload, the same T0→T2 boundary `holderRef` enforces
  // on the grant view itself.
  const grantIds = grants.map((g) => g.id);
  const grantPersonaIds = await getGrantPersonaIds(admin, grantIds);
  const personasById = await getResearchPersonasByIds(admin, Object.values(grantPersonaIds));
  const researchPersonas: Record<
    string,
    { displayName: string; handle: string; privacyMode?: string; isPlaceholder: boolean; confirmedAt?: string | null }
  > = {};
  for (const [grantId, targetPersonaId] of Object.entries(grantPersonaIds)) {
    const rec = personasById[targetPersonaId];
    if (!rec) continue;
    researchPersonas[grantId] =
      'privacyMode' in rec
        ? {
            displayName: rec.displayName,
            handle: rec.handle,
            privacyMode: rec.privacyMode,
            isPlaceholder: rec.isPlaceholder,
            confirmedAt: rec.confirmedAt,
          }
        : { displayName: rec.displayName, handle: rec.handle, isPlaceholder: true };
  }

  const capabilitiesByGrant: Record<
    string,
    {
      id: string;
      scopeType: string;
      scopeRef: string;
      capability: string;
      status: string;
      grantedAt: string;
      expiresAt: string | null;
      revokedAt: string | null;
      reason: string | null;
      receiptId: string | null;
      isHighRisk: boolean;
    }[]
  > = {};
  await Promise.all(
    grantIds.map(async (id) => {
      const rows = await listCapabilitiesForGrant(admin, id);
      // `grantedByPersonaId` is intentionally dropped here — T0, never
      // serialised to browser-bound JSON (Identity & Access Spine).
      capabilitiesByGrant[id] = rows.map((r) => ({
        id: r.id,
        scopeType: r.scopeType,
        scopeRef: r.scopeRef,
        capability: r.capability,
        status: r.status,
        grantedAt: r.grantedAt,
        expiresAt: r.expiresAt,
        revokedAt: r.revokedAt,
        reason: r.reason,
        receiptId: r.receiptId,
        isHighRisk: isHighRiskCapability(r.capability),
      }));
    }),
  );

  // Passport application queue — the existing participant-initiated path.
  // PLATFORM ADMIN ONLY: it is an estate-wide queue, not domain-scoped.
  let applications: { total: number; pending: number; agentAssisted: number } | null = null;
  if (authority.tier === 'platform') try {
    const { count: total } = await admin
      .from('polity_passport_applications')
      .select('id', { count: 'exact', head: true });
    const { count: pending } = await admin
      .from('polity_passport_applications')
      .select('id', { count: 'exact', head: true })
      .in('status', ['submitted', 'pending', 'in_review']);
    const { count: agentAssisted } = await admin
      .from('polity_passport_applications')
      .select('id', { count: 'exact', head: true })
      .eq('personhood_proof_type', 'agent_declaration');
    applications = { total: total ?? 0, pending: pending ?? 0, agentAssisted: agentAssisted ?? 0 };
  } catch {
    // Pre-migration installs — the section renders without counts.
  }

  return NextResponse.json(
    {
      ok: true,
      // ONLY the domains this caller may steward, each carrying only the roles
      // this caller may confer. The surface therefore cannot offer a control the
      // issue route would refuse — MS-9, "a control that cannot act must not
      // render", applied to an access gate.
      domains: authority.domains.map((d) => ({
        id: d,
        label: DOMAIN_LABELS[d],
        roles: issuableRoles(d, authority.tier),
        // The catalogue of projects an invitation may name, narrowed to the
        // caller's own scope when their grant is scoped.
        assignableScopes: (SCOPE_CATALOGUES[d] ?? []).filter((s) => {
          const own = authority.scopes[d];
          return own === 'all' || own === undefined ? true : own.includes(s.id);
        }),
        // Whether the caller MUST name a scope (a scoped steward cannot issue
        // an unrestricted invitation — that would silently widen their grant).
        scopeRequired: authority.scopes[d] !== 'all' && authority.scopes[d] !== undefined,
      })),
      authority: { tier: authority.tier },
      invitations,
      grants,
      researchPersonas,
      capabilitiesByGrant,
      // ONE catalogue, reused by the capability editor — never hand-copied
      // client-side (inv.engineering.036/037).
      capabilityCatalogue: {
        scopeTypes: CAPABILITY_SCOPE_TYPES,
        ordinary: ORDINARY_CAPABILITIES,
        highRisk: HIGH_RISK_CAPABILITIES,
      },
      applications,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
