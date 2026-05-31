/**
 * GET /api/iqubes/[id]/actions
 *
 * Agent-readable action menu for `id`. Each entry exposes:
 * - verb (the IQubeAgentAction)
 * - HTTP method to call
 * - href (absolute URL)
 * - auth / policy / DVN-receipt requirements
 *
 * Verbs the source has explicitly disallowed are OMITTED — the
 * route surfaces affordances, not denials (an agent shouldn't be
 * told "you can call X but it will fail"; it should not see X at
 * all).
 *
 * Phase 1 note (PRD §8.4): action `href`s may point at routes
 * whose handlers don't yet exist. That's fine — the action menu
 * is descriptive in v0.1. Fast-follow wires the POST handlers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildIQubeCard, buildActionMenu } from '@/services/iqube/legibility/cardBuilder';
import { getLegibilitySource } from '@/services/iqube/legibility/registry';
import {
  IQubeActionsResponseSchema,
  safeValidate,
} from '@/services/iqube/legibility/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

function withCors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Cache-Control', 'public, max-age=60');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const id = params.id?.trim();
  if (!id) {
    return withCors(NextResponse.json({ error: 'Missing id' }, { status: 400 }));
  }

  const source = await getLegibilitySource(id);
  if (!source) {
    return withCors(NextResponse.json({ error: 'Not found' }, { status: 404 }));
  }

  const card = buildIQubeCard(source);
  const candidate = buildActionMenu(card);

  const validated = safeValidate(IQubeActionsResponseSchema, candidate, `actions[${id}]`);
  if (!validated) {
    return withCors(NextResponse.json(
      { error: 'Invalid actions response' },
      { status: 500 },
    ));
  }

  return withCors(NextResponse.json(validated));
}
