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
import { ASSIGNABLE_EXPERIMENTS, autoClaimEmailInvitation, getGrantedExperiments } from '@/services/passport/participationAccess';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    // SECURITY (2026-08-27 IRL OS containment — see
    // docs/security/2026-08-27_irl-os-containment-breach-audit.md): an
    // unauthenticated caller must not receive the full experiment catalogue
    // (ids + labels for EVERY registered experiment, including confidential
    // Autonomi/Lehigh/OCSGA workspace-scoped experiments) as an existence
    // signal. `assignable` is empty here; the caller has no access to list.
    return NextResponse.json({ ok: true, isAdmin: false, access: 'none', allowed: [], assignable: [] });
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const isAdmin = Boolean(persona.cartridgeFlags?.isAdmin);
  const quota = await checkExperimentQuota(admin, persona.personaId, new Date(), isAdmin);

  let access: 'all' | 'scoped' | 'none' = 'none';
  let allowed: string[] = [];
  let allowedExperiments: string[] = [];
  if (isAdmin) {
    access = 'all';
  } else {
    const plan = await getPersonaPlan(admin, persona.personaId);
    if (plan.experimentMonthlyCap > 0) {
      access = 'all'; // paid Sovereign-research / Steward → all experiments
    } else {
      // An emailed, authorized citizen has access without a manual claim: if the
      // caller's own email matches an active research-lab invitation, auto-claim
      // it into a grant (idempotent) before resolving.
      if (persona.authProfileId) {
        await autoClaimEmailInvitation(
          admin,
          { personaId: persona.personaId, authProfileId: persona.authProfileId },
          'research-lab',
        ).catch(() => false);
      }
      const granted = await getGrantedExperiments(admin, persona.personaId);
      if (granted.hasGrant) {
        if (granted.allowed === 'all') access = 'all';
        else {
          access = 'scoped';
          allowed = Array.from(granted.allowed);
          // Track experiments separately for the Lab component to filter correctly
          // Workspace scopes should not appear in the experiments list
          allowedExperiments = granted.scopes ? Array.from(granted.scopes.experiments) : allowed;
        }
      }
    }
  }

  // SECURITY (2026-08-27 IRL OS containment): `assignable` must never carry
  // more than this caller may actually see. Admin/'all' access legitimately
  // sees the full catalogue; a 'scoped' or 'none' caller must see only their
  // own allowed set — otherwise every other experiment's id+label (including
  // confidential Autonomi/Lehigh/OCSGA workspace-scoped entries) leaks as an
  // existence signal to a caller who was denied everything else about it.
  const assignable =
    isAdmin || access === 'all'
      ? ASSIGNABLE_EXPERIMENTS
      : ASSIGNABLE_EXPERIMENTS.filter((e) => allowedExperiments.includes(e.id));

  return NextResponse.json(
    {
      ok: true,
      isAdmin,
      access,
      allowed,
      allowedExperiments,
      assignable,
      cap: Number.isFinite(quota.cap) ? quota.cap : null,
      used: quota.used,
      remaining: Number.isFinite(quota.remaining) ? quota.remaining : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
