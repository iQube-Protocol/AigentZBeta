/**
 * GET /api/assistant/specialist-thread?specialistId=marketa&limit=20
 *
 * Returns the persona's recent consultations for one specialist (or
 * all specialists when `specialistId` is omitted). Read from the
 * existing `activity_receipts` table — no new schema. Each row in the
 * response is a thin pointer (summary + when + cartridge + intent id),
 * enough for the SpecialistsLayout's "Prior consultations" list to
 * surface continuity without requiring the full response payload.
 *
 * Fast-follow (tracked in
 * codexes/packs/agentiq/updates/2026-05-25_specialists-layout-inference-memory-backlog.md):
 *   pull the full prior response from the persona-bound inference
 *   memory and stitch it into the thread so each row can re-render as
 *   a SpecialistResponseCard, not just a pointer.
 *
 * Privacy: persona resolved from the spine; T0 ids never leave the
 * server. Only T1 receipt fields are surfaced.
 */
import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { listActivityReceiptsForPersona } from '@/services/receipts/activityReceiptService';
import type { SpecialistId } from '@/services/agents/specialistRouter';

export const dynamic = 'force-dynamic';

const VALID_SPECIALIST_IDS: Set<string> = new Set([
  'marketa',
  'quill',
  'kn0w1',
  'aigent-z',
  'aigent-c',
  'aigent-nakamoto',
  'moneypenny',
  'metaye',
]);

interface ThreadEntry {
  receiptId: string;
  specialistId: SpecialistId;
  summary: string;
  activeCartridge: string;
  createdAt: string;
  intentId: string | null;
  /** True when the consult appears to have been the answer to a hand-off ask. */
  fromHandoff: boolean;
}

interface ThreadResponse {
  specialistId: SpecialistId | null;
  entries: ThreadEntry[];
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const url = new URL(request.url);
  const specialistIdRaw = url.searchParams.get('specialistId');
  const limitRaw = url.searchParams.get('limit');
  const specialistId =
    specialistIdRaw && VALID_SPECIALIST_IDS.has(specialistIdRaw)
      ? (specialistIdRaw as SpecialistId)
      : null;
  const limit = (() => {
    const n = Number(limitRaw);
    if (!Number.isFinite(n)) return 20;
    return Math.min(Math.max(Math.round(n), 1), 50);
  })();

  try {
    // Pull a broader window so we can post-filter to the requested
    // specialist (agents_invoked is an array — the DB filter alone
    // would over-match on aigent-me which co-attends every consult).
    const receipts = await listActivityReceiptsForPersona(context.personaId, {
      limit: Math.max(limit * 3, 30),
      actionTypes: ['specialist_consulted'],
    });

    const entries: ThreadEntry[] = [];
    for (const r of receipts) {
      const consulted = r.agentsInvoked.find(
        (a) => a !== 'aigent-me' && VALID_SPECIALIST_IDS.has(a),
      ) as SpecialistId | undefined;
      if (!consulted) continue;
      if (specialistId && consulted !== specialistId) continue;
      entries.push({
        receiptId: r.id,
        specialistId: consulted,
        summary: r.summary,
        activeCartridge: r.activeCartridge,
        createdAt: r.createdAt,
        intentId: r.intentId,
        fromHandoff: r.contextShared.includes('specialist-handoff'),
      });
      if (entries.length >= limit) break;
    }

    const payload: ThreadResponse = {
      specialistId,
      entries,
    };
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/specialist-thread] failed: ${msg}`);
    return NextResponse.json(
      { error: 'specialist-thread-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
