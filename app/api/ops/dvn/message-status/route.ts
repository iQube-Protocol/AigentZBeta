import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';
import { findAgentReceiptRefs, type ActivityActionType } from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/ops/dvn/message-status?agentRuntimeId=aigent-nakamoto&actionTypes=standing_accrued
 *   or  ?dvnReceiptId=<canister message id>  (classify one message directly)
 *
 * Read-only DVN message classifier — Horizen Pilot Closure, Part B1
 * (operator directive, 2026-08-09): "establish exact Nakamoto truth...
 * classify DVN message via get_dvn_message/get_message_attestations/
 * attestation count into DVN_RECORDED|WAITING_FOR_ATTESTATIONS|
 * MESSAGE_NOT_FOUND|TARGET_READ_FAILED. No guessing, no re-submission."
 *
 * NEVER submits or resubmits anything — `get_dvn_message` and
 * `get_message_attestations` are both `query` methods on the canister
 * (services/ops/idl/cross_chain_service.ts). This route only reads.
 *
 * ── WHY THE READINESS PREDICATE IS DUPLICATED HERE, NOT IMPORTED ──────────
 *
 * `services/dvn/activityReceiptDvnPipeline.ts`'s `finalizeReadyActivityReceipts`
 * already reads the SAME two canister methods with the SAME
 * `REQUIRED_ATTESTATIONS = 2` threshold — but that file is PROTECTED
 * (CLAUDE.md: no change without explicit operator approval) and does not
 * export its threshold constant or its `unwrapOpt` helper. Rather than
 * requesting an export (a change to protected infrastructure) for a
 * read-only diagnostic, this route duplicates the three-line predicate
 * verbatim. If the canister's threshold ever changes, both copies must be
 * updated together — this is the one deliberate exception to "one
 * authoritative location," made because the authoritative location is
 * off-limits to unsupervised edits.
 *
 * `DVN_RECORDED` here means the CANISTER-SIDE readiness predicate is
 * satisfied (attestationCount >= 2) — it does NOT mean
 * `activity_receipts.receipt_status` has already been flipped to
 * `dvn_recorded` locally; that transition is the finalizer's job, running
 * on its own 5-minute schedule (.github/workflows/activity-receipts-finalizer.yml).
 * This route reports BOTH so a canister-ready-but-not-yet-locally-finalized
 * state is visible rather than conflated with either extreme.
 *
 * Auth: CRON_TRIGGER_TOKEN, same convention as the other /api/ops/dvn/*
 * infra routes.
 */

/** Duplicated from activityReceiptDvnPipeline.ts's own module doc — see note above. */
const REQUIRED_ATTESTATIONS = 2;
const DVN_TARGETED_CALL_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

/** Candid `opt` decodes as `[]` (none) or `[value]` (some) — normalized to a plain nullable. */
function unwrapOpt<T>(value: Array<T> | T | null | undefined): T | null {
  if (Array.isArray(value)) return value.length > 0 ? value[0] : null;
  return value ?? null;
}

type DvnMessageClassification = 'DVN_RECORDED' | 'WAITING_FOR_ATTESTATIONS' | 'MESSAGE_NOT_FOUND' | 'TARGET_READ_FAILED';

interface MessageClassificationResult {
  dvnReceiptId: string | null;
  classification: DvnMessageClassification;
  attestationCount?: number;
  requiredAttestations?: number;
  attestations?: unknown[];
  error?: string;
}

async function classifyDvnMessage(
  dvn: { get_dvn_message: (id: string) => Promise<unknown>; get_message_attestations: (id: string) => Promise<unknown> },
  dvnReceiptId: string | null,
): Promise<MessageClassificationResult> {
  if (!dvnReceiptId) {
    return { dvnReceiptId: null, classification: 'MESSAGE_NOT_FOUND', error: 'no dvn_receipt_id on this receipt — never submitted to the canister' };
  }
  try {
    const message = unwrapOpt(
      await withTimeout(dvn.get_dvn_message(dvnReceiptId) as Promise<any>, DVN_TARGETED_CALL_TIMEOUT_MS, `get_dvn_message(${dvnReceiptId})`),
    );
    if (!message) {
      return { dvnReceiptId, classification: 'MESSAGE_NOT_FOUND' };
    }
    const attestations = await withTimeout(
      dvn.get_message_attestations(dvnReceiptId) as Promise<unknown[]>,
      DVN_TARGETED_CALL_TIMEOUT_MS,
      `get_message_attestations(${dvnReceiptId})`,
    );
    const attestationCount = Array.isArray(attestations) ? attestations.length : 0;
    return {
      dvnReceiptId,
      classification: attestationCount >= REQUIRED_ATTESTATIONS ? 'DVN_RECORDED' : 'WAITING_FOR_ATTESTATIONS',
      attestationCount,
      requiredAttestations: REQUIRED_ATTESTATIONS,
      attestations: Array.isArray(attestations) ? attestations : [],
    };
  } catch (err) {
    return { dvnReceiptId, classification: 'TARGET_READ_FAILED', error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_TRIGGER_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'cron_token_not_configured' }, { status: 503 });
  }
  const provided =
    request.headers.get('x-cron-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const DVN_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
  if (!DVN_ID) {
    return NextResponse.json({ error: 'DVN canister ID not configured' }, { status: 503 });
  }

  let dvn: { get_dvn_message: (id: string) => Promise<unknown>; get_message_attestations: (id: string) => Promise<unknown> };
  try {
    dvn = await getActor<any>(DVN_ID, dvnIdl);
  } catch (err) {
    return NextResponse.json({ error: `canister actor failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 502 });
  }

  const directDvnReceiptId = request.nextUrl.searchParams.get('dvnReceiptId');
  if (directDvnReceiptId) {
    const result = await classifyDvnMessage(dvn, directDvnReceiptId);
    return NextResponse.json({ ...result, at: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const agentRuntimeId = request.nextUrl.searchParams.get('agentRuntimeId') || 'aigent-nakamoto';
  const actionTypesParam = request.nextUrl.searchParams.get('actionTypes');
  const actionTypes = (actionTypesParam ? actionTypesParam.split(',') : ['standing_accrued'])
    .map((s) => s.trim())
    .filter(Boolean) as ActivityActionType[];

  const receipts = await findAgentReceiptRefs(agentRuntimeId, actionTypes, { limit: 50 });
  const results = await Promise.all(
    receipts.map(async (receipt) => {
      const messageStatus = await classifyDvnMessage(dvn, receipt.dvnReceiptId);
      return {
        receiptId: receipt.id,
        actionType: receipt.actionType,
        localReceiptStatus: receipt.receiptStatus,
        createdAt: receipt.createdAt,
        ...messageStatus,
        // Visible, never conflated: the canister-side predicate can say
        // DVN_RECORDED before the local row's receipt_status catches up —
        // that gap is the finalizer's own 5-minute scheduling window, not
        // a defect. It IS worth naming when it's genuinely stale (canister
        // ready, local status hasn't moved on the NEXT read either).
        localAlreadyFinalized: receipt.receiptStatus === 'dvn_recorded',
      };
    }),
  );

  return NextResponse.json(
    { agentRuntimeId, actionTypes, results, at: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
