/**
 * POST /api/steward/participation/capabilities — attach a capability to an
 * existing access grant, resource-bound at scope (IRL Stewardship, Part 2,
 * items 10-18).
 *
 * "Access determines what a Persona may enter. Capability determines what
 * that Persona may do inside the authorized scope." This route never widens
 * access — it requires an existing, caller-visible grant (same scope
 * containment as `/grants/[grantId]`) and attaches a capability the service
 * layer (`services/research/accessCapabilities.ts`) validates against the
 * capability catalogue and, for high-risk capabilities, the existing
 * workspace-role ceiling.
 *
 * Body: { grantId, scopeType, scopeRef, capability, runConstraints?,
 *          expiresAt?, reason?, confirmHighRisk? }
 *
 * DELIBERATE CONFIRMATION (item 12/16) — a high-risk capability
 * (ide_ingest, crystal_groom, freeze_unfreeze, canonize,
 * invariant_registry_mutate, protocol_ratify, standing_admin, access_admin)
 * is refused with 400 unless `confirmHighRisk: true` is explicitly set. This
 * is the server-side half of "requires deliberate confirmation" — the UI's
 * visual distinction is necessary but not sufficient; any caller (human UI
 * or MCP/agent surface, item 17) must pass the same explicit flag.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  CAPABILITY_SCOPE_TYPES,
  CAPABILITY_VALUES,
  grantCapability,
  isHighRiskCapability,
  type CapabilityScopeType,
  type CapabilityValue,
} from '@/services/research/accessCapabilities';
import { grantWithinAuthority, resolveStewardAuthority } from '@/app/api/steward/participation/_lib/resolveStewardAuthority';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const gate = await resolveStewardAuthority(req);
  if (!gate.ok) return gate.response;
  const { personaId, authority, admin } = gate;

  const body = (await req.json().catch(() => ({}))) as {
    grantId?: string;
    scopeType?: string;
    scopeRef?: string;
    capability?: string;
    runConstraints?: Record<string, unknown> | null;
    expiresAt?: string | null;
    reason?: string;
    confirmHighRisk?: boolean;
  };
  if (!body.grantId) return NextResponse.json({ ok: false, error: 'grantId is required' }, { status: 400 });
  if (!body.scopeType || !(CAPABILITY_SCOPE_TYPES as readonly string[]).includes(body.scopeType)) {
    return NextResponse.json({ ok: false, error: 'Valid scopeType is required' }, { status: 400 });
  }
  if (!body.scopeRef?.trim()) return NextResponse.json({ ok: false, error: 'scopeRef is required' }, { status: 400 });
  if (!body.capability || !(CAPABILITY_VALUES as readonly string[]).includes(body.capability)) {
    return NextResponse.json({ ok: false, error: 'Valid capability is required' }, { status: 400 });
  }
  const capability = body.capability as CapabilityValue;
  if (isHighRiskCapability(capability) && body.confirmHighRisk !== true) {
    return NextResponse.json(
      { ok: false, error: `'${capability}' is a high-risk capability and requires confirmHighRisk: true` },
      { status: 400 },
    );
  }

  const { data: grantRow, error: grantErr } = await admin
    .from('access_grants')
    .select('access_domain, allowed_experiments')
    .eq('id', body.grantId)
    .maybeSingle();
  if (grantErr || !grantRow) return NextResponse.json({ ok: false, error: 'Grant not found' }, { status: 404 });
  const grantDomain = String((grantRow as Record<string, unknown>).access_domain);
  const grantScope = ((grantRow as Record<string, unknown>).allowed_experiments as string[] | null) ?? null;
  const containment = grantWithinAuthority(authority, grantDomain, grantScope);
  if (!containment.ok) return NextResponse.json({ ok: false, error: containment.error }, { status: 403 });

  const result = await grantCapability(admin, {
    grantId: body.grantId,
    scopeType: body.scopeType as CapabilityScopeType,
    scopeRef: body.scopeRef.trim(),
    capability,
    actorPersonaId: personaId,
    runConstraints: body.runConstraints ?? null,
    expiresAt: body.expiresAt ?? null,
    reason: body.reason,
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, capability: result.capability });
}
