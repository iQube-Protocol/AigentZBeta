/**
 * POST /api/homecoming/agent/produce — the Homecoming↔Artifact-Runtime convergence
 * (CFS-023 Phase 4 Operational Homecoming, delivered through CFS-025 AR).
 *
 * A constitutional delegate produces a real operating artifact NATIVELY: it drafts
 * the content (grounded in its constitutional identity + sovereign knowledge,
 * carrying a sovereignty receipt), and the Artifact Runtime tiers + envelopes it.
 *
 * Admin-gated (spends provider credits) + spine-guarded. Like the IRL pilot
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
import { saveArtifactRecord, listArtifactRecords } from '@/services/artifact/artifactRecordStore';
import { accrueProductionStanding, resolveDelegateAgentId } from '@/services/homecoming/delegateStanding';
import { mirrorLifecycleToLinear } from '@/services/linear/lifecycleMirror';
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

  // Persist non-disposable productions (CFS-025: disposable is NEVER persisted;
  // operational + constitutional get a durable record so the artifact survives a
  // refresh). Best-effort — soft-fails to response-only until the migration runs.
  let recordId: string | null = null;
  if (result.consequenceClass !== 'disposable' && result.artifact.ok && result.body) {
    recordId = await saveArtifactRecord({
      artifactId: result.artifact.artifactId ?? 'unassigned',
      profile: typeof body.profile === 'string' ? body.profile : 'documentation',
      consequenceClass: result.consequenceClass as 'operational' | 'constitutional',
      delegate,
      title: brief.slice(0, 120),
      brief,
      body: result.body,
      receiptId: result.artifact.receiptId ?? null,
      sovereignty: result.sovereignty,
    });
  }

  // The Standing loop (CFS-023 × CFS-025): a successful non-disposable
  // production accrues standing to the DELEGATE (delegated lane) through the
  // canonical accrual service — the delegate EARNS its trust-band climb by
  // producing. Best-effort; an accrual failure never blocks the production and
  // is reported honestly.
  let standing: Awaited<ReturnType<typeof accrueProductionStanding>> | null = null;
  if (result.consequenceClass !== 'disposable' && result.artifact.ok) {
    const agentId = await resolveDelegateAgentId(delegate);
    standing = agentId
      ? await accrueProductionStanding({
          delegateAgentId: agentId,
          consequenceClass: result.consequenceClass as 'operational' | 'constitutional',
          receiptId: result.artifact.receiptId ?? null,
        })
      : { accrued: false, reason: `no seeded RootDID for '${delegate}' — stand the delegate up first` };
  }

  // Linear mirror (observe-mode, soft-fail): delegate productions track in the
  // same cycle issue — a receipt-anchored constitutional production lands Done,
  // otherwise In Progress. T2-safe note (delegate slug, record/receipt ids,
  // earned standing) — never a persona identifier.
  const linear =
    result.consequenceClass !== 'disposable' && result.artifact.ok
      ? await mirrorLifecycleToLinear({
          delegate,
          profile: typeof body.profile === 'string' ? body.profile : 'documentation',
          brief,
          phase:
            result.consequenceClass === 'constitutional' && result.artifact.receiptId
              ? 'published'
              : 'artifact_produced',
          note: [
            `Produced by \`${delegate}\` (${result.consequenceClass})`,
            recordId ? `record \`${recordId}\`` : null,
            result.artifact.receiptId ? `receipt \`${result.artifact.receiptId}\`` : null,
            standing?.accrued
              ? `standing +${standing.cvs} → ${standing.overall} (ceiling ${standing.trustBandCeiling})`
              : null,
          ]
            .filter(Boolean)
            .join(' — '),
        })
      : { mirrored: false, reason: 'disposable or failed production — not mirrored (by definition)' };

  return NextResponse.json({ ok: result.artifact.ok, recordId, standing, linear, ...result });
}

/** GET — list produced artifact records (?delegate=…), newest first. Admin-gated. */
export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
  const delegate = new URL(req.url).searchParams.get('delegate')?.trim() || undefined;
  const records = await listArtifactRecords({ delegate });
  return NextResponse.json(
    {
      ok: true,
      records: records.map((r) => ({
        id: r.id,
        artifactId: r.artifact_id,
        profile: r.profile,
        consequenceClass: r.consequence_class,
        delegate: r.delegate,
        title: r.title,
        contentHash: r.content_hash,
        receiptId: r.receipt_id,
        createdAt: r.created_at,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
