/**
 * POST /api/artifact/records/promote — promote a persisted artifact record
 * operational → constitutional (CFS-025 maturation: a deliberate act of
 * promotion, up exactly one tier, never down).
 *
 * Admin-gated + spine-guarded. The route resolves the operator's real T0
 * personaId under the gate solely to write the ONE anchored
 * `artifact_published` receipt; the record is then lifted with that receipt id
 * (the verification pair: content_hash + receipt_id). The Standing loop applies:
 * the producing delegate accrues the constitutional-publication CVS on promotion.
 *
 * Body: { recordId: string }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { canPromote } from '@/types/artifactRuntime';
import { readArtifactRecord, promoteArtifactRecord } from '@/services/artifact/artifactRecordStore';
import { accrueProductionStanding, resolveDelegateAgentId } from '@/services/homecoming/delegateStanding';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { recordId?: string };
  const recordId = body.recordId?.trim();
  if (!recordId) return NextResponse.json({ ok: false, error: 'recordId is required' }, { status: 400 });

  const record = await readArtifactRecord(recordId);
  if (!record) return NextResponse.json({ ok: false, error: 'Record not found' }, { status: 404 });
  if (!canPromote(record.consequence_class, 'constitutional')) {
    return NextResponse.json(
      { ok: false, error: `Cannot promote from '${record.consequence_class}' — promotion moves up exactly one tier (operational → constitutional).` },
      { status: 409 },
    );
  }

  // The single anchored publication receipt — written BEFORE the lift so a
  // promoted record always carries its verification anchor.
  const receipt = await createActivityReceipt({
    personaId: persona.personaId,
    activeCartridge: 'agentiq',
    actionType: 'artifact_published',
    summary: `artifact record ${record.artifact_id} promoted to constitutional — sha256 ${record.content_hash.slice(0, 16)}`,
    contextShared: ['artifact-runtime', 'promotion'],
    artifactsCreated: [record.artifact_id],
  }).catch(() => null);
  if (!receipt?.id) {
    return NextResponse.json({ ok: false, error: 'publication receipt write failed — record left operational (honest: no half-promotion)' }, { status: 502 });
  }

  const promoted = await promoteArtifactRecord(recordId, receipt.id);
  if (!promoted) {
    return NextResponse.json(
      { ok: false, error: 'promotion update failed (record may have been promoted concurrently)', receiptId: receipt.id },
      { status: 409 },
    );
  }

  // Standing loop: the PRODUCING delegate earns the constitutional CVS on
  // promotion (best-effort; 'operator'-produced records accrue nothing).
  let standing = null;
  if (promoted.delegate && promoted.delegate !== 'operator') {
    const agentId = await resolveDelegateAgentId(promoted.delegate);
    if (agentId) {
      standing = await accrueProductionStanding({
        delegateAgentId: agentId,
        consequenceClass: 'constitutional',
        receiptId: receipt.id,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    recordId: promoted.id,
    consequenceClass: promoted.consequence_class,
    receiptId: receipt.id,
    contentHash: promoted.content_hash,
    standing,
  });
}
