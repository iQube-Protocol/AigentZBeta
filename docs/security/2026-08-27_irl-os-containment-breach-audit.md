# IRL OS → metaMe IRL Boundary Breach — Containment Audit

**Status:** Phase 1 containment implemented and tested. Addendum (query-derived administrator authority
removal) implemented and tested. Phase 2 (scoped restoration) not started.
**Severity:** CRITICAL — confidential research IP exposure + client-controlled authority signal.
**Branch:** `sec/irl-os-containment-2026-08-27` (based on `origin/dev`, no OCSGA/Crystal/Differ commits).
**Reported:** operator, with screenshots showing IRL OS Workspace cards linking directly into `irl-cartridge`
with `personaId=`/`isAdmin=`/`from=`/`fromTab=` query parameters, and internal documents (a draft partner
letter, internal reports) rendering in the public cartridge.
**Owner:** Claude Code (this session), operator review pending.
**Operator disposition (2026-08-27):** Phase 1 approved, including the temporary interruption of the
Autonomi/Austin direct-document reviewer flow (Residual Risk item 0 below) — confidentiality takes
priority; that flow is restored via canonical scoped grants in Phase 2. The addendum below was then
required before an emergency merge is authorized.

---

## ADDENDUM (2026-08-27) — query-derived administrator authority removed

**Trigger:** the operator's Phase 1 approval flagged that `?isAdmin=true` "sets client state permanently
for unauthenticated visitors and satisfies client-side tab gates" (confirmed finding, Root Cause 3 below)
as unacceptable even though the Phase 1 server-side fixes already prevent the presently-observed document
reads through it. A client-controlled parameter must never create even UI-level administrator state.

### What was removed

**`app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts`** — the shared hook every codex/cartridge
embed route uses to resolve `personaId`/`authProfileId`/`isAdmin`:

- `initialIsAdmin` removed from the hook's options type entirely — there is no longer any parameter through
  which a caller can seed admin state.
- `isAdmin` state now **always** initializes to `useState<boolean>(false)` — a plain literal, not a lazy
  initializer reading the URL/localStorage/a prop. Server and first-client render are therefore identical
  by construction; no protected tab can flash during hydration.
- The canonical-persona resolver effect now opens with `setIsAdmin(false)` as its **first, unconditional
  statement**, before any async work — a persona switch (or a persona clearing to `undefined`) discards
  any prior admin state immediately, before the new persona's own resolution completes. Every early-return
  path (no window, no personaId, no JWT, fetch failure, fetch rejection) leaves that reset value in place;
  none of them need their own "set false" branch.
- The **only** remaining path to `isAdmin === true` is `data.cartridgeFlags?.isAdmin === true` from a
  successful, JWT-authenticated fetch to `/api/wallet/active-persona` — the canonical server-side resolver
  (`services/identity/getActivePersona.ts`). No URL parameter, prop, or postMessage payload can reach it.
- The postMessage handler (`aa-auth-context-v1`) no longer reads `payload.isAdmin` / `incomingIsAdmin` at
  all — a trusted, origin-verified parent frame may still propose which `personaId`/`authProfileId` to
  select (a navigation hint, exactly like the URL params), but can never assert admin authority. The
  now-unused `sanitizeBool` helper (its only caller) was removed.
- The exported result type's `isAdmin` field changed from `boolean | undefined` to a definite `boolean`.

**Callers updated to match** (`app/(embed)/triad/embed/codex/[codexSlug]/page.tsx`,
`app/(embed)/triad/embed/codex/page.tsx`) — the `queryIsAdmin = searchParams?.get("isAdmin") === "true" ||
searchParams?.get("admin") === "1"` derivation and its `initialIsAdmin` forwarding are both removed. The
third real caller, `app/(embed)/triad/embed/companion/page.tsx`, never read or forwarded `isAdmin` and
needed no change.

