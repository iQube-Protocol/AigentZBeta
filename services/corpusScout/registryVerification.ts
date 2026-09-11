/**
 * Registry-level VERIFICATION — the binding between a curated registry URL and
 * the real-world property that registry depends on (operator ruling,
 * 2026-07-27; SPEC-CIR-001 §9).
 *
 * ── The defect this closes ──────────────────────────────────────────────────
 *
 * The capability already existed and was ratified. `followRedirects()`
 * (`retrieval.ts`) resolves redirects. `runInstitutionDiscovery(seedUrl)`
 * (`institutionNavigator.ts`) finds publication entry points. `retrieveArtifact`
 * fetches and hashes bytes. `inspectArtifact` confirms substantive content and
 * *"never infers validity from a URL or declared MIME type alone."*
 *
 * What did not exist was the **binding**: verification ran at DOCUMENT level,
 * after acquisition had already started, and a registry entry carried no
 * verification state at all. Nothing refused to acquire from an unverified
 * institution. That is precisely CFS-053's shape — a registry of URLs with no
 * binding to the real-world property it depends on, where the absence is
 * undetectable because nothing ever errors. This module is the binding and the
 * gate; it reimplements none of the machinery above.
 *
 * ── Verification is MORE than reachability ─────────────────────────────────
 *
 * All four conjuncts, per the ruling:
 *
 *   institution URL resolves
 *     + document candidates discovered
 *     + at least one document passes the Corpus Qualification Standard
 *     + retrieved bytes and inspection result are recorded
 *
 * A 200 response is not verification. An institution whose homepage loads but
 * whose publication listing yields nothing acquirable is `insufficient_corpus`,
 * not `verified` — and `insufficient_corpus` does not open the gate.
 *
 * ── This module cannot verify anything from the build environment ──────────
 *
 * Outbound HTTPS is blocked here. `verifyInstitutionEntry` is written to run on
 * the deployed app. Nothing in this codebase marks anything `verified` without
 * a completed run: `applyVerificationOutcome` refuses the transition
 * (`isVerificationTransitionAllowed`), so "verified" cannot be asserted, only
 * earned.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { followRedirects, retrieveArtifact, sniffMagicBytes, TRANSIENT_HTTP_STATUSES } from './retrieval';
import { runInstitutionDiscovery, type DocumentCandidate } from './institutionNavigator';
import { inspectArtifact } from './inspection';
import { CORPUS_QUALIFICATION_STANDARD_STATEMENT } from './corpusQualificationStandard';
import { resolveCanonicalHomepage } from './canonicalInstitutionHomepages';

// ── The status vocabulary ───────────────────────────────────────────────────

/**
 * The operator's explicit verification-status vocabulary. ORTHOGONAL to
 * `RatificationStatus` (`proposed | ratified`), exactly as `provenanceClass`
 * is orthogonal to `reviewWorkflowStatus` (PRD-ICA-001 §0.3): ratification
 * answers *"does a steward accept this authority"*, verification answers
 * *"does this URL still lead to a qualifying corpus"*. An entry can be
 * ratified and `verification_failed`, or `verified` and never ratified.
 * Collapsing them would make a dead link indistinguishable from an
 * unapproved one.
 */
export type VerificationStatus =
  /** Never submitted for verification. The seeding default. */
  | 'proposed'
  /** A verification run is in flight. The ONLY state `verified` may follow. */
  | 'pending_verification'
  /** All four conjuncts satisfied, with the evidence recorded. */
  | 'verified'
  /** The seed URL could not be resolved, or the run errored. */
  | 'verification_failed'
  /** Reachable, but no document passed the Corpus Qualification Standard. */
  | 'insufficient_corpus'
  /** A transient failure (timeout). Re-runnable; not a judgment on the source. */
  | 'temporarily_unavailable'
  /** The seed now redirects to a different host — a steward must re-confirm. */
  | 'redirect_changed'
  /** Steward judgment: no longer an authority for this pillar. */
  | 'deprecated';

export const VERIFICATION_STATUSES: readonly VerificationStatus[] = [
  'proposed', 'pending_verification', 'verified', 'verification_failed',
  'insufficient_corpus', 'temporarily_unavailable', 'redirect_changed', 'deprecated',
];

export function isVerificationStatus(v: unknown): v is VerificationStatus {
  return typeof v === 'string' && (VERIFICATION_STATUSES as readonly string[]).includes(v);
}

/** The statuses a completed verification RUN may produce. `proposed` and
 *  `deprecated` are not run outcomes — one precedes verification, the other is
 *  a steward judgment. */
export const RUN_OUTCOME_STATUSES: readonly VerificationStatus[] = [
  'verified', 'verification_failed', 'insufficient_corpus', 'temporarily_unavailable', 'redirect_changed',
];

