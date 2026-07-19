/**
 * GET /api/experiments/access — what experiments may THIS caller run, and how
 * much quota remains. Powers the IRL OS Experiments tab: it shows only the
 * experiments the caller is entitled to (paid full access, or the specific
 * set their reviewer invitation assigned), and hides acceptance tests /
 * outputs from non-admins.
 *
 * Returns:
 *   isAdmin        — admins see and run everything (no scoping)
 *   access         — 'all' | 'scoped' | 'none'
 *   allowed        — experiment ids the caller may run (when scoped)
 *   assignable     — the catalogue of assignable experiments (id + label)
 *   cap / used / remaining — monthly quota snapshot
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getPersonaPlan } from '@/services/billing/personaPlan';
import { checkExperimentQuota } from '@/services/billing/experimentQuota';
import { ASSIGNABLE_EXPERIMENTS, getGrantedExperiments } from '@/services/passport/participationAccess';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: true, isAdmin: false, access: 'none', allowed: [], assignable: ASSIGNABLE_EXPERIMENTS });
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const isAdmin = Boolean(persona.cartridgeFlags?.isAdmin);
  const quota = await checkExperimentQuota(admin, persona.personaId, new Date(), isAdmin);

  let access: 'all' | 'scoped' | 'none' = 'none';
  let allowed: string[] = [];
  if (isAdmin) {
    access = 'all';
  } else {
    const plan = await getPersonaPlan(admin, persona.personaId);
    if (plan.experimentMonthlyCap > 0) {
      access = 'all'; // paid Sovereign-research / Steward → all experiments
    } else {
      const granted = await getGrantedExperiments(admin, persona.personaId);
      if (granted.hasGrant) {
        if (granted.allowed === 'all') access = 'all';
        else {
          access = 'scoped';
          allowed = Array.from(granted.allowed);
        }
      }
    }
  }

  return NextResponse.json(
    {
      ok: true,
      isAdmin,
      access,
      allowed,
      assignable: ASSIGNABLE_EXPERIMENTS,
      cap: Number.isFinite(quota.cap) ? quota.cap : null,
      used: quota.used,
      remaining: Number.isFinite(quota.remaining) ? quota.remaining : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
