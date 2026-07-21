/**
 * POST /api/constitutional/decision — the Constitutional Decision stage,
 * standalone (CFS-029 §7.1, ratified 2026-07-13).
 *
 * The DCC's Decision capsule calls this BEFORE pack generation: given the
 * capability goal (+ optionally the session's live Capability Evidence), it
 * decides HOW the capability should be realized — the nine mechanisms plus
 * 'none' (capability exists; compose, build nothing). When no evidence is
 * supplied, the latest PERSISTED evidence for the goal is read back
 * (CFS-029 §3: evidence outlives sessions) and its freshness reported
 * (§7.3: stale evidence grounds loudly, never silently).
 *
 * The decision returned here travels forward: the Implementation Pack route
 * accepts it verbatim (`decision` body field) so the pipeline decides ONCE.
 *
 * Admin-gated (spine; the LLM tier spends provider credits). T2-safe.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { decideRealizationMechanism } from '@/services/constitutional/constitutionalDecision';
import {
  readLatestCapabilityEvidence,
  evidenceFreshnessFor,
  type CapabilityEvidence,
  type EvidenceFreshness,
} from '@/services/constitutional/capabilityEvidence';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { goal?: unknown; capabilityEvidence?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
  if (!goal) return NextResponse.json({ ok: false, error: 'goal (string) is required' }, { status: 400 });

  const supplied =
    body.capabilityEvidence && typeof body.capabilityEvidence === 'object' && !Array.isArray(body.capabilityEvidence)
      ? (body.capabilityEvidence as CapabilityEvidence)
      : undefined;

  let evidence = supplied ?? null;
  let evidenceFreshness: EvidenceFreshness = supplied ? 'supplied' : 'none';
  if (!evidence) {
    const persisted = await readLatestCapabilityEvidence(goal);
    if (persisted) {
      evidence = persisted.evidence;
      evidenceFreshness = evidenceFreshnessFor(persisted.createdAt, new Date().toISOString());
    }
  }

  const decision = await decideRealizationMechanism(goal, evidence ?? undefined);
  return NextResponse.json({
    ok: true,
    decision: { ...decision, decidedAt: new Date().toISOString() },
    evidenceFreshness,
    evidenceSummary: evidence
      ? {
          existing: evidence.existing?.length ?? 0,
          missing: evidence.missing?.length ?? 0,
          reusePercent: evidence.reusePercent ?? null,
        }
      : null,
  });
}