/**
 * The transition table.
 *
 * The load-bearing rule is one line long: **`verified` is reachable only from
 * `pending_verification`.** Everything else is convenience. Without it,
 * anything that can write the column can declare an entry verified, and the
 * gate below becomes decoration — a mechanism that exists and cannot enforce,
 * which is the defect this whole module was built to close.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<VerificationStatus, readonly VerificationStatus[]>> = {
  proposed: ['pending_verification', 'deprecated'],
  pending_verification: [...RUN_OUTCOME_STATUSES, 'deprecated'],
  // Re-verification is always available; a verified entry can go stale.
  verified: ['pending_verification', 'deprecated'],
  verification_failed: ['pending_verification', 'deprecated'],
  insufficient_corpus: ['pending_verification', 'deprecated'],
  temporarily_unavailable: ['pending_verification', 'deprecated'],
  redirect_changed: ['pending_verification', 'deprecated'],
  // A steward may re-open a deprecated entry; it re-enters unverified.
  deprecated: ['proposed'],
};

export function isVerificationTransitionAllowed(from: VerificationStatus, to: VerificationStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * **The refusal gate.** Institutional discovery requires BOTH a steward's
 * ratification and a completed verification. Neither alone is sufficient:
 * ratification without verification acquires from a URL nobody has resolved,
 * and verification without ratification acquires from an authority nobody
 * accepted.
 *
 * Fail-closed on every unknown value — an entry whose verification status is
 * missing, misspelled or from a future vocabulary does not acquire.
 */
export function canRunInstitutionDiscovery(entry: {
  status: string;
  verificationStatus: VerificationStatus | null;
}): { allowed: true } | { allowed: false; reason: string } {
  if (entry.status !== 'ratified') {
    return { allowed: false, reason: 'institution must be ratified before discovery can run' };
  }
  if (entry.verificationStatus !== 'verified') {
    return {
      allowed: false,
      reason:
        `institution must be VERIFIED before discovery can run (currently '${entry.verificationStatus ?? 'unset'}') — ` +
        'an operator-supplied URL is not a verified URL; run POST /api/corpus-scout/institution-verification first',
    };
  }
  return { allowed: true };
}

// ── The verification run ────────────────────────────────────────────────────

/** One document that passed the Corpus Qualification Standard, with the
 *  evidence the ruling requires recorded (§3: "retrieved bytes and inspection
 *  result"). */
export interface QualifyingDocument {
  documentUrl: string;
  contentHash: string;
  mimeType: string;
  fileSizeBytes: number;
  pageCount: number | null;
  substantiveTextCharacters: number;
  blankPageRatio: number | null;
}

export interface VerificationOutcome {
  status: VerificationStatus;
  /** The URL the seed actually resolved to after redirects. */
  resolvedUrl: string | null;
  checkedAt: string;
  candidatesFound: number;
  documentsInspected: number;
  qualifyingDocuments: QualifyingDocument[];
  /** The standard applied, recorded on the row so a later reader knows which
   *  bar this entry cleared without having to guess. */
  standard: string;
  detail: string;
}

/** Bounded work per institution — verification needs ONE qualifying document,
 *  not a full acquisition pass. */
const MAX_DOCUMENTS_TO_INSPECT = 5;

/** Injectable so the run is testable without network access. Defaults are the
 *  real, already-ratified machinery — this module adds no second retrieval,
 *  navigation or inspection implementation. */
export interface VerificationDeps {
  followRedirects: typeof followRedirects;
  runInstitutionDiscovery: typeof runInstitutionDiscovery;
  retrieveArtifact: typeof retrieveArtifact;
  inspectArtifact: typeof inspectArtifact;
}

const REAL_DEPS: VerificationDeps = {
  followRedirects, runInstitutionDiscovery, retrieveArtifact, inspectArtifact,
};

function hostOf(url: string): string | null {
  try { return new URL(url).host.toLowerCase(); } catch { return null; }
}

// ── THE THREE PHASES — the SAME decision logic as before, factored into
// independently-callable units (2026-08-31, "verification wall-clock
// granularity" repair). `runVerification` below composes these into the
// original one-shot behavior UNCHANGED; `runVerificationStep` (below)
// composes the SAME three functions into a resumable, one-phase-per-call
// primitive. Neither reimplements the decision logic — this is the ONE
// authoritative place the four-conjunct evaluation lives (inv.engineering.
// 036/037): only the I/O progression around it differs between callers. ──

type ResolveSeedResult =
  | { terminal: true; status: VerificationStatus; resolvedUrl: string | null; detail: string }
  | { terminal: false; resolvedUrl: string };

/** Conjunct 1 — does the institution URL resolve? Exactly the original
 *  step 1 body, unchanged. */
