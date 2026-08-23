/**
 * /api/research/exchanges — Reciprocal Artifact Exchange (PRD-IRL-AX-001).
 *
 * POST — create a new exchange as Party A (the initiator). A human
 *        constitutional act: requires a signed-in persona via the spine.
 * GET  — list the caller's own exchanges (as either party).
 *
 * Every response is scoped to the caller's own persona, resolved server-side
 * through the identity spine (getActivePersona) — never trusted from the
 * client. See services/research/reciprocalExchange.ts for the full gate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createExchange, listMyExchanges } from '@/services/research/reciprocalExchange';
import type { DisclosurePolicy } from '@/types/reciprocalExchange';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' } as const;

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated — sign in with your persona to create an exchange' }, { status: 401, headers: noStore });
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 503, headers: noStore });

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    purpose?: string;
    permittedPurpose?: string;
    researchQuestion?: string;
    disclosurePolicy?: DisclosurePolicy;
    comparisonPolicy?: string;
    confidentialityClass?: string;
    ownershipDeclaration?: string;
    derivativeAnalysisPermitted?: boolean;
    publicationPermitted?: boolean;
    retentionPolicy?: string;
    agreementRef?: string;
    parentExperimentId?: string;
  };
  if (!body.title?.trim() || !body.purpose?.trim() || !body.permittedPurpose?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'title, purpose and permittedPurpose are required' },
      { status: 400, headers: noStore },
    );
  }

  const result = await createExchange(admin, {
    initiatorPersonaId: persona.personaId,
    title: body.title,
    purpose: body.purpose,
    permittedPurpose: body.permittedPurpose,
    researchQuestion: body.researchQuestion,
    disclosurePolicy: body.disclosurePolicy,
    comparisonPolicy: body.comparisonPolicy,
    confidentialityClass: body.confidentialityClass,
    ownershipDeclaration: body.ownershipDeclaration,
    derivativeAnalysisPermitted: body.derivativeAnalysisPermitted,
    publicationPermitted: body.publicationPermitted,
    retentionPolicy: body.retentionPolicy,
    agreementRef: body.agreementRef,
    parentExperimentId: body.parentExperimentId,
  });
  if (!result.ok) return NextResponse.json(result, { status: 400, headers: noStore });
  return NextResponse.json(result, { headers: noStore });
}

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401, headers: noStore });
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 503, headers: noStore });

  const result = await listMyExchanges(admin, persona.personaId);
  if (!result.ok) return NextResponse.json(result, { status: 500, headers: noStore });
  return NextResponse.json(result, { headers: noStore });
}
