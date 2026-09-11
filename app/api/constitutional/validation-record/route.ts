/**
 * POST /api/constitutional/validation-record — record a Constitutional-class
 * Dev Receipt (CFS-020 CDE).
 *
 * Serves both Constitutional-class receipts of the Constitutional Development
 * Environment (Extend, Don't Duplicate — one route, `kind` discriminated):
 *   - kind='validation'  → `constitutional_validation_recorded`
 *   - kind='remediation' → `remediation_recorded`
 *
 * POST { goal, kind?, verdict?, satisfiedCount?, unresolvedCount?,
 *        unintendedCount?, remedyCount?, revalidationRequired?, packId? }
 *   → { ok: true, receiptId }
 *
 * `packId` (2026-07-14, merge validation gate): when supplied, the summary
 * carries `pack=<id>` so the in-app merge gate can correlate a passing
 * validation record with the Implementation Pack whose PR is being merged.
 *
 * Admin-gated (spine). The receipt summary is T2-safe: goal excerpt + counts
 * only — NO T0 identifiers (personaId/caseId/rootDid/etc.), no consequence
 * bodies. Mirrors implementation-pack/route.ts's structure and summary
 * discipline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body: {
    goal?: unknown;
    kind?: unknown;
    verdict?: unknown;
    satisfiedCount?: unknown;
    unresolvedCount?: unknown;
    unintendedCount?: unknown;
    remedyCount?: unknown;
    revalidationRequired?: unknown;
    packId?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (typeof body.goal !== 'string' || body.goal.trim().length === 0) {
    return NextResponse.json({ ok: false, error: 'goal (non-empty string) is required' }, { status: 400 });
  }
  const goal = body.goal.trim();
  const kind = body.kind === 'remediation' ? 'remediation' : 'validation';
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  // Pack correlation for the merge gate — a pack id is a T2-safe generated id
  // (UUID), never a persona identifier. Whitespace-stripped + bounded.
  const packId =
    typeof body.packId === 'string' && body.packId.trim() ? body.packId.trim().replace(/\s+/g, '').slice(0, 80) : null;

  // T2-safe summary: goal excerpt + counts only. No T0 identifiers, no bodies.
  const summary =
    (kind === 'remediation'
      ? `remediation recorded — ${n(body.remedyCount)} remed(ies) revalidation=${body.revalidationRequired === true} goal="${goal.slice(0, 100)}"`
      : `constitutional validation recorded — verdict=${typeof body.verdict === 'string' ? body.verdict : 'unknown'} ` +
        `satisfied=${n(body.satisfiedCount)} unresolved=${n(body.unresolvedCount)} unintended=${n(body.unintendedCount)} ` +
        `goal="${goal.slice(0, 100)}"`) + (packId ? ` pack=${packId}` : '');

  const receipt = await createActivityReceipt({
    personaId: persona.personaId,
    actionType: kind === 'remediation' ? 'remediation_recorded' : 'constitutional_validation_recorded',
    summary,
    activeCartridge: 'agentiq',
  }).catch((err) => {
    console.error('[api/constitutional/validation-record] receipt creation failed', err);
    return null;
  });

  if (!receipt) {
    return NextResponse.json(
      { ok: false, error: 'receipt creation failed — the record is not persisted; do not treat as recorded' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, receiptId: receipt.id });
}
