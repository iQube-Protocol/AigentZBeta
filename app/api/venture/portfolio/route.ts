/**
 * GET  /api/venture/portfolio — the persona's cross-venture portfolio
 *                               (ventures + derived intelligence + saved
 *                               thesis/priorities).
 * POST /api/venture/portfolio — save the portfolio-level thesis, notes, and
 *                               priority ordering.
 *
 * Gated to the Venture Portfolio wizard (Pro/Elite). Admins bypass.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getPersonaPlan } from '@/services/billing/personaPlan';
import { getVenturePortfolio, saveVenturePortfolio } from '@/services/venture/venturePortfolio';
import type { VentureOperatingModel } from '@/types/ventureQube';

export const dynamic = 'force-dynamic';

async function gate(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return { ok: false as const, status: 401, error: 'Not authenticated' };
  const admin = getSupabaseServer();
  if (!admin) return { ok: false as const, status: 503, error: 'database unavailable' };
  const isAdmin = persona.cartridgeFlags?.isAdmin === true;
  if (!isAdmin) {
    const plan = await getPersonaPlan(admin, persona.personaId);
    if (!plan.wizardAccess.portfolio) {
      return { ok: false as const, status: 403, error: 'Venture Portfolio requires Venture Lab Pro or Elite.' };
    }
  }
  return { ok: true as const, personaId: persona.personaId, admin };
}

export async function GET(req: NextRequest) {
  const g = await gate(req);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const portfolio = await getVenturePortfolio(g.admin, g.personaId);
  return NextResponse.json({ ok: true, ...portfolio });
}

export async function POST(req: NextRequest) {
  const g = await gate(req);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const body = (await req.json().catch(() => ({}))) as {
    thesis?: string | null;
    notes?: string | null;
    priorities?: string[];
    operatingModel?: VentureOperatingModel | null;
  };
  const result = await saveVenturePortfolio(g.admin, g.personaId, body);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  const portfolio = await getVenturePortfolio(g.admin, g.personaId);
  return NextResponse.json({ ok: true, ...portfolio });
}