**`utils/codex-nav.ts` (`buildCodexUrl`/`CodexNavOptions`)** — the canonical cross-cartridge navigation
helper documented in CLAUDE.md's "Inter-Cartridge Navigation" rule. `isAdmin` removed from the options
type, the destructure, and the query-string serialization — centrally, not just at each call site, so a
future caller cannot silently reintroduce the parameter (and if one tries via an object literal, it now
fails to compile — TypeScript's excess-property check on `CodexNavOptions` is the backstop). Every real
call site that passed `isAdmin` was updated to stop:

- `app/triad/components/codex/tabs/PartnerProgrammesTab.tsx` (`DeepLinkCard`, the confirmed Phase 1
  `irl-cartridge` deep-link vector) — `isAdmin` no longer forwarded into the generated href or accepted as
  a prop; `AreaLinks` no longer passes it through.
- `components/metame/cards/QuickLinksCard.tsx` — the general cross-cartridge quick-links card (reaches
  IRL OS among many other cartridges).
- `app/triad/components/codex/tabs/KnytAlphaTab.tsx`, `app/triad/components/codex/tabs/AlphaProgrammeTab.tsx`
  — Venture Lab α surfaces using the same pattern; fixed for consistency (the underlying hook fix already
  neutralized these, but leaving the producer in place would be exactly the "future vulnerability whenever
  a new route trusts the UI gate" primitive the operator's directive warned against).

### Broader-use audit (required by the directive) — two more independent instances found and fixed

`useCodexEmbedAuthBridge` has exactly three real callers (enumerated by grepping every reference, then
isolating actual call sites from doc-comment mentions): the two embed pages above and the companion embed
page. None of the three needed anything beyond the hook fix itself — no legitimate authenticated-embed flow
depended on the query-derived path (the canonical resolver was always the intended source of truth per the
hook's own pre-existing doc comments; the defect was that the URL-seeded value was never overwritten for an
unauthenticated caller, not that optimistic seeding was the design goal).

The broader search (`searchParams?.get("isAdmin")`, `?admin=`, `?runtimeAdmin=` across the whole codebase)
found **two independent instances of the same defect class**, unrelated to `useCodexEmbedAuthBridge`:

1. **`components/metame/MetaMeRuntimeClient.tsx`** — `runtimeAdminMode = runtimeAdminUrlOverride ||
   personaIsAdmin`, where `runtimeAdminUrlOverride = searchParams?.get("runtimeAdmin") === "1" ||
   searchParams?.get("admin") === "1"`. Gated `canEdit`, admin-only receipt/regenerate links, and
   open-in-new-window behavior in the metaMe runtime shell. Fixed: `runtimeAdminMode = personaIsAdmin`
   (the pre-existing canonical server-resolved flag) — the URL override removed entirely.
2. **`components/composer/ComposerExperienceViewer.tsx`** — `canEdit = adminUrlOverride || isAdmin ||
   !isConsumerSurface`, where `adminUrlOverride = searchParams?.get("admin") === "1" ||
   searchParams?.get("runtimeAdmin") === "1"`. This one is more severe in kind than the codex-embed
   defect: it granted **Studio EDIT authority** (not just tab visibility) to any caller who appended the
   param. Fixed: `canEdit = isAdmin || !isConsumerSurface` — the URL override removed entirely; `isAdmin`
   here was already correctly resolved via `personaFetch("/api/wallet/active-persona")`.

Per the directive's decision rule ("replace legitimate flows with canonical server/session authority rather
than preserving the query escape hatch... prefer eliminating it centrally"): both fixes were surgical
one-line removals restoring the already-correct canonical value as the sole source — no legitimate flow
was broken, because both files already computed the correct canonical flag and were simply OR-ing an
unnecessary, unauthenticated override on top of it. The `ComposerStudio.tsx` producer that still *sets*
`?runtimeAdmin=1` on an outbound preview link was left as-is: it is the general (non-IRL-OS-specific)
Composer preview-launch flow, an admin's own authenticated client setting a parameter that, after this
fix, no consumer trusts as authority — dead weight, not a residual risk, and out of scope for this
emergency patch.

### What server-side data-read exploit this closes (confirming the operator's finding)

The operator's finding was verified precisely: `?isAdmin=true` **did** set real, durable UI-level admin
state for an unauthenticated caller (no JWT → the canonical resolver effect never overwrote the
URL-seeded value). Combined with `services/passport/participationTabGate.ts`'s
`tabPassesAccessGates` — a client-side-only gate (`if (tab.adminOnly && !isAdmin) return false`) — this
meant an admin-gated tab's UI would render for a spoofed caller. Whether that ever produced a **data**
leak depended entirely on whether the tab's own content-fetch independently re-verified authority
server-side. Phase 1 already closed the two confirmed unauthenticated document routes
(`/api/codex/packs/[packId]/file`, `/api/public/irl/doc`) that made this exploitable for content; every
other server route this pass independently checked (`/api/venture/workspace/[id]`,
`/api/experiments/access`, `/api/research/readiness/[id]`, `/api/corpus-scout/candidates`) was already
correctly resolving `isAdmin` server-side and ignoring the client value. This addendum closes the
remaining **misleading-UI / future-regression** exposure named in the operator's directive: even with
every currently-known data route now safe, the client-level admin state itself was a durable, spoofable
signal other code could come to trust later — removed at the root rather than left in place as a latent
primitive.

### Tests

`tests/irl-os-query-derived-authority-removal.test.ts` — 29 new structural/source-authority canaries
(same convention as the rest of `tests/` — no `@testing-library/react` in this codebase; behaviour is
proven from the hook's own control flow via `readSource`/`stripComments`/`importAuthority`). Covers:
no `initialIsAdmin` field anywhere in the hook; no `isAdmin` in the postMessage message type; `isAdmin`
seeded only by a literal `useState<boolean>(false)`; the only `setIsAdmin(true)` call site is gated on a
strict `=== true` check against the canonical response; the resolver effect resets to `false` as its
first statement and re-fires on every `personaId` change; a failed/no-auth fetch never sets `isAdmin`;
the result type is a definite `boolean`; neither embed page reads `isAdmin`/`admin` from `searchParams`
or forwards `initialIsAdmin`; `CodexNavOptions` no longer declares `isAdmin`; no `buildCodexUrl(...)`
call site in the four fixed files passes `isAdmin`; the two independently-found `MetaMeRuntimeClient`/
`ComposerExperienceViewer` instances are fixed; the postMessage origin-allowlist check still gates
identity selection; the hydration-safety property (plain-literal, non-lazy initializer); disabled IRL OS
tab components are never eagerly imported by the registry; `AgentiqCartridgeTab` has no static import
path into `codexes/packs/` (the structural guarantee that confidential document bodies cannot reach the
public client bundle, in place of grepping for a specific secret string — see the note on that choice
in the test file itself); both document routes read through `corpusReadPackFile`, confirming no third,
unaudited reader of the `irl` pack corpus exists.

Also required two follow-on test fixes for assertions that had gone stale from the operator-approved
Phase 1 disposition itself (disabling `irl-os-workspace`/`irl-os-validation-programme`/`irl-os-protocols`)
— not introduced by this addendum, but only surfaced when the FULL suite (not just the 299/407 originally
related tests) was run per the operator's explicit instruction:

- `tests/irl-os-access-boundary.test.ts` — two assertions updated: the "Explore IRL OS" / OCSGA Full View
  parity checks now expect `irl-os-welcome` (not the disabled `irl-os-workspace`); the participant-tab-set
  check no longer expects `irl-os-workspace`/`irl-os-protocols` in the enabled list; the parity check was
  also **strengthened** to additionally assert the `expandedTab` target is `enabled: true`, so a future
  regression back into "points at a disabled tab" is caught structurally, not just by the specific literal.
- `tests/boundary-research-experiment-scoping.test.ts` — one assertion updated to the same `irl-os-welcome`
  target.
- `tests/validation-programme-journey.test.ts` — one assertion updated: `irl-os-validation-programme`'s
  `enabled` is now asserted `false`, with a comment naming the Phase 1 rationale and the Phase 2
  restoration condition.

**A second dangling-link instance was found and fixed during this pass**, not caught in the original Phase
1 diff: `services/journey/journeySurfaceRegistry.ts`'s `irl-exchange-workspace` descriptor's
`expandedTab` (the OCSGA Bridge's "Open full view" affordance) also pointed at the now-disabled
`irl-os-workspace` — repointed to `irl-os-welcome`, mirroring the `QuickLinksCard`/
`BoundaryResearchProgressPanel` fixes from Phase 1.

### Verification

- **407 tests pass** across the 16 directly-related test files (up from 299 in the Phase 1 report — the
  29 new addendum canaries plus the 2 stale-assertion fixes surfaced above).
- **Full repository suite, compared against the exact `origin/dev` baseline** (methodology: `git stash`
  the addendum, then `git checkout origin/dev -- .` and delete the two Phase-1-only new files so the
  working tree is byte-identical to `origin/dev`, run `npm test -- --run`; restore; run the same command
  again on the full addendum state): **baseline 21 failed files / 49 failed tests / 8074 passed / 2
  skipped (8125 total)** vs **addendum 21 failed files / 49 failed tests / 8120 passed / 2 skipped (8171
  total)**. The failing-file sets are **byte-identical** (`diff` confirms) — every one of the 21 is a
  pre-existing, unrelated baseline failure (journey-admission-spine, phase-a-baseline-canaries,
  pulse-transparency, repo-weight budget, register-ceremony, etc. — none touch IRL OS, the auth bridge,
  or codex navigation). The +46 passed-test delta is exactly the two new test files' combined size
  (17 + 29). **Zero regressions, zero new failures.**
- **TypeScript, same methodology**: baseline `origin/dev` — **689 errors**. Addendum — **689 errors**.
  Identical count; spot-checked that every error in a file this addendum touched
  (`components/metame/MetaMeRuntimeClient.tsx`) is the same pre-existing error at the same relative
  position (line numbers shift by the size of an added comment block; error content is unchanged). Zero
  new TypeScript errors.

### Residual note

A restoration-procedure mistake during this verification pass (using `git checkout .` after a `git
checkout origin/dev -- .` baseline snapshot, which restores from the now-origin/dev-content INDEX rather
than from HEAD) transiently reverted the Phase 1 changes in six files back to their pre-Phase-1 state in
the local working tree. This was caught immediately by the full-suite diff (one test failure appeared that
should have been impossible given the already-fixed source) and corrected via `git checkout HEAD --
<files>` before anything was committed or pushed — recorded here for the record, not because it reached
any pushed or committed state.

---

## Hard invariant (ratified by this audit, enforced by the fixes below)

> IRL OS is a public and selectively gated projection of the laboratory. It is never a navigation path,
> rendering alias, or authority bridge into private metaMe IRL. No IRL OS surface may link to, embed,
> mount, redirect to, or reconstruct a destination in `irl-cartridge`. Access to private research content
> must be resolved independently through authoritative invitation, cohort, or administrator grants.

---

## Verified root causes

All three findings below were independently confirmed by reading the implementation (not inferred from
the screenshots alone) before any fix was written.

### Root cause 1 — shared Workspace rendering constructs `irl-cartridge` deep links (CONFIRMED, CRITICAL)

- **File:** `services/research/researchWorkspace.ts` — every research-programme workspace (Autonomi
  EXP-P1 review, Lehigh capstones, the OCSGA collaboration workspace, and others) declares its
  Protocols & Articles / EXP-P1 Readiness / Experiments / Reports / Records & Findings / Independent
  Review / Observer Review links with `codexSlug: 'irl-cartridge'` hardcoded (16 occurrences).
- **File:** `app/triad/components/codex/tabs/PartnerProgrammesTab.tsx:610-617` — `DeepLinkCard` builds
  the actual `<a href>` from that `codexSlug` via `buildCodexUrl(link.codexSlug, { tab: link.tab,
  personaId, isAdmin, from: "alpha-knyt", fromTab: "partner-programmes" })`. This is the exact shape of
  destination visible in the screenshots — `irl-cartridge` with `personaId`/`isAdmin`/`fromTab` as query
  parameters.
- **File:** `data/codex-configs.ts:6819` (pre-fix) — `IRL_OS_CARTRIDGE`'s Workspace tab was built with
  `buildResearchWorkspaceTab('irl-os-workspace')`, the **same** builder function and **same**
  `PartnerProgrammesTab` mount the private `IRL_CARTRIDGE`'s own Workspace tab uses. Any IRL OS visitor
  who reached a workspace with any research-lab access grant saw these `irl-cartridge` `DeepLinkCard`s
  rendered directly in the public cartridge.
- **File:** `data/codex-configs.ts:6537-6551` (pre-fix) — `irl-os-validation-programme`
  (`ValidationProgrammeJourneyTab`) independently mounts the same `PartnerProgrammesTab` family
  (confirmed via `app/triad/components/codex/tabs/ValidationProgrammeJourneyTab.tsx:21-38`, which
  imports `PartnerProgrammesTab`, `IndependentReviewPanel`, and `LockerTab` into its component
  registry) — a second, independent instance of the same breach class.

**This is the confirmed mechanism behind the screenshots' third-row Workspace links** (Protocols &
Articles, EXP-P1 Readiness, Experiments, Reports, Records & Findings) resolving into `irl-cartridge`.

### Root cause 2 — two document-serving routes have no access control for the `irl` pack (CONFIRMED, CRITICAL)

- **File:** `app/api/codex/packs/[packId]/file/route.ts` — pre-fix, this route's own header comment
  stated plainly: *"this route has no access control of its own... a direct request to this route with
  the same packId/path bypasses [any tab's adminOnly flag] entirely."* Only one pack+path-prefix pair
  (`polity-core`/`items/commentary/constitutional-internet/`) was gated. Every `irl`-pack path —
  `col_foundation` (full Charter canon, CRP-001 Research Programmes roadmap, Chrysalis PRD, the
  constitutional glossary) and `col_experiments` (experiment designs, protocols, methods, PRDs) — was
  servable to **any** caller, admin or not, IRL OS or metaMe IRL, public or private, regardless of the
  calling tab's `adminOnly` flag.
- **File:** `app/api/public/irl/doc/route.ts` — a **second, independent** unauthenticated route,
  explicitly documented as "public, persona-free RAW markdown download," accepting any path within the
  entire `irl` pack with zero access control. Its justification comment claimed *"T2-safe by
  construction: the irl pack contains no persona data"* — a premise that conflates persona-identifier
  safety (T2-safety) with confidentiality; the `irl` pack demonstrably does carry confidential research
  IP that is neither persona data nor "the published open corpus" this route was scoped to.

**This is the confirmed mechanism behind internal documents (draft partner letter class of material,
internal CFS/IRL documents) rendering in the public cartridge** — independent of and in addition to the
Workspace-tab navigation issue in Root Cause 1. Fixing only the navigation paths (Root Cause 1) would
have left both routes reachable by direct URL/curl regardless of which cartridge's UI was used.

### Root cause 3 — client-controlled `isAdmin`/`personalId` influence UI-layer authorization decisions (CONFIRMED, HIGH — server data independently verified safe where checked)

- **File:** `app/(embed)/triad/embed/codex/[codexSlug]/page.tsx:78` — `queryIsAdmin =
  searchParams?.get("isAdmin") === "true" || searchParams?.get("admin") === "1"`, passed as
  `initialIsAdmin` into `useCodexEmbedAuthBridge`.
- **File:** `app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts:184` — `const [isAdmin,
  setIsAdmin] = useState<boolean | undefined>(initialIsAdmin)`. A later effect (lines 265-305)
  attempts to overwrite this with the server-resolved `/api/wallet/active-persona` value — **but only
  runs if a JWT is present** (`if (!jwt) return;`). For an **unauthenticated** visitor, `?isAdmin=true`
  in the URL sets client `isAdmin = true` and it is **never overwritten**.
- **File:** `services/passport/participationTabGate.ts:100-107` — `tabPassesAccessGates(tab, access,
  isAdmin)` — `if (tab.adminOnly && !isAdmin) return false;` — this `isAdmin` parameter is the
  **client-derived** value from the bridge above, threaded through `CodexPanelDynamic` /
  `TabRenderer`. This is a **client-side-only** gate: it determines whether an `adminOnly` tab **renders
  in the UI**, with no independent server re-verification of the tab-open decision itself.

**Exploit chain:** an unauthenticated visitor navigating to `.../irl-cartridge?tab=irl-records&isAdmin=true`
(or any other `adminOnly` IRL tab) has the tab's client-side gate satisfied by the spoofed URL parameter;
combined with Root Cause 2 (the underlying document route enforcing no independent authorization), the
tab's content would previously have been fully retrievable. **The exploit required BOTH conditions —
Root Cause 2's fix alone closes this chain**, since the tab now renders (a UI-layer cosmetic issue,
unchanged by this pass) but its data fetch 403s without genuine server-verified admin.

**Where verified NOT exploitable (server independently re-checks, ignoring client `isAdmin`):**
- `app/api/venture/workspace/[id]/route.ts` — server returns no Tier 0 content without genuine admin
  (per its own `WorkspaceAdministration` caller's documented behavior).
- `app/api/experiments/access/route.ts` — resolves `isAdmin` exclusively from
  `persona.cartridgeFlags?.isAdmin` via `getActivePersona(req)`, never a query parameter.
- `app/api/research/readiness/[experimentId]/route.ts` — same pattern, `getActivePersona` +
  `cartridgeFlags?.isAdmin`.
- `app/api/corpus-scout/candidates/route.ts` — same pattern.

**Disposition:** query-derived `isAdmin`/`personalId` values are **not** treated as authority anywhere
server data was independently checked. They **were** effectively authority-bearing for document content
gated only by the (now-fixed) unauthenticated `irl`-pack routes. Per the directive, this is removed as a
priority repair (Root Cause 2's fix), and negative tests added (see Tests section) to prevent regression.

---

## Additional finding — experiment-catalogue existence-signal leak (CONFIRMED, MODERATE)

- **File:** `app/api/experiments/access/route.ts` (pre-fix) — returned `assignable:
  ASSIGNABLE_EXPERIMENTS` (the **full** experiment registry — every experiment id + descriptive label,
  including confidential Autonomi (EXP-P1/P2/P3) and Lehigh-scoped entries) to **every** caller,
  including fully unauthenticated ones, before any grant check. This is an existence-signal leak: a
  denied caller should not learn the id/label of every confidential experiment even if they cannot run
  them.

---

## Exposure matrix

| IRL OS source surface | Pre-fix destination / data source | Exposed material | Intended access class | Repair |
|---|---|---|---|---|
| Workspace tab (`irl-os-workspace`) | `buildResearchWorkspaceTab` → `PartnerProgrammesTab` → `DeepLinkCard` → `irl-cartridge` (+ `personaId`/`isAdmin` query params) | Direct navigation into the private cartridge's Protocols/EXP-P1 Readiness/Experiments/Reports/Records tabs | Invitation/cohort/admin-gated, IRL OS-native | **Disabled** (Phase 1); Phase 2: IRL OS-native projection |
| Validation Programme tab (`irl-os-validation-programme`) | `ValidationProgrammeJourneyTab` → same `PartnerProgrammesTab` family + `IndependentReviewPanel`/`LockerTab` | Same as above, plus review-package surfaces | Reviewer-invitation-gated | **Disabled** (Phase 1); Phase 2: verified reviewer scoping |
| Laboratory → Experiments (`irl-os-experiment-lab`) | `InvariantExperimentLab` → `/api/experiments/access` (verified server-correct) | Foundational Series runner | Admin/invitation/cohort-gated | **Disabled** (Phase 1, pending explicit cohort-scope verification); access route itself already correct |
| Laboratory → Protocols & Articles (`irl-os-protocols`) | `AgentiqCartridgeTab` → `/api/codex/packs/irl/file?path=...` (col_experiments, **no auth**, pre-fix) | Experiment designs, protocols, methods, PRDs | Gated per experiment | **Disabled** (Phase 1) + route now default-deny |
| Laboratory → EXP-P1 Readiness (`irl-os-exp-p1-readiness`) | `ExpP1ReadinessTab` → `/api/research/readiness/[id]` (verified server-gated: `cartridgeFlags?.isAdmin`) | Per-gate readiness sections | Admin-only | **Already correctly gated** — unchanged |
| Laboratory → Corpus Scout (`irl-os-corpus-scout`) | `CorpusScoutTab` → `/api/corpus-scout/candidates` (verified server-gated) | Steward review queue | Admin-only | **Already correctly gated** — unchanged |
| Laboratory → Constitutional Evaluation (`irl-os-evaluation`) | `AgentiqCartridgeTab` → `/api/codex/packs/irl/file` (col_foundation, **no auth**, pre-fix) | CFS-033 evaluation framework | Gated, not public | **Disabled** (Phase 1) + route now default-deny |
| Institution → Charter (`irl-os-charter`) | `AgentiqCartridgeTab` → `/api/codex/packs/irl/file` (col_foundation, full CFS-019, **no auth**, pre-fix) | Full internal Charter canon | Genesis + authored public overview only | **Disabled** (Phase 1) + route now default-deny; Phase 2: author public excerpt |
| Institution → Research Programmes (`irl-os-programmes`) | `AgentiqCartridgeTab` → `/api/codex/packs/irl/file` (CRP-001, **no auth**, pre-fix) | Full programme roadmap/backlog | Public-summary-only or hidden | **Disabled** (Phase 1) + route now default-deny |
| Research → Layer I/II/III (`irl-os-layer-i/ii/iii`) | `AgentiqCartridgeTab` → `/api/codex/packs/irl/file` (**no auth**, pre-fix) | Canonical invariants appendix, Chrysalis PRD, Charter | Not explicitly classified public | **Disabled** (Phase 1) + route now default-deny |
| Research → Glossary (`irl-os-glossary`) | `AgentiqCartridgeTab` → `/api/codex/packs/irl/file` (**no auth**, pre-fix) | Constitutional vocabulary | Not explicitly classified public | **Disabled** (Phase 1) + route now default-deny |
| Any direct URL / curl | `/api/public/irl/doc?path=<any irl-pack path>` — explicitly documented "persona-free," **no auth** | Any `irl`-pack file, including all of the above | — | Route now default-deny (allowlist: `foundation/PARTICIPATION_overview.md` only) |
| `/api/experiments/access` (unauthenticated or unentitled callers) | Full `ASSIGNABLE_EXPERIMENTS` catalogue returned regardless of entitlement | Every experiment id + label, including confidential Autonomi/Lehigh entries | Scoped to actual entitlement | `assignable` now scoped/empty for non-admin/non-`'all'` callers |
| `components/metame/cards/QuickLinksCard.tsx` | Deep link to `irl-os-charter` (now disabled) | Dangling reference, not a leak itself | — | Repointed to `irl-os-welcome` |
| `components/journey/BoundaryResearchProgressPanel.tsx` "Explore IRL OS" link | Pointed at `irl-os-workspace` (now disabled) | Dangling reference, not a leak itself | — | Repointed to `irl-os-welcome` |

### Verified NOT part of the breach (checked, not assumed)

| Surface | Why it's safe |
|---|---|
| `irl-os-welcome`, `irl-os-dashboard` | `publicMode: true`, dedicated `/api/public/irl/research-overview` projection — no `isAdmin`/`personalId` query influence (grepped, comments-only matches) |
| `irl-os-invariant-field`, `irl-os-invariant-registry` | Dedicated `/api/public/irl/invariant-field`, `/api/public/irl/invariants` — same verification |
| `irl-os-reports` | `/api/public/irl/reports` — server-side filters to `published_at` set (grepped and confirmed) |
| `irl-os-participation-overview`, `irl-os-passport-apply`, `irl-os-passport-delegation` | `PassportBureauApplyTab`/`BoundedDelegationTab` — not `AgentiqCartridgeTab`, do not touch the vulnerable `irl`-pack routes; Participation Overview's one `irl`-pack path is the explicit allowlist entry |
| `app/triad/components/codex/AccessionProgressBar.tsx` | Its `irl-cartridge` string is same-origin self-scoping logic (`codexId === 'irl-cartridge'` → use `'irl'` tab prefix), never a cross-cartridge navigation construction |
| `BoundaryResearchProgressPanel`'s two `PartnerProgrammesTab` mounts (`initialSurface="pipeline"` / `"evidence"`) | Traced: `pipeline` renders `PipelinePanel` only (no `DeepLinkCard`); `evidence` renders `AreaLinks area="evidence"`, and the OCSGA workspace's links (`irl-protocols`: area `overview`; `irl-exchange`: area `operate`) have no `evidence`-area entries — `AreaLinks` returns `null` for an empty filtered set. **Not currently reachable**, but noted as residual risk below since the OCSGA workspace's `irl-exchange` link (area `operate`, `codexSlug: 'irl-cartridge'`) would render if any surface ever mounts `initialSurface="overview"` or `"operate"` for that workspace from a public context. |

---

## Fixes implemented (Phase 1)

### 1. `app/api/codex/packs/[packId]/file/route.ts` — default-deny for the `irl` pack

Added `IRL_PUBLIC_PACK_PATHS` (currently: `foundation/PARTICIPATION_overview.md` only). For
`packId === 'irl'`, any path **not** in this allowlist now requires `getActivePersona(request)` to
resolve a persona with `cartridgeFlags.isAdmin === true`, exactly mirroring the pre-existing
`ADMIN_GATED_PACK_PATHS` mechanism (server-resolved from the authenticated session — never a query
parameter). Every other pack's existing behavior is unchanged.

### 2. `app/api/public/irl/doc/route.ts` — default-deny, no persona bypass

Added `IRL_PUBLIC_DOC_PATHS` (same one-entry allowlist). Any path not on the allowlist now returns a
neutral 404 (this route has no persona resolution at all — an admin who needs a gated document uses the
cartridge UI, which routes through the packs/file route above). No existence signal is leaked on denial.

### 3. `app/api/experiments/access/route.ts` — scoped `assignable` catalogue

- Unauthenticated callers now receive `assignable: []` instead of the full registry.
- Authenticated-but-unentitled (`access === 'none'`) and scoped (`access === 'scoped'`) callers now
  receive `assignable` filtered to their own `allowedExperiments`. Admin and `access === 'all'` callers
  are unaffected (unchanged, correct).

### 4. `data/codex-configs.ts` — `IRL_OS_CARTRIDGE` hardening

Disabled (`enabled: false`, tab kept in the registry per the file's own established
`irl-os-records` precedent — not deleted, so Phase 2 restoration is a diff, not a rebuild):

- `irl-os-workspace` (the confirmed `irl-cartridge` deep-link vector)
- `irl-os-validation-programme` (independent instance of the same vector)
- `irl-os-experiment-lab` ("Experiments" — access route itself verified correct, but explicit
  invitation/cohort scoping beyond paid/admin is unverified)
- `irl-os-charter`, `irl-os-layer-i`, `irl-os-layer-ii`, `irl-os-layer-iii`, `irl-os-protocols`,
  `irl-os-glossary`, `irl-os-evaluation`, `irl-os-programmes` (all served via the now-fixed but
  previously-unauthenticated `irl`-pack routes; none explicitly classified public per the operator's
  access policy)

Left enabled (verified safe — see table above): `irl-os-welcome`, `irl-os-dashboard`,
`irl-os-invariant-field`, `irl-os-invariant-registry`, `irl-os-reports`,
`irl-os-participation-overview`, `irl-os-passport-apply`, `irl-os-passport-delegation`,
`irl-os-passport-locker`, `irl-os-participation-standing`, `irl-os-passport-steward` (already
`adminOnly`), `irl-os-exp-p1-readiness` (already `adminOnly`, verified server-gated),
`irl-os-corpus-scout` (already `adminOnly`, verified server-gated). `irl-os-records` was already
`enabled: false` pre-incident — no change.

### 5. Dangling-link cleanup (non-security, prevents a broken-nav side effect of #4)

- `components/metame/cards/QuickLinksCard.tsx` — IRL OS quick-link repointed from the now-disabled
  `irl-os-charter` to `irl-os-welcome`.
- `components/journey/BoundaryResearchProgressPanel.tsx` — "Explore IRL OS ↗" link repointed from the
  now-disabled `irl-os-workspace` to `irl-os-welcome`.

---

## Residual risks / Phase 2 work (explicitly deferred, not silently dropped)

0. **OPERATIONAL SIDE EFFECT, flagged for prompt operator attention:** `/api/journey/validation-programme/agent-package/route.ts`
   hands an already-vetted, non-admin **scoped reviewer** (the Autonomi/Austin Independent Review flow —
   `tests/validation-programme-agent-package.test.ts:127-140` exercises the `role: 'reviewer'` case)
   URLs directly into `/api/codex/packs/irl/file?path=foundation/experiments/exp-p1-representation-runtime-gauntlet/{README.md,STAGE-0_HANDOFF.md}`.
   Because the packs/file route's new gate is admin-only for any non-allowlisted `irl`-pack path, **a
   genuinely-invited, non-admin reviewer's document fetch via these URLs will now 403** — the
   `agent-package` route's own invitation/grant check already vetted the caller before handing out the
   URL, but the packs/file route has no way to see that prior vetting; it only recognizes canonical
   admin. This is the same tradeoff the directive explicitly anticipated ("If proper invitation/cohort
   filtering is not already available, deny the route in Phase 1. Restore it in Phase 2") — verified
   here to affect a live, already-approved external review process, not just newly-discovered public
   exposure, so it is called out separately rather than buried in the general Phase 2 list. **The
   Validation Programme UI tab that leads a reviewer to this flow is itself disabled in this same
   Phase 1 pass (see Fix 4)**, so the immediate practical impact is limited to any reviewer already
   using the `agent-package` URLs directly (e.g. via an MCP-connected agent) outside the UI. Phase 2
   should add scope-aware gating to the packs/file route (accept a caller whose canonical
   `research-lab` grant covers the referenced experiment, not just admin) before re-enabling the
   Validation Programme tab.

1. **`researchWorkspace.ts`'s hardcoded `codexSlug: 'irl-cartridge'` links are unchanged at the data
   level.** Phase 1 contained every currently-reachable IRL OS/OCSGA-adjacent rendering path to them
   (disabled tabs; traced `BoundaryResearchProgressPanel`'s two mounts as not currently reachable for
   the OCSGA workspace specifically). A **future** change that mounts `PartnerProgrammesTab` with
   `initialSurface="overview"` or `"operate"` from any public-facing surface would re-expose the
   `irl-exchange` link (OCSGA workspace) or the `irl-protocols`/`irl-reports`/etc. links (other
   workspaces). Phase 2 should either: (a) repoint every workspace's links at IRL OS-native
   destinations the way the OCSGA workspace's `irl-protocols` link was already repointed to
   `irl-os-cartridge`/`irl-os-protocols` (2026-08-26), or (b) make `DeepLinkCard` itself refuse to
   construct an `irl-cartridge` href when the current host cartridge is not `irl-cartridge` — the more
   structurally sound fix, deferred because it requires threading host-cartridge context into
   `PartnerProgrammesTab` that does not exist today.
2. **No public-safe projection has been authored for Charter/Research Programmes/Protocols/Glossary/
   Constitutional Evaluation.** Per the operator's access policy, Charter should show Genesis + a
   deliberately authored public overview; Research Programmes should show generic public copy or stay
   hidden. Phase 1 chose "hidden" for all of these per the directive's explicit preference ("It is
   preferable to temporarily hide useful surfaces than continue exposing confidential laboratory IP").
3. **Validation Programme and Experiments tabs need explicit invitation/cohort-scope verification**,
   not just the admin/paid-access verification already confirmed, before Phase 2 re-enables them.
4. **Participation group tabs (`irl-os-passport-locker`, `irl-os-participation-standing`,
   `irl-os-passport-steward`'s non-admin sub-tabs) were not independently re-audited in this pass** —
   they are treated as already-reviewed per the file's own numerous "Access-boundary correction
   (2026-08-26)" comments, which predate this incident. Flagged as a pending verification item, not
   asserted as clean.
5. **`personalId`/`personaId`/`fromTab` query-parameter forwarding into `buildCodexUrl` throughout the
   codebase was not exhaustively enumerated** beyond the specific vectors this audit traced
   end-to-end (`DeepLinkCard`, the embed page, `useCodexEmbedAuthBridge`, `tabPassesAccessGates`).
   Given every server route independently checked in this pass (venture workspace, experiments access,
   readiness, corpus scout) correctly ignores client-supplied identity/authority in favor of
   `getActivePersona`, the working hypothesis is that this pattern holds platform-wide — but this is a
   hypothesis, not an exhaustive proof, and should be the subject of a dedicated follow-up sweep.

---

## Tests

`tests/irl-os-containment.test.ts` — 17 canaries, all passing:

1. No IRL OS tab/subTab/component-prop destination string contains `irl-cartridge` (structural walk).
2. The full serialized `IRL_OS_CARTRIDGE` definition contains no `irl-cartridge` substring (belt-and-braces).
3. `irl-os-workspace` (the confirmed vector) is present but disabled.
4. `irl-os-validation-programme` is present but disabled.
5. Every confidential-IP tab served via the packs/file route is present but disabled (9 tabs).
6. EXP-P1 Readiness and Corpus Scout remain `enabled: true` + `adminOnly: true`.
7. Verified-public tabs (own dedicated public API) remain enabled.
8. `QuickLinksCard.tsx` no longer hardcodes an `irl-cartridge` slug/codexSlug destination.
9. `BoundaryResearchProgressPanel`'s "Explore IRL OS" link no longer targets the disabled `irl-os-workspace` tab.
10. The packs/file route source never reads `isAdmin`/`personalId`/`personaId` from `searchParams`.
11. The public irl/doc route source never reads `isAdmin`/`personalId`/`personaId` from `searchParams`.
12. The experiments/access route resolves `isAdmin` only via `persona.cartridgeFlags?.isAdmin`, never a query param.
13. The packs/file route gates the `irl` pack to `IRL_PUBLIC_PACK_PATHS` unless admin.
14. The public irl/doc route gates to `IRL_PUBLIC_DOC_PATHS`.
15. The shared `PARTICIPATION_overview.md` path is allowlisted in both document routes.
16. An unauthenticated `/api/experiments/access` caller receives `assignable: []`, not the full registry.
17. A scoped caller's `assignable` is filtered via `ASSIGNABLE_EXPERIMENTS.filter`.

**Result:** all 17 pass. Related pre-existing suites re-run for regression: `research-lab-workspace.test.ts`
(48 tests), `research-workspace-spec.test.ts` (52 tests), `participation-tab-gate.test.ts` (11 tests),
`venture-lab-cohort-isolation.test.ts` (30 tests) — **all 141 pass, no regressions.**

---

## What this audit does NOT claim

- It does not claim every `personalId`/`isAdmin`/`fromTab` query-parameter usage across the entire
  codebase was traced (see Residual Risk 5).
- It does not claim the Participation group's non-admin sub-tabs were independently re-verified in this
  pass (see Residual Risk 4).
- It does not claim a Phase 2 public-safe projection exists for any of the now-hidden tabs — they are
  hidden, not fixed-and-restored.
- It does not claim `researchWorkspace.ts`'s underlying link data was corrected — only that every
  currently-reachable rendering path to the vulnerable links from an IRL OS/OCSGA-adjacent surface was
  traced and closed (see Residual Risk 1).
