/**
 * The resolution-to-invariant feedback loop — validator, milestone-close check,
 * and registry report (operator instruction, 2026-08-03).
 *
 *   Build → observe consequence → diagnose → repair → verify → COMPRESS THE
 *   RESOLUTION → PROTECT IT WITH A CANARY → reuse it → validate the invariant →
 *   build again with lower risk of repair.
 *
 * WHY IT LIVES HERE. `services/invariants/` is already this repo's one home for
 * the invariant model — `lifecycle.ts` runs the DB-backed
 * proposed→validated→canonical ladder, `store.ts` persists it, `resolution.ts`
 * is the Invariant Resolution Engine. A resolution record is the UPSTREAM of
 * that same pipeline: the raw material a candidate invariant is compressed
 * from. Putting it anywhere else would be a second place the platform reasons
 * about invariants (`inv.engineering.036`/`037`).
 *
 * NAME COLLISION, DELIBERATELY AVOIDED. `resolution.ts` in this directory is
 * the IRE — "resolution" there means *resolving a constitutional field for a
 * query*. This module is `resolutionRecords.ts` and never abbreviates to
 * "resolution": two unrelated meanings of one word in one directory is exactly
 * the ambiguity that produces the wrong import.
 *
 * PURITY BOUNDARY, mirroring `services/constitutional/capabilityCompletionArtifact.ts`:
 * every rule below is a PURE function over already-loaded records. `loadRegistry`
 * is the ONE impure export and does nothing but read the registry directory —
 * so the canary and the CLI report read through the same loader and cannot
 * disagree about what is in the registry.
 *
 * T1-safe: statements, ids, paths and counts only. Never a personaId.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CompletionStage } from '@/types/capabilityCompletion';
import {
  AGENT_MAX_STAGE,
  CANDIDATE_INVARIANT_SCHEMA_VERSION,
  RECURRENCE_CLASS_TRIGGERS,
  RESOLUTION_RECORD_SCHEMA_VERSION,
  RESOLUTION_SCOPES,
  RESOLUTION_TRIGGERS,
  atOrAbove,
  type CandidateInvariant,
  type MilestoneCloseFinding,
  type MilestoneCloseResult,
  type ResolutionIssue,
  type ResolutionRecord,
  type ResolutionRegistryReport,
  type ResolutionValidationResult,
} from '@/types/resolutionRecords';

/**
 * The registry's one authoritative location. It sits in the AgentiQ pack beside
 * `updates/` — the docs it is derived from — because CLAUDE.md already makes
 * `codexes/packs/agentiq/` the single home for what changed on this platform
 * and why. It is NOT registered in `collections.json`: these are governed data
 * records read by tooling, not markdown for the Updates tab.
 */
export const RESOLUTION_REGISTRY_ROOT = 'codexes/packs/agentiq/resolution-records';
export const RESOLUTION_RECORDS_DIR = `${RESOLUTION_REGISTRY_ROOT}/records`;
export const CANDIDATE_INVARIANTS_DIR = `${RESOLUTION_REGISTRY_ROOT}/candidate-invariants`;

export interface ResolutionRegistry {
  records: ResolutionRecord[];
  candidates: CandidateInvariant[];
}

// ---------------------------------------------------------------------------
// The ONE loader (impure)
// ---------------------------------------------------------------------------

function readJsonDir<T>(dir: string): T[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as T);
}

/** Reads the registry off disk. `repoRoot` defaults to the process cwd. */
export function loadRegistry(repoRoot = process.cwd()): ResolutionRegistry {
  return {
    records: readJsonDir<ResolutionRecord>(join(repoRoot, RESOLUTION_RECORDS_DIR)),
    candidates: readJsonDir<CandidateInvariant>(join(repoRoot, CANDIDATE_INVARIANTS_DIR)),
  };
}

// ---------------------------------------------------------------------------
// Validation (pure)
// ---------------------------------------------------------------------------

const isNonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every(isNonEmpty);