async function resolveSeedPhase(seedUrl: string, deps: VerificationDeps): Promise<ResolveSeedResult> {
  const trimmed = seedUrl.trim();
  if (!trimmed) {
    return { terminal: true, status: 'verification_failed', resolvedUrl: null, detail: 'no seed URL to verify' };
  }
  const resolved = await deps.followRedirects(trimmed, { accept: 'text/html,*/*' });
  if (!resolved.ok) {
    const status: VerificationStatus =
      resolved.failureClass === 'timeout' ? 'temporarily_unavailable'
      : resolved.failureClass === 'redirect-loop' ? 'redirect_changed'
      : 'verification_failed';
    return { terminal: true, status, resolvedUrl: resolved.finalUrl ?? null, detail: `seed URL did not resolve: ${resolved.failureClass}` };
  }
  const resolvedUrl = resolved.finalUrl;
  if (!resolved.response.ok) {
    // `followRedirects` already retried a TRANSIENT status (429/502/503/504)
    // up to its bounded attempt limit before returning here — so a transient
    // status surviving to this point means retries were exhausted, not that
    // none were tried. That is a DIFFERENT fact from "this URL doesn't work":
    // it must be recorded as `temporarily_unavailable` (re-runnable, no
    // judgment on the source), never `verification_failed` (operator ruling
    // 2026-07-28: "A timeout must not silently become 'no evidence.' The
    // failed acquisition attempt should remain observable" — the same
    // discipline extends to a non-timeout transient status).
    const status: VerificationStatus = TRANSIENT_HTTP_STATUSES.has(resolved.response.status)
      ? 'temporarily_unavailable'
      : 'verification_failed';
    return {
      terminal: true, status, resolvedUrl,
      detail: `seed URL returned HTTP ${resolved.response.status}${status === 'temporarily_unavailable' ? ' (transient — retries exhausted)' : ''}`,
    };
  }
  // A redirect WITHIN the institution's own host is routine (a locale or
  // trailing-slash hop). A redirect to a DIFFERENT host means the registry's
  // URL no longer points where the steward thought — a judgment call, not a
  // failure, so it goes back to the steward rather than being auto-accepted.
  if (hostOf(resolvedUrl) !== hostOf(trimmed)) {
    return {
      terminal: true, status: 'redirect_changed', resolvedUrl,
      detail: `seed URL now redirects off-host: ${hostOf(trimmed)} → ${hostOf(resolvedUrl)} — a steward must re-confirm the entry`,
    };
  }
  return { terminal: false, resolvedUrl };
}

type DiscoverCandidatesResult =
  | { terminal: true; status: VerificationStatus; detail: string; candidatesFound: number }
  | { terminal: false; candidates: DocumentCandidate[]; candidatesFound: number };

/** Conjunct 2 — are document candidates discovered? Exactly the original
 *  step 2 body, unchanged (Agent B/C, `institutionNavigator.ts`). */
async function discoverCandidatesPhase(resolvedUrl: string, deps: VerificationDeps): Promise<DiscoverCandidatesResult> {
  const discovery = await deps.runInstitutionDiscovery(resolvedUrl);
  if (!discovery.ok) {
    const status: VerificationStatus = discovery.failureClass === 'timeout' ? 'temporarily_unavailable' : 'verification_failed';
    return { terminal: true, status, detail: `institution navigation failed: ${discovery.error ?? discovery.failureClass}`, candidatesFound: 0 };
  }
  const candidatesFound = discovery.candidates.length;
  if (candidatesFound === 0) {
    return {
      terminal: true, status: 'insufficient_corpus', candidatesFound,
      detail: 'the institution URL resolves but no document candidates were discovered — reachable is not the same as acquirable',
    };
  }
  return { terminal: false, candidates: discovery.candidates, candidatesFound };
}

/** Conjuncts 3+4, for ONE candidate document — exactly the original loop
 *  body's per-iteration work, unchanged. The caller owns the loop/cursor
 *  (`runVerification` iterates in-process; `runVerificationStep` persists
 *  the cursor between calls) — this function is the single per-document
 *  unit both share. */
async function inspectCandidatePhase(
  candidate: DocumentCandidate,
  deps: VerificationDeps,
): Promise<{ qualifies: true; document: QualifyingDocument } | { qualifies: false }> {
  const retrieval = await deps.retrieveArtifact(candidate.documentUrl, candidate.discoveryUrl);
  if (!retrieval.ok || !retrieval.bytes || !retrieval.artifactHash) return { qualifies: false };

  const sniffed = sniffMagicBytes(retrieval.bytes);
  const mimeType = sniffed.isPdf ? 'application/pdf' : (retrieval.contentType ?? 'text/html');
  const inspection = await deps.inspectArtifact(retrieval.bytes, mimeType);
  if (!inspection.ok || !inspection.passesContentPresenceCheck) return { qualifies: false };

  return {
    qualifies: true,
    document: {
      documentUrl: candidate.documentUrl,
      contentHash: retrieval.artifactHash,
      mimeType,
      fileSizeBytes: retrieval.fileSizeBytes,
      pageCount: inspection.pageCount,
      substantiveTextCharacters: inspection.substantiveTextCharacters,
      blankPageRatio: inspection.blankPageRatio,
    },
  };
}

