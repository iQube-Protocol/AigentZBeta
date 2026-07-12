/**
 * POST /api/artifact/produce-software — the `software` pilot's route (CFS-025
 * Phase 2, increment 4; D1-safe under CFS-016).
 *
 * Shepherds a capability goal into an OPERATIONAL-tier `software` artifact
 * whose body is the CFS-015 Implementation Pack, via the Artifact Runtime
 * (services/artifact/pilots/softwarePilot.ts).
 *
 * Spine-guarded + admin-gated identically to /api/artifact/produce-research:
 * the caller is resolved through `getActivePersona` and must be an admin (pack
 * generation spends provider credits). The runtime + pilot see only a
 * server-computed one-way `actorCommitment` — the personaId never leaves this
 * route (and, operational tier, no receipt is written at all).
 *
 * D1 HOLDS: this route produces the implementation-pack artifact + its durable
 * record. It executes NOTHING, pushes NOTHING, deploys NOTHING. With
 * `proposeDeployment: true` the response carries the documented pointer to
 * /api/constitutional/deployment-proposal (the route-inlined D1 ceremony) —
 * the proposal is driven there, and the push stays human.
 *
 * Body: { goal: string, proposeDeployment?: boolean, domains?: string[] }
 * Response: the pilot's T1-projected SoftwarePilotResult (artifact, recordId,
 * pack projection, deploymentProposal pointer, d1 note) — no T0 identifiers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { produceSoftwareArtifact } from '@/services/artifact/pilots/softwarePilot';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Server-computed, one-way, T2-safe commitment to the acting subject — the ONLY
 *  subject handle the runtime/record see. Same namespace as produce-research so
 *  one operator maps to one artifact actor across pilots. */
function actorCommitmentFor(personaId: string): string {
  return createHash('sha256').update(`artifact:actor:${personaId}`).digest('hex').slice(0, 16);
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { goal?: unknown; proposeDeployment?: unknown; domains?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (typeof body.goal !== 'string' || body.goal.trim().length === 0) {
    return NextResponse.json({ ok: false, error: 'goal (non-empty string) is required' }, { status: 400 });
  }
  const goal = body.goal.trim();
  if (
    body.domains !== undefined &&
    (!Array.isArray(body.domains) || body.domains.some((d) => typeof d !== 'string'))
  ) {
    return NextResponse.json({ ok: false, error: 'domains must be an array of strings' }, { status: 400 });
  }

  // T2-safe intent ref derived from the goal — deterministic so a re-run of the
  // same goal carries the same authorising ref (no raw ids, no clock).
  const intentRef = `intent:aigentz-software:${createHash('sha256').update(goal).digest('hex').slice(0, 12)}`;

  try {
    const result = await produceSoftwareArtifact({
      actorCommitment: actorCommitmentFor(persona.personaId),
      intentRef,
      goal,
      domains: body.domains as string[] | undefined,
      proposeDeployment: body.proposeDeployment === true,
    });
    // T1-projected result (the pilot re-guards T0 inexpressibility). An honest
    // artifact.ok:false is still a resolved result the caller surfaces inline.
    return NextResponse.json({ ok: result.artifact.ok, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'software_production_failed';
    console.error('[api/artifact/produce-software] production failed:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
