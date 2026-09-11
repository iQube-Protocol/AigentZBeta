/**
 * POST /api/corpus-scout/candidates/resolve-duplicates — the smallest safe act
 * for exact-duplicate groups, performed WHOLE (operator ruling, 2026-08-03).
 *
 *   > "'Accept recommendation and continue' must perform the whole governed
 *   >  treatment in one step… No searching, no copying IDs, no re-entering
 *   >  rationale."
 *
 * ── What it does NOT introduce ──────────────────────────────────────────────
 *
 * No new write path. The governed treatment is the EXISTING `mark_duplicate`
 * decision in `applyCandidateReviewDecision`, which already sets
 * `reviewWorkflowStatus = 'duplicate'` and records `duplicateOfSourceId`
 * pointing at the canonical — an UPDATE, so both records survive. This route
 * derives WHICH source is canonical and loops that same applier.
 *
 * ── Why per-source and not through bulk-review ──────────────────────────────
 *
 * `bulk-review` REFUSES `mark_duplicate` by design: the alias target is a
 * per-source fact, and one decision applied to a whole batch would assert that
 * every member duplicates the same document. That refusal is correct and is NOT
 * relaxed here. This route loops the SINGLE-source applier once per alias, each
 * with its own `duplicateOfSourceId` — which is exactly what the refusal was
 * protecting.
 *
 * ── dryRun defaults TRUE ────────────────────────────────────────────────────
 *
 * Same posture as every other governed act in this pipeline: a caller who
 * forgets the flag previews.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { listCandidateSources } from '@/services/corpusScout/provenance';
import { findDuplicateCandidates } from '@/services/corpusScout/intelligence';
import { applyCandidateReviewDecision } from '@/services/corpusScout/reviewDecision';
import {
  composeDuplicateResolution,
  dryRunDuplicateResolution,
  renderDuplicateDryRun,
  type DuplicateResolutionPlan,
} from '@/services/corpusScout/duplicateResolution';
import { buildCohortAuthorization, computeCohortHash } from '@/services/research/cohortAuthorization';
import { writeLifecycleReceipt } from '@/services/research/lifecycle';
import type { PopulationDisclosure } from '@/services/research/exceptionIsolation';
import { resolvableDuplicateAliasIds } from '@/services/corpusScout/admissionPreparation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface Body {
  campaignDomain?: string;
  /** Resolve these groups only. Omit to resolve every group carrying a
   *  deterministic recommendation ("Resolve all recommended exceptions"). */
  groupKeys?: unknown;
  /** Override the derived canonical for one group ("Choose the other copy"). */
  canonicalOverrides?: unknown;
  /** Editable; defaults to the system-composed rationale per group. */
  rationale?: string;
  dryRun?: boolean;
  /**
   * STALE-COHORT PROTECTION (2026-09-01) — echo of `duplicateCohortHash`
   * from the pending decision / prepare-recommendations response that showed
   * this resolution. When present, the route recomputes the CURRENT
   * resolvable-alias cohort before writing and refuses
   * (`recommendation-set-changed`) if it no longer matches — the corpus
   * moved (a source was decided, or a new duplicate appeared) between
   * preparation and confirmation. Omit to skip the check (unchanged
   * behaviour for callers that do not carry a prepared-cohort commitment,
   * e.g. an operator resolving a `groupKeys`-filtered subset ad hoc).
   */
  expectedCohortHash?: string;
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const campaignDomain = body.campaignDomain?.trim();
  if (!campaignDomain) return NextResponse.json({ ok: false, error: 'campaignDomain is required' }, { status: 400 });
  const dryRun = body.dryRun !== false;
  const requestedGroups = Array.isArray(body.groupKeys)
    ? body.groupKeys.filter((k): k is string => typeof k === 'string')
    : null;
  const overrides = (body.canonicalOverrides ?? {}) as Record<string, string>;

  // The whole domain, at every status — the population the disclosure reports
  // and the set duplicates are detected over.
  let all: Awaited<ReturnType<typeof listCandidateSources>>;
  try {
    all = await listCandidateSources(admin, { campaignDomain });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'the corpus could not be read' }, { status: 500 });
  }

  // Detected with the EXISTING detector over the sources still awaiting a
  // decision — a group whose members have already been decided is not an
  // outstanding exception.
  const pending = all.filter((s) => s.reviewWorkflowStatus === 'pending_review');
  const groups = findDuplicateCandidates(
    pending.map((r) => ({
      sourceId: r.sourceId,
      artifactHash: r.artifactHash,
      normalizedTextHash: r.normalizedTextHash,
      canonicalUrl: r.canonicalUrl,
    })),
  );

  const plans: DuplicateResolutionPlan[] = groups.map((group) =>
    composeDuplicateResolution({ group, rows: pending }),
  );
  const selected = plans.filter((p) => {
    if (requestedGroups && !requestedGroups.includes(p.groupKey)) return false;
    return true;
  });

  // An override names a DIFFERENT member as canonical ("Choose the other
  // copy"). It is honoured only when the named source is genuinely in that
  // group — an override pointing outside the group would alias an unrelated
  // record, which is the one thing isolation forbids.
  const resolved: DuplicateResolutionPlan[] = selected.map((p) => {
    const override = overrides[p.groupKey];
    if (!override || !p.copies.some((c) => c.sourceId === override)) return p;
    return {
      ...p,
      canonicalSourceId: override,
      aliasSourceIds: p.copies.map((c) => c.sourceId).filter((id) => id !== override),
      kind: 'recommended-resolution-available',
      why: [`operator selected ${override} as canonical, overriding the derived recommendation`],
      rationale:
        `Selected ${override} as the canonical copy by steward override. ` +
        `Preserved ${p.copies.map((c) => c.sourceId).filter((id) => id !== override).join(', ')} as an exact-duplicate ` +
        'alias and excluded it from duplicate ingestion.',
      ambiguity: null,
    };
  });

  const preview = dryRunDuplicateResolution(resolved);
  const currentCohortHash = computeCohortHash(resolvableDuplicateAliasIds(resolved));

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      plans: resolved,
      preview,
      previewLines: renderDuplicateDryRun(preview),
      cohortHash: currentCohortHash,
    });
  }

  // STALE-COHORT PROTECTION (2026-09-01) — see the `expectedCohortHash`
  // field's own doc comment on `Body`. Checked ONLY on the write path: a
  // stale preview is merely uninformative, but a stale WRITE would resolve
  // aliases the steward never actually confirmed. Fails closed — nothing is
  // written when the cohort has moved.
  if (body.expectedCohortHash && body.expectedCohortHash !== currentCohortHash) {
    return NextResponse.json(
      {
        ok: false,
        error: 'recommendation-set-changed',
        detail:
          'The prepared duplicate-resolution cohort no longer matches what was shown — a source may have been ' +
          'decided, or a new duplicate group may have appeared, since preparation. Refresh recommendations and ' +
          'reconfirm before resolving.',
        currentCohortHash,
      },
      { status: 409 },
    );
  }

  // ── EXECUTE ───────────────────────────────────────────────────────────────
  const actionable = resolved.filter((p) => p.kind === 'recommended-resolution-available' && p.canonicalSourceId);
  if (actionable.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'no group carries a deterministic recommendation — nothing to resolve' },
      { status: 400 },
    );
  }

  const outcomes: { groupKey: string; canonicalSourceId: string; aliasSourceId: string; ok: boolean; detail: string }[] = [];
  for (const plan of actionable) {
    const canonical = plan.canonicalSourceId!;
    const rationale = body.rationale?.trim() || plan.rationale;
    for (const aliasId of plan.aliasSourceIds) {
      // THE EXISTING APPLIER, once per alias, each with its own target. This is
      // what `bulk-review`'s mark_duplicate refusal was protecting.
      const result = await applyCandidateReviewDecision(
        admin,
        aliasId,
        { decision: 'mark_duplicate', notes: rationale, duplicateOfSourceId: canonical },
        persona.personaId,
      );
      outcomes.push({
        groupKey: plan.groupKey,
        canonicalSourceId: canonical,
        aliasSourceId: aliasId,
        ok: result.ok,
        detail: result.ok
          ? `recorded as an exact-duplicate alias of ${canonical}; the record is preserved and excluded from ingestion`
          : result.error,
      });
    }
  }

  const written = outcomes.filter((o) => o.ok);
  const population: PopulationDisclosure = {
    // Aliasing NEVER shrinks the discovered population — the alias keeps its
    // row. Reading `all.length` after the act would prove it; reading it here
    // states the same fact from the pre-act read.
    discovered: all.length,
    admitted: all.filter((s) => Boolean(s.evidenceRowId)).length,
    candidatesExtracted: 0,
    validated: 0,
    assignedToCrystal: 0,
    excludedWithWarnings: 0,
    exceptions: written.length,
    refused: 0,
    scope: 'current-acquisition-round',
  };

  const authorization = buildCohortAuthorization({
    stage: 'Corpus Scout duplicate resolution',
    target: campaignDomain,
    executableRecordIds: written.map((o) => o.aliasSourceId),
    counts: {
      total: outcomes.length,
      ready: 0,
      readyWithWarning: written.length,
      exceptions: outcomes.length - written.length,
      refused: 0,
      executable: written.length,
    },
    exceptions: [],
    acceptedWarnings: written.map((o) => ({
      recordId: o.aliasSourceId,
      warnings: [`aliased to canonical ${o.canonicalSourceId}; record preserved, excluded from ingestion`],
    })),
    population,
    personaId: persona.personaId,
    rationale: body.rationale?.trim() || actionable.map((p) => p.rationale).join(' '),
  });

  const receipt = await writeLifecycleReceipt({
    personaId: persona.personaId,
    summary: authorization.summary,
    invariantSeedIds: [],
  }).catch(() => ({ ok: false, receiptId: null }));

  if (!receipt.ok) {
    console.error('[DUPLICATE RESOLUTION] receipt not written for', written.map((o) => o.aliasSourceId).join(', '));
  }

  return NextResponse.json({
    ok: true,
    dryRun: false,
    resolved: written.length,
    failed: outcomes.length - written.length,
    outcomes,
    preview,
    cohortHash: authorization.cohortHash,
    authorizedBy: authorization.authorizedBy,
    receiptWritten: receipt.ok,
    receiptWarning: receipt.ok
      ? null
      : 'The aliases were recorded but the batch receipt was not written. The decisions stand; the attributable record of this act does not.',
  });
}