/**
 * Run the four conjuncts against one institution's seed URL, ALL IN ONE
 * CALL — the original one-shot contract, unchanged, for callers that
 * genuinely want a single synchronous result (the single-entry admin route,
 * the whole-domain sweep). Never throws; every failure path returns a
 * structured outcome with an honest status, mirroring `retrieval.ts`'s
 * ethos (PRD-ICA-001 §12).
 *
 * ⚠ THIS FUNCTION HOLDS ONE REQUEST OPEN ACROSS UP TO SEVEN EXTERNAL
 * OPERATIONS (resolve, discover, up to five document fetch+inspects) — the
 * exact shape that produced a live HTTP 504 on `verify-step` (2026-08-31).
 * `runVerificationStep` below is the BOUNDED, resumable alternative the
 * Copilot/Track 2 acquisition loop actually calls; this function remains
 * for the two call sites that are not driven through that bounded loop and
 * are documented as accepting the risk (the operator-run whole-domain sweep
 * is explicitly "the call the operator runs on the deployed app", never
 * the Copilot's own bounded loop).
 *
 * The order matters and is not arbitrary: resolve first (a dead URL is not an
 * insufficient corpus, it is a failure), then discover (a reachable
 * institution with no publications is insufficient, not failed), then inspect
 * (candidates that all fall below the standard are insufficient too). Each
 * status names a different remediation, which is the point of having eight of
 * them rather than a boolean.
 */
export async function runVerification(
  seedUrl: string,
  deps: VerificationDeps = REAL_DEPS,
): Promise<VerificationOutcome> {
  const base = {
    checkedAt: new Date().toISOString(),
    standard: CORPUS_QUALIFICATION_STANDARD_STATEMENT,
  };

  const resolvePhase = await resolveSeedPhase(seedUrl, deps);
  if (resolvePhase.terminal) {
    return { ...base, status: resolvePhase.status, resolvedUrl: resolvePhase.resolvedUrl, detail: resolvePhase.detail, candidatesFound: 0, documentsInspected: 0, qualifyingDocuments: [] };
  }
  const { resolvedUrl } = resolvePhase;

  const discoverPhase = await discoverCandidatesPhase(resolvedUrl, deps);
  if (discoverPhase.terminal) {
    return { ...base, status: discoverPhase.status, resolvedUrl, detail: discoverPhase.detail, candidatesFound: discoverPhase.candidatesFound, documentsInspected: 0, qualifyingDocuments: [] };
  }
  const { candidates, candidatesFound } = discoverPhase;

  const qualifyingDocuments: QualifyingDocument[] = [];
  let documentsInspected = 0;
  for (const candidate of candidates.slice(0, MAX_DOCUMENTS_TO_INSPECT)) {
    const result = await inspectCandidatePhase(candidate, deps);
    documentsInspected += 1;
    if (result.qualifies) {
      qualifyingDocuments.push(result.document);
      break; // one qualifying document is the bar; verification is not acquisition
    }
  }

  if (qualifyingDocuments.length === 0) {
    return {
      ...base, status: 'insufficient_corpus', resolvedUrl, candidatesFound, documentsInspected, qualifyingDocuments,
      detail: `${documentsInspected} candidate document(s) inspected, none passed the Corpus Qualification Standard`,
    };
  }

  return {
    ...base,
    status: 'verified',
    resolvedUrl,
    candidatesFound,
    documentsInspected,
    qualifyingDocuments,
    detail: `all four conjuncts satisfied — resolved, ${candidatesFound} candidate(s) discovered, ${qualifyingDocuments.length} qualifying document recorded with content hash`,
  };
}

// ── Persistence ─────────────────────────────────────────────────────────────

export interface VerifyEntryResult {
  ok: boolean;
  error?: string;
  domain: string;
  pillarKey: string;
  institutionName: string;
  seedUrl?: string;
  outcome?: VerificationOutcome;
}

/**
 * Write a run's outcome onto the registry row, refusing any transition the
 * table forbids. This is where "verified" becomes unforgeable: the row is put
 * into `pending_verification` BEFORE the run, and the outcome is only written
 * if `pending_verification → <outcome>` is legal. A caller that skips the run
 * cannot reach `verified` from `proposed`.
 */
