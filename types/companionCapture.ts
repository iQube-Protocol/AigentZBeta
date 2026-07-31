/**
 * metaMe Companion — Capture contract (SPEC-MMC-001 §3 Movement I;
 * PRD-MMC-IMPL-003 Increment 1, DESIGN — awaiting operator ratification).
 *
 * Canonical sources:
 *   codexes/packs/irl/foundation/SPEC-MMC-001_constitutional-flow.md (§3
 *   Movement I — Capture; §9 "Pull Across")
 *   codexes/packs/agentiq/updates/2026-07-23_prd-mmc-impl-003-companion-phase4-capture-implementation-plan.md
 *   (Increment 1, §0.8's naming distinction and governing invariant)
 *
 * NAMING: capture is the interaction (a human recognizing "this matters");
 * constitutionalization is the operation (this thing durably becomes an
 * object within the runtime). This type describes the payload of the
 * INTERACTION — it is not itself the constitutional object. The Workspace
 * Inbox row Increment 2 persists from this payload is where constitution
 * actually happens (PRD-MMC-IMPL-003 §0.8).
 *
 * A NEW, SIBLING file to `types/companionObserver.ts` — deliberately not an
 * edit to that file. `BrowserContextObservation` is a lightweight,
 * excerpt-capped (2,000 char) context snapshot for grounding; a capture is a
 * durable, larger, source-attributed payload meant to become a real
 * constitutional object. Different data shape, different persistence model,
 * same consent discipline — a sibling module, not an extension of the
 * Observer's existing type.
 *
 * TIER DISCIPLINE (browser-bound module — T1/T2 ONLY): same as
 * `types/companionObserver.ts`. This file may be serialised to a browser
 * surface. NO T0 identifier may appear anywhere in it: no `personaId`, no
 * `authProfileId`, no `rootDid`, no `kybeAttestation`, no cross-persona
 * `fioHandle`. Persona scoping happens at the API-route layer
 * (`app/api/companion/capture/*`, Increment 2), never in this type.
 */

import type { ObserverCapability } from '@/types/companionObserver';

// ─── Source kinds this pass supports ────────────────────────────────────────

/**
 * What kind of Legacy-Internet object is being captured. Deliberately a
 * small, generic-webpage-shaped set for this pass — email/GitHub-issue/
 * Slack/AI-conversation sources are named in SPEC-MMC-001 §3/§6 but are
 * explicitly out of scope here (PRD-MMC-IMPL-003 §1 non-goals); they would
 * need app-specific DOM knowledge this generic set doesn't have. The union
 * is written so adding a source kind later is additive, not breaking.
 */
export type CaptureSourceKind = 'webpage' | 'selection' | 'pdf' | 'image';

/** Every `CaptureSourceKind` value, for exhaustive iteration (UI rendering,
 *  parity canaries). */
export const CAPTURE_SOURCE_KINDS: readonly CaptureSourceKind[] = [
  'webpage',
  'selection',
  'pdf',
  'image',
] as const;

/**
 * Which existing `ObserverCapability` a given source kind's read requires.
 * The single source of truth for that mapping — never left to caller
 * convention. Reuses Phase 2's `ObserverCapability` union unmodified; no new
 * capability type is introduced for Capture. Notably: `'pdf'` maps to
 * `'downloads'`, a capability Phase 2 already modeled but which nothing in
 * the codebase consumed until this mapping (PRD-MMC-IMPL-003 §0.4).
 */
export const SOURCE_KIND_TO_CAPABILITY: Record<CaptureSourceKind, ObserverCapability> = {
  webpage: 'page-document',
  selection: 'selection',
  pdf: 'downloads',
  image: 'page-document',
};

// ─── Content-length ceiling ──────────────────────────────────────────────

/**
 * Max length, in characters, of `contentText` below. Larger than
 * `BrowserContextObservation.pageDocumentExcerpt`'s 2,000-char grounding
 * excerpt (a capture is meant to durably hold a real document/selection/
 * page, not a grounding snippet) but still bounded — never a raw, unbounded
 * DOM/file dump. 20,000 is a build-time tuning proposal, not an
 * architectural ceiling (PRD-MMC-IMPL-003 §5.2) — confirm or adjust when
 * Increment 1 is actually implemented.
 */
