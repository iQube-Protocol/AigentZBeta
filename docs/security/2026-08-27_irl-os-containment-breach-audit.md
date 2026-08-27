# IRL OS → metaMe IRL Boundary Breach — Containment Audit

**Status:** Phase 1 containment implemented and tested. Phase 2 (scoped restoration) not started.
**Severity:** CRITICAL — confidential research IP exposure + client-controlled authority signal.
**Branch:** `sec/irl-os-containment-2026-08-27` (based on `origin/dev`, no OCSGA/Crystal/Differ commits).
**Reported:** operator, with screenshots showing IRL OS Workspace cards linking directly into `irl-cartridge`
with `personaId=`/`isAdmin=`/`from=`/`fromTab=` query parameters, and internal documents (a draft partner
letter, internal reports) rendering in the public cartridge.
**Owner:** Claude Code (this session), operator review pending.

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
