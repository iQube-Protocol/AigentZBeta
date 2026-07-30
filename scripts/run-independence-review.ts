#!/usr/bin/env npx tsx
/**
 * run-independence-review.ts — the IRL-REVIEW-001 Phase 1 runner.
 *
 * A thin shell over `services/research/review/runner.ts`. Everything worth
 * canarying lives in the service; this file reads the corpus, verifies the
 * pinned reviewer pair against the live provider catalogue, checkpoints each
 * accepted batch, and writes the artifacts. It is the ONLY part of the
 * review path that touches a database, and it touches it read-only.
 *
 * ── Plan is the default. Executing is a deliberate act. ─────────────────────
 *
 * Without `--execute` the runner does everything up to the first model call:
 * it builds the block decision, seals and hashes the package, verifies the
 * reviewer pair, and prints the redacted package preview and the pre-run
 * manifest. Nothing is dispatched. That default exists because a live review
 * costs money and, more importantly, because a review that has already run is
 * the wrong moment to notice that the target statement was wrong.
 *
 * ── Checkpointing (2026-07-30 resilience amendment) ─────────────────────────
 *
 * Every accepted batch is persisted to
 * `codexes/packs/irl/foundation/reviews/<version>/<reviewId>/{r1,r2}/batch-NNN.json`
 * the moment it is accepted — never only at the end. A run's `run-manifest.json`
 * records its identity (package/rubric/prompt/model hashes) and state
 * (CREATED → R1_IN_PROGRESS → R1_COMPLETE → R2_IN_PROGRESS → COMPLETE, or
 * REFUSED_RESUMABLE on a bounded-retry failure, or INVALIDATED on an identity
 * mismatch). `final/review-result.json` and `final/review-receipt.json` are
 * written ONLY once both passes are complete — a partial run must look
 * partial, never complete-with-fewer-rows.
 *
 * This exists because the vP1 batch-011 run lost 11 accepted R2 batches (and
 * all of R1) on an interruption: nothing was written to disk until full
 * success, so there was nothing to resume from. That run is recorded as
 * permanently `REFUSED — NON-RECOVERABLE EXECUTION` — its console log is
 * operational evidence, not a resumable artifact. See
 * codexes/packs/agentiq/updates/2026-07-30_irl-review-001-checkpoint-resume.md.
 *
 * Usage:
 *   npx tsx scripts/run-independence-review.ts --version=vP1
 *   npx tsx scripts/run-independence-review.ts --version=vP1 --preview
 *   npx tsx scripts/run-independence-review.ts --version=vP1 --execute
 *   npx tsx scripts/run-independence-review.ts --version=vP1 --execute \
 *        --r2-human=<steward-ref> --r2-decisions=path/to/steward-decisions.json
 *   npx tsx scripts/run-independence-review.ts --version=vP1 --execute \
 *        --batch-size=8 --max-attempts=3 --full-coverage
 *   npx tsx scripts/run-independence-review.ts --execute \
 *        --resume=codexes/packs/irl/foundation/reviews/vP1/review.vP1.xxxxxxxxxxxx
 *
 * --batch-size / --max-attempts override the frozen defaults (batching.ts) for
 * this run only — both are still recorded in the run manifest, so a smaller
 * batch size for a resumed pass is a visible, auditable choice rather than a
 * silent deviation. On `--resume`, these are read back from the existing run
 * manifest instead — a resume must not repartition remaining rows mid-run, so
 * CLI flags cannot silently change them; passing a conflicting value refuses.
 * --full-coverage is an operator-directed decision for THIS run (every
 * subject goes to second review) and is reported under its own honest
 * category — never folded into "mechanically flagged".
 *
 * Requires (server-side only, never NEXT_PUBLIC_, never committed):
 *   VENICE_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildBatchPlan,
  buildPreRunManifest,
  buildReviewRequest,
  buildRunIdentity,
  buildBatchCheckpoint,
  createFileBackedProvider,
  createVeniceProvider,
  DEFAULT_BATCH_SIZE,
  DEFAULT_DETERMINISM,
  DEFAULT_MAX_ATTEMPTS_PER_BATCH,
  exportRelations,
  formatBlockDecision,
  INDEPENDENCE_PROMPT_VERSION,
  INDEPENDENCE_RUBRIC_ID,
  INDEPENDENCE_RUBRIC_VERSION,
  redactedPreview,
  ReviewRefusal,
  runDualReview,
  selectReviewer2Coverage,
  transitionRunManifest,
  verifyCheckpointCompatible,
  verifyPinnedPairAgainstCatalogue,
  type BatchAttemptRecord,
  type BatchCheckpoint,
  type BatchPlan,
  type ReviewerIdentity,
  type ReviewSubjectRecord,
  type ReviewerAssignment,
  type ReviewerSlot,
  type RunManifestRecord,
  type StewardAssignment,
} from '../services/research/review';
import {
  EXP_P1_REVIEWER_PAIR,
  EXP_P1_REVIEW_QUESTION,
} from '../services/research/review/templates/expP1Admissibility';
// ONE construction, shared with the Lab surface's New Review route. Two
// constructions would drift, and the drift would be invisible exactly where it
// matters: in the redacted preview a human approves before a run.
import { buildReviewPlan } from '../services/research/independentReviewPlan';
import { createFileReviewCheckpointStore, type ReviewCheckpointStore } from './_lib/reviewCheckpointStore';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(REPO, 'codexes/packs/irl/foundation/reviews');

function arg(name: string, fallback: string | null = null): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}
const EXECUTE = process.argv.includes('--execute');
const PREVIEW = process.argv.includes('--preview');
const VERSION = arg('version', 'vP1')!;
const RESUME_DIR = arg('resume');
/**
 * Operator-directed full coverage for THIS run (2026-07-30 ruling, vP1 R2
 * resume): every subject goes to second review, regardless of rule or sample
 * outcome. This is a per-run operational decision, not a change to the
 * template's ratified `EXP_P1_COVERAGE.sampleRate` — so it is a CLI flag, not
 * a change to `expP1Admissibility.ts`, and it is reported under its own
 * honest category (`operator-directed-full-coverage`) rather than folded into
 * "mechanically flagged".
 */
