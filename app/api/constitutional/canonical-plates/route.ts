/**
 * /api/constitutional/canonical-plates — the Canonical Plate Registry
 * (operator + Aletheon design, 2026-07-20).
 *
 * GET  ?edition=public   → published plates only (the IRL OS view; no auth —
 *                          published canon is public by definition)
 * GET  (default)         → every status (the internal lab view; spine-authed)
 * POST { action }        → admin-gated (steward) lifecycle:
 *        validate  { plate }            — schema/graph check, no write
 *        compose   { plate }            — validate + insert as draft
 *        submit    { cpNumber }         — draft → candidate
 *        canonise  { cpNumber }         — candidate → ratified (constitutional act)
 *        publish   { cpNumber }         — ratified → published (exposure)
 *        withdraw  { cpNumber }         — candidate/ratified → draft
 *
 * Every write is receipted (canonical_plate_* action types) so plate
 * lifecycle acts join the constitutional record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import {
  listPlates,
  validatePlate,
  composePlate,
  transitionPlate,
  type PlateTransition,
  type RegisteredPlate,
} from '@/services/artifact/canonicalPlateRegistry';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const editionParam = new URL(req.url).searchParams.get('edition');
  if (editionParam === 'public') {
    const plates = await listPlates(admin, 'public');
    return NextResponse.json({ ok: true, edition: 'public', plates }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // Internal view — spine-authed; the laboratory sees every status.
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const plates = await listPlates(admin, 'internal');
  return NextResponse.json(
    { ok: true, edition: 'internal', isAdmin: Boolean(persona.cartridgeFlags?.isAdmin), plates },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ ok: false, error: 'Steward access required — plate lifecycle acts are admin-gated' }, { status: 403 });
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    plate?: Partial<RegisteredPlate>;
    cpNumber?: string;
  };

  const knownCpNumbers = new Set((await listPlates(admin, 'internal')).map((p) => p.cpNumber));

  if (body.action === 'validate' || body.action === 'compose') {
    const plate = body.plate ?? {};
    const check = validatePlate(plate, knownCpNumbers);
    if (body.action === 'validate' || !check.valid) {
      return NextResponse.json({ ok: true, action: 'validate', ...check });
    }
    const composed = await composePlate(admin, {
      title: String(plate.title),
      form: (plate.form ?? 'branch') as RegisteredPlate['form'],
      kind: String(plate.kind ?? 'ontology'),
      structure: plate.structure as Record<string, unknown>,
      message: String(plate.message),
      assets: plate.assets,
      constitutionalRefs: plate.constitutionalRefs ?? [],
      dependencies: plate.dependencies,
      machineTags: plate.machineTags,
      knowledgeQubeRef: plate.knowledgeQubeRef,
      composerPersonaId: persona.personaId,
    });
    if (!composed.ok) return NextResponse.json(composed, { status: 500 });
    try {
      await createActivityReceipt({
        personaId: persona.personaId,
        activeCartridge: 'irl-cartridge',
        actionType: 'canonical_plate_composed',
        summary: `Canonical plate composed: ${composed.cpNumber} — ${String(plate.title)} (draft)`,
      });
    } catch { /* receipt failure never blocks the compose */ }
    return NextResponse.json({ ok: true, action: 'compose', cpNumber: composed.cpNumber, status: 'draft' });
  }

  const transitions: PlateTransition[] = ['submit', 'canonise', 'publish', 'withdraw'];
  if (transitions.includes(body.action as PlateTransition)) {
    if (!body.cpNumber) return NextResponse.json({ ok: false, error: 'cpNumber required' }, { status: 400 });
    const result = await transitionPlate(admin, body.cpNumber, body.action as PlateTransition);
    if (!result.ok) return NextResponse.json(result, { status: 409 });
    try {
      await createActivityReceipt({
        personaId: persona.personaId,
        activeCartridge: 'irl-cartridge',
        actionType: `canonical_plate_${body.action === 'canonise' ? 'ratified' : body.action === 'publish' ? 'published' : body.action}`,
        summary: `Canonical plate ${body.cpNumber}: ${body.action} → ${result.status}`,
      });
    } catch { /* non-blocking */ }
    return NextResponse.json({ ok: true, action: body.action, cpNumber: body.cpNumber, status: result.status });
  }

  return NextResponse.json(
    { ok: false, error: 'action must be one of: validate, compose, submit, canonise, publish, withdraw' },
    { status: 400 },
  );
}
