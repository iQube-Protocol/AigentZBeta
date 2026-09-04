/**
 * Shared error-to-HTTP-response mapping for the Factor/Aegis API routes
 * (Phase 2, spec/moneypenny-mpy2-3). Every route in app/api/moneypenny/
 * factor/* and app/api/moneypenny/aegis/* funnels its catch block through
 * this ONE function rather than hand-rolling a status per route — the
 * service-layer error `.code` values (FactorCaseTransitionError,
 * AegisAssessmentError, AuthorityChainError, AdmissionAuthorityError,
 * StandingProposalError) are the single source of truth for what each
 * refusal means; this file only decides which HTTP status best carries
 * that meaning, it never re-derives the refusal reason itself.
 */

import { NextResponse } from 'next/server';

interface CodedError {
  code: string;
  message: string;
}

function isCodedError(err: unknown): err is CodedError {
  return typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code: unknown }).code === 'string';
}

const NOT_FOUND_CODES = new Set(['case-not-found', 'chain-not-found', 'assessment-not-found']);
const FORBIDDEN_CODES = new Set([
  'cross-tenant-denied',
  'cross-principal-denied',
  'self-assessment-refused',
  'admission-requires-moneypenny-authority',
  'no-active-delegation-grant',
  'subdelegation-not-permitted',
]);
const CONFLICT_CODES = new Set(['concurrent-transition']);

export function respondError(err: unknown, fallbackStatus = 500): NextResponse {
  if (isCodedError(err)) {
    const status = NOT_FOUND_CODES.has(err.code) ? 404 : FORBIDDEN_CODES.has(err.code) ? 403 : CONFLICT_CODES.has(err.code) ? 409 : 400;
    return NextResponse.json({ ok: false, error: err.code, detail: err.message }, { status });
  }
  return NextResponse.json(
    { ok: false, error: 'internal-error', detail: err instanceof Error ? err.message : String(err) },
    { status: fallbackStatus },
  );
}

/** Every route resolves tenantId the same way: an optional body/query
 *  field, defaulting to 'default' — the SAME default factorCaseService.ts's
 *  createOrResumeCase already applies. No per-persona tenant mapping exists
 *  yet in this codebase (tenant_id is a forward-looking multi-org concept,
 *  not yet bound to any real org identity) — inventing one here would
 *  violate CLAUDE.md's No-Guessing rule, so every route accepts an explicit
 *  tenantId and falls back to the same literal default the schema itself
 *  uses, rather than fabricating a persona->tenant derivation. */
export function resolveTenantId(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : 'default';
}