const FULL_COVERAGE = process.argv.includes('--full-coverage');
const CLI_BATCH_SIZE = arg('batch-size') ? Number(arg('batch-size')) : null;
const CLI_MAX_ATTEMPTS = arg('max-attempts') ? Number(arg('max-attempts')) : null;

function loadLocalEnv(): void {
  for (const name of ['.env.local', '.env.local.temp']) {
    const path = join(REPO, name);
    if (!existsSync(path)) continue;
    for (const raw of readFileSync(path, 'utf-8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 1) continue;
      const k = line.slice(0, eq).trim();
      if (process.env[k]) continue;
      process.env[k] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
}

function reviewerIdentityFrom(a: ReviewerAssignment): ReviewerIdentity {
  return {
    reviewerSlot: a.reviewerSlot,
    requestedModelId: a.requestedModelId ?? a.humanReviewerRef ?? 'human',
    resolvedModelId: a.resolvedModelId ?? a.humanReviewerRef ?? 'human',
    modelFamily: a.modelFamily ?? 'human',
  };
}

/** Every mismatch, not just the first — a resume refusal should say everything that drifted. */
function assertReviewersMatchManifest(
  manifest: RunManifestRecord,
  current: { r1: ReviewerIdentity; r2: ReviewerIdentity },
): void {
  const mismatches: string[] = [];
  const c = (field: string, a: unknown, b: unknown) => {
    if (a !== b) mismatches.push(`${field}: manifest='${a}' current='${b}'`);
  };
  for (const slot of ['r1', 'r2'] as const) {
    c(`${slot}.requestedModelId`, manifest.reviewers[slot].requestedModelId, current[slot].requestedModelId);
    c(`${slot}.resolvedModelId`, manifest.reviewers[slot].resolvedModelId, current[slot].resolvedModelId);
    c(`${slot}.modelFamily`, manifest.reviewers[slot].modelFamily, current[slot].modelFamily);
  }
  if (mismatches.length > 0) {
    throw new ReviewRefusal(
      'checkpoint-run-invalidated',
      `resume refused — reviewer identity no longer matches the checkpointed run:\n  ${mismatches.join('\n  ')}`,
    );
  }
}

function batchAttemptFromCheckpoint(cp: BatchCheckpoint): BatchAttemptRecord {
  return {
    reviewerSlot: cp.reviewerSlot,
    batchId: cp.batchId,
    batchHash: cp.batchHash,
    attempt: cp.attemptCount,
    rawOutputRef: `checkpoint:${cp.reviewerSlot}/${cp.batchId}`,
    raw: '',
    outputHash: cp.rawResponseHash,
    accepted: true,
    decisions: cp.decisions,
  };
}

/**
 * Every checkpoint on disk for one reviewer slot, verified against the
 * EXPECTED plan for that slot. A single incompatible checkpoint invalidates
 * the whole resume — a partially-trusted resume is exactly the "plausible
 * but wrong" failure mode this system exists to prevent.
 */
function loadVerifiedCheckpoints(
  store: ReviewCheckpointStore,
  slot: ReviewerSlot,
  expectedPlan: BatchPlan,
  runIdentity: ReturnType<typeof buildRunIdentity>,
  reviewerIdentity: ReviewerIdentity,
): BatchAttemptRecord[] {
  const out: BatchAttemptRecord[] = [];
  for (const batch of expectedPlan.batches) {
    const cp = store.readBatchCheckpoint(slot, batch.batchId);
    if (!cp) continue;
    const { compatible, mismatches } = verifyCheckpointCompatible(cp, {
      runIdentity,
      reviewerIdentity,
      batchId: batch.batchId,
      batchHash: batch.batchHash,
      orderedSubjectIds: batch.subjectRefs,
    });
    if (!compatible) {
      throw new ReviewRefusal(
        'checkpoint-run-invalidated',
        `resume refused — checkpoint ${slot}/${batch.batchId} no longer matches the current run:\n  ` +
          mismatches.map((m) => `${m.field}: expected=${JSON.stringify(m.expected)} found=${JSON.stringify(m.found)}`).join('\n  '),
      );
    }
    out.push(batchAttemptFromCheckpoint(cp));
  }
  return out;
}

async function main(): Promise<void> {
  loadLocalEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (checked env, .env.local, .env.local.temp).');
    process.exit(1);
  }
  // A live run needs the reviewer credential BEFORE anything else happens, so
  // the failure is "you have not set the key" rather than "the review found
  // nothing" forty minutes later.
  if (EXECUTE && !process.env.VENICE_API_KEY) {
    console.error(
      'VENICE_API_KEY is not set.\n' +
        'Refusing to run: a review that did not happen must never be recorded as a review that\n' +
        'found nothing. Export VENICE_API_KEY (server-side only — never NEXT_PUBLIC_, never\n' +
        'committed) and re-run.',
    );
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  // ── Resume: load the existing manifest and pin this run to it ────────────
  let resumeManifest: RunManifestRecord | null = null;
  let store: ReviewCheckpointStore | null = null;
  if (RESUME_DIR) {
    store = createFileReviewCheckpointStore(join(REPO, RESUME_DIR));
    resumeManifest = store.readRunManifest();
    if (!resumeManifest) {
      console.error(`Refusing: no run-manifest.json found at ${RESUME_DIR} — nothing to resume.`);
      process.exit(1);
    }
    if (resumeManifest.state === 'COMPLETE') {
      console.error(`Refusing: the run at ${RESUME_DIR} already completed. Nothing to resume.`);
      process.exit(1);
    }
    if (resumeManifest.state === 'INVALIDATED') {
      console.error(`Refusing: the run at ${RESUME_DIR} was already marked INVALIDATED. Start a fresh run instead.`);
      process.exit(1);
    }
    if (CLI_BATCH_SIZE !== null && CLI_BATCH_SIZE !== resumeManifest.preRunManifest.batchSize) {
      console.error(
        `Refusing: --batch-size=${CLI_BATCH_SIZE} conflicts with the resumed run's own batchSize ` +
          `(${resumeManifest.preRunManifest.batchSize}). A resume must use the same batch size and exact ` +
          'batch membership as the run it resumes — omit --batch-size to inherit it.',
      );
      process.exit(1);
    }
    if (CLI_MAX_ATTEMPTS !== null && CLI_MAX_ATTEMPTS !== resumeManifest.preRunManifest.maxAttemptsPerBatch) {
      console.error(
        `Refusing: --max-attempts=${CLI_MAX_ATTEMPTS} conflicts with the resumed run's own maxAttemptsPerBatch ` +
          `(${resumeManifest.preRunManifest.maxAttemptsPerBatch}). Omit --max-attempts to inherit it.`,
      );
      process.exit(1);
    }
    console.log(`── Resuming run ${resumeManifest.runId} from ${RESUME_DIR} ──`);
    console.log(`  state at pause: ${resumeManifest.state}`);
  }

  const nowIso = resumeManifest?.packageCreatedAt ?? new Date().toISOString();
  const BATCH_SIZE = CLI_BATCH_SIZE ?? resumeManifest?.preRunManifest.batchSize ?? DEFAULT_BATCH_SIZE;
  const MAX_ATTEMPTS_PER_BATCH =
    CLI_MAX_ATTEMPTS ?? resumeManifest?.preRunManifest.maxAttemptsPerBatch ?? DEFAULT_MAX_ATTEMPTS_PER_BATCH;

  // ONE construction, shared with the Lab's New Review route. On resume,
  // `nowIso` is the ORIGINAL package-build timestamp, so the same corpus
  // state reproduces a byte-identical package — a corpus that changed in the
  // meantime will produce a different packageHash, caught below.
  const plan = await buildReviewPlan(admin, { version: VERSION, createdAt: nowIso });
  const { pkg, block, reviewId, assetCommitment } = plan;

  if (resumeManifest) {
    if (pkg.packageId !== resumeManifest.runIdentity.packageId || pkg.packageHash !== resumeManifest.runIdentity.packageHash) {
      throw new ReviewRefusal(
        'checkpoint-run-invalidated',
        `resume refused — the corpus no longer reproduces the checkpointed package ` +
          `(expected packageId=${resumeManifest.runIdentity.packageId} packageHash=${resumeManifest.runIdentity.packageHash}; ` +
          `got packageId=${pkg.packageId} packageHash=${pkg.packageHash}). The corpus changed since this run began.`,
      );
    }
    if (reviewId !== resumeManifest.preRunManifest.reviewId) {
      throw new ReviewRefusal(
        'checkpoint-run-invalidated',
        `resume refused — reviewId no longer matches (expected ${resumeManifest.preRunManifest.reviewId}, got ${reviewId})`,
      );
    }
  }

  console.log(`Live Invariant Corpus: ${plan.corpusRowCount} rows.`);
  console.log(`  pre-boundary:                             ${plan.corpusRowCount}`);
  const outOfBoundaryBreakdown = Object.entries(plan.outOfBoundaryByNamespace)
    .sort((a, b) => b[1] - a[1])
    .map(([ns, n]) => `${ns}:${n}`)
    .join(', ');
  console.log(
    `  excluded by namespace boundary (${plan.outOfBoundaryCount}${outOfBoundaryBreakdown ? ` — ${outOfBoundaryBreakdown}` : ''})`,
  );
  console.log(`  frozen package (in boundary):             ${plan.inBoundaryCount}`);

  console.log('\n── Class C block decision ─────────────────────────────────');
  console.log(formatBlockDecision(block));
  console.log('\n  Namespace distribution:');
  for (const [ns, n] of Object.entries(block.namespaceCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${ns.padEnd(20)} ${String(n).padStart(4)}`);
  }
  console.log(`  earliest creation ${block.earliestCreatedAt ?? 'n/a'} · latest ${block.latestCreatedAt ?? 'n/a'}`);
  console.log(`\n  rows enumerated individually in the package: ${plan.individuallyEnumerated}`);
  console.log(`  mechanically flagged (union, any rule): ${plan.mechanicallyFlagged.length}`);
  console.log('  by rule (a row may match more than one — this is a breakdown, not a partition):');
  for (const [ruleId, refs] of Object.entries(plan.mechanicallyFlaggedByRule)) {
    console.log(`    ${ruleId.padEnd(32)} ${String(refs.length).padStart(4)}  — ${plan.mechanicallyFlaggedRuleReasons[ruleId]}`);
  }
  if (FULL_COVERAGE) {
    console.log(
      '\n  --full-coverage set: every subject in this package goes to second review for THIS run. ' +
        'Reported as "operator-directed-full-coverage" in the coverage step below — this is an ' +
        'operator-directed full dual review for this run, not a claim that every row was ' +
        'mechanically mandatory.',
    );
  }

  const preview = redactedPreview(pkg);
  console.log(`\n  package ${pkg.packageId}`);
  console.log(`  packageHash ${pkg.packageHash}`);
  console.log(`  hash verified: ${preview.hashVerified}`);

  if (PREVIEW) {
    console.log('\n── Redacted package preview (first 2 subjects) ────────────');
    console.log(JSON.stringify({ ...preview, package: { ...pkg, subjects: pkg.subjects.slice(0, 2) } }, null, 2));
  }

  // ── Verify the pinned reviewer pair against the live catalogue ────────────
  const humanR2Ref = arg('r2-human');
  const humanR2Path = arg('r2-decisions');

  let r1Assignment: ReviewerAssignment;
  let r2Assignment: ReviewerAssignment;
  let r1Provider;
  let r2Provider;

  if (EXECUTE || process.env.VENICE_API_KEY) {
    const venice = createVeniceProvider();
    const catalogue = await venice.listModels();
    const verified = verifyPinnedPairAgainstCatalogue(EXP_P1_REVIEWER_PAIR, catalogue, nowIso);
    console.log('\n── Reviewer pair verified against the live catalogue ──────');
    for (const slot of ['R1', 'R2'] as const) {
      const v = verified[slot];
      console.log(
        `  ${slot}: requested '${v.requestedModelId}' → resolved '${v.resolvedModelId}' ` +
          `· family '${v.family}' (from '${v.familyEvidence}') · declared ${v.declaredLineage}`,
      );
    }
    r1Assignment = {
      reviewerSlot: 'R1',
      reviewerType: 'external-model',
      provider: EXP_P1_REVIEWER_PAIR.R1.provider,
      requestedModelId: verified.R1.requestedModelId,
      resolvedModelId: verified.R1.resolvedModelId,
      modelFamily: verified.R1.family,
      modelFamilyEvidence: verified.R1.familyEvidence,
      declaredLineage: verified.R1.declaredLineage,
      promptVersion: INDEPENDENCE_PROMPT_VERSION,
      rubricVersion: INDEPENDENCE_RUBRIC_VERSION,
      determinismSettings: { ...DEFAULT_DETERMINISM },
    };
    r1Provider = venice;

    if (humanR2Ref) {
      if (!humanR2Path || !existsSync(humanR2Path)) {
        throw new ReviewRefusal('missing-human-adjudication', `--r2-human requires --r2-decisions=<path to the steward's decisions>`);
      }
      r2Assignment = {
        reviewerSlot: 'R2',
        reviewerType: 'human',
        humanReviewerRef: humanR2Ref,
        humanReviewerRole: 'independent-review-steward',
        promptVersion: INDEPENDENCE_PROMPT_VERSION,
        rubricVersion: INDEPENDENCE_RUBRIC_VERSION,
      };
      r2Provider = createFileBackedProvider({ reviewerRef: humanR2Ref, rawDecisions: readFileSync(humanR2Path, 'utf-8') });
    } else {
      r2Assignment = {
        reviewerSlot: 'R2',
        reviewerType: 'external-model',
        provider: EXP_P1_REVIEWER_PAIR.R2.provider,
        requestedModelId: verified.R2.requestedModelId,
        resolvedModelId: verified.R2.resolvedModelId,
        modelFamily: verified.R2.family,
        modelFamilyEvidence: verified.R2.familyEvidence,
        declaredLineage: verified.R2.declaredLineage,
        promptVersion: INDEPENDENCE_PROMPT_VERSION,
        rubricVersion: INDEPENDENCE_RUBRIC_VERSION,
        determinismSettings: { ...DEFAULT_DETERMINISM },
      };
      r2Provider = venice;
    }
  } else {
    console.log('\nVENICE_API_KEY not set — plan mode only, no reviewer pair verification performed.');
    console.log('The package above is complete and hashed. Set VENICE_API_KEY and re-run with --execute.');
    return;
  }

  if (resumeManifest) {
    assertReviewersMatchManifest(resumeManifest, { r1: reviewerIdentityFrom(r1Assignment), r2: reviewerIdentityFrom(r2Assignment) });
  }

  const stewardRef = resumeManifest ? resumeManifest.preRunManifest.steward.stewardRef : arg('steward', 'operator (interim)')!;
  const steward: StewardAssignment = resumeManifest
    ? resumeManifest.preRunManifest.steward
    : {
        stewardRef,
        interim: !arg('steward'),
        interimReason: !arg('steward')
          ? 'First run of the capability: the Independent Review Steward role is not yet assigned, so ' +
            'the operator acts as interim steward. Recorded as interim so the next run can see that ' +
            'the routine reviewer and the final governed authority were the same party.'
          : undefined,
      };

  const request = buildReviewRequest({
    reviewId,
    experimentId: `EXP-P1/${VERSION}`,
    assetType: 'invariant-set',
    reviewMode: 'dual',
    reviewQuestion: EXP_P1_REVIEW_QUESTION,
    rubricId: INDEPENDENCE_RUBRIC_ID,
    packageRef: `${OUT_DIR}/${VERSION}/${reviewId}/run-manifest.json`,
    pkg,
    requestedAt: nowIso,
    requestedByRef: stewardRef,
  });

  if (!EXECUTE) {
    console.log('\n── PLAN ONLY — no reviewer was called ─────────────────────');
    console.log(`  R1  ${r1Assignment.provider}:${r1Assignment.resolvedModelId} (${r1Assignment.modelFamily})`);
    console.log(
      `  R2  ${r2Assignment.reviewerType === 'human' ? `human ${r2Assignment.humanReviewerRef}` : `${r2Assignment.provider}:${r2Assignment.resolvedModelId} (${r2Assignment.modelFamily})`}`,
    );
    console.log(`  rubric ${INDEPENDENCE_RUBRIC_ID} v${INDEPENDENCE_RUBRIC_VERSION} · prompt v${INDEPENDENCE_PROMPT_VERSION}`);
    console.log(`  steward ${steward.stewardRef}${steward.interim ? ' (INTERIM)' : ''}`);
    console.log(`  batch size ${BATCH_SIZE} · max attempts/batch ${MAX_ATTEMPTS_PER_BATCH}${FULL_COVERAGE ? ' · --full-coverage set' : ''}`);
    console.log('\n  Re-run with --execute to dispatch. The operator triggers the live review.');
    return;
  }

  // ── Checkpoint plumbing ───────────────────────────────────────────────────
  const runDir = RESUME_DIR ? join(REPO, RESUME_DIR) : join(OUT_DIR, VERSION, reviewId);
  const checkpointStore = store ?? createFileReviewCheckpointStore(runDir);
  // ALWAYS a concrete value, passed to BOTH this preview computation and to
  // `runDualReview` below — the two must use the byte-identical `committedAt`
  // or they compute two DIFFERENT manifest commitments, which would make
  // every checkpoint's batchHash mismatch the batches `runDualReview` actually
  // dispatches. A resume reuses the original run's committedAt; a fresh run
  // mints one here, once, and passes it through rather than letting each side
  // call `now()` independently.
  const startedAt = resumeManifest?.preRunManifest.committedAt ?? new Date().toISOString();

  // Recompute the SAME pre-run manifest the runner will build internally
  // (pure function, identical inputs -> identical output) so run identity
  // and per-slot batch plans are known BEFORE dispatch, for checkpoint
  // verification and manifest bookkeeping.
  const preRunManifestPreview = buildPreRunManifest({
    request,
    pkg,
    assignments: [r1Assignment, r2Assignment],
    steward,
    determinism: DEFAULT_DETERMINISM,
    sampleRate: plan.coverage.sampleRate,
    sampleSeed: plan.coverage.sampleSeed,
    batchSize: BATCH_SIZE,
    maxAttemptsPerBatch: MAX_ATTEMPTS_PER_BATCH,
    committedAt: startedAt,
  });
  if (resumeManifest && preRunManifestPreview.manifestCommitment !== resumeManifest.runIdentity.preRunManifestHash) {
    throw new ReviewRefusal(
      'checkpoint-run-invalidated',
      'resume refused — the recomputed pre-run manifest no longer matches the checkpointed run ' +
        '(rubric, prompt, determinism, steward, coverage settings or committedAt drifted).',
    );
  }

  const runIdentity = buildRunIdentity({
    packageId: pkg.packageId,
    packageHash: pkg.packageHash,
    preRunManifestHash: preRunManifestPreview.manifestCommitment,
  });
  const reviewerIdentities = { r1: reviewerIdentityFrom(r1Assignment), r2: reviewerIdentityFrom(r2Assignment) };

  const r1BatchPlan = buildBatchPlan({
    reviewerSlot: 'R1',
    packageHash: pkg.packageHash,
    manifestHash: preRunManifestPreview.manifestCommitment,
    subjectRefs: pkg.subjects.map((s) => s.subjectRef),
    batchSize: BATCH_SIZE,
  });

  let manifest: RunManifestRecord = resumeManifest ?? {
    runId: reviewId,
    state: 'CREATED',
    runIdentity,
    packageCreatedAt: nowIso,
    preRunManifest: preRunManifestPreview,
    reviewers: reviewerIdentities,
    r1BatchPlan,
    r2BatchPlan: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (!resumeManifest) {
    checkpointStore.writeRunManifest(manifest);
  }

  const r1Resume = loadVerifiedCheckpoints(checkpointStore, 'R1', r1BatchPlan, runIdentity, reviewerIdentities.r1);
  console.log(`\n  checkpoint: ${r1Resume.length}/${r1BatchPlan.batches.length} R1 batch(es) already accepted and verified`);

  if (manifest.state === 'CREATED' || manifest.state === 'REFUSED_RESUMABLE') {
    manifest = transitionRunManifest(manifest, 'R1_IN_PROGRESS', new Date().toISOString());
    checkpointStore.writeRunManifest(manifest);
  }

  // Pre-resolve R2's resumable checkpoints ONLY when R1 is already fully
  // checkpointed — R2's membership depends on R1's decisions, so it cannot be
  // known (and nothing there needs resuming yet) while R1 is still partial.
  let r2Resume: BatchAttemptRecord[] = [];
  if (r1Resume.length === r1BatchPlan.batches.length && manifest.r2BatchPlan) {
    const r1DecisionsFromCheckpoints = r1Resume.flatMap((a) => a.decisions ?? []);
    const coverage = selectReviewer2Coverage({
      subjects: pkg.subjects,
      r1Decisions: r1DecisionsFromCheckpoints,
      packageExclusions: pkg.exclusionsFromPackage,
      mechanicallyFlagged: plan.mechanicallyFlagged,
      sampleRate: plan.coverage.sampleRate,
      sampleSeed: plan.coverage.sampleSeed,
      fullCoveragePolicy: FULL_COVERAGE,
    });
    const coveredSet = new Set(coverage.subjectRefs);
    const r2Subjects = pkg.subjects.filter((s) => coveredSet.has(s.subjectRef));
    const recomputedR2Plan = buildBatchPlan({
      reviewerSlot: 'R2',
      packageHash: pkg.packageHash,
      manifestHash: preRunManifestPreview.manifestCommitment,
      subjectRefs: r2Subjects.map((s) => s.subjectRef),
      batchSize: BATCH_SIZE,
    });
    r2Resume = loadVerifiedCheckpoints(checkpointStore, 'R2', recomputedR2Plan, runIdentity, reviewerIdentities.r2);
    console.log(`  checkpoint: ${r2Resume.length}/${recomputedR2Plan.batches.length} R2 batch(es) already accepted and verified`);
  }

  let artifacts;
  try {
    artifacts = await runDualReview({
      request,
      pkg,
      r1: { assignment: r1Assignment, provider: r1Provider },
      r2: { assignment: r2Assignment, provider: r2Provider },
      steward,
      determinism: DEFAULT_DETERMINISM,
      coverage: {
        sampleRate: plan.coverage.sampleRate,
        sampleSeed: plan.coverage.sampleSeed,
        mechanicallyFlagged: plan.mechanicallyFlagged,
        fullCoveragePolicy: FULL_COVERAGE,
      },
      batching: { batchSize: BATCH_SIZE, maxAttemptsPerBatch: MAX_ATTEMPTS_PER_BATCH },
      assetRef: plan.assetRef,
      assetCommitment,
      now: () => new Date().toISOString(),
      startedAt,
      onStep: (s, d) => console.log(`  [${s}] ${d}`),
      resumeFrom: { r1: r1Resume, r2: r2Resume },
      checkpoint: {
        onBatchAccepted: async (slot, b) => {
          const activePlan = slot === 'R1' ? r1BatchPlan : manifest.r2BatchPlan;
          const batch = activePlan?.batches.find((bb) => bb.batchId === b.batchId);
          const checkpoint = buildBatchCheckpoint({
            runIdentity,
            reviewerIdentity: reviewerIdentities[slot === 'R1' ? 'r1' : 'r2'],
            batchId: b.batchId,
            batchHash: b.batchHash,
            orderedSubjectIds: batch?.subjectRefs ?? [],
            attempt: b.attempt,
            decisions: b.decisions,
            completedAt: new Date().toISOString(),
          });
          checkpointStore.writeBatchCheckpoint(checkpoint);
        },
        onR2BatchPlanFrozen: async (batchPlan) => {
          manifest = transitionRunManifest(manifest, 'R1_COMPLETE', new Date().toISOString());
          manifest = { ...manifest, r2BatchPlan: batchPlan };
          manifest = transitionRunManifest(manifest, 'R2_IN_PROGRESS', new Date().toISOString());
          checkpointStore.writeRunManifest(manifest);
        },
      },
    });
  } catch (e) {
    // A batch that exhausted its retries (or any other refusal) leaves
    // whatever WAS accepted safely on disk — mark the run resumable rather
    // than silently losing that record the way the vP1 batch-011 run did.
    const resumable = manifest.state === 'R1_IN_PROGRESS' || manifest.state === 'R2_IN_PROGRESS';
    if (resumable) {
      manifest = transitionRunManifest(manifest, 'REFUSED_RESUMABLE', new Date().toISOString());
      checkpointStore.writeRunManifest(manifest);
      console.error(
        `\nStatus: REFUSED — R2 INCOMPLETE / run state: REFUSED_RESUMABLE / checkpoints preserved at ${runDir}\n` +
          `Resume with:\n  npx tsx scripts/run-independence-review.ts --execute --resume=${runDir.replace(`${REPO}/`, '')}`,
      );
    }
    throw e;
  }

  manifest = transitionRunManifest(manifest, 'COMPLETE', new Date().toISOString());
  checkpointStore.writeRunManifest(manifest);

  const { relations, exclusions } = exportRelations({
    resolutions: artifacts.resolutions,
    decisions: [...artifacts.r1Decisions, ...artifacts.r2Decisions],
    reviewerRef: `${reviewId} (dual independent review)`,
    reviewedAt: nowIso,
  });

  mkdirSync(OUT_DIR, { recursive: true });
  const base = join(OUT_DIR, reviewId);
  writeFileSync(`${base}.package.json`, `${JSON.stringify(pkg, null, 2)}\n`);
  writeFileSync(`${base}.pre-run-manifest.json`, `${JSON.stringify(artifacts.preRunManifest, null, 2)}\n`);
  writeFileSync(`${base}.raw-outputs.json`, `${JSON.stringify(artifacts.rawOutputs, null, 2)}\n`);
  writeFileSync(
    `${base}.decisions.json`,
    `${JSON.stringify({ r1: artifacts.r1Decisions, r2: artifacts.r2Decisions, coverage: artifacts.coverage }, null, 2)}\n`,
  );
  writeFileSync(
    `${base}.resolutions.json`,
    `${JSON.stringify({ resolutions: artifacts.resolutions, contested: artifacts.contested, tally: artifacts.tally }, null, 2)}\n`,
  );
  writeFileSync(`${base}.relations.json`, `${JSON.stringify(relations, null, 2)}\n`);
  writeFileSync(`${base}.exclusions.json`, `${JSON.stringify({ exclusions }, null, 2)}\n`);
  writeFileSync(`${base}.receipt.json`, `${JSON.stringify(artifacts.receipt, null, 2)}\n`);

  // The consolidated, resumable-run-directory copies — written ONLY now, at
  // COMPLETE. A partial run has no `final/` directory contents at all.
  checkpointStore.writeFinalResult({ resolutions: artifacts.resolutions, contested: artifacts.contested, tally: artifacts.tally });
  checkpointStore.writeFinalReceipt(artifacts.receipt);

  console.log('\n── Review complete ───────────────────────────────────────');
  console.log(`  agreed    ${artifacts.tally.agreed}`);
  console.log(`  contested ${artifacts.tally.contested}   <-- excluded pending governed resolution`);
  console.log(`  rejected  ${artifacts.tally.rejected}`);
  console.log(`  unknown   ${artifacts.tally.unknown}   <-- fails closed`);
  console.log(`\n  Wrote ${base}.{package,pre-run-manifest,raw-outputs,decisions,resolutions,relations,exclusions,receipt}.json`);
  console.log(`  Wrote ${runDir}/{run-manifest,r1/*,r2/*,final/*}.json`);
  console.log('\n  This receipt records the review event. It does NOT ratify the asset, grant Standing,');
  console.log('  change lifecycle state, or freeze anything. The freeze is a separate governed act.');
}

main().catch((e) => {
  if (e instanceof ReviewRefusal) {
    console.error(`\nREFUSED (${e.refusalCode}): ${e.message}`);
    process.exit(2);
  }
  console.error(e);
  process.exit(1);
});
