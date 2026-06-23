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
  let canPortfolio = isAdmin;
  if (!isAdmin) {
    const plan = await getPersonaPlan(admin, persona.personaId);
    // The Founder Office (any paid tier) unlocks the operating model; this row
    // also holds it, so any Founder Office tier may read/write here. The
    // portfolio-specific surfaces (multi-venture priorities/thesis) are gated in
    // the UI by `portfolio` access.
    if (!plan.wizardAccess.operatingModel) {
      return { ok: false as const, status: 403, error: 'The operating brief requires entering the Founder Office (Founder tier or above).' };
    }
    canPortfolio = plan.wizardAccess.portfolio;
  }
  return { ok: true as const, personaId: persona.personaId, admin, canPortfolio };
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
  // The operating model is available to any Founder Office tier; the portfolio
  // fields (thesis/notes/priorities) are Founder Pro/Elite only. Strip them for
  // Founder-tier callers so a tier-1 save persists only the operating brief.
  const input = g.canPortfolio
    ? body
    : { operatingModel: body.operatingModel };
  const result = await saveVenturePortfolio(g.admin, g.personaId, input);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  const portfolio = await getVenturePortfolio(g.admin, g.personaId);
  return NextResponse.json({ ok: true, ...portfolio });
}
