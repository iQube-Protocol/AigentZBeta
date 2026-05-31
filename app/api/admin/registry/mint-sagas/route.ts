/**
 * /api/admin/registry/mint-sagas
 *
 * Stage 5 C21.
 *   GET  → list recent sagas for the Mints+Sagas tab
 *   POST → reconcile *_pending sagas (operator-triggered worker stub)
 *
 * Admin-gated. Both ops delegate to services/registry/mintSaga.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { listRecentSagas, reconcilePendingSagas } from '@/services/registry/mintSaga';

async function requireAdmin(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  if (!persona.cartridgeFlags?.isAdmin) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { persona };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const url = new URL(request.url);
  const limit = Number.parseInt(url.searchParams.get('limit') ?? '50', 10);
  const sagas = await listRecentSagas(Number.isFinite(limit) && limit > 0 && limit <= 200 ? limit : 50);
  return NextResponse.json({ sagas, total: sagas.length });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const report = await reconcilePendingSagas();
  return NextResponse.json(report);
}