export async function applyVerificationOutcome(
  admin: SupabaseClient,
  key: { domain: string; pillarKey: string; institutionName: string },
  from: VerificationStatus,
  outcome: VerificationOutcome,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isVerificationTransitionAllowed(from, outcome.status)) {
    return { ok: false, error: `verification transition '${from}' → '${outcome.status}' is not allowed` };
  }
  const { error } = await admin
    .from('corpus_institutional_registry')
    .update({
      verification_status: outcome.status,
      verified_at: outcome.status === 'verified' ? outcome.checkedAt : null,
      verification_checked_at: outcome.checkedAt,
      resolved_url: outcome.resolvedUrl,
      verification_detail: {
        detail: outcome.detail,
        standard: outcome.standard,
        candidatesFound: outcome.candidatesFound,
        documentsInspected: outcome.documentsInspected,
        qualifyingDocuments: outcome.qualifyingDocuments,
      },
      // A terminal outcome means no run is in flight any more, regardless of
      // whether it arrived via the one-shot `runVerification` or the
      // resumable `runVerificationStep` below — the checkpoint is scratch
      // state for an IN-FLIGHT run only, never left dangling once one exists.
      verification_progress: null,
      updated_at: new Date().toISOString(),
    })
    .eq('domain', key.domain)
    .eq('pillar_key', key.pillarKey)
    .eq('institution_name', key.institutionName);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── THE RESUMABLE, BOUNDED STEP (2026-08-31, "verification wall-clock
// granularity" repair) ──────────────────────────────────────────────────
//
// `verifyInstitutionEntry`/`runVerification` chain up to seven external
// operations (resolve, discover, up to five fetch+inspects) in one call —
// exactly the shape that produced a live HTTP 504 on `verify-step` for BIS.
// `runVerificationStep` performs EXACTLY ONE of those operations per call,
// racing it against `VERIFICATION_STEP_DEADLINE_MS` (comfortably below the
// hosting request ceiling — the same `Promise.race` discipline
// `crystalAcquisitionPrecondition.ts`'s "empty 504" repair established:
// never await the losing side, log it forensically, return a clean
// structured result instead of hanging). Progress (phase, cursor, evidence
// accumulated so far) is persisted on the registry row's
// `verification_progress` column between calls — the SAME `pending_
// verification` row every other verification path already writes, not a
// second store — so a caller drives this repeatedly, exactly mirroring how
// `runOneAcquisitionStep`/`.../acquisition/run-step` is already driven.
//
// Reuses `resolveSeedPhase`/`discoverCandidatesPhase`/`inspectCandidatePhase`
// verbatim — the SAME decision logic `runVerification` composes, never a
// second, independently-derived evaluation (inv.engineering.036/037).

const TABLE = 'corpus_institutional_registry';

/** Comfortably below the hosting request ceiling that produced the live
 *  504 (this route's own `maxDuration` budget is far larger, but the
 *  observed failure was an upstream/proxy timeout, not the Lambda's own
 *  configured ceiling) — matches `retrieval.ts`'s own single-attempt
 *  `TIMEOUT_MS`, so a normal, healthy external call already fits inside one
 *  race without ever needing a second attempt. */
export const VERIFICATION_STEP_DEADLINE_MS = 20_000;

export type VerificationPhase = 'resolve-seed' | 'discover-candidates' | 'fetch-document';

/** The durable, resumable checkpoint persisted in `verification_progress`.
 *  Scratch state for an IN-FLIGHT run only — cleared the moment a terminal
 *  outcome is applied (`applyVerificationOutcome`, above). */
export interface VerificationProgress {
  phase: VerificationPhase;
  seedUrl: string;
  resolvedUrl: string | null;
  /** Populated once `discover-candidates` completes; capped at
   *  `MAX_DOCUMENTS_TO_INSPECT` the same way the one-shot loop already
   *  slices its candidate list — never re-sliced per step. */
  candidates: DocumentCandidate[] | null;
  candidateIndex: number;
  candidatesFound: number;
  documentsInspected: number;
  startedAt: string;
}

function isVerificationProgress(v: unknown): v is VerificationProgress {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    (p.phase === 'resolve-seed' || p.phase === 'discover-candidates' || p.phase === 'fetch-document') &&
    typeof p.seedUrl === 'string' &&
    (p.resolvedUrl === null || typeof p.resolvedUrl === 'string') &&
    (p.candidates === null || Array.isArray(p.candidates)) &&
    typeof p.candidateIndex === 'number' &&
    typeof p.candidatesFound === 'number' &&
    typeof p.documentsInspected === 'number' &&
    typeof p.startedAt === 'string'
  );
}

