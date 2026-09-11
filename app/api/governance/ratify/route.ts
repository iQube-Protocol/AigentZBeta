/**
 * /api/governance/ratify — the ratification ACT.
 *
 * WHY THIS EXISTS. `createGovernanceReceipt()` has existed since Operation
 * Chrysalis Phase 0A, maps to `governance_decision_ratified` /
 * `governance_decision_amended`, and both action types are in the DVN
 * pipeline's `ANCHORABLE_ACTION_TYPES`. The whole path — helper →
 * `createActivityReceipt` → DVN → canister — works, and it had ZERO CALL SITES.
 * A complete mechanism nothing invoked (MS-7: an inert mechanism is a defect
 * even though nothing errors).
 *
 * The reason sat upstream of the missing call: ratification was not an EVENT.
 * `GOVERNANCE_DECISIONS` was a hardcoded array; ratifying meant editing that
 * array and a markdown table. Neither is an act the platform observes, so there
 * was nothing for a receipt to attach to.
 *
 * OPERATOR RULING, 2026-07-27: *"Ratification must become an explicit
 * authorised operator act. Editing a constitutional document does not
 * constitute ratification and must not automatically emit a governance
 * receipt. The ratification act must bind the decision to the exact document
 * version and immutable content hash, invoke the existing governance receipt
 * helper, and enter the DVN anchoring pipeline."*
 *
 * WHAT THIS ROUTE IS AND IS NOT. It is the THIN authority boundary: authenticate,
 * admit only an admin, parse, resolve the candidate, delegate. The act itself —
 * persist → receipt → DVN → observe — lives in
 * `services/governance/governanceRatification.ts`, because a constitutional act
 * that only exists inside an HTTP handler cannot be performed by anything else
 * and cannot be tested without one.
 *
 * WHAT IT ANCHORS. The receipt carries the document's CONTENT HASH, version,
 * amendment ids, authority basis and effective date — not merely the decision
 * id. A receipt attesting that "GD-014 was ratified" without attesting to what
 * GD-014 SAID is a signature on a blank page: the document could change
 * afterwards and the anchor would still verify.
 *
 * GET returns the projected decision log — persisted ratifications first, seed
 * entries flagged as seed — with each record's OBSERVED anchor state.
 *
 * Admin-gated: ratification is an authority act. The ops-token branch is NOT
 * offered — unlike a scheduled report, ratification must have a human behind it
 * (Law XI: amending canon is an operator act).
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  RATIFICATION_ACTS,
  RATIFIABLE_ROOTS,
  recordRatification,
  resolveRatificationCandidate,
  resolveDecision,
  projectGovernanceDecisionLog,
  type RatificationAct,
  type RatificationKind,
} from '@/services/governance/governanceRatification';
import type { DecisionDomain } from '@/services/governance/governanceDecisionLog';

export const dynamic = 'force-dynamic';

function bad(error: string, detail?: string, status = 400): NextResponse {
  return NextResponse.json(
    { ok: false, error, ...(detail ? { detail } : {}) },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && !!v.trim()) : [];
}

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return bad('unauthenticated', undefined, 401);
  if (!persona.cartridgeFlags?.isAdmin) return bad('admin-access-required', undefined, 403);

  const decisions = await projectGovernanceDecisionLog();
  return NextResponse.json(
    {
      ok: true,
      decisions,
      // The projection's own honesty: how many entries are backed by an act.
      counts: {
        ratified: decisions.filter((d) => d.provenance === 'ratified').length,
        seed: decisions.filter((d) => d.provenance === 'seed').length,
      },
    },
    NO_STORE,
  );
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return bad('unauthenticated', undefined, 401);
  if (!persona.cartridgeFlags?.isAdmin) return bad('admin-access-required', undefined, 403);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return bad('invalid-json-body');
  }
  const body = (raw ?? {}) as Record<string, unknown>;

  const act = String(body.act ?? 'ratify') as RatificationAct;
  if (!(act in RATIFICATION_ACTS)) {
    return bad('unknown-act', `expected one of ${Object.keys(RATIFICATION_ACTS).join(' | ')}`);
  }

  const decisionId = typeof body.decisionId === 'string' ? body.decisionId.trim() : '';
  if (!decisionId) return bad('decision-id-required');

  const documentPath = typeof body.documentPath === 'string' ? body.documentPath.trim() : '';
  if (!documentPath) {
    return bad(
      'document-path-required',
      'a receipt attesting that something was ratified without attesting to what it said is a signature on a blank page',
    );
  }

  // Steps 3 + 4 — resolve the exact candidate and freeze/hash its bytes.
  const candidate = await resolveRatificationCandidate(documentPath, {
    documentId: typeof body.documentId === 'string' ? body.documentId : undefined,
    documentTitle: typeof body.documentTitle === 'string' ? body.documentTitle : undefined,
    documentVersion: typeof body.documentVersion === 'string' ? body.documentVersion : undefined,
  });
  if (!candidate) {
    return bad(
      'document-not-ratifiable',
      `must be readable and live under one of: ${RATIFIABLE_ROOTS.join(', ')}`,
    );
  }

  const known = await resolveDecision(decisionId);

  // Steps 6 → 8 — persist the event, then the receipt, then the DVN pipeline.
  const result = await recordRatification({
    personaId: persona.personaId,
    decisionId,
    act,
    candidate,
    domain:
      known?.domain ??
      (typeof body.decisionType === 'string' ? (body.decisionType as DecisionDomain) : 'constitutional'),
    summary: typeof body.summary === 'string' ? body.summary : known?.title,
    authorityBasis:
      (typeof body.authorityBasis === 'string' ? body.authorityBasis : '') ||
      known?.constitutionalBasis,
    sovereigntyImpact: known?.sovereigntyImpact,
    amendmentIds: stringArray(body.amendmentIds),
    supersedes: stringArray(body.supersedes),
    previousContentHash:
      typeof body.previousContentHash === 'string' ? body.previousContentHash : null,
    effectiveAt: typeof body.effectiveAt === 'string' ? body.effectiveAt : null,
    ratificationKind:
      body.ratificationKind === 'retrospective'
        ? ('retrospective' as RatificationKind)
        : ('original' as RatificationKind),
    originalRatifiedAt:
      typeof body.originalRatifiedAt === 'string' ? body.originalRatifiedAt : undefined,
    historicalContentRecoverable:
      typeof body.historicalContentRecoverable === 'boolean'
        ? body.historicalContentRecoverable
        : undefined,
  });

  if (!result.ok) {
    // The act happened; the record did not. Say so rather than reporting
    // success — an unrecorded ratification is exactly the gap this closes.
    return NextResponse.json(
      { ok: false, error: 'ratification-not-recorded', detail: result.reason },
      { status: 500, ...NO_STORE },
    );
  }

  const { ratification } = result;
  if (!ratification.receiptId) {
    // The record stands, but the receipt — the thing that reaches the DVN — did
    // not get written. Reporting ok:true here would recreate the original defect
    // in a subtler form: a ratification that nothing will ever anchor.
    return NextResponse.json(
      {
        ok: false,
        error: 'receipt-not-written',
        detail: 'the ratification is recorded but no governance receipt was created — it will not anchor',
        ratification,
      },
      { status: 500, ...NO_STORE },
    );
  }

  return NextResponse.json(
    { ok: true, alreadyRecorded: result.alreadyRecorded, ratification },
    NO_STORE,
  );
}
