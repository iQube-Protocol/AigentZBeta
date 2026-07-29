#!/usr/bin/env npx tsx
/**
 * run-independence-review.ts — the IRL-REVIEW-001 Phase 1 runner.
 *
 * A thin shell over `services/research/review/runner.ts`. Everything worth
 * canarying lives in the service; this file reads the corpus, verifies the
 * pinned reviewer pair against the live provider catalogue, and writes the
 * artifacts. It is the ONLY part of the review path that touches a database,
 * and it touches it read-only.
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
 * Usage:
 *   npx tsx scripts/run-independence-review.ts --version=vP1
 *   npx tsx scripts/run-independence-review.ts --version=vP1 --preview
 *   npx tsx scripts/run-independence-review.ts --version=vP1 --execute
 *   npx tsx scripts/run-independence-review.ts --version=vP1 --execute \
 *        --r2-human=<steward-ref> --r2-decisions=path/to/steward-decisions.json
 *
 * Requires (server-side only, never NEXT_PUBLIC_, never committed):
 *   VENICE_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildBlockDecision,
  buildReviewPackage,
  buildReviewRequest,
  commit,
  createFileBackedProvider,
  createVeniceProvider,
  DEFAULT_DETERMINISM,
  exportRelations,
  formatBlockDecision,
  INDEPENDENCE_PROMPT_VERSION,
  INDEPENDENCE_RUBRIC_ID,
  INDEPENDENCE_RUBRIC_VERSION,
  redactedPreview,
  ReviewRefusal,
  runDualReview,
  verifyPinnedPairAgainstCatalogue,
  type ReviewSubjectRecord,
  type ReviewerAssignment,
  type StewardAssignment,
} from '../services/research/review';
import {
  CLASS_C_BLOCK_RULING,
  CLASS_C_POPULATION_QUERY,
  EXP_P1_CHRONOLOGY,
  EXP_P1_COVERAGE,
  EXP_P1_NAMESPACE_BOUNDARY,
  EXP_P1_NON_TARGETS,
  EXP_P1_REVIEWER_PAIR,
  EXP_P1_REVIEW_QUESTION,
  EXP_P1_TARGET_STATEMENT,
  expP1ClassCExceptionRules,
  expP1MechanicalFlags,
} from '../services/research/review/templates/expP1Admissibility';
import { GENERAL_CONSTITUTIONAL_NAMESPACES } from '../services/research/experimentRelation';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(REPO, 'codexes/packs/irl/foundation/reviews');

function arg(name: string, fallback: string | null = null): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}
const EXECUTE = process.argv.includes('--execute');
const PREVIEW = process.argv.includes('--preview');
const VERSION = arg('version', 'vP1')!;

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

interface CorpusRow {
  id: string;
  seed_id: string | null;
  statement: string;
  namespace: string;
  status: string;
  provenance: unknown;
  created_at: string;
  updated_at: string | null;
}

function readProvenanceClass(provenance: unknown): string | null {
  if (!provenance || typeof provenance !== 'object') return null;
  const p = provenance as Record<string, unknown>;
  for (const k of ['provenanceClass', 'evidenceProvenance', 'provenance_class']) {
    if (typeof p[k] === 'string') return p[k] as string;
  }
  return null;
}

function readRefs(provenance: unknown, keys: string[]): string[] {
  if (!provenance || typeof provenance !== 'object') return [];
  const p = provenance as Record<string, unknown>;
  const out: string[] = [];
  for (const k of keys) {
    const v = p[k];
    if (typeof v === 'string' && v.trim()) out.push(v.trim());
    if (Array.isArray(v)) out.push(...v.filter((x): x is string => typeof x === 'string'));
  }
  return out;
}

function toSubject(row: CorpusRow): ReviewSubjectRecord {
  return {
    subjectRef: row.seed_id || row.id,
    statement: row.statement,
    namespace: String(row.namespace),
    sourceProvenance: readProvenanceClass(row.provenance),
    sourceRefs: readRefs(row.provenance, ['sourceRefs', 'sources', 'source', 'sourceUrl', 'ratified_source']),
    derivationRefs: readRefs(row.provenance, ['derivationRefs', 'derivedFrom', 'derivation', 'method']),
    createdAt: String(row.created_at ?? ''),
    revisedAt: row.updated_at ? String(row.updated_at) : null,
    lifecycleStatus: String(row.status),
  };
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

  // ── Read the corpus (read-only; the review path itself never sees this client)
  const rows: CorpusRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('invariants')
      .select('id,seed_id,statement,namespace,status,provenance,created_at,updated_at')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`corpus read failed: ${error.message}`);
    rows.push(...((data ?? []) as unknown as CorpusRow[]));
    if (!data || data.length < PAGE) break;
  }
  console.log(`Live Invariant Corpus: ${rows.length} rows.`);

  const boundary = new Set(EXP_P1_NAMESPACE_BOUNDARY);
  const inBoundary = rows.filter((r) => boundary.has(String(r.namespace)));
  const outOfBoundary = rows.filter((r) => !boundary.has(String(r.namespace)));
  console.log(`  in boundary:  ${inBoundary.length}`);
  console.log(`  out of boundary (recorded with reasons): ${outOfBoundary.length}`);

  const subjects = inBoundary.map(toSubject);

  // ── Class C block decision ────────────────────────────────────────────────
  const classC = subjects.filter((s) => GENERAL_CONSTITUTIONAL_NAMESPACES.has(s.namespace));
  const individual = subjects.filter((s) => !GENERAL_CONSTITUTIONAL_NAMESPACES.has(s.namespace));

  const block = buildBlockDecision({
    blockId: `block.class-c.${VERSION}`,
    ruling: CLASS_C_BLOCK_RULING,
    populationQuery: CLASS_C_POPULATION_QUERY,
    population: classC,
    exceptionRules: expP1ClassCExceptionRules(),
    taskConstructionBegun: false,
    taskConstructionEvidence:
      'No task specification exists in the repository at package-construction time; task ' +
      'construction follows the freeze, never precedes it.',
    sampleSeed: EXP_P1_COVERAGE.blockSampleSeed,
    samplePerNamespace: EXP_P1_COVERAGE.blockSamplePerNamespace,
  });

  console.log('\n── Class C block decision ─────────────────────────────────');
  console.log(formatBlockDecision(block));
  console.log('\n  Namespace distribution:');
  for (const [ns, n] of Object.entries(block.namespaceCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${ns.padEnd(20)} ${String(n).padStart(4)}`);
  }
  console.log(`  earliest creation ${block.earliestCreatedAt ?? 'n/a'} · latest ${block.latestCreatedAt ?? 'n/a'}`);

  // Rows extracted from the block are reviewed individually, alongside the
  // non-Class-C rows and the block's representative sample.
  const extractedRefs = new Set(block.extracted.map((e) => e.subjectRef));
  const sampleRefs = new Set(block.representativeSample);
  const packageSubjects = [
    ...individual,
    ...classC.filter((s) => extractedRefs.has(s.subjectRef) || sampleRefs.has(s.subjectRef)),
  ];
  console.log(`\n  rows enumerated individually in the package: ${packageSubjects.length}`);
  console.log(`    (${individual.length} outside Class C, ${extractedRefs.size} extracted exceptions, ` +
    `${[...sampleRefs].filter((r) => !extractedRefs.has(r)).length} additional sample rows)`);

  // ── Seal the package ──────────────────────────────────────────────────────
  const nowIso = new Date().toISOString();
  const reviewId = `review.${VERSION}.${commit({ v: VERSION, n: packageSubjects.length, block: block.blockId }).slice(0, 12)}`;
  const assetCommitment = commit({ subjects: packageSubjects.map((s) => s.subjectRef).sort() });

  const pkg = buildReviewPackage({
    packageId: `pkg.${reviewId}`,
    reviewId,
    assetRef: `crystal-${VERSION}`,
    assetCommitment,
    targetDefinition: EXP_P1_TARGET_STATEMENT,
    nonTargets: EXP_P1_NON_TARGETS,
    rubricRef: INDEPENDENCE_RUBRIC_ID,
    rubricVersion: INDEPENDENCE_RUBRIC_VERSION,
    sourceRefs: [
      'codexes/packs/irl/foundation/SPEC-IRL-REVIEW-001_independent-review-capability.md',
      'codexes/packs/agentiq/updates/2026-07-29_external-review-rulings.md',
    ],
    chronology: EXP_P1_CHRONOLOGY,
    evidenceSummaries: [],
    subjects: packageSubjects,
    blockDecisions: [block],
    exclusionsFromPackage: outOfBoundary.map((r) => r.seed_id || r.id),
    createdAt: nowIso,
  });

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

  const stewardRef = arg('steward', 'operator (interim)')!;
  const steward: StewardAssignment = {
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
    packageRef: `${OUT_DIR}/${reviewId}.package.json`,
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
    console.log('\n  Re-run with --execute to dispatch. The operator triggers the live review.');
    return;
  }

  const artifacts = await runDualReview({
    request,
    pkg,
    r1: { assignment: r1Assignment, provider: r1Provider },
    r2: { assignment: r2Assignment, provider: r2Provider },
    steward,
    determinism: DEFAULT_DETERMINISM,
    coverage: {
      sampleRate: EXP_P1_COVERAGE.sampleRate,
      sampleSeed: EXP_P1_COVERAGE.sampleSeed,
      mechanicallyFlagged: expP1MechanicalFlags(packageSubjects),
    },
    assetRef: `crystal-${VERSION}`,
    assetCommitment,
    now: () => new Date().toISOString(),
    onStep: (s, d) => console.log(`  [${s}] ${d}`),
  });

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

  console.log('\n── Review complete ───────────────────────────────────────');
  console.log(`  agreed    ${artifacts.tally.agreed}`);
  console.log(`  contested ${artifacts.tally.contested}   <-- excluded pending governed resolution`);
  console.log(`  rejected  ${artifacts.tally.rejected}`);
  console.log(`  unknown   ${artifacts.tally.unknown}   <-- fails closed`);
  console.log(`\n  Wrote ${base}.{package,pre-run-manifest,raw-outputs,decisions,resolutions,relations,exclusions,receipt}.json`);
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