export interface VerificationStepDiagnostics {
  institutionName: string;
  phase: VerificationPhase;
  /** The document-candidate cursor — `0` for `resolve-seed`/
   *  `discover-candidates`, the index into `candidates` for
   *  `fetch-document`. */
  cursor: number;
  elapsedMs: number;
  /** Always 0 or 1 — this step performs AT MOST one external network
   *  operation. 0 only when the row could not be read at all (no external
   *  work was ever attempted). */
  externalCallsAttempted: number;
}

export type VerificationStepResult =
  | { ok: true; status: 'in-progress'; domain: string; pillarKey: string; institutionName: string; diagnostics: VerificationStepDiagnostics }
  | { ok: true; status: VerificationStatus; domain: string; pillarKey: string; institutionName: string; outcome: VerificationOutcome; diagnostics: VerificationStepDiagnostics }
  | { ok: false; domain: string; pillarKey: string; institutionName: string; error: string };

type PhaseWorkResult =
  | { terminal: true; status: VerificationStatus; detail: string; documentsInspected: number; qualifyingDocuments: QualifyingDocument[] }
  | { terminal: false; next: Partial<VerificationProgress> };

/** Dispatches to the ONE bounded external operation `progress.phase` names.
 *  Never a loop over multiple operations — that is precisely the property
 *  that makes each call boundable. */
async function runOnePhase(progress: VerificationProgress, deps: VerificationDeps): Promise<PhaseWorkResult> {
  switch (progress.phase) {
    case 'resolve-seed': {
      const r = await resolveSeedPhase(progress.seedUrl, deps);
      if (r.terminal) return { terminal: true, status: r.status, detail: r.detail, documentsInspected: 0, qualifyingDocuments: [] };
      return { terminal: false, next: { phase: 'discover-candidates', resolvedUrl: r.resolvedUrl } };
    }
    case 'discover-candidates': {
      // Guarded defensively (never reachable via the normal phase sequence,
      // which always sets resolvedUrl before advancing here) — fails
      // closed rather than crashing on a malformed/tampered checkpoint.
      if (!progress.resolvedUrl) {
        return { terminal: true, status: 'verification_failed', detail: 'internal: discover-candidates reached with no resolved URL', documentsInspected: 0, qualifyingDocuments: [] };
      }
      const r = await discoverCandidatesPhase(progress.resolvedUrl, deps);
      if (r.terminal) return { terminal: true, status: r.status, detail: r.detail, documentsInspected: 0, qualifyingDocuments: [] };
      return {
        terminal: false,
        next: { phase: 'fetch-document', candidates: r.candidates.slice(0, MAX_DOCUMENTS_TO_INSPECT), candidatesFound: r.candidatesFound, candidateIndex: 0 },
      };
    }
    case 'fetch-document': {
      const candidates = progress.candidates ?? [];
      const idx = progress.candidateIndex;
      if (idx >= candidates.length) {
        return {
          terminal: true, status: 'insufficient_corpus', documentsInspected: progress.documentsInspected, qualifyingDocuments: [],
          detail: `${progress.documentsInspected} candidate document(s) inspected, none passed the Corpus Qualification Standard`,
        };
      }
      const result = await inspectCandidatePhase(candidates[idx], deps);
      const documentsInspected = progress.documentsInspected + 1;
      if (result.qualifies) {
        return {
          terminal: true, status: 'verified', documentsInspected, qualifyingDocuments: [result.document],
          detail: 'all four conjuncts satisfied — resolved, candidate(s) discovered, one qualifying document recorded with content hash',
        };
      }
      // Not the LAST candidate yet — advance the cursor and continue on the
      // NEXT call. The last candidate's failure is handled by the
      // `idx >= candidates.length` branch above on the call AFTER this one,
      // so `documentsInspected`'s final value always matches how many were
      // actually attempted (same accounting the one-shot loop produces).
      return { terminal: false, next: { phase: 'fetch-document', candidateIndex: idx + 1, documentsInspected } };
    }
  }
}

/**
 * THE ONE BOUNDED VERIFICATION STEP a Copilot/Track 2 acquisition loop
 * actually drives. Performs EXACTLY the phase named by the institution's
 * persisted `verification_progress` (starting a fresh run at `resolve-seed`
 * if none exists), races that ONE external operation against `deadlineMs`,
 * persists the resulting progress (or applies the terminal outcome), and
 * returns a structured result — `status: 'in-progress'` with the SAME
 * phase/cursor unchanged if the deadline won the race (never an empty 504;
 * the orphaned call is left to finish or be recycled with the Lambda,
 * logged forensically, never awaited — the established
 * `crystalAcquisitionPrecondition.ts` discipline).
 */
