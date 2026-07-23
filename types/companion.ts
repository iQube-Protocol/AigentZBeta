/**
 * metaMe Companion — runtime contract (PRD-MMC-001, RATIFIED 2026-07-22).
 *
 * Canonical source: codexes/packs/irl/foundation/PRD-MMC-001_metame-companion.md
 *
 * The load-bearing architectural decision (PRD §2): ONE Companion runtime,
 * many thin presentation surfaces. A surface renders and captures input; it
 * never re-implements identity resolution, grounding, the copilot, the
 * wallet, the R/T primitive, or the session. This module is the
 * surface-agnostic contract every presentation surface consumes — mirroring
 * how `types/orchestration.ts` anchors the dual-agent model.
 *
 * TIER DISCIPLINE (browser-bound module — T1/T2 ONLY):
 * Every type here may be serialised to a browser surface. Therefore NO T0
 * identifier may appear in any shape in this file: no `personaId`, no
 * `authProfileId`, no `rootDid`, no `kybeAttestation`, no cross-persona
 * `fioHandle`. Identity travels ONLY as the T1 `ActivePersonaSurface`
 * (opaque `personaSessionToken` + display fields) issued by
 * `GET /api/wallet/active-persona`. Enforced by
 * `tests/companion-runtime.test.ts` (canary).
 *
 * PHASE SCOPE (PRD §6): this contract covers Phase 0/1 ONLY — runtime shell,
 * identity surface, deep links (`buildCodexUrl`), user-initiated capture
 * intent shapes, and the Timeline as a READ over existing receipts.
 *
 * >>> NO BROWSER OBSERVATION IN THIS CONTRACT. <<<
 * The Constitutional Observer / Context Engine (PRD components 3, 15) and
 * ALL browser-context fields (current tab, selection, page document,
 * history, clipboard, SessionQube browser-context projection) are Phase 2+,
 * gated on the operator ratifying PRD §4 (progressive per-capability
 * consent, revocation, T0-never-leaves, no off-device browsing data without
 * an explicit grant). They are deliberately OMITTED here — not modelled as
 * optional fields — so no Phase 0/1 surface can carry observation data even
 * accidentally. Add them only in the §4-ratified Phase 2 pass.
 */

import type { ActivePersonaSurface } from '@/types/access';
import type { CodexShell } from '@/utils/codex-nav';

// ─── Presentation surfaces ──────────────────────────────────────────────────

/**
 * The presentation surfaces the runtime serves (PRD §2 diagram). Agentic
 * hosts (Claude / ChatGPT / VS Code) reach the SAME runtime via
 * MCP/Threshold (PRD-THR-001, §0.5) — `mcp-host` names that channel; this
 * contract does not restate the Threshold gateway.
 */
export type CompanionSurfaceKind =
  | 'web-embed'          // Phase 0/1 first surface: /triad/embed/companion
  | 'extension-sidebar'  // Phase 2+ (extension shell; observation gated on §4)
  | 'extension-overlay'  // Phase 2+
  | 'mobile'             // Phase 4
  | 'desktop'            // Phase 4
  | 'vscode'             // Phase 4
  | 'embedded-widget'    // Phase 4
  | 'mcp-host';          // Already served by PRD-THR-001 (Threshold/MCP)

// ─── Identity (T1 — the ONLY identity shape a surface holds) ────────────────

/**
 * Identity context for a Companion surface. This is a REFERENCE to the
 * spine's existing T1 surface — `ActivePersonaSurface` as issued by
 * `GET /api/wallet/active-persona` — not a parallel identity shape
 * (CLAUDE.md "Don't rebuild these"). `null` = unauthenticated; every
 * consumer fails closed.
 *
 * The caller's OWN `ownFioHandle` may be present on the underlying surface
 * (owner self-view, T1-permitted); cross-persona handle resolution is
 * forbidden everywhere.
 */
export type CompanionIdentityContext = ActivePersonaSurface | null;

// ─── Session (REFERENCE to PRD-PAG-001's SessionQube — never a second one) ──

/**
 * Reference to the constitutional session. The SessionQube is DEFINED BY
 * PRD-PAG-001 §4 (the promotion of CFS-024's Session level, composing
 * `personaSessionToken` + `agent_gateway_sessions` +
 * `resolveConstitutionalContext().session`). The Companion NEVER defines a
 * second SessionQube (PRD-MMC-001 §0.1, component 13) — this type carries
 * only an opaque reference plus the T1 expiry the active-persona surface
 * already exposes.
 *
 * INTEGRATION TODO (PRD-PAG-001 §4): when the PAG-001 build lands its
 * SessionQube object, populate `sessionQubeRef` from that seam. Do not
 * import from `services/threshold/*` here — that build is concurrent; this
 * contract composes against its ratified PRD seam, not its in-flight files.
 *
 * Phase 2+ browser-context fields on the SessionQube (applications visited,
 * captured evidence, generated work — PRD component 13) are additive
 * projections owned by the §4-gated pass and are intentionally absent.
 */
export interface CompanionSessionRef {
  /** Opaque T1/T2 reference to the PAG-001 SessionQube. Never a raw UUID
   *  correlatable to a persona; never present before PAG-001 issues it. */
  sessionQubeRef?: string;
  /** Mirror of `ActivePersonaSurface.sessionExpiresAt` (T1). */
  expiresAt?: string;
}

// ─── Deep links (PRD component 11 — EXTENDS `buildCodexUrl`) ────────────────

