/**
 * POST /api/research/crystal/[experimentId]/freeze — the operator's freeze act,
 * and the artifact provisioning it depends on. Admin-gated.
 *
 * ── The gap this closes (audit, 2026-08-02) ─────────────────────────────────
 *
 * `freezeArtifact` (services/research/artifacts.ts) has existed, gated and
 * receipted, since PRD-EPI-001 §2 — and had **no caller anywhere in this
 * repository**. Neither did `upsertArtifact`, so no `crystal-version` artifact
 * has ever been created either. The whole ladder above it (readiness →
 * statistics → recommendation → ceremony package) terminated in a package the
 * operator could read and then had no way to act on.
 *
 * A constitutional act with no reachable mechanism is doctrine, not machinery.
 * This route is the mechanism. It adds no new gate and relaxes none: every
 * refusal below either belongs to `freezeArtifact`/`checkFreezeGate` already,
 * or is a guard on the ONE thing an HTTP layer can get wrong that the service
 * cannot see — ratifying a hash that no longer describes the corpus.
 *
 * ── Two explicit acts, never one ────────────────────────────────────────────
 *
 *   action: "provision"  create/refresh the crystal-version artifact at
 *                        `validated`. Freely editable pre-freeze (IRL-016 §3).
 *                        Not a freeze; writes no commitment and no signature.
 *
 *   action: "freeze"     the constitutional act. Requires `confirm: true`, a
 *                        non-empty signatory list, a stated rationale, and a
 *                        `contentHash` that still matches the corpus as it
 *                        stands right now.
 *
 * There is deliberately no single call that does both. Provisioning an artifact
 * as a side effect of freezing would mean the operator's one act created the
 * object it then ratified, and nothing would have been reviewable in between.
 *
 * ── The staleness guard, and why it is here rather than in the service ──────
 *
 * `freezeArtifact` writes whatever `contentHash` it is handed as the immutable
 * `commitmentHash`. It cannot tell whether that hash still describes the
 * corpus, because it never recomputes one. So an operator who previewed a
 * package on Monday, had an invariant assigned to the domain on Tuesday, and
 * ratified on Wednesday would commit Monday's hash over Wednesday's crystal —
 * an immutable, receipted, DVN-anchored commitment to a set that no longer
 * exists, discoverable only by someone who recomputed it later.
 *
 * This route therefore recomputes the statistics hash at the moment of the act
 * and refuses a mismatch, naming both values. It never substitutes the fresh
 * hash for the operator's: ratifying a value the operator did not read would be
 * the same defect wearing a helpful face.
 *
 * ── T0 discipline ───────────────────────────────────────────────────────────
 *
 * `signedBy` is written into a durable, receipted, chain-anchorable record.
 * Raw persona UUIDs are T0 and must never reach it, so a UUID-shaped signatory
 * is refused outright — the caller supplies T2-safe references
 * (`personaPublicRef`), the same exposure class the freeze ceremony package's
 * `operatorRef`/`reviewerRef` already carry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { freezeArtifact, getArtifactById, upsertArtifact } from '@/services/research/artifacts';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { runCrystalStatisticsReport } from '@/services/research/crystalStatistics';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface FreezeBody {
  action?: unknown;
  crystalId?: unknown;
  crystalDomain?: unknown;
  contentHash?: unknown;
  signedBy?: unknown;
  freezeRationale?: unknown;
  confirm?: unknown;
  /** Required boolean, freeze act only. See the boundary block below —
   *  declared here only so this is visible as a real field, never so it can
   *  be defaulted. */
  boundaryAcknowledged?: unknown;
  /**
   * NOT INPUTS (operator ruling, EXP PP1 Track 2, 2026-08-05): the ratified
   * boundary is read server-side from the Domain Declaration and is never
   * supplied, restated, or overridden by a caller — declared here only so a
   * caller that still sends one is REFUSED rather than silently ignored,
   * mirroring freeze-preview/route.ts's own guard.
   */
  domainBoundary?: unknown;
  namespace?: unknown;
  scope?: unknown;
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * GET ?crystalId=... — read-only. Exists so the Freeze surface can render a
 * post-freeze summary (receipt, immutable metadata) WITHOUT re-mounting the
 * ceremony inputs on every reload (operator bug report, 2026-08-05: "the UI
 * still renders the pre-freeze ceremony... creating the impression that
 * another freeze is required"). The programme route's own artifact signal
 * is a narrow `{id, lifecycle}` projection — this is the first place that
 * reads the artifact's full frozen fields (contentHash, signedBy, frozenAt,
 * receiptId) back out.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ experimentId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ requestSucceeded: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ requestSucceeded: false, error: 'Steward access required' }, { status: 403 });
  }
  const { experimentId } = await params;
  const crystalId = req.nextUrl.searchParams.get('crystalId') || `${experimentId}/crystal-vP1`;
  const artifact = await getArtifactById(crystalId).catch(() => null);
  return NextResponse.json(
    { requestSucceeded: true, artifact },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ experimentId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ requestSucceeded: false, error: 'Not authenticated' }, { status: 401 });
  }
  // Every Review-workspace role carries `mayFreeze: false` by construction
  // (services/research/researchWorkspaceRoles.ts) — requesting a freeze and
  // performing one are the distinction the whole boundary rests on. So this
  // route admits the platform steward only, and is NOT extended to the
  // assigned-reviewer path the read-only readiness route admits.
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ requestSucceeded: false, error: 'Steward access required' }, { status: 403 });
  }

  const { experimentId } = await params;
  let body: FreezeBody;
  try {
    body = (await req.json()) as FreezeBody;
  } catch {
    return NextResponse.json({ requestSucceeded: false, error: 'invalid JSON body' }, { status: 400 });
  }

  const action = asString(body.action);
  if (action !== 'provision' && action !== 'freeze') {
    return NextResponse.json(
      { requestSucceeded: false, error: 'action must be "provision" or "freeze"' },
      { status: 400 },
    );
  }

  const crystalId = asString(body.crystalId) || `${experimentId}/crystal-vP1`;

  // ── provision ────────────────────────────────────────────────────────────
  if (action === 'provision') {
    const existing = await getArtifactById(crystalId).catch(() => null);
    if (existing?.lifecycle === 'frozen') {
      return NextResponse.json(
        {
          requestSucceeded: false,
          error: `artifact '${crystalId}' is already frozen — freeze is immutable (IRL-016 §4) and it may not be reset to 'validated'`,
        },
        { status: 409 },
      );
    }
    const result = await upsertArtifact({
      id: crystalId,
      kind: 'crystal-version',
      phase: 'protocol',
      experimentId,
      lifecycle: 'validated',
    });
    if (!result.ok) {
      return NextResponse.json({ requestSucceeded: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json(
      {
        requestSucceeded: true,
        action,
        crystalId,
        lifecycle: 'validated',
        note:
          'Provisioned only. Nothing is frozen, no commitment is written and no signature is recorded — a ' +
          'pre-freeze artifact stays freely editable (IRL-016 §3). Run the freeze preview next.',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // ── freeze ───────────────────────────────────────────────────────────────
  if (body.confirm !== true) {
    return NextResponse.json(
      {
        requestSucceeded: false,
        error:
          'confirm: true is required — a freeze is a constitutional act and is never performed as a side ' +
          'effect of reading a preview',
      },
      { status: 400 },
    );
  }

  /*
   * FREEZE MUST NEVER ACCEPT A DOMAIN BOUNDARY AS OPERATOR INPUT (operator
   * ruling, EXP PP1 Track 2, 2026-08-05). The freeze package carries the
   * ratified boundary verbatim, read server-side from the Domain
   * Declaration — the operator's only constitutional act here is to
   * acknowledge that they are freezing exactly that ratified boundary.
   * Changing scope is a formal amendment to the Domain Declaration
   * (services/research/crystalDomains.ts), never a field on this request —
   * mirrors freeze-preview/route.ts's identical guard.
   */
  for (const forbidden of ['domainBoundary', 'namespace', 'scope'] as const) {
    if (body[forbidden] !== undefined) {
      return NextResponse.json(
        {
          requestSucceeded: false,
          error:
            `${forbidden} is not an input to the freeze act. The ratified boundary is read server-side from the ` +
            'domain declaration; a different scope requires a formal amendment to the domain declaration, never ' +
            'a field on this request.',
        },
        { status: 400 },
      );
    }
  }

  // The ratified Domain Declaration must exist BEFORE anything else about
  // scope is checked — a freeze with no ratified boundary to acknowledge is
  // not a smaller version of a valid freeze, it is not a freeze at all.
  const declaration = crystalDomainForExperiment(experimentId);
  if (!declaration?.boundary) {
    return NextResponse.json(
      {
        requestSucceeded: false,
        error: `no ratified Domain Declaration exists for experiment '${experimentId}' — freeze cannot proceed without one`,
      },
      { status: 400 },
    );
  }

  if (body.boundaryAcknowledged !== true) {
    return NextResponse.json(
      {
        requestSucceeded: false,
        error:
          'boundaryAcknowledged: true is required — the operator must acknowledge the exact ratified boundary ' +
          '(read server-side from the domain declaration) before freezing; it is never re-derived, restated, ' +
          'or bypassed here.',
        ratifiedBoundary: declaration.boundary,
      },
      { status: 400 },
    );
  }

  const freezeRationale = asString(body.freezeRationale);
  if (!freezeRationale) {
    return NextResponse.json(
      { requestSucceeded: false, error: 'freezeRationale is required — an unexplained freeze is a stray click in the audit trail' },
      { status: 400 },
    );
  }

  const signedBy = Array.isArray(body.signedBy)
    ? body.signedBy.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim())
    : [];
  if (signedBy.length === 0) {
    return NextResponse.json(
      { requestSucceeded: false, error: 'signedBy must hold at least one signatory reference (IRL-016 §2)' },
      { status: 400 },
    );
  }
  const t0Leak = signedBy.find((s) => UUID_SHAPE.test(s));
  if (t0Leak) {
    return NextResponse.json(
      {
        requestSucceeded: false,
        error:
          `signatory '${t0Leak}' is UUID-shaped — a raw persona identifier is T0 and must never enter a ` +
          'durable, receipted, chain-anchorable record. Supply the T2-safe reference (personaPublicRef) instead.',
      },
      { status: 400 },
    );
  }

  const suppliedHash = asString(body.contentHash);
  if (!suppliedHash) {
    return NextResponse.json(
      { requestSucceeded: false, error: 'contentHash is required — it becomes the immutable commitmentHash (PRD-EPI-001 §2.1)' },
      { status: 400 },
    );
  }

  const crystalDomain = asString(body.crystalDomain) || declaration.domain;
  if (!crystalDomain) {
    return NextResponse.json(
      {
        requestSucceeded: false,
        error: `no crystal domain is declared for experiment '${experimentId}' and none was supplied — refusing to freeze over a guessed domain`,
      },
      { status: 400 },
    );
  }

  // The staleness guard. Recomputed here, at the moment of the act.
  const statistics = await runCrystalStatisticsReport({ experimentId, crystalDomain });
  if (statistics.substrateError) {
    return NextResponse.json(
      {
        requestSucceeded: false,
        error:
          `cannot verify the content commitment — the invariant substrate is unreadable: ${statistics.substrateError}. ` +
          'Refusing to freeze against a hash that could not be checked.',
      },
      { status: 503 },
    );
  }
  if (statistics.frozenHash !== suppliedHash) {
    return NextResponse.json(
      {
        requestSucceeded: false,
        error:
          'contentHash does not describe the crystal as it stands now — the corpus changed since the package ' +
          'you read was built. Rebuild the freeze preview and ratify the hash you have actually reviewed.',
        suppliedContentHash: suppliedHash,
        currentContentHash: statistics.frozenHash,
        crystalDomain,
        invariantCount: statistics.invariantCount,
      },
      { status: 409 },
    );
  }

  // Everything below belongs to the service. `freezeArtifact` re-runs
  // `checkFreezeGate` → `runCrystalReadinessReport` itself, refuses a re-freeze,
  // refuses a non-`validated` source state, and writes the receipt through the
  // one lifecycle path. This route does not duplicate any of it.
  const frozen = await freezeArtifact({
    personaId: persona.personaId,
    id: crystalId,
    contentHash: suppliedHash,
    signedBy,
  });
  if (!frozen.ok) {
    return NextResponse.json({ requestSucceeded: false, error: frozen.error }, { status: 409 });
  }

  return NextResponse.json(
    {
      requestSucceeded: true,
      action,
      crystalId,
      crystalDomain,
      contentHash: suppliedHash,
      signedBy,
      freezeRationale,
      invariantCount: statistics.invariantCount,
      receiptId: frozen.receiptId ?? null,
      note:
        'Frozen. The crystal’s content is fixed and receipted; the receipt rides the existing ' +
        'research_lifecycle_transition DVN path. Publication as canonical is a separate act.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
