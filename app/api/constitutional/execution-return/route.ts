/**
 * /api/constitutional/execution-return — ingest an Execution Return
 * (Homecoming Phase II WP-B).
 *
 * POST { packId, actor, branch?, commits?, pullRequest?, filesChanged,
 *        validationResults, deviationsFromPack, failuresOrEscalations,
 *        discoveries, consequenceObservations, completedAt }
 *   → { ok: true, receiptId, replayed?: true }
 *
 * Admin-gated (spine), same as the sibling implementation-pack route this
 * evidence closes the loop for. Refuses (400, `pack-not-found`) unless
 * `packId` is POSITIVELY confirmed against a real `implementation_pack_
 * generated` receipt — fails closed on any doubt (network/DB error is
 * treated the same as "not found", never optimistically accepted).
 *
 * A duplicate/replayed submission for a packId that already has an accepted
 * Execution Return is handled deterministically: the EXISTING receipt id is
 * returned (`replayed: true`) and no second receipt is written — the same
 * evidence resubmitted twice must not fabricate two divergent records of
 * "what happened".
 *
 * This route never writes `deployment_authorized` and never calls or
 * references the merge/dispatch surfaces — it is the return half of the
 * cybernetic loop, not a new execution or authorization mechanism.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  verifyPackExists,
  findAcceptedExecutionReturn,
  recordExecutionReturn,
  type ExecutionReturn,
  type ExecutionReturnValidationResult,
} from '@/services/constitutional/executionReturn';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set(['passed', 'failed', 'not-run']);

function coerceValidationResults(raw: unknown): ExecutionReturnValidationResult[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ExecutionReturnValidationResult[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return null;
    const e = entry as Record<string, unknown>;
    if (typeof e.name !== 'string' || !e.name.trim()) return null;
    if (typeof e.status !== 'string' || !VALID_STATUSES.has(e.status)) return null;
    out.push({
      name: e.name,
      status: e.status as ExecutionReturnValidationResult['status'],
      ...(typeof e.detail === 'string' ? { detail: e.detail } : {}),
    });
  }
  return out;
}

function coerceStringArray(raw: unknown): string[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.some((x) => typeof x !== 'string')) return null;
  return raw as string[];
}

/** Parses and validates the request body into a well-typed ExecutionReturn,
 *  or returns a string naming the first validation failure. Pure. */
export function parseExecutionReturn(body: unknown): ExecutionReturn | string {
  if (!body || typeof body !== 'object') return 'body must be a JSON object';
  const b = body as Record<string, unknown>;

  if (typeof b.packId !== 'string' || !b.packId.trim()) return 'packId (non-empty string) is required';
  if (typeof b.actor !== 'string' || !b.actor.trim()) return 'actor (non-empty string) is required';
  if (typeof b.completedAt !== 'string' || !b.completedAt.trim()) return 'completedAt (ISO string) is required';

  const filesChanged = coerceStringArray(b.filesChanged);
  if (filesChanged === null) return 'filesChanged must be an array of strings';

  const validationResults = coerceValidationResults(b.validationResults ?? []);
  if (validationResults === null) {
    return "validationResults must be an array of { name: string, status: 'passed'|'failed'|'not-run', detail?: string }";
  }

  const deviationsFromPack = coerceStringArray(b.deviationsFromPack);
  if (deviationsFromPack === null) return 'deviationsFromPack must be an array of strings';
  const failuresOrEscalations = coerceStringArray(b.failuresOrEscalations);
  if (failuresOrEscalations === null) return 'failuresOrEscalations must be an array of strings';
  const discoveries = coerceStringArray(b.discoveries);
  if (discoveries === null) return 'discoveries must be an array of strings';
  const consequenceObservations = coerceStringArray(b.consequenceObservations);
  if (consequenceObservations === null) return 'consequenceObservations must be an array of strings';

  const commits = b.commits === undefined ? [] : coerceStringArray(b.commits);
  if (commits === null) return 'commits must be an array of strings';

  let pullRequest: ExecutionReturn['pullRequest'] = null;
  if (b.pullRequest !== undefined && b.pullRequest !== null) {
    if (typeof b.pullRequest !== 'object') return 'pullRequest must be an object';
    const pr = b.pullRequest as Record<string, unknown>;
    pullRequest = {
      ...(typeof pr.number === 'number' ? { number: pr.number } : {}),
      ...(typeof pr.url === 'string' ? { url: pr.url } : {}),
    };
  }

  return {
    packId: b.packId.trim(),
    actor: b.actor.trim(),
    branch: typeof b.branch === 'string' ? b.branch : null,
    commits,
    pullRequest,
    filesChanged,
    validationResults,
    deviationsFromPack,
    failuresOrEscalations,
    discoveries,
    consequenceObservations,
    completedAt: b.completedAt,
  };
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const parsed = parseExecutionReturn(rawBody);
  if (typeof parsed === 'string') {
    return NextResponse.json({ ok: false, error: parsed }, { status: 400 });
  }
  const ret = parsed;

  // Fail closed: `false` (confirmed absent) and `null` (could not check)
  // are refused identically — an Execution Return is never accepted on an
  // unconfirmed pack.
  const exists = await verifyPackExists(ret.packId);
  if (exists !== true) {
    return NextResponse.json(
      { ok: false, error: 'pack-not-found', detail: `No implementation_pack_generated receipt found for packId "${ret.packId}"` },
      { status: 400 },
    );
  }

  // Deterministic replay handling: an existing accepted return for this
  // packId is returned as-is, never duplicated. A lookup failure here also
  // fails closed (refuse) rather than risk writing a second, divergent
  // record of "what happened".
  const existingReceiptId = await findAcceptedExecutionReturn(ret.packId);
  if (existingReceiptId === undefined) {
    return NextResponse.json(
      { ok: false, error: 'duplicate-check-failed', detail: 'Could not verify whether this pack already has an accepted Execution Return.' },
      { status: 503 },
    );
  }
  if (existingReceiptId !== null) {
    return NextResponse.json({ ok: true, receiptId: existingReceiptId, replayed: true });
  }

  const receiptId = await recordExecutionReturn({ actingPersonaId: persona.personaId, ret });
  if (!receiptId) {
    return NextResponse.json({ ok: false, error: 'record_failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, receiptId });
}