/**
 * A deep-link dispatch request. Resolved by the runtime via the canonical
 * `buildCodexUrl()` helper (`utils/codex-nav.ts`) — never a second link
 * builder (PRD §0.8; CLAUDE.md "Inter-Cartridge Navigation"). Identity
 * propagates as the T1 `personaSessionToken` (`?pst=`) — the raw persona
 * UUID is never placed on a Companion link by this contract.
 */
export interface CompanionDeepLink {
  /** Target codex/cartridge slug — passed through to `buildCodexUrl`.
   *  Slugs are data, not guesses: surfaces must source them from the
   *  registry / existing nav config, never invent them. */
  slug: string;
  /** Target tab slug within the codex, if any. */
  tab?: string;
  /** Destination shell — embed (default) or in-platform viewer. */
  shell?: CodexShell;
  /** Breadcrumb source for back-links. */
  from?: string;
  fromTab?: string;
}

// ─── Notifications / Timeline (PRD components 12, 14 — READ over receipts) ──

/**
 * Phase 1 Timeline entry: a READ-ONLY projection of an existing activity
 * receipt (`GET /api/assistant/receipts`) into a surface-renderable feed
 * item. The receipt writer and the DVN pipeline are untouched (PARAMOUNT —
 * PRD §4.4): this is a view, never a new receipt type and never a
 * mechanism change.
 *
 * Phase 3 (PRD-MMC-IMPL-002 §3 Increment 3, "Universal Notifications")
 * additively marks a subset of feed items as notification-class via
 * `isNotification` / `kind` — still the SAME Timeline, never a second feed.
 * A future UI pass keys off `isNotification` (or the specific `kind` value)
 * to render the unread-style dot/badge described there; this contract only
 * carries the data, no rendering decision. Known notification `kind` values
 * emitted by `services/companion/runtime.ts` today: `'passport_status_changed'`
 * (re-tagged, not re-read, from the existing receipts feed),
 * `'delegation_status'`, and `'standing_increased'` (both NEW reads, folded
 * in from `GET /api/companion/notifications`) — `kind` stays a plain
 * `string` (not a closed union) so this list can grow without a type edit.
 */
export interface CompanionFeedItem {
  /** Receipt id (already browser-serialised by the receipts endpoint), or a
   *  stable synthetic id for a non-receipt notification item. */
  id: string;
  /** Receipt action type, passed through verbatim (T1-safe), or a
   *  notification-class kind (see the notification kinds noted above). */
  kind: string;
  /** Human-readable summary from the receipt (T1-safe). */
  title: string;
  /** ISO timestamp (receipt createdAt, or best-effort "observed at" for a
   *  derived notification item that has no single underlying event time —
   *  e.g. `standing_increased`, which is detected, not timestamped). */
  occurredAt: string;
  /** Originating cartridge slug, when the receipt carries one. */
  cartridge?: string;
  /** Optional deep link into the surface that produced the entry. */
  deepLink?: CompanionDeepLink;
  /**
   * True for a first-class notification item (Increment 3) as opposed to a
   * generic receipted-activity item. Additive/optional so no existing
   * consumer of this contract needs to change: absent/false renders exactly
   * as today. A future UI pass reads this to apply the unread-style
   * dot/badge treatment.
   */
  isNotification?: boolean;
}

// ─── Capture (PRD component 9 — user-initiated ONLY in Phase 1) ─────────────

/**
 * A USER-INITIATED capture intent (explicit paste / upload / "capture this"
 * click — PRD §6 Phase 1: "user-initiated, no passive observation").
 * This shape describes intent only; execution MUST route through the
 * existing Qube creators + AR/CPS seams (`services/iqube/*`,
 * `services/research/*` — PRD §0.7), never a parallel creator.
 *
 * INTEGRATION TODO (PRD-MMC-001 §0.7): the server route that consumes this
 * shape and dispatches to the existing constructors is a follow-on Phase 1
 * work item; no such route ships in this pass.
 *
 * There is deliberately NO field for tab/page/selection *observation* —
 * `content` is only ever what the user explicitly typed, pasted, or
 * uploaded into the surface.
 */
export interface CompanionCaptureIntent {
  /** What the user explicitly handed the surface. */
  kind: 'text' | 'url' | 'file';
  /** The user-provided content (text body, URL string, or file name). */
  content: string;
  /** Which existing constructor family should receive it. */
  target: 'experience-qube' | 'research-qube' | 'intent-qube';
  /** Optional user-typed note. */
  note?: string;
}

// ─── The resolved runtime context ───────────────────────────────────────────

/**
 * The surface-agnostic context `resolveCompanionContext()` returns
 * (`services/companion/runtime.ts`). Everything in it is T1/T2 —
 * serialisable to any presentation surface as-is.
 */
export interface CompanionRuntimeContext {
  /** Which surface requested resolution. */
  surface: CompanionSurfaceKind;
  /** T1 identity — `null` means unauthenticated; consumers fail closed. */
  identity: CompanionIdentityContext;
  /** Reference to the PAG-001 session (see CompanionSessionRef). */
  session: CompanionSessionRef;
  /** Phase 1 Timeline: read-over-receipts feed (may be empty). */
  feed: CompanionFeedItem[];
  /** ISO timestamp of resolution — surfaces show staleness honestly
   *  ("observed, never asserted" applies to runtime state too). */
  resolvedAt: string;
}
