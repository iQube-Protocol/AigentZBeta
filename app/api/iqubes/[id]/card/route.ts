/**
 * GET /api/iqubes/[id]/card
 *
 * Returns the validated iQubeCard for `id`. Behaviour per PRD §8.2:
 *
 *   - id resolves to a public iQube              → 200 + full card
 *   - id resolves to public_meta_private_payload → 200 + meta card
 *   - id resolves to private (or unknown)        → 404
 *   - validation failure                         → 500 + standard
 *     error body (PRD §11)
 *
 * The card is the single source of truth for what the iQube exposes
 * to agents. The Registry remains canonical for the underlying
 * content — `card.registry.canonical_url` always points back.
 *
 * Spine guardrails:
 * - Never serialises T0 fields. The card builder + source adapters
 *   are the chokepoint; this route just hands them through.
 * - For `public_meta_private_payload`, payload-bearing fields stay
 *   absent from the response (the builder already omits them).
 * - The optional `Authorization: Bearer …` header is accepted but
 *   ignored in v0.1 — auth-aware behaviour is the fast-follow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildIQubeCard } from '@/services/iqube/legibility/cardBuilder';
import { getLegibilitySource } from '@/services/iqube/legibility/registry';
import { IQubeCardSchema, safeValidate } from '@/services/iqube/legibility/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function withCors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.headers.set('Cache-Control', 'public, max-age=60');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(_req: NextRequest, props: RouteParams) {
  const params = await props.params;
  const id = params.id?.trim();
  if (!id) {
    return withCors(NextResponse.json({ error: 'Missing id' }, { status: 400 }));
  }

  const source = await getLegibilitySource(id);
  // PRD §8.2 — default for private / unknown is 404, not 403, to
  // avoid leaking existence.
  if (!source) {
    return withCors(NextResponse.json({ error: 'Not found' }, { status: 404 }));
  }

  const candidate = buildIQubeCard(source);
  const card = safeValidate(IQubeCardSchema, candidate, `card[${id}]`);
  if (!card) {
    return withCors(NextResponse.json(
      { error: 'Invalid iQubeCard response' },
      { status: 500 },
    ));
  }

  return withCors(NextResponse.json(card, {
    headers: { 'Content-Type': 'application/iqube-card+json' },
  }));
}
