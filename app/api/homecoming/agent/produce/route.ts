/**
 * POST /api/homecoming/agent/produce — the Homecoming↔Artifact-Runtime convergence
 * (CFS-023 Phase 4 Operational Homecoming, delivered through CFS-025 AR).
 *
 * A constitutional delegate produces a real operating artifact NATIVELY: it drafts
 * the content (grounded in its constitutional identity + sovereign knowledge,
 * carrying a sovereignty receipt), and the Artifact Runtime tiers + envelopes it.
 *
 * Admin-gated (spends provider credits) + spine-guarded. Like the CCRL pilot
 * route, this SEAM resolves the operator's real T0 personaId server-side under the
 * gate and threads it ONLY as the publish-receipt writer id; the delegate seam +
 * runtime see a T2 `actorCommitment` only.
 *
 * Body: {
 *   delegate: HomecomingDelegateId, brief: string, profile?: ArtifactProfileId,
 *   consequenceClass?: 'operational' | 'constitutional', mode?: 'propose'|'publish'
 * }.
 * Default: operational tier, propose-mode (a delegate cannot birth a constitutional
 * artifact — the operator PROMOTES it, and only a promotion + publish anchors).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getKnowledgeBaseService } from '@/services/content/knowledgeBaseService';
import { produceViaDelegate } from '@/services/homecoming/delegateProduce';
import { HOMECOMING_DELEGATES, type HomecomingDelegateId } from '@/types/homecoming';
import type { ArtifactProfileId } from '@/types/artifactRuntime';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function actorCommitmentFor(personaId: string): string {
  return createHash('sha256').update(`artifact:actor:${personaId}`).digest('hex').slice(0, 16);
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });

  let body: {
    delegate?: string;
    brief?: string;
    profile?: string;
    consequenceClass?: string;
    mode?: string;
    maxTokens?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const delegate = body.delegate as HomecomingDelegateId;
  if (!delegate || !(HOMECOMING_DELEGATES as readonly string[]).includes(delegate)) {
    return NextResponse.json(
      { ok: false, error: `delegate must be one of: ${HOMECOMING_DELEGATES.join(', ')}` },
      { status: 400 },
    );
  }
  const brief = typeof body.brief === 'string' ? body.brief.trim() : '';
  if (!brief) return NextResponse.json({ ok: false, error: 'brief is required' }, { status: 400 });

  // Only operational/constitutional are meaningful requests here; anything else
  // (incl. omitted) classifies (→ operational for delegate work).
  const consequenceClass =
    body.consequenceClass === 'constitutional'
      ? 'constitutional'
      : body.consequenceClass === 'operational'
      ? 'operational'
      : undefined;
  const mode = body.mode === 'publish' ? 'publish' : 'propose';

  // Best-effort sovereign-knowledge grounding — the `homecoming` KB domain, same
  // source the converse route uses. Never blocks production.
  let knowledge: string[] = [];
  try {
    const kb = getKnowledgeBaseService();
    const chunks = await kb.getRelevantChunks(brief, 'homecoming', 5, 1500);
    knowledge = chunks.map((c) => c.content).filter(Boolean);
  } catch {
    // Grounding is additive — proceed without it.
  }

  const personaId = persona.personaId;
  const result = await produceViaDelegate({
    delegate,
    brief,
    profile: typeof body.profile === 'string' ? (body.profile as ArtifactProfileId) : undefined,
    consequenceClass,
    mode,
    actorCommitment: actorCommitmentFor(personaId),
    intentRef: `intent:homecoming:${delegate}`,
    ...(mode === 'publish' ? { personaId } : {}),
    grounding: knowledge.length ? { knowledge } : undefined,
    maxTokens: typeof body.maxTokens === 'number' ? body.maxTokens : undefined,
  });

  return NextResponse.json({ ok: result.artifact.ok, ...result });
}
