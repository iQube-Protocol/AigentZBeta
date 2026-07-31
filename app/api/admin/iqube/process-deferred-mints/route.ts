/**
 * POST /api/admin/iqube/process-deferred-mints — drain the deferred tokenQube
 * mint queue (admin-only).
 *
 * Mints pending rows whose target chain is live (Base today), reconciling the
 * registry / ownership / persona_qube_mints records. Safe to run repeatedly;
 * wire to a cron when the batch cadence is decided. GET returns queue counts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { processDeferredMints } from '@/services/chain/deferredMint';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function requireAdmin(req: NextRequest) {
  // Scheduled-caller path — a GitHub Actions cron has no persona session, so
  // it authenticates with the ADMIN_OPS_TOKEN bearer (same convention as
  // /api/access/finalize-receipts). Checked first so the loop never needs a
  // Supabase session.
  const expected = process.env.ADMIN_OPS_TOKEN;
  if (expected) {
    const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token === expected) return { ok: true as const };
  }

  // Interactive admin path — operator/persona session resolved via the spine.
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return { ok: false as const, status: 401, error: 'Not authenticated' };
  if (!persona.cartridgeFlags?.isAdmin) return { ok: false as const, status: 403, error: 'Admin access required' };
  return { ok: true as const };
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

  let limit = 50;
  try {
    const body = (await req.json().catch(() => ({}))) as { limit?: number };
    if (typeof body.limit === 'number' && body.limit > 0 && body.limit <= 500) limit = body.limit;
  } catch { /* default limit */ }

  try {
    const result = await processDeferredMints({ admin, limit });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Deferred mint processing failed' },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

  const { data, error } = await admin
    .from('deferred_token_qube_mints')
    .select('status, target_chain')
    .limit(1000);
  if (error) {
    if (error.message.includes('deferred_token_qube_mints')) {
      return NextResponse.json({ ok: true, counts: {}, migrationPending: '20260617300000_deferred_token_qube_mints.sql' });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    const key = `${r.target_chain}:${r.status}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return NextResponse.json({ ok: true, counts });
}
