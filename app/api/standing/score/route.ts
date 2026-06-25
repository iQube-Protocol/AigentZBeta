/**
 * GET /api/standing/score — the active persona's computed Standing score.
 *
 * Reconciles VSP veracity (verified declarations) + reputation accrual into one
 * legible score (Standing Charter sense). T1-safe.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { computeStandingScore } from '@/services/standing/standingScore';
import { getPersonaPlan } from '@/services/billing/personaPlan';
import { getExperienceQube } from '@/services/iqube/experienceQube';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'database unavailable' }, { status: 503 });
  }

  // Archetype-pathway tags are a Tier 1 (sovereignAccess) entitlement. Free
  // Citizens get the unified score with no pathway breakdown.
  const [plan, qube] = await Promise.all([
    getPersonaPlan(admin, persona.personaId).catch(() => null),
    getExperienceQube(persona.personaId).catch(() => null),
  ]);
  const includePathwayTags = plan?.sovereignAccess ?? false;

  const standing = await computeStandingScore(admin, persona.personaId, {
    includePathwayTags,
    operatorArchetype: qube?.meta.operatorArchetype ?? null,
  });
  return NextResponse.json({ ok: true, ...standing, pathwayTagsEntitled: includePathwayTags });
}
