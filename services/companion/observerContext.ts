/**
 * metaMe Companion — Context Engine input contract (PRD-MMC-001 §0.4, §6
 * Phase 2; PRD-MMC-IMPL-001 Increment 3, RATIFIED 2026-07-23).
 *
 * This module composes a `BrowserContextObservation` (`types/companionObserver.ts`)
 * into arguments for the EXISTING, UNMODIFIED Invariant Resolution Engine
 * entry point — `resolveConstitutionalField` in `services/invariants/resolution.ts`.
 * It does not reimplement any of that engine's five phases, and it does not
 * modify `services/invariants/grounding.ts`'s `GroundingContext` shape.
 *
 * The composition this module exists to make possible, stated explicitly:
 *
 *   resolveConstitutionalField(
 *     buildObserverIntentText(observation, userIntent),
 *     toGroundingContext(observation),
 *   )
 *
 * — a call to the SAME engine every other caller uses, fed a new,
 * browser-derived input source. No second grounding engine, no new IRE
 * parameter, no change to `resolveConstitutionalField`'s signature.
 *
 * NO REAL PRODUCER EXISTS YET: nothing in this module constructs a live
 * `BrowserContextObservation` from an actual browser tab. That is the job of
 * a future, environment-specific browser-extension pass (PRD-MMC-IMPL-001
 * §4) which cannot be built or verified in this sandbox. This module is not
 * wired into any UI, copilot, or SmartTriad surface — that wiring depends on
 * a real observation source existing, and is explicitly out of scope here.
 *
 * Pure / no I/O in this file: no fetch, no Supabase client, no React.
 */

import type { GroundingContext } from '@/services/invariants/grounding';
import { isCapabilityGranted } from '@/services/companion/observerConsent';
import type {
  BrowserContextObservation,
  ObserverCapability,
  ObserverGrantState,
} from '@/types/companionObserver';

// ─────────────────────────────────────────────────────────────────────────
// The consent-enforcement choke point
// ─────────────────────────────────────────────────────────────────────────

/**
 * Throws if any POPULATED field on `observation` corresponds to a capability
 * that is not currently granted (per `isCapabilityGranted`, Increment 1) in
 * `state`. This is the runtime enforcement point the type system cannot
 * provide (`BrowserContextObservation`'s own doc comment names this exact
 * gap) — every caller MUST pass an observation through this function before
 * using it for anything, including before calling `toGroundingContext` or
 * `buildObserverIntentText` below.
 *
 * `siteDomain` is passed through to `isCapabilityGranted` from the
 * observation's own `currentTabDomain` when present, so a site-scoped grant
 * (e.g. `'current-tab'` or `'page-document'` granted only for
 * `example.com`) is checked against the domain the observation actually
 * claims to be from — not just "granted somewhere, for some site."
 */
export function assertObservationRespectsGrants(
  observation: BrowserContextObservation,
  state: ObserverGrantState,
): void {
  const siteDomain = observation.currentTabDomain;

  const checks: Array<{ populated: boolean; capability: ObserverCapability; field: string }> = [
    {
      populated: observation.currentTabDomain !== undefined,
      capability: 'current-tab',
      field: 'currentTabDomain',
    },
    {
      populated: observation.currentTabTitle !== undefined,
      capability: 'current-tab',
      field: 'currentTabTitle',
    },
    {
      populated: observation.selectionText !== undefined,
      capability: 'selection',
      field: 'selectionText',
    },
    {
      populated: observation.pageDocumentExcerpt !== undefined,
      capability: 'page-document',
      field: 'pageDocumentExcerpt',
    },
  ];

  for (const check of checks) {
    if (!check.populated) continue;
    if (!isCapabilityGranted(state, check.capability, siteDomain)) {
      throw new Error(
        `assertObservationRespectsGrants: observation field '${check.field}' is populated but ` +
          `capability '${check.capability}' is not currently granted` +
          (siteDomain ? ` for site '${siteDomain}'` : '') +
          '. Observed, never asserted — refusing to use this observation.',
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Pure mapping into the existing IRE's GroundingContext
// ─────────────────────────────────────────────────────────────────────────

/**
 * Maps a `BrowserContextObservation` onto the EXACT, verified
 * `GroundingContext` shape (`services/invariants/grounding.ts`:
 * `{ domains?: string[]; ontologyClassIds?: string[]; namespaces?: InvariantNamespace[];
 * statuses?: InvariantStatus[]; limit?: number }`). Only `domains` has a
 * corresponding browser-observed signal today (`currentTabDomain`) — this
 * function deliberately does NOT invent new `GroundingContext` fields for
 * `selectionText` or `pageDocumentExcerpt`; there is no existing IRE input
 * slot for page/selection content, so those signals are not represented in
 * the mapping (an honest limit, not silently worked around by changing
 * `grounding.ts`).
 *
 * Returns `{}` when no domain signal exists on the observation.
 */
export function toGroundingContext(
  observation: BrowserContextObservation,
): Partial<GroundingContext> {
  if (!observation.currentTabDomain) return {};
  return { domains: [observation.currentTabDomain] };
}

// ─────────────────────────────────────────────────────────────────────────
// Intent text composition — "observed, never asserted"
// ─────────────────────────────────────────────────────────────────────────

/**
 * Composes the text `resolveConstitutionalField`'s first parameter needs.
 *
 * CRITICAL — "observed, never asserted" (PRD-MMC-001 §4.2): this function
 * PREFERS `userTypedIntent` when present. When it is NOT present, it returns
 * an EMPTY STRING — it never synthesizes a usable intent string from
 * `currentTabTitle` or `selectionText` alone. The Context Engine must never
 * self-trigger a constitutional resolution from passive observation; an
 * Observer "offer" is always human-initiated. An empty string passed to
 * `resolveConstitutionalField` qualifies to nothing actionable (Phase 1
 * "Qualify" extracts no field from empty text) — it is the honest
 * non-actionable signal, not a workaround.
 *
 * If a synthesized fallback string is ever useful for some OTHER downstream
 * purpose (e.g. a future SmartTriad "offer" surface suggesting "help me with
 * this page" as a prompt the human can then choose to send), that must be a
 * DIFFERENT function or a clearly separate code path — never the default
 * behavior here when `userTypedIntent` is absent. No such function exists in
 * this increment; it is out of scope (PRD-MMC-IMPL-001 §2 Increment 3 non-goals).
 */
export function buildObserverIntentText(
  observation: BrowserContextObservation,
  userTypedIntent?: string,
): string {
  if (userTypedIntent && userTypedIntent.trim().length > 0) {
    return userTypedIntent;
  }
  return '';
}
