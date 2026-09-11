/**
 * GET /api/identity/resolve-ens/[name]
 *
 * Public ENS reverse resolver. Accepts either:
 *   - bare label: 'first-citizen' → resolves under ENS_PARENT (polity.eth)
 *   - full name:  'first-citizen.polity.eth'
 *
 * Returns the persona_public_ref (T1-safe commitment) the ENS resolves
 * to. NEVER returns persona_id or any T0 identifier.
 *
 * Per the 2026-06-13 hackathon plan §Sprint 7 — anonymity guardrail.
 *
 * This endpoint is intentionally public + CORS-enabled (external
 * verifiers may use it to check that a presented ENS name truly maps
 * to the persona's public ref).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

const ENS_PARENT = process.env.ENS_PARENT_NAME ?? 'polity.eth';

interface RouteParams {
  params: Promise<{ name: string }>;
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

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { name } = await params;
    if (!name) {
      return withCors(NextResponse.json({ ok: false, error: 'name required' }, { status: 400 }));
    }

    const ensFull = name.includes('.') ? name.toLowerCase() : `${name.toLowerCase()}.${ENS_PARENT}`;

    const admin = getSupabaseServer();
    if (!admin) {
      return withCors(
        NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 }),
      );
    }

    // Persona ENS first.
    const { data: pRow } = await admin
      .from('persona_ens_names')
      .select('ens_full, ens_label, ens_parent, persona_public_ref, status, minted_at')
      .eq('ens_full', ensFull)
      .eq('status', 'live')
      .maybeSingle();

    if (pRow) {
      return withCors(
        NextResponse.json({
          ok: true,
          kind: 'persona',
          ensFull: pRow.ens_full,
          ensLabel: pRow.ens_label,
          ensParent: pRow.ens_parent,
          // T1-safe — commitment hash only. Never persona_id.
          publicRef: pRow.persona_public_ref,
          mintedAt: pRow.minted_at,
        }),
      );
    }

    // Locker ENS next.
    const { data: lRow } = await admin
      .from('locker_ens_names')
      .select('ens_full, ens_label, ens_parent, status, minted_at')
      .eq('ens_full', ensFull)
      .eq('status', 'live')
      .maybeSingle();

    if (lRow) {
      return withCors(
        NextResponse.json({
          ok: true,
          kind: 'locker',
          ensFull: lRow.ens_full,
          ensLabel: lRow.ens_label,
          ensParent: lRow.ens_parent,
          // Locker reverse resolution intentionally hides the holder's
          // public ref — only the bound delegate can resolve the actual
          // holder via the QubeTalk channel.
          publicRef: null,
          mintedAt: lRow.minted_at,
        }),
      );
    }

    return withCors(NextResponse.json({ ok: false, error: 'ENS name not found' }, { status: 404 }));
  } catch (e) {
    return withCors(
      NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Resolve failed' }, { status: 500 }),
    );
  }
}