export async function runVerificationStep(
  admin: SupabaseClient,
  key: { domain: string; pillarKey: string; institutionName: string },
  deps: VerificationDeps = REAL_DEPS,
  deadlineMs: number = VERIFICATION_STEP_DEADLINE_MS,
): Promise<VerificationStepResult> {
  const { domain, pillarKey, institutionName } = key;
  const stepStartedAt = Date.now();

  const { data, error } = await admin
    .from(TABLE)
    .select('seed_url, verification_status, verification_progress')
    .eq('domain', domain).eq('pillar_key', pillarKey).eq('institution_name', institutionName)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, domain, pillarKey, institutionName, error: error?.message ?? `no institution '${institutionName}' found for pillar '${pillarKey}' in '${domain}'` };
  }

  const current: VerificationStatus = isVerificationStatus(data.verification_status) ? data.verification_status : 'proposed';
  let progress = isVerificationProgress(data.verification_progress) ? data.verification_progress : null;

  if (!progress) {
    if (!isVerificationTransitionAllowed(current, 'pending_verification')) {
      return { ok: false, domain, pillarKey, institutionName, error: `cannot start verification from '${current}' — re-open the entry first` };
    }
    // Same seed-URL backfill `verifyInstitutionEntry` already performs — the
    // SAME curated source of truth, resolved and persisted once, here at
    // the start of a fresh run only (never re-resolved mid-run).
    let seedUrl = (data.seed_url as string | null)?.trim() ?? '';
    if (!seedUrl) {
      const resolved = resolveCanonicalHomepage(institutionName);
      if (resolved) {
        seedUrl = resolved;
        await admin
          .from(TABLE)
          .update({ seed_url: resolved, updated_at: new Date().toISOString() })
          .eq('domain', domain).eq('pillar_key', pillarKey).eq('institution_name', institutionName);
      }
    }
    progress = {
      phase: 'resolve-seed', seedUrl, resolvedUrl: null, candidates: null,
      candidateIndex: 0, candidatesFound: 0, documentsInspected: 0,
      startedAt: new Date().toISOString(),
    };
    await admin
      .from(TABLE)
      .update({ verification_status: 'pending_verification', verification_progress: progress, updated_at: new Date().toISOString() })
      .eq('domain', domain).eq('pillar_key', pillarKey).eq('institution_name', institutionName);
  }

  const activeProgress = progress;
  const workPromise = runOnePhase(activeProgress, deps);
  const raced = await Promise.race([
    workPromise.then((value) => ({ raced: 'completed' as const, value })),
    new Promise<{ raced: 'timeout' }>((resolve) => setTimeout(() => resolve({ raced: 'timeout' }), deadlineMs)),
  ]);
  const elapsedMs = Date.now() - stepStartedAt;
  const diagnostics: VerificationStepDiagnostics = {
    institutionName, phase: activeProgress.phase, cursor: activeProgress.candidateIndex, elapsedMs, externalCallsAttempted: 1,
  };

  if (raced.raced === 'timeout') {
    // eslint-disable-next-line no-console
    console.error(
      `[registry-verification] step for '${institutionName}' (phase '${activeProgress.phase}', cursor ${activeProgress.candidateIndex}) ` +
        `exceeded its ${deadlineMs}ms budget — returning in-progress at the SAME phase/cursor; nothing was written this call. ` +
        'Re-call to retry.',
    );
    // Forensic only, never awaited — the orphaned call is left to finish or
    // be recycled with the Lambda; its eventual outcome is logged purely
    // for diagnosis of which external operation was actually slow.
    workPromise
      .then((late) =>
        // eslint-disable-next-line no-console
        console.error(`[registry-verification] the timed-out step for '${institutionName}' later completed: ${late.terminal ? late.status : 'advanced to ' + late.next.phase}.`),
      )
      .catch((err: unknown) =>
        // eslint-disable-next-line no-console
        console.error(`[registry-verification] the timed-out step for '${institutionName}' later threw: ${err instanceof Error ? err.message : String(err)}`),
      );
    return { ok: true, status: 'in-progress', domain, pillarKey, institutionName, diagnostics };
  }

  const result = raced.value;
  if (result.terminal) {
    const outcome: VerificationOutcome = {
      status: result.status,
      resolvedUrl: activeProgress.resolvedUrl,
      checkedAt: new Date().toISOString(),
      candidatesFound: activeProgress.candidatesFound,
      documentsInspected: result.documentsInspected,
      qualifyingDocuments: result.qualifyingDocuments,
      standard: CORPUS_QUALIFICATION_STANDARD_STATEMENT,
      detail: result.detail,
    };
    const applied = await applyVerificationOutcome(admin, key, 'pending_verification', outcome);
    if (!applied.ok) return { ok: false, domain, pillarKey, institutionName, error: applied.error };
    return { ok: true, status: outcome.status, domain, pillarKey, institutionName, outcome, diagnostics };
  }

  const nextProgress: VerificationProgress = { ...activeProgress, ...result.next };
  await admin
    .from(TABLE)
    .update({ verification_progress: nextProgress, updated_at: new Date().toISOString() })
    .eq('domain', domain).eq('pillar_key', pillarKey).eq('institution_name', institutionName);
  return { ok: true, status: 'in-progress', domain, pillarKey, institutionName, diagnostics };
}

