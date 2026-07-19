/**
 * GET /api/steward/participation — the steward's consolidated participation
 * view (Constitutional Access Service). Admin-gated.
 *
 * Returns, across all five access domains (or ?domain=<one>):
 *   - domains + role catalogues (configuration, for the create-invitation form)
 *   - invitations (bounded bearer records — hashes only, never raw codes)
 *   - access grants (canonical records; holder as T2-safe commitment)
 *   - passport application queue counts (the participant-initiated path,
 *     which keeps its existing review surface) including the agent-assisted
 *     count (personhood_proof_type = 'agent_declaration')
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  ACCESS_DOMAINS,
  DOMAIN_LABELS,
  DOMAIN_ROLES,
  isAccessDomain,
  listAccessGrants,
  listAccessInvitations,
} from '@/services/passport/participationAccess';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

  const domainParam = new URL(req.url).searchParams.get('domain') ?? undefined;
  const domain = domainParam && isAccessDomain(domainParam) ? domainParam : undefined;

  const [invitations, grants] = await Promise.all([
    listAccessInvitations(admin, domain),
    listAccessGrants(admin, domain),
  ]);

  // Passport application queue — the existing participant-initiated path.
  let applications: { total: number; pending: number; agentAssisted: number } | null = null;
  try {
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
      domains: ACCESS_DOMAINS.map((d) => ({ id: d, label: DOMAIN_LABELS[d], roles: DOMAIN_ROLES[d] })),
      invitations,
      grants,
      applications,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
