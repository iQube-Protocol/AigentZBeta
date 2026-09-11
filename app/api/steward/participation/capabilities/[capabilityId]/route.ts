/**
 * PATCH /api/steward/participation/capabilities/[capabilityId] — revoke a
 * capability (IRL Stewardship, Part 2, item 15: "immediate revocation
 * effect" — `revokeCapability` flips status, read fresh on the very next
 * `resolveCapability` call, never cached).
 *
 * Body: { action: 'revoke', reason? }
 *
 * SCOPE CONTAINMENT — resolved via the capability row's own grant (same
 * domain/scope test as `/grants/[grantId]` and `POST /capabilities`), so a
 * delegated steward can only revoke a capability on a grant they administer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { revokeCapability } from '@/services/research/accessCapabilities';
import { grantWithinAuthority, resolveStewardAuthority } from '@/app/api/steward/participation/_lib/resolveStewardAuthority';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ capabilityId: string }> }) {
  const { capabilityId } = await params;
  const resolved = await resolveStewardAuthority(req);
  if ('error' in resolved) return resolved.error;
  const { personaId, authority, admin } = resolved;

  const body = (await req.json().catch(() => ({}))) as { action?: string; reason?: string };
  if (body.action !== 'revoke') {
    return NextResponse.json({ ok: false, error: "action: 'revoke' required" }, { status: 400 });
  }

  const { data: capRow, error: capErr } = await admin
    .from('access_grant_capabilities')
    .select('grant_id')
    .eq('id', capabilityId)
    .maybeSingle();
  if (capErr || !capRow) return NextResponse.json({ ok: false, error: 'Capability grant not found' }, { status: 404 });

  const { data: grantRow, error: grantErr } = await admin
    .from('access_grants')
    .select('access_domain, allowed_experiments')
    .eq('id', (capRow as Record<string, unknown>).grant_id as string)
    .maybeSingle();
  if (grantErr || !grantRow) return NextResponse.json({ ok: false, error: 'Underlying grant not found' }, { status: 404 });
  const grantDomain = String((grantRow as Record<string, unknown>).access_domain);
  const grantScope = ((grantRow as Record<string, unknown>).allowed_experiments as string[] | null) ?? null;
  const containment = grantWithinAuthority(authority, grantDomain, grantScope);
  if (!containment.ok) return NextResponse.json({ ok: false, error: containment.error }, { status: 403 });

  const result = await revokeCapability(admin, { capabilityId, actorPersonaId: personaId, reason: body.reason });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, capability: result.capability });
}
