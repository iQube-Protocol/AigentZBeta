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
import { createExchange, listMyExchanges, listExchangesByParentExperiment } from '@/services/research/reciprocalExchange';
import { resolveWorkspaceRole } from '@/services/passport/participationAccess';
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

  // Optional workspace/programme scope (2026-09-08, Workspace capability
  // generalization) — when a caller's surface (e.g. a Workspace card) only
  // cares about exchanges tagged to ONE canonical research workspace/programme
  // (`parentExperimentId`, the same free-text tag `listExchangesByParentExperiment`
  // filters on), this narrows the caller's own already-scoped list rather than
  // requiring a second endpoint. Omitted -> unchanged set of exchanges (every
  // one this persona is a party to).
  const parentExperimentId = req.nextUrl.searchParams.get('parentExperimentId');
  const scoped = parentExperimentId
    ? result.exchanges.filter((e) => e.parentExperimentId === parentExperimentId)
    : result.exchanges;

  // Workspace-scoped observer inclusion (2026-09-12, operator instruction:
  // "should not be restricted just to the parties who exchanged them but
  // should be visible to anyone who has access rights to the experiment").
  // A caller who holds workspace access to `parentExperimentId` but is not a
  // direct party to any exchange tagged with it should still see it listed —
  // the SAME admission getExchangeView/resolveExchangeArtifactContent grant
  // for the single-exchange view, applied here to the LIST too, so a caller
  // never sees an exchange listed that they'd then be refused opening.
  if (parentExperimentId) {
    const role = await resolveWorkspaceRole(admin, persona.personaId, parentExperimentId, null);
    if (role) {
      const all = await listExchangesByParentExperiment(admin, parentExperimentId);
      if (all.ok) {
        const seen = new Set(scoped.map((e) => e.id));
        for (const e of all.exchanges) {
          if (!seen.has(e.id)) {
            scoped.push(e);
            seen.add(e.id);
          }
        }
      }
    }
  }

  // T0 STRIP (fixed in passing, 2026-09-08 — this list endpoint previously
  // returned the full `ReciprocalExchangeRecord`, including
  // initiatorPersonaId/counterpartyPersonaId/inviteCodeHash, unstripped. The
  // sibling single-exchange view (`getExchangeView`, reciprocalExchange.ts)
  // already treats these as T0 — "strip them... so no T0 value leaks into a
  // JSON response" — this list route simply hadn't been given the same
  // treatment yet. The client's own `ExchangeSummary` type only ever read
  // id/title/purpose/status/disclosurePolicy/createdAt, so this is a pure
  // response-shape narrowing, not a behavior change for any real caller.)
  const exchanges = scoped.map((e) => ({
    id: e.id,
    title: e.title,
    purpose: e.purpose,
    status: e.status,
    disclosurePolicy: e.disclosurePolicy,
    createdAt: e.createdAt,
  }));

  return NextResponse.json({ ok: true, exchanges }, { headers: noStore });
}
