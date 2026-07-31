/**
 * GET /api/assistant/workbench-ledger
 *
 * Pills & Artifacts ledger for the active persona — the historical
 * view that powers the myWorkbench surface.
 *
 * Combines:
 *   - intent_qubes (via nbe_plans) → every Pill the persona has Acted
 *     on, with its current status (in_progress / completed / failed /
 *     cancelled / awaiting_approval)
 *   - activity_receipts (action_type in [artifact_created,
 *     artifact_sent, approval_granted]) → the artifact + approval
 *     trail attached to each Pill
 *
 * Receipts joined to Pills via `intent_id`. Receipts without an
 * intent_id are emitted as `orphan_artifact` entries — these are the
 * compose-strip drafts (Email/Doc/etc.) where the operator started a
 * draft without first Acting on a Pill.
 *
 * Persona resolved through the spine. Never accept persona id from
 * query (T0 — server-internal only).
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { listRecentIntentsForPersona } from '@/services/iqube/intentQube';
import {
  listActivityReceiptsForPersona,
  type ActivityReceiptRecord,
} from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';

interface LedgerArtifactEntry {
  /** Connector-emitted reference, e.g. "google-doc:1abc...". */
  reference: string;
  /** Parsed type (google-doc / gmail-draft / brief / etc.). */
  type: string | null;
  /** Parsed id portion of the reference. */
  id: string | null;
  /** Receipt that recorded this artifact. */
  receiptId: string;
  /** When the receipt was issued. */
  recordedAt: string;
  /** Whether the receipt represents a send (vs draft). */
  sent: boolean;
}

interface LedgerPillEntry {
  kind: 'pill';
  intentId: string;
  intentName: string;
  intentType: string;
  cartridge: string;
  status: 'in_progress' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
  approvalRequired: boolean;
  createdAt: string;
  /** Specialist agents the Pill is routed to (display only). */
  agents: string[];
  /** Artifacts produced for this Pill, oldest first. */
  artifacts: LedgerArtifactEntry[];
}

interface LedgerOrphanEntry {
  kind: 'orphan_artifact';
  /** Receipt id — also serves as the entry's React key. */
  receiptId: string;
  summary: string;
  cartridge: string;
  createdAt: string;
  artifacts: LedgerArtifactEntry[];
}

type LedgerEntry = LedgerPillEntry | LedgerOrphanEntry;

function parseArtifactReference(ref: string, receipt: ActivityReceiptRecord): LedgerArtifactEntry {
  const colon = ref.indexOf(':');
  const type = colon > 0 ? ref.slice(0, colon) : null;
  const id = colon > 0 ? ref.slice(colon + 1) : null;
  return {
    reference: ref,
    type,
    id,
    receiptId: receipt.id,
    recordedAt: receipt.createdAt,
    sent: receipt.actionType === 'artifact_sent',
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ error: 'persona-required' }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '50'), 1), 200);

  // Two parallel reads — the intent list and the receipt list. Intents
  // give us the canonical Pill state; receipts give us the artifact
  // trail. The merge happens client-side of the DB call so we don't
  // need a fragile SQL join.
  const [intents, receipts] = await Promise.all([
    listRecentIntentsForPersona(persona.personaId, { limit }),
    listActivityReceiptsForPersona(persona.personaId, {
      limit,
      actionTypes: ['artifact_created', 'artifact_sent', 'approval_granted'],
    }),
  ]);

  // Build childIntentId → parentIntentId so artifacts on child intents
  // roll up to the parent pill (Content Capsule Containment golden
  // rule, CLAUDE.md).
  const parentByChild = new Map<string, string>();
  for (const p of intents) {
    if (p.parentIntentId) parentByChild.set(p.id, p.parentIntentId);
  }

  // Group artifact receipts by their effective root intent_id (parent
  // when present, else self). Receipts without an intent_id become
  // orphan_artifact entries.
  const artifactsByIntent = new Map<string, LedgerArtifactEntry[]>();
  const orphanReceipts: ActivityReceiptRecord[] = [];
  for (const r of receipts) {
    const refs = r.artifactsCreated ?? [];
    if (refs.length === 0) continue;
    if (r.intentId) {
      const rootId = parentByChild.get(r.intentId) ?? r.intentId;
      const list = artifactsByIntent.get(rootId) ?? [];
      for (const ref of refs) list.push(parseArtifactReference(ref, r));
      artifactsByIntent.set(rootId, list);
    } else {
      orphanReceipts.push(r);
    }
  }

  // Filter out child intents — they live inside their parent capsule's
  // chain panel, not as standalone Active Intents pills. Surfacing them
  // here would violate the Content Capsule Containment golden rule
  // (CLAUDE.md): derivative content from a parent capsule must render
  // inside that parent, not as orphan top-level pills.
  const rootIntents = intents.filter((p) => !p.parentIntentId);

  const pillEntries: LedgerPillEntry[] = rootIntents.map((p) => ({
    kind: 'pill' as const,
    intentId: p.id,
    intentName: p.intentName,
    intentType: p.intentType,
    cartridge: p.activeCartridge,
    status: p.status,
    approvalRequired: p.approvalRequired,
    createdAt: p.createdAt,
    agents: p.targetAgents,
    artifacts: artifactsByIntent.get(p.id) ?? [],
  }));

  const orphanEntries: LedgerOrphanEntry[] = orphanReceipts.map((r) => ({
    kind: 'orphan_artifact' as const,
    receiptId: r.id,
    summary: r.summary,
    cartridge: r.activeCartridge,
    createdAt: r.createdAt,
    artifacts: (r.artifactsCreated ?? []).map((ref) => parseArtifactReference(ref, r)),
  }));

  const merged: LedgerEntry[] = [...pillEntries, ...orphanEntries].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );

  return NextResponse.json({
    entries: merged,
    counts: {
      total: merged.length,
      pills: pillEntries.length,
      orphans: orphanEntries.length,
      queued: pillEntries.filter((p) => p.status === 'in_progress' || p.status === 'awaiting_approval').length,
      complete: pillEntries.filter((p) => p.status === 'completed').length,
    },
  });
}