/**
 * Verify one registry entry end-to-end: move it to `pending_verification`,
 * run the four conjuncts against its seed URL, record the outcome.
 *
 * Deliberately does NOT require the entry to be ratified — verification is
 * evidence a steward reads BEFORE ratifying, so requiring ratification first
 * would make the two gates circular.
 */
export async function verifyInstitutionEntry(
  admin: SupabaseClient,
  input: { domain: string; pillarKey: string; institutionName: string },
  deps: VerificationDeps = REAL_DEPS,
): Promise<VerifyEntryResult> {
  const { domain, pillarKey, institutionName } = input;
  const base = { domain, pillarKey, institutionName };

  const { data, error } = await admin
    .from('corpus_institutional_registry')
    .select('seed_url, verification_status')
    .eq('domain', domain)
    .eq('pillar_key', pillarKey)
    .eq('institution_name', institutionName)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, ...base, error: error?.message ?? `no institution '${institutionName}' found for pillar '${pillarKey}' in '${domain}'` };
  }

  const current: VerificationStatus = isVerificationStatus(data.verification_status) ? data.verification_status : 'proposed';
  if (!isVerificationTransitionAllowed(current, 'pending_verification')) {
    return { ok: false, ...base, error: `cannot start verification from '${current}' — re-open the entry first` };
  }

  // RESOLVE THE SEED URL HERE, not only in getDomainConstitution.
  //
  // Found 2026-07-28: all 40 commercialisation entries returned
  // `verification_failed` with detail 'no seed URL to verify', because the
  // migrations that seeded the registry never wrote `seed_url`, and the
  // backfill from the curated homepage registry lived ONLY inside
  // `getDomainConstitution` — a read path this function never calls. So
  // verification silently depended on a steward having opened the UI tab
  // first. That is a latent ordering dependency between two functions with
  // no stated contract between them (CB-1: the mechanism existed and could
  // not fire on the path that needed it).
  //
  // Resolving from `resolveCanonicalHomepage` rather than importing
  // `ensureInstitutionSeedUrl` avoids a circular import
  // (domainConstitution already imports this module) while using the SAME
  // curated source of truth — never a search API, never a guess. The
  // resolved value is PERSISTED, so it becomes auditable provenance on the
  // row rather than a runtime-only fallback that vanishes after the call.
  let seedUrl = (data.seed_url as string | null)?.trim() ?? '';
  if (!seedUrl) {
    const resolved = resolveCanonicalHomepage(institutionName);
    if (resolved) {
      seedUrl = resolved;
      await admin
        .from('corpus_institutional_registry')
        .update({ seed_url: resolved, updated_at: new Date().toISOString() })
        .eq('domain', domain).eq('pillar_key', pillarKey).eq('institution_name', institutionName);
    }
  }

  await admin
    .from('corpus_institutional_registry')
    .update({ verification_status: 'pending_verification', updated_at: new Date().toISOString() })
    .eq('domain', domain).eq('pillar_key', pillarKey).eq('institution_name', institutionName);

  const outcome = await runVerification(seedUrl, deps);
  const applied = await applyVerificationOutcome(admin, input, 'pending_verification', outcome);
  if (!applied.ok) return { ok: false, ...base, seedUrl, outcome, error: applied.error };

  return { ok: true, ...base, seedUrl, outcome };
}

export interface VerifyDomainResult {
  ok: boolean;
  domain: string;
  attempted: number;
  verified: number;
  perEntry: VerifyEntryResult[];
}

/** Verify every registry entry in a domain, sequentially — one action for a
 *  whole registry, mirroring `runDiscoveryForDomain`'s shape. */
export async function verifyDomainRegistry(
  admin: SupabaseClient,
  domain: string,
  deps: VerificationDeps = REAL_DEPS,
): Promise<VerifyDomainResult> {
  const { data } = await admin
    .from('corpus_institutional_registry')
    .select('pillar_key, institution_name')
    .eq('domain', domain)
    .order('institution_name', { ascending: true });

  const rows = (data ?? []) as { pillar_key: string; institution_name: string }[];
  const perEntry: VerifyEntryResult[] = [];
  for (const row of rows) {
    perEntry.push(await verifyInstitutionEntry(admin, { domain, pillarKey: row.pillar_key, institutionName: row.institution_name }, deps));
  }
  return {
    ok: true,
    domain,
    attempted: rows.length,
    verified: perEntry.filter((r) => r.outcome?.status === 'verified').length,
    perEntry,
  };
}
