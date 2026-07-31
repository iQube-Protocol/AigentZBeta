/**
 * GET /api/capability/producers — CFS-028 production routing (RATIFIED
 * 2026-07-12). Ranked, reasoned producer recommendations for one capability at
 * one consequence tier, for the OPERATOR to select from (Law XI: the graph
 * recommends, the operator selects — this route never executes anything).
 *
 * Query: ?capability=<ArtifactProfileId|deployment-execution>&tier=<operational|constitutional>
 * Admin-gated (spine) — the produce surfaces this feeds are admin-gated too.
 * T2-safe: producers, band labels, scores, and stated reasons only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { recommendProducers } from '@/services/capability/capabilityGraph';
import { ARTIFACT_PROFILES } from '@/types/artifactRuntime';
import type { CapabilityId } from '@/types/capabilityGraph';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });

  const params = new URL(req.url).searchParams;
  const capability = params.get('capability')?.trim() ?? '';
  const validCapability =
    (ARTIFACT_PROFILES as readonly string[]).includes(capability) || capability === 'deployment-execution';
  if (!validCapability) {
    return NextResponse.json(
      { ok: false, error: `capability must be one of: ${[...ARTIFACT_PROFILES, 'deployment-execution'].join(', ')}` },
      { status: 400 },
    );
  }
  const tierParam = params.get('tier')?.trim();
  const tier = tierParam === 'constitutional' ? 'constitutional' : 'operational';

  const recommendations = await recommendProducers(capability as CapabilityId, tier);
  return NextResponse.json(
    { ok: true, capability, tier, recommendations },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
