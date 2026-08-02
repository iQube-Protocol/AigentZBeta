/**
 * POST /api/research/crystal/[experimentId]/assign — assign already-validated
 * invariants to an experiment's RATIFIED crystal domain (Track 2, step 4).
 * Admin-gated.
 *
 * ── The gap this closes (audit, 2026-08-02) ─────────────────────────────────
 *
 * Track 2's chain is: admit an external source → extract candidates → validate
 * through the receipted lifecycle → ASSIGN eligible invariants to the ratified
 * domain → readiness → freeze. Every step but the fourth had an operator-usable
 * path. The fourth had none:
 *
 *   - `upsertContext` (services/invariants/store.ts) had exactly two callers,
 *     both inside `services/invariants/lifecycle.ts` — `discoverInvariant`
 *     (creation time only) and `mergeInvariants`. Nothing could add a domain to
 *     an invariant that already exists.
 *   - `promoteCandidate` tags a promoted candidate with its DISCOVERY domain
 *     (`financial-services`), never a crystal domain. Running Track 2 end to end
 *     would therefore have produced validated invariants that never appear in
 *     `financial-risk-value-systems` — and the readiness surface would still
 *     have reported zero, for a completely different reason.
 *   - `domainAcceptsAssignment` had no production caller at all.
 *
 * ── What this route does NOT do ─────────────────────────────────────────────
 *
 * It never creates an invariant, never edits a statement, never changes a
 * lifecycle status, and never changes a provenance class. It only records that
 * an EXISTING, ALREADY-ELIGIBLE invariant belongs to the declared crystal
 * domain. Every admission decision is made by `evaluateCrystalAssignment`
 * against the ratified declaration's own fields — this route holds no copy of
 * the rule.
 *
 * A record that is not yet eligible is REFUSED with the rule that refused it.
 * The remedy is to validate it (`POST /api/invariants/[id]/advance`) or to
 * record its evidence provenance through the reclassification path
 * (`POST /api/invariants/discovery`, action `classify`) — both of
 * which are recorded acts carrying their own evidence. Neither is performed
 * here, because making a record eligible and admitting an eligible record are
 * different acts by different authorities.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { getInvariantsByIds, listContexts, upsertContext } from '@/services/invariants/store';
import {
  crystalDeclarationHash,
  crystalDomainForExperiment,
  domainAcceptsAssignment,
  evaluateCrystalAssignment,
  type CrystalAssignmentRefusal,
} from '@/services/research/crystalDomains';
import { readEvidenceProvenance } from '@/services/research/experimentalPopulations';
import { writeLifecycleReceipt } from '@/services/research/lifecycle';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface AssignBody {
  invariantIds?: unknown;
  /** Evaluate and report, write nothing. Default TRUE — a write is opt-in. */
  dryRun?: unknown;
  /** Optional context interpretation, stored verbatim on the context row. */
  interpretation?: unknown;
  /**
   * Why these invariants are being admitted. Required for a real write —
   * inclusion in a governed corpus is an act, and an unexplained one is a
   * stray click in the record that decides what the experiment tested.
   */
  rationale?: unknown;
}