export const CAPTURED_CONTENT_MAX_CHARS = 20_000;

// ─── The capture payload (the interaction) ──────────────────────────────

/**
 * The shape of a single capture request — what the extension's context-menu
 * handler (Increment 4) builds and hands to `POST /api/companion/capture`
 * (Increment 2). This is the INTERACTION payload, not the persisted
 * constitutional object — see `CapturedObjectRecord` below for the T1-safe
 * shape a client reads back after constitution has happened.
 *
 * CONSENT DISCIPLINE (enforced at runtime, not by this type, mirroring
 * `BrowserContextObservation`'s identical discipline): `sourceKind` MUST
 * correspond to a currently-granted capability per `SOURCE_KIND_TO_CAPABILITY`
 * — the enforcement point is `assertCaptureRespectsGrants`
 * (`services/companion/captureConsent.ts`), which every caller MUST invoke
 * before this payload is used for anything, including before it is POSTed.
 *
 * `contentText` MUST be capped at `CAPTURED_CONTENT_MAX_CHARS`. For a `'pdf'`
 * source, `contentText` MAY be omitted by the caller — the server-side route
 * (Increment 2/4) derives it from `sourceUrl` via the existing
 * `services/content/pdfExtractionService.ts`, never the extension itself
 * (PRD-MMC-IMPL-003 §0.5).
 */
export interface CapturedObject {
  sourceKind: CaptureSourceKind;
  /** The Legacy-Internet URL this was captured from, when applicable. */
  sourceUrl?: string;
  /** A short title — page title, or a synthesized label for a selection. */
  title?: string;
  /** The captured content. Omitted for a `'pdf'` capture (server-derived).
   *  Capped at `CAPTURED_CONTENT_MAX_CHARS` for every other source kind. */
  contentText?: string;
  /** ISO timestamp the capture interaction occurred. */
  capturedAt: string;
}

// ─── The persisted record (the operation's result) ──────────────────────

/** Where a captured object currently stands — always `'inbox'` on creation
 *  (PRD-MMC-IMPL-003 §0.3's Workspace-inbox-as-universal-landing decision).
 *  `'assigned'` once a quick-action (Intent/Venture) has bound it to a real
 *  destination; `'archived'` for a future dismiss affordance (not built in
 *  this pass — no archive UI exists yet, the status value is reserved so
 *  the schema doesn't need to change when one is added). */
export type CapturedObjectStatus = 'inbox' | 'assigned' | 'archived';

/** The two destinations this pass's assign quick-action supports (§0.3 —
 *  the only two named SPEC-MMC-001 §6 destinations with a real, composable
 *  constructor: `createIntentQube` / `createVentureQube`). */
export type CaptureAssignDestination = 'intent' | 'venture';

/**
 * The T1-safe shape a client reads back — what `GET /api/companion/capture`
 * (Increment 2) returns and `CaptureInboxPanel.tsx` (Increment 3) renders.
 * No `personaId` field, same discipline as `ObserverCapabilityGrant` /
 * `ActivityReceiptRecord`'s own client-facing shapes.
 */
export interface CapturedObjectRecord extends CapturedObject {
  id: string;
  status: CapturedObjectStatus;
  assignedDestination?: CaptureAssignDestination;
  /** The id of the Intent or Venture this capture was assigned to, once
   *  `status` is `'assigned'`. */
  assignedRefId?: string;
}

// ─── Existing-object picker (2026-07-24) ────────────────────────────────
//
// Assign originally only ever created a brand-new Intent/Venture from a
// capture (§0.3's two supported destinations) — there was no way to
// attach a capture to something the persona already has. These are the
// T1-safe shapes `GET /api/companion/capture/destinations` returns for
// that picker; no `personaId` anywhere, same discipline as
// `CapturedObjectRecord` above.

/** One entry in the "attach to an existing Intent" picker list. */
export interface CaptureIntentDestination {
  id: string;
  name: string;
  status: string;
}

/** One entry in the "attach to an existing Venture" picker list. */
export interface CaptureVentureDestination {
  id: string;
  name: string;
  slug: string;
  stage: string;
}
