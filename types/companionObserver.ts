/**
 * metaMe Companion — Observer capability-grant contract (PRD-MMC-001 §4,
 * Phase 2; PRD-MMC-IMPL-001 Increment 1, RATIFIED 2026-07-23).
 *
 * Canonical sources:
 *   codexes/packs/irl/foundation/PRD-MMC-001_metame-companion.md (§4.1's
 *   capability-grant table)
 *   codexes/packs/agentiq/updates/2026-07-23_prd-mmc-impl-001-companion-phase2-implementation-plan.md
 *   (Increment 1)
 *
 * A NEW, SIBLING file to `types/companion.ts` — deliberately not an edit to
 * that file. `types/companion.ts`'s own header states its Phase 0/1 contract
 * "deliberately OMITS" browser-observation fields "so no Phase 0/1 surface
 * can carry observation data even accidentally," and `tests/companion-runtime.test.ts`
 * greps that file's source for the absence of exactly those fields. Adding
 * observation types to `types/companion.ts` in place would require rewriting
 * that existing, already-ratified canary as part of this pass — this sibling
 * file keeps it correct and unchanged, and gives Phase 2 its own type module
 * with its own canary (`tests/companion-observer.test.ts`).
 *
 * TIER DISCIPLINE (browser-bound module — T1/T2 ONLY):
 * This file may be serialised to a browser surface (it is the T1/T2 grant
 * state a client renders and a consent-management UI operates on).
 * Therefore NO T0 identifier may appear in any shape in this file: no
 * `personaId`, no `authProfileId`, no `rootDid`, no `kybeAttestation`, no
 * cross-persona `fioHandle`. A grant record identifies WHAT is granted, never
 * WHO the persona is — persona scoping happens at the API-route layer
 * (`app/api/companion/observer/grants/*`, Increment 2), which resolves the
 * caller via the spine and stores/reads grants keyed server-side. Enforced
 * by `tests/companion-observer.test.ts` (canary).
 *
 * IDENTITY-ONLY IS NOT A MEMBER OF `ObserverCapability`. Per PRD §4.1's own
 * table, "identity-only" is the always-on Phase 0/1 baseline ("Continue with
 * Polity Passport", persona display — no page reading) — it is not an
 * observation capability that can be granted or revoked, so it has no row
 * here, mirroring the PRD table's own "n/a (baseline)" annotation.
 */

// ─── The seven grantable Observer capabilities (PRD §4.1) ──────────────────

/**
 * Every observation capability the Observer may ever request, beyond the
 * always-on identity-only baseline. Each is OFF by default, granted
 * per-capability, explicitly, and revocably (PRD §4.1) — never a blanket
 * install permission.
 */
export type ObserverCapability =
  | 'current-tab'   // Observe the active tab's domain/URL/title only
  | 'selection'     // Read the user's explicit text selection
  | 'page-document' // Read the current page/document body for capture/help
  | 'downloads'     // Access a file the user is downloading
  | 'clipboard'     // Read/write clipboard on explicit action
  | 'notifications' // Deliver constitutional notifications
  | 'history';      // Observe navigation history for continuity — most
                     // sensitive; strongest warning (PRD §4.1)

/** Every `ObserverCapability` value, for exhaustive iteration (UI rendering,
 *  parity canaries). Keep in the same order as the PRD §4.1 table. */
export const OBSERVER_CAPABILITIES: readonly ObserverCapability[] = [
  'current-tab',
  'selection',
  'page-document',
  'downloads',
  'clipboard',
  'notifications',
  'history',
] as const;

/**
 * A grant's scope. Per PRD §4.1's own "Revocable" column annotations, only
 * `current-tab` ("per-site + global") and `page-document` ("per-site") ever
 * carry site-scoped grants — every other capability is global-only. This is
 * enforced by `SCOPE_SUPPORT` below, not left to caller convention.
 */
export type ObserverCapabilityScope = 'global' | 'site';

/** Which scopes each capability supports — the single source of truth for
 *  the PRD §4.1 table's scope column. A capability absent from the
 *  `'site'`-supporting set is global-only; requesting a `'site'` grant for
 *  it is a caller error (enforced at the API layer, Increment 2). */
export const SCOPE_SUPPORT: Record<ObserverCapability, readonly ObserverCapabilityScope[]> = {
  'current-tab': ['global', 'site'],
  'selection': ['global'],
  'page-document': ['global', 'site'],
  'downloads': ['global'],
  'clipboard': ['global'],
  'notifications': ['global'],
  'history': ['global'],
};

// ─── A single grant record ──────────────────────────────────────────────────

/**
 * One capability grant. Never deleted on revoke — `revokedAt` is set instead,
 * preserving an audit trail (mirroring the DVN pipeline's own "never silently
 * drop, always record state" discipline, applied here to consent rather than
 * receipts).
 */
