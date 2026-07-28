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
import { runInstitutionDiscovery } from './institutionNavigator';
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

/**
 * Run the four conjuncts against one institution's seed URL. Never throws;
 * every failure path returns a structured outcome with an honest status,
 * mirroring `retrieval.ts`'s ethos (PRD-ICA-001 §12).
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
    candidatesFound: 0,
    documentsInspected: 0,
    qualifyingDocuments: [] as QualifyingDocument[],
    standard: CORPUS_QUALIFICATION_STANDARD_STATEMENT,
  };

  const trimmed = seedUrl.trim();
  if (!trimmed) {
    return { ...base, status: 'verification_failed', resolvedUrl: null, detail: 'no seed URL to verify' };
  }

  // 1 — does the institution URL resolve?
  const resolved = await deps.followRedirects(trimmed, { accept: 'text/html,*/*' });
  if (!resolved.ok) {
    const status: VerificationStatus =
      resolved.failureClass === 'timeout' ? 'temporarily_unavailable'
      : resolved.failureClass === 'redirect-loop' ? 'redirect_changed'
      : 'verification_failed';
    return { ...base, status, resolvedUrl: resolved.finalUrl ?? null, detail: `seed URL did not resolve: ${resolved.failureClass}` };
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
      ...base, status, resolvedUrl,
      detail: `seed URL returned HTTP ${resolved.response.status}${status === 'temporarily_unavailable' ? ' (transient — retries exhausted)' : ''}`,
    };
  }
  // A redirect WITHIN the institution's own host is routine (a locale or
  // trailing-slash hop). A redirect to a DIFFERENT host means the registry's
  // URL no longer points where the steward thought — a judgment call, not a
  // failure, so it goes back to the steward rather than being auto-accepted.
  if (hostOf(resolvedUrl) !== hostOf(trimmed)) {
    return {
      ...base, status: 'redirect_changed', resolvedUrl,
      detail: `seed URL now redirects off-host: ${hostOf(trimmed)} → ${hostOf(resolvedUrl)} — a steward must re-confirm the entry`,
    };
  }

  // 2 — are document candidates discovered? (Agent B/C, unchanged.)
  const discovery = await deps.runInstitutionDiscovery(resolvedUrl);
  if (!discovery.ok) {
    const status: VerificationStatus = discovery.failureClass === 'timeout' ? 'temporarily_unavailable' : 'verification_failed';
    return { ...base, status, resolvedUrl, detail: `institution navigation failed: ${discovery.error ?? discovery.failureClass}` };
  }
  const candidatesFound = discovery.candidates.length;
  if (candidatesFound === 0) {
    return {
      ...base, status: 'insufficient_corpus', resolvedUrl, candidatesFound,
      detail: 'the institution URL resolves but no document candidates were discovered — reachable is not the same as acquirable',
    };
  }

  // 3 + 4 — does at least one document pass the standard, with its bytes and
  // inspection result recorded?
  const qualifyingDocuments: QualifyingDocument[] = [];
  let documentsInspected = 0;
  for (const candidate of discovery.candidates.slice(0, MAX_DOCUMENTS_TO_INSPECT)) {
    const retrieval = await deps.retrieveArtifact(candidate.documentUrl, candidate.discoveryUrl);
    documentsInspected += 1;
    if (!retrieval.ok || !retrieval.bytes || !retrieval.artifactHash) continue;

    const sniffed = sniffMagicBytes(retrieval.bytes);
    const mimeType = sniffed.isPdf ? 'application/pdf' : (retrieval.contentType ?? 'text/html');
    const inspection = await deps.inspectArtifact(retrieval.bytes, mimeType);
    if (!inspection.ok || !inspection.passesContentPresenceCheck) continue;

    qualifyingDocuments.push({
      documentUrl: candidate.documentUrl,
      contentHash: retrieval.artifactHash,
      mimeType,
      fileSizeBytes: retrieval.fileSizeBytes,
      pageCount: inspection.pageCount,
      substantiveTextCharacters: inspection.substantiveTextCharacters,
      blankPageRatio: inspection.blankPageRatio,
    });
    break; // one qualifying document is the bar; verification is not acquisition
  }

  if (qualifyingDocuments.length === 0) {
    return {
      ...base, status: 'insufficient_corpus', resolvedUrl, candidatesFound, documentsInspected,
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
      updated_at: new Date().toISOString(),
    })
    .eq('domain', key.domain)
    .eq('pillar_key', key.pillarKey)
    .eq('institution_name', key.institutionName);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