/** `RES-YYYY-MM-DD-<SLUG>-NNN` / `CI-YYYY-MM-DD-<SLUG>-NNN`. */
const RESOLUTION_ID = /^RES-\d{4}-\d{2}-\d{2}-[A-Z0-9-]+-\d{3}$/;
const CANDIDATE_ID = /^CI-\d{4}-\d{2}-\d{2}-[A-Z0-9-]+-\d{3}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateResolutionRecord(input: unknown): ResolutionValidationResult {
  const issues: ResolutionIssue[] = [];
  const push = (path: string, message: string) => issues.push({ path, message });
  const r = input as Partial<ResolutionRecord> | null;

  if (!r || typeof r !== 'object') {
    return { valid: false, issues: [{ path: '', message: 'record is not an object' }] };
  }
  // Version first — a foreign document is refused, never coerced.
  if (r.schemaVersion !== RESOLUTION_RECORD_SCHEMA_VERSION) {
    push('schemaVersion', `expected '${RESOLUTION_RECORD_SCHEMA_VERSION}', got '${String(r.schemaVersion)}'`);
    return { valid: false, issues };
  }
  if (!isNonEmpty(r.resolutionId) || !RESOLUTION_ID.test(r.resolutionId)) {
    push('resolutionId', 'must match RES-YYYY-MM-DD-<SLUG>-NNN');
  }
  if (!isNonEmpty(r.date) || !ISO_DATE.test(r.date)) push('date', 'must be an ISO date (YYYY-MM-DD)');
  for (const f of ['capability', 'milestone', 'problem'] as const) {
    if (!isNonEmpty(r[f])) push(f, 'is required');
  }
  for (const f of ['observedFailure', 'rootCauses', 'resolution'] as const) {
    if (!isStringList(r[f]) || r[f]!.length === 0) push(f, 'must hold at least one entry');
  }
  for (const f of ['rejectedApproaches', 'candidateInvariants', 'canaries', 'sourceDocs'] as const) {
    if (!isStringList(r[f])) push(f, 'must be a list of non-empty strings');
  }
  if (!RESOLUTION_SCOPES.includes(r.scope as never)) push('scope', `must be one of ${RESOLUTION_SCOPES.join(' | ')}`);
  if (!RESOLUTION_TRIGGERS.includes(r.trigger as never)) push('trigger', 'must be one of the ten cadence triggers');
  if (!isStageValue(r.status)) push('status', 'must be a COMPLETION_LIFECYCLE stage');

  const e = r.evidence;
  if (!e || typeof e !== 'object') {
    push('evidence', 'is required');
  } else {
    for (const f of ['commits', 'tests', 'receipts', 'incidentRefs'] as const) {
      if (!isStringList(e[f])) push(`evidence.${f}`, 'must be a list of non-empty strings (empty is legal)');
    }
  }

  // Every candidate reference must be an id, never free prose — otherwise one
  // rule with three incidents becomes three near-duplicate strings.
  (r.candidateInvariants ?? []).forEach((id, i) => {
    if (!CANDIDATE_ID.test(id)) push(`candidateInvariants[${i}]`, `'${id}' is not a candidate id (CI-YYYY-MM-DD-<SLUG>-NNN)`);
  });

  return { valid: issues.length === 0, issues };
}