export interface ObserverCapabilityGrant {
  capability: ObserverCapability;
  scope: ObserverCapabilityScope;
  /** Present only for `scope: 'site'` grants — the domain the grant applies
   *  to. Absent (undefined) for `scope: 'global'` grants. */
  siteDomain?: string;
  /** ISO timestamp the grant was created. */
  grantedAt: string;
  /** ISO timestamp the grant was revoked, if it has been. Unset = active. */
  revokedAt?: string;
}

/**
 * The full grant-state map for a persona: every `ObserverCapability` maps to
 * an array of grant records (site-scoped capabilities may have many; global
 * capabilities have at most one meaningful active entry, but the shape stays
 * an array uniformly rather than special-casing). An EMPTY array — never a
 * `false` boolean — represents "never granted," mirroring `types/companion.ts`'s
 * own "deliberately absent, not merely optional" discipline: a Phase 1-era
 * caller that never populates this map trivially satisfies "nothing granted"
 * with no special handling required.
 */
export type ObserverGrantState = Record<ObserverCapability, ObserverCapabilityGrant[]>;

/** An empty grant state — every capability ungranted. The correct default
 *  for a persona who has never interacted with the consent UI. */
export function emptyObserverGrantState(): ObserverGrantState {
  const state = {} as ObserverGrantState;
  for (const capability of OBSERVER_CAPABILITIES) {
    state[capability] = [];
  }
  return state;
}

// ─── Context Engine input contract (PRD-MMC-IMPL-001 Increment 3) ──────────

/**
 * Max length, in characters, of `pageDocumentExcerpt` below. This is a page
 * EXCERPT for grounding, never the full raw DOM — the minimum-disclosure
 * discipline PRD-MMC-001 §0.9/§4.2 requires. 2,000 chars is the documented
 * floor; a constructing caller MUST NOT exceed it.
 */
export const PAGE_DOCUMENT_EXCERPT_MAX_CHARS = 2000;

/**
 * The shape of a single "browser context" observation — what a future
 * extension's content script would populate and hand to the Context Engine
 * (`services/companion/observerContext.ts`) before it feeds the existing,
 * unmodified IRE (`resolveConstitutionalField`, `services/invariants/resolution.ts`).
 *
 * CONSENT DISCIPLINE (enforced at runtime, not by this type): every optional
 * field below corresponds to exactly one `ObserverCapability` and MUST be
 * populated ONLY when that capability is present and unrevoked in
 * `grantedCapabilities` (i.e. `isCapabilityGranted` on the caller's
 * `ObserverGrantState` returns true for it):
 *
 *   - `currentTabDomain`, `currentTabTitle` ⟶ requires `'current-tab'`
 *   - `selectionText`                        ⟶ requires `'selection'`
 *   - `pageDocumentExcerpt`                  ⟶ requires `'page-document'`
 *
 * TypeScript cannot express "field X present iff capability Y is granted" —
 * there is no type-level enforcement of this rule. The enforcement point is
 * `assertObservationRespectsGrants` (`services/companion/observerContext.ts`),
 * which every caller MUST invoke before using an observation for anything.
 * An observation object that violates this discipline is a caller bug, not a
 * type error — treat it with the same seriousness as a T0 leak.
 *
 * MINIMUM DISCLOSURE: `pageDocumentExcerpt` MUST be capped at
 * `PAGE_DOCUMENT_EXCERPT_MAX_CHARS` (2,000 chars) — this is a page excerpt for
 * grounding purposes, never the full raw DOM.
 *
 * NO REAL PRODUCER EXISTS YET: nothing in this codebase currently constructs
 * a live `BrowserContextObservation` from an actual page — that is the job of
 * a future, environment-specific browser-extension pass (PRD-MMC-IMPL-001 §4)
 * which cannot be built or verified in this sandbox. This type is the
 * contract that pass must satisfy, not a claim that it exists.
 */
export interface BrowserContextObservation {
  /** The capabilities this observation's populated fields were derived under
   *  — the exact snapshot `assertObservationRespectsGrants` checks against. */
  grantedCapabilities: ObserverCapability[];
  /** Requires `'current-tab'`. The active tab's domain only — never the full URL. */
  currentTabDomain?: string;
  /** Requires `'current-tab'`. The active tab's page title. */
  currentTabTitle?: string;
  /** Requires `'selection'`. The user's explicit text selection only. */
  selectionText?: string;
  /** Requires `'page-document'`. A page excerpt, capped at
   *  `PAGE_DOCUMENT_EXCERPT_MAX_CHARS` — never the full raw DOM. */
  pageDocumentExcerpt?: string;
  /** ISO timestamp the observation was captured. */
  observedAt: string;
}
