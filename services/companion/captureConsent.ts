/**
 * metaMe Companion — Capture consent gate (SPEC-MMC-001 §3 Movement I;
 * PRD-MMC-IMPL-003 Increment 1, DESIGN — awaiting operator ratification).
 *
 * Mirrors `services/companion/observerContext.ts`'s `assertObservationRespectsGrants`
 * exactly — a sibling assertion for a sibling payload shape, reusing the SAME
 * `ObserverGrantState` / `isCapabilityGranted` primitives from Phase 2
 * (`services/companion/observerConsent.ts`), never a second consent model.
 *
 * Called twice, same double-gate discipline as the Observer's own consent
 * check: once client-side in the extension's background worker (pre-check,
 * Increment 4) and once server-side in the capture ingest route (Increment
 * 2), re-validated against the persona's real, DB-stored grant state —
 * never trusting a client-claimed grant.
 *
 * Pure / no I/O in this file: no fetch, no Supabase client, no React.
 */

import { isCapabilityGranted } from '@/services/companion/observerConsent';
import type { ObserverGrantState } from '@/types/companionObserver';
import { SOURCE_KIND_TO_CAPABILITY, type CapturedObject } from '@/types/companionCapture';

/**
 * Throws unless the capability `SOURCE_KIND_TO_CAPABILITY` maps `capture.sourceKind`
 * to is currently granted (per `isCapabilityGranted`) in `state`. This is the
 * consent-enforcement choke point every caller MUST pass a capture through
 * before it is persisted, POSTed, or used for anything else — the same
 * "observed, never asserted" discipline `assertObservationRespectsGrants`
 * already enforces for the Observer's lighter-weight context snapshots,
 * applied here to a durable capture payload.
 *
 * `siteDomain` scopes a site-scoped grant check (mirroring
 * `assertObservationRespectsGrants`'s identical parameter) — pass the
 * captured object's own source domain when known (e.g. derived from
 * `capture.sourceUrl`) so a `'site'`-scoped `'page-document'`/`'current-tab'`
 * grant for `example.com` is checked against the domain the capture actually
 * claims to be from, not just "granted somewhere, for some site."
 */
export function assertCaptureRespectsGrants(
  capture: Pick<CapturedObject, 'sourceKind'>,
  state: ObserverGrantState,
  siteDomain?: string,
): void {
  const capability = SOURCE_KIND_TO_CAPABILITY[capture.sourceKind];
  if (!isCapabilityGranted(state, capability, siteDomain)) {
    throw new Error(
      `assertCaptureRespectsGrants: capture sourceKind '${capture.sourceKind}' requires capability ` +
        `'${capability}', which is not currently granted` +
        (siteDomain ? ` for site '${siteDomain}'` : '') +
        '. Recognition is not enough on its own — refusing to constitutionalize this capture.',
    );
  }
}