export function validateCandidateInvariant(input: unknown): ResolutionValidationResult {
  const issues: ResolutionIssue[] = [];
  const push = (path: string, message: string) => issues.push({ path, message });
  const c = input as Partial<CandidateInvariant> | null;

  if (!c || typeof c !== 'object') {
    return { valid: false, issues: [{ path: '', message: 'candidate is not an object' }] };
  }
  if (c.schemaVersion !== CANDIDATE_INVARIANT_SCHEMA_VERSION) {
    push('schemaVersion', `expected '${CANDIDATE_INVARIANT_SCHEMA_VERSION}', got '${String(c.schemaVersion)}'`);
    return { valid: false, issues };
  }
  if (!isNonEmpty(c.candidateId) || !CANDIDATE_ID.test(c.candidateId)) {
    push('candidateId', 'must match CI-YYYY-MM-DD-<SLUG>-NNN');
  }
  if (!isNonEmpty(c.statement)) push('statement', 'is required');
  if (c.classification !== null && !isNonEmpty(c.classification)) {
    push('classification', 'must be a non-empty string or null');
  }
  if (!RESOLUTION_SCOPES.includes(c.scope as never)) push('scope', `must be one of ${RESOLUTION_SCOPES.join(' | ')}`);
  if (!isStageValue(c.status)) push('status', 'must be a COMPLETION_LIFECYCLE stage');
  if (!isStringList(c.derivedFrom) || c.derivedFrom!.length === 0) {
    push('derivedFrom', 'must name at least one resolution record');
  }
  if (!isStringList(c.notes)) push('notes', 'must be a list of non-empty strings (empty is legal)');

  if (!Array.isArray(c.occurrences) || c.occurrences.length === 0) {
    push('occurrences', 'must record at least one sighting — a candidate with none is an assertion, not an observation');
  } else {
    c.occurrences.forEach((o, i) => {
      if (!o || typeof o !== 'object') return push(`occurrences[${i}]`, 'is not an object');
      if (!isNonEmpty(o.site)) push(`occurrences[${i}].site`, 'is required');
      if (!isNonEmpty(o.defect)) push(`occurrences[${i}].defect`, 'is required');
      if (!isNonEmpty(o.resolutionId)) push(`occurrences[${i}].resolutionId`, 'is required');
      if (!isStringList(o.evidence) || o.evidence.length === 0) {
        push(`occurrences[${i}].evidence`, 'an occurrence with no evidence is a claim, not a sighting');
      }
    });
  }

  if (!Array.isArray(c.canaries)) {
    push('canaries', 'must be a list (empty is legal and visible)');
  } else {
    c.canaries.forEach((k, i) => {
      if (!k || typeof k !== 'object') return push(`canaries[${i}]`, 'is not an object');
      if (!isNonEmpty(k.path)) push(`canaries[${i}].path`, 'is required');
      if (!isNonEmpty(k.assertion)) push(`canaries[${i}].assertion`, 'a canary whose assertion is unrecorded loses its purpose');
      if (typeof k.verifiedFailingBeforeFix !== 'boolean') {
        push(`canaries[${i}].verifiedFailingBeforeFix`, 'must be a boolean — `false` is an honest state (OS-9)');
      }
    });
  }

  // THE NON-RATIFICATION GUARD. An agent may raise a candidate no higher than
  // `validated`; above that requires a named operator act. No agent message is
  // ever operator consent, so this cannot be satisfied by an agent's judgement.
  const stage = isStageValue(c.status) ? c.status : null;
  if (stage && atOrAbove(stage, 'ratified')) {
    if (!isNonEmpty(c.ratifiedSource)) {
      push('ratifiedSource', `status '${stage}' is above the agent ceiling '${AGENT_MAX_STAGE}' and requires a named operator act`);
    }
  } else if (c.ratifiedSource !== null) {
    push('ratifiedSource', `must be null below 'ratified' — it names a ratification that has not happened`);
  }

  return { valid: issues.length === 0, issues };
}

function isStageValue(v: unknown): v is CompletionStage {
  return (
    v === 'observed' || v === 'candidate' || v === 'validated' ||
    v === 'ratified' || v === 'canonical' || v === 'deprecated'
  );
}

// ---------------------------------------------------------------------------
// Referential integrity (pure)
// ---------------------------------------------------------------------------

/**
 * Every id one side names must exist on the other. A record pointing at a
 * candidate that does not exist, or a candidate derived from a record that does
 * not exist, is a broken loop — the failure mode where the lesson survives as a
 * dangling reference and the reader concludes it was never captured.
 */
