/**
 * POST /api/governance/ratify — the ratification ACT.
 *
 * WHY THIS EXISTS. `createGovernanceReceipt()` has existed since Operation
 * Chrysalis Phase 0A, maps to `governance_decision_ratified` /
 * `governance_decision_amended`, and both action types are in the DVN
 * pipeline's `ANCHORABLE_ACTION_TYPES`. The whole path — helper →
 * `createActivityReceipt` → DVN → canister — works.
 *
 * It had ZERO CALL SITES. The only reference anywhere outside its own
 * definition was a re-export in `services/governance/index.ts`. So no
 * constitutional amendment has ever produced a receipt to anchor: not Law XVI,
 * not the Horizen amendments, not the 2026-06-17 charters. A complete
 * mechanism nothing invoked — MS-7, an inert mechanism is a defect even though
 * nothing errors.
 *
 * The reason sat upstream of the missing call. Ratification was not an EVENT.
 * `GOVERNANCE_DECISIONS` is a hardcoded array; ratifying meant editing that
 * array and editing a markdown table. Neither is an act the platform observes,
 * so there was nothing for a receipt to attach to.
 *
 * OPERATOR RULING, 2026-07-27, on whether a document edit should emit a receipt
 * or ratification should become an explicit act: *"I'd say both — an operator
 * performs ratification and a receipt of that is generated."* This route is the
 * act; the receipt is its consequence, not a side effect of saving a file.
 *
 * WHAT IT ANCHORS. The receipt carries a CONTENT COMMITMENT of the ratified
 * document, not merely its id. A receipt attesting that "GD-014 was ratified"
 * without attesting to what GD-014 SAID is a signature on a blank page — the
 * document could change afterwards and the anchor would still verify. The
 * commitment is a sha256 of the document bytes, computed server-side from the
 * repo path, so re-ratifying an unchanged document is idempotent in content and
 * a changed document produces a visibly different commitment.
 *
 * T2 discipline: the commitment, the decision id and the document path are all
 * T2-safe. No persona identifier enters the receipt beyond the existing
 * `createActivityReceipt` contract, which hashes it for the DVN payload.
 *
 * Admin-gated: ratification is an authority act. The ops-token branch is NOT
 * offered here — unlike a scheduled report, ratification must have a human
 * behind it (Law XI: amending canon is an operator act).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join, normalize } from 'path';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { createGovernanceReceipt } from '@/services/governance/governanceReceiptHelper';
import { getDecision } from '@/services/governance/governanceDecisionLog';

export const dynamic = 'force-dynamic';

/** The two lifecycle acts this route performs. */
const RATIFICATION_ACTS = {
  ratify: 'governance_decision_ratified',
  amend: 'governance_decision_amended',
} as const;
type RatificationAct = keyof typeof RATIFICATION_ACTS;

/**
 * Roots a ratifiable document may live under. Ratification is an act over
 * CONSTITUTIONAL material; pointing it at arbitrary repo files would let the
 * governance ledger attest to anything.
 */
const RATIFIABLE_ROOTS = ['codexes/packs/irl/foundation/', 'codexes/packs/polity-core/items/', 'codexes/packs/agentiq/updates/'];

function bad(error: string, detail?: string, status = 400): NextResponse {
  return NextResponse.json(
    { ok: false, error, ...(detail ? { detail } : {}) },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * sha256 of the document's bytes. Returns null when the path is outside the
 * ratifiable roots, escapes the repo, or does not exist — a ratification whose
 * subject cannot be read is refused rather than anchored without content.
 */
function commitDocument(repoRelativePath: string): { commitment: string; bytes: number } | null {
  const normalized = normalize(repoRelativePath);
  if (normalized.startsWith('..') || normalized.startsWith('/')) return null;
  if (!RATIFIABLE_ROOTS.some((root) => normalized.startsWith(root))) return null;
  try {
    const buf = readFileSync(join(process.cwd(), normalized));
    return { commitment: createHash('sha256').update(buf).digest('hex'), bytes: buf.length };
  } catch {
    return null;
  }
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

  const doc = commitDocument(documentPath);
  if (!doc) {
    return bad(
      'document-not-ratifiable',
      `must exist and live under one of: ${RATIFIABLE_ROOTS.join(', ')}`,
    );
  }

  // A decision id already in the log carries its own classification; one that
  // is not (a document-first amendment such as Law XVI) supplies its own.
  const known = getDecision(decisionId);
  const summary =
    typeof body.summary === 'string' && body.summary.trim()
      ? body.summary.trim()
      : known?.title ?? `${act === 'ratify' ? 'Ratified' : 'Amended'} ${decisionId}`;

  const receipt = await createGovernanceReceipt({
    personaId: persona.personaId,
    actionType: RATIFICATION_ACTS[act],
    decisionId,
    decisionType: known?.domain ?? (typeof body.decisionType === 'string' ? body.decisionType : 'constitutional'),
    affectedRoles: [],
    affectedAssets: [`document:${documentPath}`, `sha256:${doc.commitment}`],
    authorityBasis: known?.constitutionalBasis ?? 'Law XI — amending canon is an operator act',
    constitutionalBasis: known?.constitutionalBasis ?? 'CFS-009',
    escalationPath: 'operator',
    sovereigntyImpact: known?.sovereigntyImpact ?? { me: 'neutral', c: 'neutral', z: 'neutral' },
    summary: `${summary} · sha256:${doc.commitment.slice(0, 16)} (${doc.bytes} bytes)`,
  });

  if (!receipt) {
    // The act happened; the record did not. Say so rather than reporting
    // success — an unrecorded ratification is exactly the gap this closes.
    return NextResponse.json(
      { ok: false, error: 'receipt-not-written', commitment: doc.commitment },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      act,
      decisionId,
      documentPath,
      commitment: doc.commitment,
      receiptId: receipt.id,
      // The DVN pipeline anchors asynchronously; the receipt's own status is
      // the truth about whether it reached the canister.
      receiptStatus: receipt.receiptStatus,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
