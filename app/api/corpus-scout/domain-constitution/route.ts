/**
 * /api/corpus-scout/domain-constitution — the Constitutional Discovery
 * amendment's substrate surface (PRD-ICA-001 amendment, RATIFIED 2026-07-23,
 * Phase 1). Admin-gated, mirroring `/api/corpus-scout/candidates`'s auth
 * pattern exactly (`getActivePersona` + `cartridgeFlags?.isAdmin`).
 *
 * GET  ?domain=  → the full constitutional substrate for one domain: Domain
 *      Definition (§2.1), Constitutional Coverage Model (§2.2), Constitutional
 *      Dependency Registry (§2.3), Institutional Registry (§3).
 *
 * POST { action, domain, ... } → propose or ratify one artifact. One route,
 *      an `action` discriminator — mirrors `/api/corpus-scout/candidates/
 *      [sourceId]/review`'s `decision` discriminator pattern rather than
 *      inventing eight separate route files for one small surface.
 *
 *   propose-definition   { purpose }
 *   ratify-definition    {}
 *   propose-pillar       { pillarKey, pillarLabel, completenessDefinition }
 *   ratify-pillar        { pillarKey }
 *   confirm-saturation   { pillarKey }  -- §6.1, requires an already-ratified pillar
 *   propose-dependency   { dependencyName, relationship }
 *   ratify-dependency    { dependencyName }
 *   propose-institution  { pillarKey, institutionName }
 *   ratify-institution   { pillarKey, institutionName }
 *
 * No auto-ratification path exists — every `ratify-*` action requires the
 * caller's own persona id (the steward), recorded on the row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  getDomainConstitution,
  upsertDomainDefinition,
  ratifyDomainDefinition,
  upsertCoveragePillar,
  ratifyCoveragePillar,
  confirmPillarSaturation,
  upsertDependencyEntry,
  ratifyDependencyEntry,
  upsertInstitutionEntry,
  ratifyInstitutionEntry,
} from '@/services/corpusScout/domainConstitution';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ACTIONS = [
  'propose-definition', 'ratify-definition',
  'propose-pillar', 'ratify-pillar', 'confirm-saturation',
  'propose-dependency', 'ratify-dependency',
  'propose-institution', 'ratify-institution',
] as const;
type Action = (typeof ACTIONS)[number];

function isAction(v: unknown): v is Action {
  return typeof v === 'string' && (ACTIONS as readonly string[]).includes(v);
}

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const domain = new URL(req.url).searchParams.get('domain')?.trim();
  if (!domain) return NextResponse.json({ ok: false, error: 'domain is required' }, { status: 400 });

  const constitution = await getDomainConstitution(admin, domain);
  return NextResponse.json({ ok: true, constitution }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    domain?: string;
    purpose?: string;
    pillarKey?: string;
    pillarLabel?: string;
    completenessDefinition?: string;
    dependencyName?: string;
    relationship?: string;
    institutionName?: string;
  };

  if (!isAction(body.action)) {
    return NextResponse.json({ ok: false, error: `action must be one of: ${ACTIONS.join(', ')}` }, { status: 400 });
  }
  const domain = body.domain?.trim();
  if (!domain) return NextResponse.json({ ok: false, error: 'domain is required' }, { status: 400 });

  switch (body.action) {
    case 'propose-definition': {
      if (!body.purpose?.trim()) return NextResponse.json({ ok: false, error: 'purpose is required' }, { status: 400 });
      const r = await upsertDomainDefinition(admin, { domain, purpose: body.purpose });
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'ratify-definition': {
      const r = await ratifyDomainDefinition(admin, domain, persona.personaId);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'propose-pillar': {
      if (!body.pillarKey?.trim() || !body.pillarLabel?.trim()) {
        return NextResponse.json({ ok: false, error: 'pillarKey and pillarLabel are required' }, { status: 400 });
      }
      const r = await upsertCoveragePillar(admin, {
        domain,
        pillarKey: body.pillarKey,
        pillarLabel: body.pillarLabel,
        completenessDefinition: body.completenessDefinition ?? '',
      });
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'ratify-pillar': {
      if (!body.pillarKey?.trim()) return NextResponse.json({ ok: false, error: 'pillarKey is required' }, { status: 400 });
      const r = await ratifyCoveragePillar(admin, domain, body.pillarKey, persona.personaId);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'confirm-saturation': {
      if (!body.pillarKey?.trim()) return NextResponse.json({ ok: false, error: 'pillarKey is required' }, { status: 400 });
      const r = await confirmPillarSaturation(admin, domain, body.pillarKey, persona.personaId);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'propose-dependency': {
      if (!body.dependencyName?.trim() || !body.relationship?.trim()) {
        return NextResponse.json({ ok: false, error: 'dependencyName and relationship are required (Law I — the edge is the point)' }, { status: 400 });
      }
      const r = await upsertDependencyEntry(admin, { domain, dependencyName: body.dependencyName, relationship: body.relationship });
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'ratify-dependency': {
      if (!body.dependencyName?.trim()) return NextResponse.json({ ok: false, error: 'dependencyName is required' }, { status: 400 });
      const r = await ratifyDependencyEntry(admin, domain, body.dependencyName, persona.personaId);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'propose-institution': {
      if (!body.pillarKey?.trim() || !body.institutionName?.trim()) {
        return NextResponse.json({ ok: false, error: 'pillarKey and institutionName are required' }, { status: 400 });
      }
      const r = await upsertInstitutionEntry(admin, { domain, pillarKey: body.pillarKey, institutionName: body.institutionName });
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'ratify-institution': {
      if (!body.pillarKey?.trim() || !body.institutionName?.trim()) {
        return NextResponse.json({ ok: false, error: 'pillarKey and institutionName are required' }, { status: 400 });
      }
      const r = await ratifyInstitutionEntry(admin, domain, body.pillarKey, body.institutionName, persona.personaId);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
  }
}