interface AssignmentOutcome {
  invariantId: string;
  admitted: boolean;
  written: boolean;
  refusals: CrystalAssignmentRefusal[];
  detail: string;
  /** Domains this invariant already belonged to, BEFORE this act. */
  priorDomains: string[];
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ experimentId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ requestSucceeded: false, error: 'Not authenticated' }, { status: 401 });
  }
  // Corpus construction is steward work. The Review workspace's reviewer roles
  // are deliberately NOT admitted here: `RESEARCH_WORKSPACE_ROLE_AUTHORITY`
  // gives every role `mayFreeze: false`, and admitting material to a governed
  // boundary sits on the same side of that line as freezing it.
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ requestSucceeded: false, error: 'Steward access required' }, { status: 403 });
  }

  const { experimentId } = await params;
  const declaration = crystalDomainForExperiment(experimentId);
  if (!declaration) {
    return NextResponse.json(
      {
        requestSucceeded: false,
        error:
          `no crystal domain is declared for experiment '${experimentId}' — an experiment cannot silently ` +
          `inherit another's crystal`,
      },
      { status: 404 },
    );
  }

  let body: AssignBody;
  try {
    body = (await req.json()) as AssignBody;
  } catch {
    return NextResponse.json({ requestSucceeded: false, error: 'invalid JSON body' }, { status: 400 });
  }

  const invariantIds = Array.isArray(body.invariantIds)
    ? [...new Set(body.invariantIds.filter((v): v is string => typeof v === 'string' && v.trim().length > 0))]
    : [];
  if (invariantIds.length === 0) {
    return NextResponse.json(
      { requestSucceeded: false, error: 'invariantIds must be a non-empty array of invariant ids' },
      { status: 400 },
    );
  }
  // Opt-in, not opt-out. A caller that forgets the flag inspects; it does not
  // write to a governed boundary.
  const dryRun = body.dryRun !== false;
  const interpretation = typeof body.interpretation === 'string' ? body.interpretation : null;
  const rationale = typeof body.rationale === 'string' ? body.rationale.trim() : '';
  if (!dryRun && !rationale) {
    return NextResponse.json(
      {
        requestSucceeded: false,
        error:
          'rationale is required for a real assignment — inclusion in a governed corpus is an act, and the ' +
          'record of what this experiment tested must say why each member is in it. A dry run needs none.',
      },
      { status: 400 },
    );
  }

  // Refuse the whole request on an unratified boundary — evaluating per-record
  // would report N identical refusals for one fact about the domain.
  if (!domainAcceptsAssignment(declaration)) {
    return NextResponse.json(
      {
        requestSucceeded: false,
        error:
          `domain '${declaration.domain}' is '${declaration.ratification}' — no source or invariant may be ` +
          'assigned to it until the boundary is ratified',
      },
      { status: 409 },
    );
  }

  let records: Awaited<ReturnType<typeof getInvariantsByIds>>;
  try {
    records = await getInvariantsByIds(invariantIds);
  } catch (error) {
    return NextResponse.json(
      { requestSucceeded: false, error: `invariant substrate unreadable: ${error instanceof Error ? error.message : String(error)}` },
      { status: 503 },
    );
  }

  const byId = new Map(records.map((r) => [r.id, r]));
  const outcomes: AssignmentOutcome[] = [];
  const notFound: string[] = [];
  const writeErrors: string[] = [];

  for (const id of invariantIds) {
    const record = byId.get(id);
    if (!record) {
      notFound.push(id);
      continue;
    }
    const verdict = evaluateCrystalAssignment({
      declaration,
      status: record.status,
      evidenceProvenance: readEvidenceProvenance(record.provenance),
    });

    // Read BEFORE the write — "which domains did this belong to before this
    // act" is unanswerable afterwards, because the context row is an upsert.
    const priorDomains = (await listContexts(record.id).catch(() => []))
      .map((c) => c.domain)
      .sort();

    let written = false;
    if (verdict.admitted && !dryRun) {
      try {
        await upsertContext({
          invariantId: record.id,
          domain: declaration.domain,
          interpretation,
          retrievalTags: [],
        });
        written = true;
      } catch (error) {
        writeErrors.push(`${record.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    outcomes.push({
      invariantId: record.id,
      admitted: verdict.admitted,
      written,
      refusals: verdict.refusals,
      detail: verdict.detail,
      priorDomains,
    });
  }

  const admitted = outcomes.filter((o) => o.admitted).length;
  const declarationHash = crystalDeclarationHash(declaration);

  /*
   * THE ASSIGNMENT RECEIPT (operator ruling, 2026-08-02).
   *
   *   > "Assignment is a governed inclusion act, not a database write."
   *
   * The context row records THAT an invariant is in the domain. It cannot
   * record who admitted it, under which version of the boundary, on what
   * eligibility decision, or why — and those are exactly the questions asked of
   * a frozen crystal later. So a real assignment writes a receipt carrying all
   * eight required facts.
   *
   * ── Which mechanism this relies on, stated plainly ─────────────────────────
   *
   * It rides the EXISTING `research_lifecycle_transition` receipt
   * (`writeLifecycleReceipt`), which is already in ANCHORABLE_ACTION_TYPES and
   * already passes the SQL CHECK constraint. **No new ActivityActionType and no
   * schema change.** Inventing `crystal_assignment_recorded` would need a
   * migration to the action-type constraint — a schema change the operator has
   * not ruled on, and one this session must not make unilaterally.
   *
   * The trade-off, named rather than hidden: the facts live in the receipt's
   * `summary` text, not in typed columns, so they are auditable by reading and
   * not queryable by field. If the operator later wants a typed assignment
   * receipt, that is a migration plus one action-type addition — the facts
   * recorded here are already the right ones.
   *
   * A receipt failure NEVER rolls back an admission that already succeeded, and
   * is never swallowed: `receiptWritten: false` is reported on the response so
   * the operator sees an assignment that landed without its record.
   */
  let receiptWritten = false;
  let receiptId: string | null = null;
  const writtenOutcomes = outcomes.filter((o) => o.written);
  if (!dryRun && writtenOutcomes.length > 0) {
    const summary =
      `${experimentId} crystal assignment — ${writtenOutcomes.length} invariant(s) admitted to ` +
      `'${declaration.domain}' under declaration ${declarationHash.slice(0, 16)}… ` +
      `by ${personaPublicRef(persona.personaId)} at ${new Date().toISOString()}. ` +
      `Eligibility: status ∈ {${declaration.eligibleStatuses.join('|')}} and evidence provenance ∈ ` +
      `{${declaration.eligibleProvenance.join('|')}}, evaluated per record. Members: ` +
      writtenOutcomes
        .map((o) => `${o.invariantId} (prior domains: ${o.priorDomains.join(', ') || 'none'})`)
        .join('; ') +
      `. Rationale: ${rationale}`;
    const receipt = await writeLifecycleReceipt({
      personaId: persona.personaId,
      summary,
      invariantSeedIds: [],
    }).catch(() => ({ ok: false, receiptId: null }));
    receiptWritten = receipt.ok;
    receiptId = receipt.receiptId;
    if (!receiptWritten) {
      console.error(
        `[CRYSTAL ASSIGNMENT] ${writtenOutcomes.length} invariant(s) were admitted to '${declaration.domain}' ` +
          `but the governed-inclusion receipt could not be written — the corpus changed without its record.`,
      );
    }
  }
  return NextResponse.json(
    {
      requestSucceeded: true,
      experimentId,
      crystalDomain: declaration.domain,
      dryRun,
      requested: invariantIds.length,
      admitted,
      refused: outcomes.length - admitted,
      written: outcomes.filter((o) => o.written).length,
      notFound,
      writeErrors,
      outcomes,
      declarationHash,
      steward: personaPublicRef(persona.personaId),
      rationale: rationale || null,
      receiptWritten,
      receiptId,
      ...(!dryRun && writtenOutcomes.length > 0 && !receiptWritten
        ? {
            receiptWarning:
              'The invariants were admitted but the governed-inclusion receipt failed to write. The context ' +
              'rows are the only record of this act. Re-running the same assignment is idempotent (the context ' +
              'upsert conflicts on invariant_id+domain) and will re-attempt the receipt.',
          }
        : {}),
      // Stated on the response, not only in this file's header: an admission is
      // not a freeze, and a populated domain is not a ratified crystal.
      note:
        'Assignment records that an eligible invariant belongs to the declared crystal domain. It is not a ' +
        'freeze, confers no Standing, and makes nothing canonical. Run the readiness report next; freezing ' +
        'remains a separate, explicit operator act.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