export function checkReferentialIntegrity(reg: ResolutionRegistry): ResolutionIssue[] {
  const issues: ResolutionIssue[] = [];
  const recordIds = new Set(reg.records.map((r) => r.resolutionId));
  const candidateIds = new Set(reg.candidates.map((c) => c.candidateId));

  for (const r of reg.records) {
    for (const id of r.candidateInvariants) {
      if (!candidateIds.has(id)) issues.push({ path: `${r.resolutionId}.candidateInvariants`, message: `names unknown candidate '${id}'` });
    }
  }
  for (const c of reg.candidates) {
    for (const id of c.derivedFrom) {
      if (!recordIds.has(id)) issues.push({ path: `${c.candidateId}.derivedFrom`, message: `names unknown resolution '${id}'` });
    }
    for (const o of c.occurrences) {
      if (!recordIds.has(o.resolutionId)) issues.push({ path: `${c.candidateId}.occurrences`, message: `occurrence at '${o.site}' names unknown resolution '${o.resolutionId}'` });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// The milestone-close check (pure)
// ---------------------------------------------------------------------------

/**
 * The gate the operator asked for: at milestone close, does any multi-cycle
 * resolution remain uncaptured, and does every captured one carry all three
 * required outputs?
 *
 * NOT INERT (MS-7 / OS-9). The "uncaptured" question is not a slogan the check
 * always prints: `uncapturedCandidateDocs` is the COMPUTED set of update docs
 * newer than the newest resolution record and not cited by any record's
 * `sourceDocs`. At milestone close that list is short and specific, and an
 * empty list makes the question answerable rather than rhetorical.
 *
 * The caller supplies that set (the disk read lives in `loadRegistry`'s
 * neighbour `listUncapturedUpdateDocs`), so this function stays pure.
 */
export function runMilestoneCloseCheck(
  reg: ResolutionRegistry,
  uncapturedCandidateDocs: string[] = [],
): MilestoneCloseResult {
  const findings: MilestoneCloseFinding[] = [];
  const blocker = (subjectId: string | null, message: string) => findings.push({ severity: 'blocker', subjectId, message });
  const warn = (subjectId: string | null, message: string) => findings.push({ severity: 'warning', subjectId, message });

  const candidateById = new Map(reg.candidates.map((c) => [c.candidateId, c]));

  // ── Output 2: a resolution at `candidate` or above must have compressed a rule.
  for (const r of reg.records) {
    if (atOrAbove(r.status, 'candidate') && r.candidateInvariants.length === 0) {
      blocker(r.resolutionId, `is at '${r.status}' with no candidate invariant — the resolution was recorded but never compressed into a reusable rule`);
    }
    // ── Cadence: a record exists because a trigger fired; recurrence-class
    //    triggers are the ones that have already cost repeat repair.
    if (RECURRENCE_CLASS_TRIGGERS.includes(r.trigger)) {
      const protectedByAnyCanary =
        r.canaries.length > 0 ||
        r.candidateInvariants.some((id) => (candidateById.get(id)?.canaries.length ?? 0) > 0);
      if (!protectedByAnyCanary) {
        blocker(r.resolutionId, `trigger '${r.trigger}' means this already recurred or resisted repair, and nothing executable protects it — without the canary, the invariant is advisory prose`);
      }
    }
    if (r.evidence.commits.length === 0 && r.evidence.tests.length === 0 && r.evidence.incidentRefs.length === 0) {
      warn(r.resolutionId, 'carries no commit, test or incident reference — the account cannot be checked against what happened');
    }
  }

  // ── Output 3: the canary. Missing is a WARNING at `candidate` (the honest
  //    state of a rule whose enforcement point is still being built) and a
  //    BLOCKER at `validated` and above (nothing may be called validated on the
  //    strength of an unenforced claim).
  for (const c of reg.candidates) {
    if (c.canaries.length === 0) {
      if (atOrAbove(c.status, 'validated')) {
        blocker(c.candidateId, `is '${c.status}' with no canary — an invariant without an executable mechanism cannot have been validated by regression prevention`);
      } else {
        warn(c.candidateId, 'has no canary — an invariant without a canary is advisory prose; its enforcement point is pending');
      }
    }
    if (atOrAbove(c.status, 'validated') && c.occurrences.length < 2) {
      blocker(c.candidateId, `is '${c.status}' on a single occurrence — the ladder requires reuse or regression prevention, not one fix that worked once`);
    }
    if (c.scope === 'cross-capability') {
      const sites = new Set(c.occurrences.map((o) => o.site));
      if (sites.size < 2) {
        warn(c.candidateId, `claims 'cross-capability' scope from ${sites.size} site(s) — generality is a claim that must be earned by recurrence across capabilities`);
      }
    }
    if (c.canaries.some((k) => !k.verifiedFailingBeforeFix)) {
      warn(c.candidateId, 'has a canary not verified to fail before the fix (OS-9) — a canary that cannot fail converts an open question into a settled one');
    }
  }

  // ── The uncaptured question, asked with its computed answer set.
  if (uncapturedCandidateDocs.length > 0) {
    findings.push({
      severity: 'question',
      subjectId: null,
      message: `${uncapturedCandidateDocs.length} update doc(s) newer than the newest resolution record are not cited by any record: ${uncapturedCandidateDocs.join(', ')}. Did any of them describe a multi-cycle repair, a recurrence, or a canary that encoded its defect? If so it remains uncaptured.`,
    });
  }

  return { clear: !findings.some((f) => f.severity === 'blocker'), findings };
}

/**
 * The disk half of the uncaptured question, held beside the loader so the pure
 * check above never reads a filesystem. Returns update-doc paths dated at or
 * after the newest resolution record that no record cites.
 */
export function listUncapturedUpdateDocs(reg: ResolutionRegistry, repoRoot = process.cwd()): string[] {
  const updatesDir = join(repoRoot, 'codexes/packs/agentiq/updates');
  if (!existsSync(updatesDir) || reg.records.length === 0) return [];
  const newest = reg.records.map((r) => r.date).sort().at(-1)!;
  const cited = new Set(reg.records.flatMap((r) => r.sourceDocs));
  return readdirSync(updatesDir)
    .filter((f) => f.endsWith('.md') && /^\d{4}-\d{2}-\d{2}_/.test(f))
    .filter((f) => f.slice(0, 10) >= newest)
    .map((f) => `codexes/packs/agentiq/updates/${f}`)
    .filter((p) => !cited.has(p))
    .sort();
}

// ---------------------------------------------------------------------------
// The report (pure)
// ---------------------------------------------------------------------------

export function buildRegistryReport(
  reg: ResolutionRegistry,
  uncapturedCandidateDocs: string[] = [],
  generatedFor = 'all milestones',
): ResolutionRegistryReport {
  const summarise = (c: CandidateInvariant) => ({
    candidateId: c.candidateId,
    statement: c.statement,
    status: c.status,
    occurrences: c.occurrences.length,
    canaries: c.canaries.length,
  });

  const validated = reg.candidates.filter((c) => atOrAbove(c.status, 'validated'));
  const open = reg.candidates.filter((c) => !atOrAbove(c.status, 'validated'));

  const recurrenceTriggerRecords = new Set(
    reg.records.filter((r) => RECURRENCE_CLASS_TRIGGERS.includes(r.trigger)).map((r) => r.resolutionId),
  );

  const unresolvedRecurrenceRisks = reg.candidates
    .filter((c) => c.canaries.length === 0)
    .filter((c) => c.occurrences.length > 1 || c.derivedFrom.some((id) => recurrenceTriggerRecords.has(id)))
    .map((c) => ({
      candidateId: c.candidateId,
      statement: c.statement,
      occurrences: c.occurrences.length,
      reason:
        c.occurrences.length > 1
          ? `seen ${c.occurrences.length} times and nothing executable prevents the next one`
          : 'derived from a resolution that already recurred or resisted repair, and nothing executable prevents the next one',
    }));

  return {
    generatedFor,
    totals: {
      resolutions: reg.records.length,
      candidates: reg.candidates.length,
      canaries: reg.candidates.reduce((n, c) => n + c.canaries.length, 0),
      candidatesWithoutCanary: reg.candidates.filter((c) => c.canaries.length === 0).length,
    },
    openResolutions: reg.records
      .filter((r) => !atOrAbove(r.status, 'validated'))
      .map((r) => ({ resolutionId: r.resolutionId, status: r.status, capability: r.capability, trigger: r.trigger })),
    candidateInvariants: open.map(summarise),
    validatedInvariants: validated.map(summarise),
    unresolvedRecurrenceRisks,
    milestoneClose: runMilestoneCloseCheck(reg, uncapturedCandidateDocs),
  };
}

/** Every canary path the registry claims, de-duplicated — the input to the
 *  disk-resolution check, which lives in the canary (this module stays pure
 *  apart from `loadRegistry`, mirroring `declaredProofPaths`). */
export function declaredCanaryPaths(reg: ResolutionRegistry): string[] {
  return [
    ...new Set([
      ...reg.candidates.flatMap((c) => c.canaries.map((k) => k.path)),
      ...reg.records.flatMap((r) => r.canaries),
    ]),
  ];
}
