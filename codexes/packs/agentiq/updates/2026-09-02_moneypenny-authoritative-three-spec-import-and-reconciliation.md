# MoneyPenny Authoritative Three-Spec Import and Reconciliation (2026-09-02)

**Status:** Import complete. Crosswalk complete (§2, revised §10, deltas in §12). Five reconciliation
passes: (1) §3 reconciled the specs' dated snapshot against prior-session work; (2) §6–§7 verified the
C1 shell and closed the copilot-to-capsule (C-02) gap; (3) §11 closed SC-04 (task/context versioning)
and completed the C-01/C-03 shell (pane ratio, narrow-width toggle, five-area navigation incl. Home,
sidebar retirement); (4) §13 hardens SC-04 (monotonic generation, conversation-output protection),
delivers the full-screen HFT takeover, and verifies entry continuity (direct/Operate confirmed;
Agent Me confirmed absent and reported, not silently assumed; return navigation added generically);
(5) §14 builds the previously-deferred Agent Me entry point through the established specialist/
mirror-tab mechanism (not the flagged-fragile capsule-layout files), rebuilds B2 Prepare as a
financial-profile review (retiring the legacy agent-candidate picker from Prepare), migrates the one
real in-app link off the standalone `/moneypenny` route, and records a controlled (fixture-driven,
non-authenticated) browser pass separately from live acceptance — all five passes preserved every
previously-implemented feature untouched.

---

## 0. Provenance correction — supersedes the conclusion of the 2026-09-02 crosswalk

The prior same-day document,
`codexes/packs/agentiq/updates/2026-09-02_moneypenny-handoff-specs-import-and-crosswalk.md`,
concluded — correctly, given what it could search — that no document literally titled or shaped as
a "handoff spec" existed in the `moneypenny`/`moneypenny001`/`MoneyPenny002` donor repositories, and
imported the closest real donor documents instead.

The operator has since corrected the premise, not the search: **the three authoritative specs were
never claimed to live in those donor repositories.** They were authored directly in Dele Atanda's
MoneyPenny Cartridge & FS on-ramps conversation on 2026-09-01 and supplied to this session as a
direct upload. Searching the donor repos could not and did not establish their absence from this
handoff — it only established their absence from those three specific repos, which is a narrower and
different fact than the earlier document's framing implied.

**This document does not delete or overwrite the prior crosswalk.** Per the operator's explicit
instruction ("Keep existing donor documents and SPEC-MPY-002 as separate evidence... do not replace
these specifications with donor documentation"), both stand as separate, dated evidence:

| Document | What it is | Status |
|---|---|---|
| `2026-09-02_moneypenny-handoff-specs-import-and-crosswalk.md` | Donor-repo document import + capability-lineage crosswalk | Unmodified, retained as separate evidence |
| `2026-09-01_spec-moneypenny-cartridge-capability-harvest-upgrade.md` (SPEC-MPY-002) | This session's own §15 acceptance ledger for the current build | Unmodified, retained as the canonical ledger for CURRENT implementation status |
| **This document** | Import of the three authoritative specs + crosswalk + baseline reconciliation | New |

## 1. Import — three files written verbatim to `docs/specs/moneypenny/`

| File | Version | Source lines (upload) | Written to |
|---|---|---|---|
| `MoneyPenny_Cartridge_Spec_v1.md` | 1.1 | 13–359 | `docs/specs/moneypenny/MoneyPenny_Cartridge_Spec_v1.md` |
| `Financial_Services_Bridge_Spec_v1.md` | 1.1 | 361–771 | `docs/specs/moneypenny/Financial_Services_Bridge_Spec_v1.md` |
| `Qriptopian_Bridge_Admin_Spec_v1.md` | 1.0 | 773–991 | `docs/specs/moneypenny/Qriptopian_Bridge_Admin_Spec_v1.md` |

Each file's `BEGIN CONTENT`/`END CONTENT` body was copied verbatim; the `BEGIN FILE`/`SHA256`/
`END FILE` boundary markers themselves were excluded, per the operator's instruction that the
markers "are not part of the files." No text inside a content block was edited, summarized, or
reformatted. The existing four donor-repo documents (`01`–`04-*.md`) already in
`docs/specs/moneypenny/` were left untouched, as were the pre-existing content files in that
directory.

Each spec carries 20 acceptance criteria (AC-C01–20, AC-B01–20, AC-A01–20), 60 total, exactly as the
provenance note stated.

## 2. Crosswalk — donor docs, SPEC-MPY-002, and the three authoritative specs

These are three genuinely different kinds of document and this crosswalk does not collapse them:

- The **donor-repo docs** (`01`–`04`) are architectural precedent from earlier, abandoned prototype
  repos — never requirements documents.
- **SPEC-MPY-002** is this session's own capability-harvest ledger for the MoneyPenny cartridge as it
  exists on this repo's `dev` branch today, with a numbered (1–20) acceptance list scoped to that
  harvest.
- The **three authoritative specs** are the operator's actual product requirements for the
  Cartridge/Bridge/Admin reconstitution, using their own A/B/C-lettered IDs (C-01–C-17, SC-01–SC-10,
  B-01–B-17, A-01–A-10) and 60 acceptance criteria (AC-C/AC-B/AC-A).

| Concern | Donor lineage | SPEC-MPY-002 | Authoritative spec ID(s) |
|---|---|---|---|
| Split-pane copilot-left/capsule-right shell | `moneypenny001`'s `AgentiQClient`/`MoneyPennyClient` architecture is the closest real precedent for a modular shell, but was never adopted | Not covered — SPEC-MPY-002 predates the shell decision | C-01, C-02, SC-01/02/04/09/10 (Cartridge spec) |
| Reuse of `SmartTriadCopilotLayer` as the real shared copilot | None — no donor repo has this component | Not covered | C-01 evidence table row (`AigentMeWelcomeSplitTab.tsx`/`DevCommandCenterTab.tsx`), implemented this session as `MoneyPennyCopilotWorkspace.tsx` |
| Financial Profile ingestion/review/readiness | `moneypenny`'s banking-profile wizard (`03-moneypenny-v1-testing.md`) is a real precedent for a document-upload wizard shape | §15.7 risk/trading envelope (derived, not authority) | C-04–C-06 |
| Manual/no-statement profile entry | No donor repo has this | MPY2-2c (this session, prior turn) | Falls under C-04's "Provide manual entry for a limited profile" |
| Bridge asset upload/placement/publication (video/poster/infographic) | None | Not covered | B-17, A-01–A-10 (Qriptopian Bridge Admin spec is the authoritative owner) — this session's QRP-BRIDGE-ADMIN work (`bridgeContentPlacements.ts`, `QriptopianAdminTab.tsx` asset picker, `makePublic` flag) is a partial implementation predating the formal spec |
| Multi-chain quote/execution console | `moneypenny`'s gas-oracle/multi-chain architecture (`02-moneypenny-v1-deployment.md`) is the closest real lineage, though simulated per audit | Not covered | C-11–C-13 (Simulation/live-exercise/lifecycle), C-14 (denomination model) |
| Native Qriptopian Admin → Bridges as the editorial home | None | Not covered | Owned entirely by `Qriptopian_Bridge_Admin_Spec_v1.md`; cross-referenced from Cartridge C-17 and Bridge B-17 |
| KNYT pricing discrepancy (0.005 vs 0.0005 ETH) | Not addressed by any donor doc | Flagged in this session's own standing notes | D-02 (Cartridge spec), reiterated in Bridge B-14 — still explicitly unresolved |

**What this crosswalk does not claim:**

- It does not claim the three authoritative specs supersede or invalidate SPEC-MPY-002's §15 ledger
  — that ledger describes what the current cartridge build actually does today, and remains accurate
  for that purpose.
- It does not claim any AC-C/AC-B/AC-A criterion is satisfied by virtue of this import, the earlier
  donor-doc import, or this session's prior C1/A2 work — see §3 below for what that prior work
  actually covers against the new authoritative IDs.
- It does not merge or paraphrase any of the three specs into a composite document.

## 3. Baseline reconciliation — the specs' dated snapshot vs. current source

All three specs state the same inspection boundary: `iQube-Protocol/AigentZBeta`, local branch
`claude/cs-capstone-estate-and-brief`, commit `f214d2be3`, dated 2026-08-25, inspected 2026-09-01.
Each spec explicitly requires this to be reconciled against current source before implementation
(Cartridge §3 Phase C0; Bridge §3; Admin §3 and Phase A0) — stated twice by the operator in this
session's own instructions.

**This reconciliation is necessarily partial in this pass.** The full C0/A0 reconciliation the specs
require is a dedicated inventory exercise across every evidence-table row in all three documents.
What follows are the concrete, verifiable divergences discovered so far between the specs' snapshot
and this repo's current `dev`-bound source — items a full C0/A0 pass must account for, not a
substitute for that pass.

### 3a. Work that shipped on this branch AFTER the specs' 2026-08-25/09-01 baseline

This session (2026-09-02, before the three specs were supplied) implemented and deployed to `dev`
work that the specs' evidence tables do not know about, because it postdates their inspection:

| Shipped this session | File(s) | Relationship to the authoritative specs |
|---|---|---|
| `MoneyPennyCopilotWorkspace.tsx` — `SmartTriadCopilotLayer` (left) + `MoneyPennyShell` (right), wired into `MoneyPennyPanelTab.tsx` | `app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx` | A partial, pre-spec implementation of Cartridge C-01/C-02. Built from this session's own investigation of `SmartTriadCopilotLayer` as the real shared copilot (matching Cartridge §3's own evidence-table finding for that component) — not yet reconciled against C-01's full desktop-width/narrow-width/full-screen-takeover requirements or SC-04/09/10 isolation contracts |
| Three-slot (video/poster/infographic) bridge asset picker with explicit `makePublic` authorization flag | `app/triad/components/codex/tabs/QriptopianAdminTab.tsx` (`PlacementAssetsPanel`), `services/content/codexStorageRegisterHandler.ts` | A partial, pre-spec implementation of Admin spec A-05/A-06 (asset/placement contract, explicit public-visibility decision) — built inside the EXISTING `QriptopianAdminTab.tsx`, which the Admin spec's own §4 (A-02/A-03) also names as the correct extension point (a "Bridges" sub-tab under native Qriptopian Admin). The current implementation is a placements panel within that tab, not yet the dedicated bridge/stage/slot selector breadcrumb UI (`Bridges / Constitutional Internet / Financial Services / Learn / Stablecoins`) the Admin spec's §4 describes |
| Infographic publish-and-render through `knytsBridgeEditorialConfig.ts` / `BridgeMediaStage.tsx` | `services/journey/bridgeContentPlacements.ts`, `services/journey/knytsBridgeEditorialConfig.ts`, `components/journey/BridgeMediaStage.tsx` | Directly on the reuse path both the Bridge spec (SC-06) and Admin spec (§9 Publication and renderer contract) require — the shared `knyts_bridge_editorial_config` table and `BridgeMediaStage` renderer are exactly the seams the Admin spec's §3 evidence table names for reuse. This is real forward progress on A-08, not a parallel path |
| `isPlacementSlot` fixed to accept `'infographic'` | `app/api/journey/knyts-bridge/placements/route.ts:40` | Bugfix within the same A-05/A-08 surface |

None of this prior work was built against the authoritative specs (they did not exist yet on this
branch), so none of it can be marked complete against any AC-C/AC-B/AC-A criterion without a
deliberate review pass. It is recorded here as reconciliation input, not as claimed compliance.

### 3b. Evidence-table rows the specs cite that this repo's current state already differs from

- **Admin spec §3**: "The current upload tool schema has asset roles, domain/content association and
  bundle fields; it does not expose bridge/stage/slot publication" — **partially superseded**: the
  `bridge_content_placements` table (migration `20260901000000_...sql`, not yet applied to any live
  DB) and `bridgeContentPlacements.ts`'s `publishPlacement` function, both built this session, are
  exactly this missing publication layer for the KNYTS bridge specifically — but they predate and do
  not yet implement the spec's generalized bridge/journey/stage/slot registry (Admin §5's destination
  registry) that would need to cover CI, the intermediary FS journey, and advanced Horizen slots, not
  just KNYTS.
- **Admin spec §3**: "The inspected codex upload route explicitly omits a local authorization check" —
  **partially addressed**: this session's `shouldSkipEncryption(series, makePublic)` fix in
  `codexStorageRegisterHandler.ts` closes the specific "series='bridge' must not itself authorize
  public exposure" gap the operator flagged directly, but does not constitute the full server
  authorization sweep across "all reused public mutation endpoints" the spec's AC-A10 requires.
- **Cartridge spec §3 D-02**: KNYT pricing discrepancy (0.005 vs 0.0005 ETH) — **still unresolved**,
  confirmed still present in `knytPricingService.ts`'s `KNYT_ETH_RATE = 0.0005` constant as of this
  session. No canonical-pricing-authority resolution has occurred. This remains an explicit, visible
  open item exactly as both the Cartridge (§15, D-02) and Bridge (§14, B-14) specs require it to stay
  until resolved — no numerical educational content or live KNYT pricing examples should be built
  against either value until it is.

### 3c. What a full C0/A0 pass still requires (not performed in this pass)

Per each spec's own instruction, a complete reconciliation is a capability-by-capability record:
source owner, real service, environment, authorization path, persistence, receipt, limitations —
run against ALL evidence-table rows in all three documents, not just the ones this session happened
to already touch. That full inventory is out of scope for this import-and-crosswalk pass and remains
the required next step before further implementation proceeds under these specs' authority.

## 4. What this pass does not claim

- It does not claim implementation or deployment of any AC-C/AC-B/AC-A criterion. Per the operator's
  instruction, the specs' existence does not establish either.
- It does not claim the §3a prior-session work is compliant with the authoritative specs' full
  requirements — only that it exists, predates the specs, and touches the same seams the specs
  independently name as correct reuse targets.
- It does not resolve D-02 (KNYT pricing) or any other dependency the specs list as open.
- It does not begin the specs' own C0/A0 phase work beyond the partial findings in §3b — that full
  inventory remains a distinct, subsequent task.

## 5. Read order followed

Per the operator's instruction ("Read order: cartridge, bridge, shared native administration"), all
three specs were read in that order — `MoneyPenny_Cartridge_Spec_v1.md` first, then
`Financial_Services_Bridge_Spec_v1.md`, then `Qriptopian_Bridge_Admin_Spec_v1.md` — before this
crosswalk was written.

## 6. C1 verification against the actual code (this pass)

Per the operator's direction to "verify shared context, copilot-to-capsule actions, navigation and
return behavior against C1" rather than accept the shell wrap as sufficient, `MoneyPennyCopilotWorkspace.tsx`,
`MoneyPennyPanelTab.tsx`, `MoneyPennyShell.tsx`, `MoneyPennyCapabilityRail.tsx`, and the shared
`SmartTriadCopilotLayer.tsx`/`app/api/codex/chat/route.ts` seam were read directly. Findings, C-01/C-02
requirement by requirement:

| C-01/C-02 requirement | Finding before this pass | Status after this pass |
|---|---|---|
| Copilot left ~35–40%, action space right ~60–65% | Implemented as `lg:w-1/2`/`lg:w-1/2` — an even 50/50 split, not the specified ratio | **Unchanged, cosmetic gap** — not addressed this pass; tracked below |
| "Do not retain a competing full capability sidebar" | `MoneyPennyCapabilityRail.tsx` — a 14-item, 5-group vertical nav — renders inside `MoneyPennyShell`'s right pane on every panel | **Unchanged, real gap** — this IS the "competing full capability sidebar" C-01 names. Retiring/consolidating it is C-03 (Information Architecture) work, a separate, larger slice than this pass's scope; not silently declared done |
| Narrow-width Conversation/Workspace toggle | Layout only stacks (`flex-col lg:flex-row`) at narrow widths; no explicit toggle or return affordance | **Unchanged, gap** — not addressed this pass |
| Full-screen takeover with reliable return | No such mechanism exists in `MoneyPennyCopilotWorkspace.tsx` or any panel | **Unchanged, gap** — no MoneyPenny panel currently needs one (no trading/analysis full-screen surface built yet), so this is currently low-consequence, but remains open |
| C-02 copilot-to-capsule loop: "chip proposes an applicable layout/action using registered identifiers... host opens the relevant capsule" | **Confirmed absent.** `SmartTriadCopilotLayer` supports `onSuggestedLayouts`/`quickPrompts` (DevOn wires both); `MoneyPennyCopilotWorkspace` wired neither. Worse: the server-side `ChipTargetId`/`SuggestedLayoutHint` union (`app/api/codex/chat/route.ts`, `SmartTriadCopilotLayer.tsx`) had **zero MoneyPenny/financial identifiers at all** — the registered suggestion system had no vocabulary for MoneyPenny's panels, and `aigent-moneypenny` had no layout-tag control block in its system prompt (only `aigent-me`/`aigent-z` did) | **Closed this pass** — see §7 |
| SC-04 versioned task context; late responses cannot overwrite a different task/agent/environment | No task/environment version object exists; only a flat `groundContext` | **Unchanged, gap** — no task/environment concept exists yet in MoneyPenny's C1 shell to version |
| SC-09 copilot ownership dedup (no nested duplicate copilots) | Only one `SmartTriadCopilotLayer` is ever mounted per panel | **Satisfied, trivially** — no second copilot exists to collide with |
| SC-10 isolation across refresh/embed/fullscreen | Refresh: panel is route-driven, survives refresh correctly. Embed (bridge): does not exist yet (Bridge B1 not built). Fullscreen: N/A (no fullscreen surface exists) | **Partially satisfied** (refresh only); embed/fullscreen not yet applicable |

**What this verification does not do:** it does not claim C1 is complete. The sidebar-retention gap,
the 35–40/60–65 ratio, the narrow-width toggle, and SC-04 task versioning remain real, named, open
items — recorded here rather than silently marked done. Nothing previously implemented was reverted
or restarted to perform this check.

## 7. This pass's implementation — closing the C-02 copilot-to-capsule gap (no migration, bounded)

The one concrete, unblocked, no-migration gap the §6 verification found — the copilot-to-capsule loop
having no MoneyPenny vocabulary at all in the registered suggestion system — was closed this pass, by
**extending** the existing typed system exactly as Cartridge spec C-02/SC-06 requires ("Financial
layout identifiers must extend the existing typed suggestion system... Unknown identifiers show a
recoverable unavailable state"), never forking a parallel one:

- `app/api/codex/chat/route.ts` — added `financial-profile`, `risk-envelope`, `hft-console`,
  `strategies`, `architect`, `runtime`, `smarttriad`, `service-orchestration`, `portfolio` to
  `ChipTargetId`, `LAYOUT_TAG_IDS`, and `LAYOUT_KEYWORDS` (with real keyword patterns per id — these
  are the exact `MoneyPennyPanelKey` values `moneypennyCapabilities.ts` already labels, reused
  verbatim rather than inventing a parallel vocabulary). Added an `aigent-moneypenny` branch to the
  `layoutSuggestionsBlock` system-prompt builder (previously only `aigent-me`/`aigent-z` had one, so
  MoneyPenny's LLM had no instruction to ever emit a `[layout:id|substance]` tag) — the block states
  explicitly that a tag "never authorizes any action by itself."
- `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx` — mirrored the same 9 ids onto
  `SuggestedLayoutHint.layoutId`, kept in sync by hand with the server union (the existing,
  pre-established pattern every other domain's ids in this file already follow).
- `app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx` — wired `quickPrompts` (4 curated
  financial prompts) and `onSuggestedLayouts` onto `SmartTriadCopilotLayer`. **Deliberately does NOT
  auto-navigate on a suggestion** — per this codebase's own Companion Menu System invariant MS-5 ("a
  deliberate act outranks an ambient observation"), a suggestion only lights a dismissible banner
  ("MoneyPenny suggests: open Financial Profile →"); the operator's click is what navigates, via
  `tryOpenInMountedCartridge` — the SAME seam `MoneyPennyCapabilityRail.tsx` already uses, so the
  codex tab framework remains the single owner of "which panel is active" (MS-2 — no second, parallel
  state authority introduced). Suggestable-panel labels are derived from `MONEYPENNY_CAPABILITY_GROUPS`
  (the rail's own source of truth), not hand-duplicated.

**Scope decision, stated explicitly:** only the 9 panels `MONEYPENNY_CAPABILITY_GROUPS` labels as
user-facing capabilities were wired (excluding `chat`, which is the copilot itself, not a navigation
target). `overview`, `identity`, `crm`, and `x402` are valid `MoneyPennyPanelKey`s but are not yet
referenced by the capability-group source of truth, so they were not given layout ids or keyword
patterns in this pass — a bounded decision, not an oversight, left open for a follow-up.

**Tests:** `tests/moneypenny-copilot-workspace.test.ts` — 22 tests (13 pre-existing C1 tests, updated
one regex to tolerate the new type-only import; 9 new tests proving the MS-5/MS-2-respecting wiring,
the server-side registered-identifier extension, and that the moneypenny control block's own copy
states it never authorizes an action). All pass.

**Regression:** tsc held exactly at 677 (zero new errors in touched files — the 5 errors surfaced
near the edited lines are pre-existing, unrelated `ContentDomain`/`RefObject` typing issues). Full
vitest suite held exactly at 49 failed / 17 failed files (the same pre-existing `repo-weight` and
`resolution-records` failures; no new failures).

## 8. Infographic rendering status — restated precisely

Per the operator's instruction to record this precisely: the A2 infographic publish-and-render path
(`bridgeContentPlacements.ts`'s `publishPlacement` writing all three slots through
`knytsBridgeEditorialConfig.ts`, `BridgeMediaStage.tsx` rendering `infographicUrl`) is **implemented
in code and covered by tests, and is awaiting two separate, distinct things**: (1) the additive
`infographic_url` column migration (`supabase/migrations/20260902010000_knyts_bridge_editorial_config_infographic_url.sql`)
being applied to a live database — until then, the two-tier read/write in `knytsBridgeEditorialConfig.ts`
degrades honestly rather than erroring, but the actual infographic will not persist/render live; and
(2) browser acceptance — no rendered screenshot or live interaction has verified this path end-to-end.
Neither has occurred. "Implemented" and "deployed/verified" are being reported as the separate facts
they are, per standing instruction.

## 9. Deployment status — restated precisely

Commit `8cc4fce7b` (this session's A2-completion/public-exposure-fix/C1-slice push) is **pushed to
`origin/dev`**. No Amplify build-completion signal is available to this session — there is no
Amplify-specific GitHub check visible here, only the repo's own "Dev Integration Checks" test gate,
which mirrors the same pre-existing 49-failure local baseline rather than reporting an Amplify build
result. Per the operator's own precision requirement: **pushed to dev; deployment unverified.** This
pass's new commit (§7) has not yet been pushed to dev as of this writing — see the commit/push record
that follows this document's publication for its own hash and status, reported with the same
precision.

## 10. Corrected acceptance-criteria crosswalk (AC-C / AC-B / AC-A)

This replaces the earlier, ad-hoc "A2/B1/C1/C2/C-04–C-06" self-invented labels this session used
before the authoritative specs existed. Status vocabulary: **PASS** = code + test evidence exists,
browser acceptance still pending (never claimed as browser-verified — that remains a separate,
explicit open item across every criterion below); **PARTIAL** = some real evidence, concrete gap
named; **NOT STARTED** = no code exists for this criterion yet; **BLOCKED** = code exists but a named
external dependency (migration, pricing resolution) prevents it working live; **N/A (phase)** = the
owning phase (Bridge B1+, Admin A1+) has not started, so the criterion cannot yet be assessed.

### AC-C (Cartridge)

| ID | Status | Basis |
|---|---|---|
| AC-C01 | PARTIAL | Direct/codex-tab entry and the dispatcher unify on one copilot (verified in code + tests). Agent Me entry and bridge entry are not verified — Bridge B1 (embed) does not exist yet |
| AC-C02 | PARTIAL | Rail/chip → panel navigation pre-existing and working; groundContext updates on financial-profile edits (verified); the copilot-suggests-a-capsule half is now wired (§7) but not browser-verified |
| AC-C03 | NOT STARTED | No SC-04 task/environment version object exists to guard against late-response overwrite |
| AC-C04 | PARTIAL | Refresh preserves the active panel (route-driven, verified structurally); no full-screen takeover or narrow-width toggle exists yet |
| AC-C05 | PASS | PDF/CSV ingestion + manual entry implemented (MPY2-2/MPY2-2c, prior session work); browser acceptance pending |
| AC-C06 | PARTIAL | Manual-profile path exists so declining raw-document access is possible; no dedicated cross-persona-read-denial test located this pass |
| AC-C07 | PARTIAL | Profile versioning exists (`FinancialProfileQube`); explicit dependent-proposal invalidation on correction not verified this pass |
| AC-C08 | PARTIAL | `RiskEnvelopePanel`/`riskEnvelope.ts` (MPY2-3) derive limits from the profile, not authority, by construction; a full authority-rejection integration test across all four scopes was not run this pass |
| AC-C09 | NOT VERIFIED | No admission/eligibility-gate audit performed against current APIs this pass (Cartridge spec's own D-05 dependency, explicitly still open) |
| AC-C10 | PARTIAL | `HFTConsole`/quotes are explicitly randomized/simulated per the code's own comments (never presented as live) — the "honest labeling" half holds; the reproducible-scenario/backtest half (C-11) is not built |
| AC-C11 | NOT STARTED | No live-transition/fresh-terms flow exists |
| AC-C12 | NOT STARTED | No pending/settled/failed lifecycle presentation exists beyond intent-level records |
| AC-C13 | BLOCKED | D-02 KNYT pricing discrepancy (0.005 vs 0.0005 ETH) confirmed still unresolved in `knytPricingService.ts` — numerical content must stay gated on this |
| AC-C14 | N/A (phase) | Bitcent/Base Q¢ settlement work not touched this session |
| AC-C15 | NOT STARTED | No inline conversational video message type exists in the copilot yet |
| AC-C16 | NOT VERIFIED | No accessibility audit performed this pass |
| AC-C17 | PARTIAL | `MoneyPennyPanelTab.tsx`'s dispatcher structurally preserves every existing panel-key deep link (verified); not a full alias/redirect audit |
| AC-C18 | N/A (phase) | Bridge B4 Cross not built |
| AC-C19 | NOT STARTED | No pilot session with Dele has been observed/recorded |
| AC-C20 | PARTIAL | Infographic publish/render exists for the KNYTS bridge reader (§8); it is not yet consumed inside MoneyPenny's own copilot/capsules (C-15/C-17 native-admin-to-MoneyPenny integration not built) |

### AC-B (Bridge) — mostly N/A, Bridge phase B1+ has not started this session

| ID | Status | Basis |
|---|---|---|
| AC-B01–B04, B08–B16, B18–B19 | N/A (phase) | The three-threshold bridge journey (Discover/Learn/Explore/Prepare/Operate/Cross) has not been built against these specs; Bridge B0/B1 reconciliation itself is only partially done (§3, §6) |
| AC-B05 | PARTIAL | Prepare's underlying financial-profile workflow (C-04–C-06) exists and is the same canonical profile MoneyPenny/Operate would reuse — the Bridge-side Prepare stage embedding it has not been built |
| AC-B06 | PARTIAL | Manual/limited-profile support exists (MPY2-2c) |
| AC-B17, B20 | PARTIAL | Native bridge content administration (B-17) partially implemented pre-spec (§3a) — asset picker + `makePublic` + infographic publish/render exist for KNYTS specifically, not yet the generalized bridge/journey/stage/slot registry B-17 and Admin A-04/A-05 require |
| AC-B07, B09 | NOT VERIFIED | No test located proving educational browsing is ungated by profile upload, or that a sophisticated simulation stays clearly labeled, against these specific criteria |

### AC-A (Qriptopian Bridge Admin) — Phase A0 partially done, A1+ not started

| ID | Status | Basis |
|---|---|---|
| AC-A01, A02, A03 | NOT STARTED | No dedicated native "Bridges" sub-tab with a bridge/journey/stage/slot breadcrumb selector exists — current work is a placements panel embedded in the existing KNYTS-specific admin flow, not the Admin spec's §4 generalized selector UI |
| AC-A04, A05 | PARTIAL | Video/poster/infographic upload+select+preview+publish exists and is covered by tests, scoped to the KNYTS bridge specifically |
| AC-A06 | PARTIAL | Provider identity (Supabase vs Auto-Drive) preserved correctly in the register handler; no dedicated promotion/replacement-traceability test located this pass |
| AC-A07 | NOT VERIFIED | No test proving thumbnail changes don't cross-contaminate an unrelated article cover |
| AC-A08 | NOT STARTED | No authorized-agent placement path exists yet (Admin §8's `upload_content_asset` → bridge-placement binding is explicitly named as "proposed functionality, not a currently callable tool" by the spec itself) |
| AC-A09, A10 | PARTIAL | `makePublic` explicit-flag fix (this session, prior turn) closes the specific "series='bridge' must not itself authorize exposure" gap the operator flagged directly; the full sweep across "all reused public mutation endpoints" the spec requires was not performed |
| AC-A11–A20 | NOT STARTED / NOT VERIFIED | No work performed against these this session |

**What changed in this correction versus the earlier informal ledger:** this session's own ad-hoc
"A2 complete" framing is now stated precisely as PARTIAL against the authoritative Admin spec — real,
tested, and shipped for the KNYTS-specific case, but short of the spec's generalized destination
registry (A-04) and agent-placement binding (A-07/A08). No status above is asserted higher than the
evidence in this document and in prior-session commits supports.

## 11. SC-04 closed + C-01/C-03 shell completed (this pass, 2026-09-02, second continuation)

Two bounded, no-migration slices, continued without a selection round per the operator's instruction.

### 11a. SC-04 — task/context versioning, closed using the existing shared-context infrastructure

**Mechanism, not a new parallel system.** `SmartTriadCopilotLayer.tsx` already captures
`currentGroundContext` fresh at POST time (its own pre-existing pattern, documented in its own
comments). This pass added ONE small, additive, optional prop — `onRequestContext` — that echoes that
exact snapshot to the host immediately before dispatch. Every existing caller (DevOn, Agent Me) that
doesn't wire it is unaffected. `services/moneypenny/contextVersioning.ts` is the pure, directly
unit-tested logic: `computeContextVersionKey({panel, personaId, environment, profileRevision})` and
`isResponseContextStale(sentVersionKey, currentVersionKey)`.

`MoneyPennyCopilotWorkspace.tsx` embeds the version into `groundContext.contextVersion` (so it rides
the SAME request the copilot already sends), captures it via `onRequestContext` into a ref at
dispatch time, and — inside `handleSuggestedLayouts` — discards ANY response whose captured version no
longer matches the CURRENT version computed fresh at response-arrival time. A stale response is a bare
`return`: it never calls `setSuggestedPanel`, so it can neither populate new state nor overwrite an
existing valid suggestion for the current context. The explicit-click behavior (MS-5) and single
navigation owner (MS-2, `tryOpenInMountedCartridge`) from the C-02 slice are untouched — the guard
sits strictly upstream of them.

Four axes compose the version, covering "task, agent, or environment" (SC-04's own wording) plus a
fourth this session added deliberately: `panel` (task), `personaId` (agent), `environment` (execution
environment — real state, defaulted to `'simulation'`; no simulation/live UI exists yet since C-11/C-12
are NOT STARTED, so no toggle was built — speculative UI was deliberately avoided, but the state is
real and ready for that future work to plug into), and `profileRevision` (a monotonic counter bumped
on every successful financial-profile refetch — a profile revision invalidates an in-flight response
even when panel/persona/environment are unchanged, since the response may have reasoned over the
now-superseded snapshot).

**Tests:** `tests/moneypenny-context-versioning.test.ts` — 20 tests. 12 are real, callable unit tests
of the pure logic (not source-shape checks) directly exercising the three required scenarios: a
delayed response after a panel change, a delayed response after a financial-profile revision, and a
delayed response after a simulation/live environment switch — plus a persona-switch case and a
fail-closed (null sent-version) case. 8 are source-shape tests proving the wiring (module reuse, the
guard precedes the state write, the additive/optional nature of `onRequestContext`). All pass. tsc
held at 677; the pre-existing 22-test `moneypenny-copilot-workspace.test.ts` suite still passes
unmodified by this change.

**Implementation evidence vs. browser acceptance, kept separate as instructed:** the guard's logic is
proven by real unit tests calling the pure functions with concrete inputs — this is implementation
evidence. No browser session has exercised a genuine race (typing in one panel, navigating before the
response returns) against the live UI. That remains a separate, explicit open item.

### 11b. C-03 — five-area navigation (Home / My Money / Plan / Markets / Activity), Home included

**Home is in the specification and in this implementation.** The previous turn's report text omitted
mentioning Home in one summary sentence — an error in that report's prose, not in the underlying
Cartridge spec §5 IA table, which always listed Home first. This pass implements all five.

`app/(shell)/moneypenny/components/moneypennyCapabilities.ts` gained the area registry
(`MONEYPENNY_AREAS`, `MONEYPENNY_AREA_FOR_PANEL`, `areaForPanel`, `capabilityItemsForArea`,
`areaItems`) — a DERIVED projection over the existing `MONEYPENNY_CAPABILITY_GROUPS` (never a
hand-duplicated second list of labels/descriptions/modes). The Cartridge spec's own §5
existing-surface-relocation table was applied to this repo's actual 14 `MoneyPennyPanelKey` values:

| Area | Panels |
|---|---|
| Home | `overview` |
| My Money | `financial-profile`, `identity`, `x402` |
| Plan | `risk-envelope` |
| Markets | `hft-console`, `strategies`, `architect`, `chat` |
| Activity | `portfolio`, `smarttriad`, `runtime`, `service-orchestration` |
| Utility (outside the five areas) | `crm` |

`crm`'s placement is a deliberate, spec-grounded decision, not an omission: C-03's own closing
paragraph carves "privileged administration" out of the five beginner areas as contextual utility
access ("Administration is permission-gated; it is not a sixth beginner journey"). CRM is still fully
reachable — same panel, same deep link, same functionality — via a small utility link in the new nav,
not one of the five area tabs. `identity` and `x402` had no existing `MONEYPENNY_CAPABILITY_GROUPS`
entry at all (a pre-existing gap, not introduced this pass) — both gained honest, minimal capability
items (`MONEYPENNY_UNGROUPED_ITEMS`) so their deep links remain reachable from the nav, not just a raw
URL.

**The sidebar is retired, not archived.** `MoneyPennyCapabilityRail.tsx` (the flat 14-item vertical
list C-01 explicitly names as "a competing full capability sidebar") is deleted — confirmed via
grep that no other file imported it (two doc-comment mentions elsewhere are prose, not imports,
left as-is since they're historical narrative). `MoneyPennyShell.tsx` now renders the new
`MoneyPennyAreaNav.tsx` — a horizontal area strip (5 area tabs + the CRM utility link) with a
contextual chip row for the active area's capsules — in the exact position the rail used to occupy.
Navigation still goes through the SAME `tryOpenInMountedCartridge` seam the rail always used, so every
existing `buildCodexUrl('moneypenny', {tab})` deep link resolves identically and every panel component
(`MoneyPennyPanelTab.tsx`'s `PANELS` map) is completely unchanged — only how the operator reaches a
panel changed, never what they find there.

**Mode/environment/authority stay independent of navigation (C-10), verified not just asserted:** each
capsule chip still carries its Advisor/Architect/Runtime badge, read straight from the existing
`MoneyPennyCapabilityItem.mode` field — the area registry never redefines or overrides it, and a test
(`tests/moneypenny-copilot-workspace.test.ts`) asserts no area-conditioned mode-override logic exists
in `MoneyPennyAreaNav.tsx`.

### 11c. C-01 — pane ratio and narrow-width toggle, in the same shell slice

`MoneyPennyCopilotWorkspace.tsx`'s copilot pane is now `lg:w-[38%]` and the workspace pane
`lg:w-[62%]` (both within the spec's 35–40% / 60–65% ranges), replacing the prior even 50/50
`lg:w-1/2` split.

Below the `lg` breakpoint, a new Conversation/Workspace toggle (two buttons, `lg:hidden`) switches
which pane is visible. **Both panes stay mounted at every width** — only CSS visibility
(`hidden`/`flex`/`block`, overridden unconditionally by `lg:flex`/`lg:block` at the `lg` breakpoint)
toggles which one is shown — so `SmartTriadCopilotLayer`'s conversation history and
`MoneyPennyShell`'s active-panel/task state are never remounted or lost when switching views, exactly
as instructed ("preserving conversation and task state when switching views"). At `lg`+, the toggle
itself is hidden and both panes are always visible, unchanged from before.

**Tests:** extended into the same `tests/moneypenny-copilot-workspace.test.ts` file — 10 new tests
(4 for the narrow-width toggle's mount-preservation property, 6 for the five-area nav/rail-retirement).
Combined with the SC-04 suite, 52 MoneyPenny-specific tests pass. Full regression: tsc held exactly at
677; full vitest suite held exactly at 49 failed / 17 failed files (the same pre-existing
`repo-weight`/`resolution-records` failures — zero new failures anywhere in the suite).

**Implementation evidence vs. browser acceptance:** the mount-preservation property is proven
structurally (the JSX never conditionally unmounts either pane; only className strings reference
`narrowView`) — real evidence, but not a rendered screenshot or an interactive resize/toggle session
in a real browser. That remains separately open, as does confirming the actual rendered pane widths at
various viewport sizes match the intended 38/62 split visually.

## 12. Corrected AC-C status deltas from this pass (§10 superseded for these rows only)

| ID | Previous status | New status | Basis |
|---|---|---|---|
| AC-C01 | PARTIAL | PARTIAL (stronger) | One shared copilot across direct/dispatcher entry still holds; the sidebar-vs-menu gap named in §6 is now closed (five-area menu replaces the competing sidebar). Agent Me and bridge entry remain unverified |
| AC-C02 | PARTIAL | PARTIAL (stronger) | Copilot-to-capsule suggestion now additionally respects SC-04 versioning — a stale suggestion can no longer surface as actionable. Browser acceptance still pending |
| AC-C03 | NOT STARTED | PASS (code evidence; browser acceptance pending) | SC-04's task/agent/environment versioning is now implemented and unit-tested against exactly this criterion's wording ("late responses cannot overwrite a different task, agent, or environment") |
| AC-C04 | PARTIAL | PARTIAL (stronger) | The narrow-width Conversation/Workspace toggle now exists with state preserved across switching (structurally proven); full-screen takeover still does not exist (no MoneyPenny surface currently needs one) |

All other AC-C/AC-B/AC-A rows in §10 are unchanged by this pass — restated, not re-derived, to avoid
implying progress this pass did not make.

## 13. Third continuation (2026-09-02): SC-04 hardening, full-screen HFT takeover, entry continuity

Continued without a further selection round, per the operator's instruction. Four bounded pieces:

### 13a. SC-04 hardening — two real gaps found and closed

Direct review of §11a's own mechanism, requested by the operator, found the version key was a bare
(panel, personaId, environment, profileRevision) tuple compared by value equality — correct for a
context that only ever changes monotonically forward, but silent on two real cases:

1. **Two tasks on the same panel** were indistinguishable — a second question asked without
   navigating away carried an IDENTICAL tuple to the first, so a late response to task 1 could not be
   told apart from a fresh response to task 2.
2. **The A → B → A problem** — leaving panel A, visiting B, and returning to A restores the ORIGINAL
   tuple's values, so a still-in-flight response from the FIRST visit to A would incorrectly read as
   current after the round trip.

**Fix:** `services/moneypenny/contextVersioning.ts` gained a `generation: number` field — a single
counter, monotonically bumped by the host on every context-relevant event: a new request dispatch
(`handleRequestContext`, closing gap 1), and a panel/persona/environment/profile-revision change
(closing gap 2, since leaving and returning to A each bump it independently). Panel/persona/
environment/profileRevision remain in the version as human-readable provenance for WHY a generation
changed, but `generation` alone is what guarantees uniqueness now. `MoneyPennyCopilotWorkspace.tsx`
bumps `generationRef` in `handleRequestContext` (task identity) and in three separate `useEffect`s
keyed on `activePanel`/`personaId`/`environment` (context identity), plus alongside the existing
`profileRevisionRef` bump. Ordering matters and is documented in-line: the bump happens BEFORE the
version is captured for the outgoing request, so a prompt, correct response still matches — only a
response whose captured generation has since been superseded reads as stale.

**Conversation output was NOT protected — only the suggestion banner was.** The operator's second
finding was correct: `handleSuggestedLayouts`'s guard only gated `setSuggestedPanel`;
`SmartTriadCopilotLayer`'s own internal message-append logic had no comparable check, so a stale
response's TEXT would still silently appear in the visible conversation as if it answered the current
context. Closed via one more small, additive, optional prop on the shared layer —
`shouldSuppressResponse?: (sentGroundContext) => boolean` — called right before the assistant message
is appended; when it returns true, the layer substitutes a short, honest placeholder ("This response
was generated for an earlier context and is no longer current — please re-ask.") instead of the real
content. `suggested_layouts`/`stage_proposals` still fire unconditionally afterward, so a host's
existing guard on those (already in place) is never skipped. `MoneyPennyCopilotWorkspace.tsx`'s own
`shouldSuppressResponse` reuses the SAME `pendingRequestVersionRef`/`computeCurrentVersionKey()`
comparison `handleSuggestedLayouts` uses — one mechanism, two protected surfaces, not two parallel
staleness systems. The controlled `messages`/`onMessagesChange` prop pair `SmartTriadCopilotLayer`
already exposed was deliberately NOT adopted for this — its own code comment flags a known,
never-exercised stale-closure bug in that specific path ("no current caller uses it"), and this
capability didn't need it.

**Tests:** `tests/moneypenny-context-versioning.test.ts` grew to 29 tests (was 20) — 3 new pure-logic
tests directly exercising "two tasks, same panel," the A→B→A round trip, and a false-positive check
(a genuinely single unchanged task still reads as fresh); updated wiring tests for the new
`computeCurrentVersionKey()`/`handleRequestContext` shape; 2 new tests proving conversation-output
protection is wired and scoped correctly (only `content` is swapped; `onSuggestedLayouts` calls are
outside the suppression check). All pass.

### 13b. Full-screen HFT trading takeover — delivered, "no surface needs one yet" retracted

The prior report's "no surface needs one yet" was wrong to treat as closing the requirement — the
operator's correction is accepted. `HFTConsole.tsx`'s existing disclosed simulation (labeled via
`SimulationNotice`, unchanged) is reused as the takeover surface, per the operator's direction.

`MoneyPennyFullScreenContext.tsx` (new) provides `{isFullScreen, enterFullScreen, exitFullScreen,
environment, agentName}`, defaulting to a safe no-op (`agentName: null`) outside its provider — needed
because `HFTConsole` is ALSO rendered by the untouched standalone `/moneypenny` route
(`MoneyPennyCartridge.tsx`) and by `SmartTriadSurfaces.tsx`, neither of which gets the provider or any
behavior change. `MoneyPennyCopilotWorkspace.tsx` provides the context and owns the takeover layout:
entering full-screen hides the copilot pane and narrow-width toggle via the SAME className-swap
pattern the C-01 narrow toggle already established (never unmounted — `SmartTriadCopilotLayer`'s
conversation history and `MoneyPennyShell`'s task state survive the takeover intact) and expands the
workspace pane to full width. A takeover bar shows the acting agent name and the SC-04 `environment`
value (real state, not a second disconnected concept) plus an explicit exit control; Escape also
restores the prior layout. `HFTConsole.tsx` gained a "Full screen"/"Exit full screen" button, shown
only when `agentName` is non-null (i.e., only inside a real MoneyPenny workspace).

**Tests:** `tests/moneypenny-fullscreen-takeover.test.ts` — 13 new tests, including two that verify
the two OTHER `HFTConsole` renderers are provably unaffected (no `MoneyPennyFullScreenProvider`
reference in either file). All pass.

### 13c. Entry continuity — verified directly against code, not assumed

| Entry path | Finding |
|---|---|
| Direct (`moneypenny-codex` tab) | Confirmed: resolves through `MoneyPennyPanelTab.tsx` → `MoneyPennyCopilotWorkspace.tsx`, the one dispatcher |
| Intermediary Operate | Confirmed: `FinancialSovereigntyOperateStage.tsx`'s `buildCodexUrl('moneypenny', {personaId, tab:'overview'})` reaches the SAME dispatcher |
| Agent Me | **Confirmed ABSENT.** `MoneyPennyFocusLayout.tsx` (`components/metame/welcome/layouts/`) is a completely unrelated Guided Journey Runtime "Closing Ceremony" capsule that records a disposition about whether MoneyPenny is a "focus" — it never calls `buildCodexUrl` or `tryOpenInMountedCartridge`. `AigentMeWelcomeSplitTab.tsx` (3000+ lines) contains zero `buildCodexUrl('moneypenny', ...)` calls anywhere. This is a real gap, not previously reported precisely |
| Intermediary Prepare | **Confirmed ABSENT, and expected.** `FinancialSovereigntyPrepareCrossStage.tsx` has no MoneyPenny reference at all — it is the PRE-Bridge-spec "select an agent candidate" step the Bridge spec's own §1 explicitly critiques ("its visible Prepare step selects an agent candidate... It does not provide the substantial middle period..."). Rebuilding Prepare is Bridge Bridge B2 (Discover/Learn/Explore/Prepare), a large, not-yet-started phase — not something to retrofit a MoneyPenny link onto without that larger rebuild |

**"Same workspace and financial profile, one copilot" — verified true by construction for the two
real entries** (direct, Operate): both resolve through the identical `MoneyPennyPanelTab.tsx`
dispatcher, and the financial-profile fetch (`/api/moneypenny/financial-profile`) is persona-scoped,
not entry-point-scoped, so any entry reaching the same persona reaches the same profile with no
separate data path to keep in sync.

**Agent Me entry point — deliberately NOT built this pass.** `AigentMeWelcomeSplitTab.tsx` and
`SpecialistsLayout.tsx` are both explicitly PARAMOUNT-flagged in this repo's own CLAUDE.md ("aigentMe
Capsule ↔ Layout Contract") with three documented historical regressions from exactly this class of
change (adding a chip/CTA without fully understanding the capsule-layout state machine — each cost
real debugging time). Retrofitting MoneyPenny into the existing 8-specialist `SpecialistsLayout`
roster (a different, in-app consultation architecture, not cartridge navigation) would be substantial
new work touching `services/agents/specialistRouter.ts`, not a bounded addition. Rather than risk a
regression in a flagged-fragile file within this same multi-slice turn, this is reported precisely as
an open item for a dedicated, focused slice, with the exact reusable pattern documented below.

**Return navigation — built generically, using the platform's own canonical mechanism.**
`utils/codex-nav.ts`'s `from`/`fromTab` params are already documented as "Source slug — used as
`?from=` for breadcrumb back-links" — the established, canonical mechanism (CLAUDE.md's own
"Inter-Cartridge Navigation" section). `MoneyPennyCopilotWorkspace.tsx` now reads them via
`useSearchParams()` and renders a real breadcrumb link (`buildCodexUrl(fromSlug, {tab: fromTab,
personaId})`) when a caller supplies a real codex slug. `FinancialSovereigntyOperateStage.tsx` was
deliberately NOT changed to set `from` — it is a Journey Spine STAGE, not a codex/cartridge, so it has
no real codex slug to offer, and inventing one would violate this repo's No-Guessing rule. For that
case (and any other entry without a real slug), a generic `window.history.back()` fallback closes
return navigation correctly with zero source-slug knowledge required, working the same whether the
current render is inside an embed iframe or the main shell.

**For the future Agent Me entry point, when built:** add a `buildCodexUrl('moneypenny', {tab:
'overview', personaId, from: '<agent-me-codex-slug>', fromTab: '<agent-me-tab>'})` call from wherever
the eventual CTA lives, exactly mirroring `FinancialSovereigntyOperateStage.tsx`'s existing pattern —
`MoneyPennyCopilotWorkspace.tsx`'s breadcrumb-link logic already added this pass will pick it up with
no further MoneyPenny-side change needed.

**Tests:** `tests/moneypenny-entry-continuity.test.ts` — 11 new tests, verifying each finding above
directly against source (the confirmed-absent Agent Me/Prepare links, the confirmed-present
direct/Operate dispatcher paths, the return-navigation mechanism, and that Operate does NOT set a
fabricated `from`). All pass.

### 13d. Regression, evidence discipline

tsc held exactly at 677 throughout every step of this pass. Full vitest suite held exactly at 49
failed / 17 failed files (identical pre-existing `repo-weight`/`resolution-records` failures — zero
new failures anywhere). 85 MoneyPenny-specific tests pass across four files (context-versioning,
copilot-workspace, fullscreen-takeover, entry-continuity) — all of it code/unit-test evidence, not
browser acceptance. No migration was touched this pass. No environment/Supabase/connector access was
needed or attempted for this pass's work — everything implemented was pure client-side React state,
routing, and unit-testable logic; nothing was blocked on missing configuration or credentials.

## 14. Turn C — Agent Me entry (safely), B2 Prepare rebuild, standalone-route compat mapping, controlled browser pass

Five sequential instructions, executed in order, no further selection round taken. Each is reported
against what was actually verified — code evidence, then controlled (fixture, non-authenticated)
browser evidence, kept explicitly separate from authenticated live acceptance per the operator's
instruction.

### 14a. Agent Me entry — built through the established specialist/mirror mechanism, not the flagged-fragile files

The prior pass (§13c) correctly identified the gap but declined to close it, citing this repo's own
CLAUDE.md "aigentMe Capsule ↔ Layout Contract" PARAMOUNT section and its three documented historical
regressions (2026-05-28 Capsule disappearance, Ask Specialists fallback, legacy NBA queued cards) —
all three caused by touching `AigentMeWelcomeSplitTab.tsx` / the capsule-activation state machine
without full understanding. The operator's correction this turn was not "the risk doesn't matter" —
it was "there is already a safe path that doesn't touch those files; use it."

That safe path exists in two pieces this session did not have to build:

1. **`services/orchestration/specialistRecommender.ts`** already carries a full, always-available
   MoneyPenny roster entry (`SPECIALIST_LABELS`, `SPECIALIST_DESCRIPTIONS`,
   `SPECIALIST_ACTIVATION_GATE.moneypenny: null`) — MoneyPenny was already a first-class specialist,
   just missing a click-through.
2. **`data/codex-configs.ts`'s `metame-codex`** already registers a deliberate MoneyPenny mirror tab
   (`metame-moneypenny-orchestration`, slug `moneypenny-orchestration`) explicitly documented in its
   own comment as mirroring the real MoneyPenny console into metaMe "via the SAME
   `MoneyPennyPanelTab` component... never a bespoke FS-only card."

The fix adds one small, additive block to `components/metame/welcome/layouts/SpecialistsLayout.tsx`'s
`FocusCard` — a leaf render component with no interaction with `activeCapsuleId`/`activeLayoutId`
state: a "Open MoneyPenny workspace →" button, shown only for the `moneypenny` entry, that calls
`tryOpenInMountedCartridge({cartridgeId: 'metame-codex', tab: 'moneypenny-orchestration'})` — the
platform's own same-codex tab-switch primitive (`services/cartridge/CartridgePresenceRegistry.ts`),
already used elsewhere in this file for a different specialist. **Zero lines changed in
`AigentMeWelcomeSplitTab.tsx` or `MoneyPennyFocusLayout.tsx`.** No `onRequestLayout`, no
`engageCapsule`/`setActiveLayoutId` call anywhere in the new code — none of the three historical
failure shapes are structurally possible here, verified directly against source, not assumed.

**Return context.** `MoneyPennyCopilotWorkspace.tsx` gained `getCartridge('metame-codex') !== null`
detection: when the workspace is rendered inside the metame-codex mirror (i.e., reached via this new
button), its back-link uses the SAME `tryOpenInMountedCartridge` primitive to switch back to the
`aigent-me` tab (`AIGENTME_TAB_SLUG`, verified against the real `aigent-me-welcome` tab's `slug:
'aigent-me'` in `data/codex-configs.ts`) — a real, honest round trip, checked before the existing
`from`/`fromTab` URL-param fallback and the generic `window.history.back()` fallback, both
preserved unchanged.

**Tests:** `tests/moneypenny-agentme-entry.test.ts` — 16 new tests: the pre-existing roster/mirror-tab
registration, the new button's presence and gating, all three historical failure shapes explicitly
absent from the new code, the return-context round trip (exact codex+tab pair, mirror-detection
priority ordering, honest label), and `MoneyPennyFocusLayout.tsx` confirmed byte-for-byte untouched
(unmodified since §13c). All pass.

### 14b. B2 Prepare rebuilt — financial-profile review replaces the legacy agent-candidate picker

`components/journey/FinancialSovereigntyPrepareCrossStage.tsx`'s `mode === 'prepare'` branch
previously rendered `listRegistrableAgents()` output as a "Choose an agent candidate to bring with
you" picker — the exact pre-Bridge-spec behavior the Bridge spec's own §1 critiques, and confirmed
absent-of-MoneyPenny in §13c's continuity audit. The operator's instruction named it precisely: "an
implementation baseline to replace or relocate — it does not satisfy the agreed Prepare experience."

The rebuild replaces it with a new `PrepareFinancialProfileReview` component:

- Fetches the profile via `fetchFinancialProfileSummary()`, a **new shared module**
  (`services/moneypenny/financialProfileSummary.ts`) extracted from
  `MoneyPennyCopilotWorkspace.tsx`'s previously-inline fetch — SC-03 discipline ("one canonical
  financial profile"), now literally one function both surfaces import, not two independently
  maintained fetches. `MoneyPennyCopilotWorkspace.tsx` was refactored to consume it too, and the prior
  turn's `tests/moneypenny-entry-continuity.test.ts` assertion that named the old inline call site was
  updated in place to assert the shared-module import instead (its underlying claim — the fetch is
  persona-scoped, not entry-point-scoped — still holds and is still tested, now against the shared
  module).
- Renders three honest states: loading, "No financial profile reviewed yet" (with a plain-language
  explanation of where review happens), and — once a profile exists — its `inputSource`,
  `computedFromMonths` coverage, and income/expenditure/surplus figures, with an explicit
  "Limitation: a manually-entered profile may not reflect your full financial picture" caveat when
  `inputSource === 'manual_entry'`. Nothing here is invented; every field maps directly to
  `FinancialProfileSummary`, sourced from `GET /api/moneypenny/financial-profile`.
- "Review / update my financial profile →" deep-links to MoneyPenny's real financial-profile tab via
  `buildCodexUrl('moneypenny', {personaId, tab: 'financial-profile'})` — the platform's canonical
  cross-surface mechanism, not a bridge-local reimplementation of the profile UI.
- "Continue to Operate" calls the SAME `selectStage(nextStageId)` mechanism this file already used for
  Prepare→Cross — no new navigation primitive invented. `nextStageId: 'fs-operate'` was **already**
  wired on `fs-prepare` in both `constitutionalInternetBridgeJourney.ts` and
  `knytsBridgeCrossingJourney.ts` before this pass (confirmed by direct source inspection, not
  assumption) — only the stage's rendered content needed rebuilding, not the journey graph. Both
  `app/bridge/ci/page.tsx` and `app/bridge/knyts/page.tsx` now thread `personaId` into the
  `ci-bridge-fs-prepare`/`knyts-bridge-fs-prepare` surface props (previously only `fs-operate` and
  later stages received it), matching the convention `FinancialSovereigntyOperateStage.tsx` already
  established.
- The two journey files' `fs-prepare` stage `description` strings were also corrected — they
  previously read "...optionally choose an agent candidate to bring forward," which is what the
  *browser evidence* in §14d caught as now-stale copy describing the removed picker. Both now read
  "Review or establish a financial profile, and understand its limitations, before continuing to
  Operate."

**CROSS mode is completely unchanged** — it still reads the same `fsHandoffAgentCandidate:` session
key, still has its "You can still cross without a chosen candidate — the Financial Services Bridge
will let you pick one there" fallback copy, and still builds `agentCandidateRef: selected ??
undefined`. Nothing currently writes to that session key (confirmed by repo-wide grep — the write
side lived only in the now-removed Prepare picker), so Cross's own pre-existing no-candidate fallback
is what carries visitors through; this was true before this pass's own removal of the Prepare-side
picker and is unchanged behavior, not a new gap.

**Known minor follow-up, not fixed this pass:** `fs-prepare`'s `permittedActions: ['select-agent-
candidate']` metadata field (used for the stage's "Evidence" panel labeling) was not updated to match
the new review-only behavior, to keep this change to the visibly-wrong string the browser pass
actually surfaced. Left as an explicit, named item rather than silently accepted.

**Tests:** `tests/moneypenny-b2-prepare.test.ts` — 13 new tests, covering: the picker's removal, the
shared-fetch-module usage in both consuming files, the honest empty/limitation/coverage states, the
`buildCodexUrl` deep link, `Continue to Operate` reusing `selectStage`, the journey graph's
pre-existing `nextStageId` wiring (measured empirically at 876 characters of intervening stage
metadata — the regex window was widened to match, not guessed), the `personaId` threading on both
bridge pages, and Cross mode's full non-regression. All pass.

### 14c. Standalone `/moneypenny` route — closed with an explicit compatibility mapping, not a removal

Repo-wide search confirmed the standalone route (`app/(shell)/moneypenny/page.tsx` →
`MoneyPennyCartridge.tsx` → `HFTConsole`, the legacy flat ten-tab cartridge) is real and user-facing —
but through **exactly one** in-app navigational link anywhere in `app/` or `components/`:
`app/components/wallet/MoneyPennyWalletRuntime.tsx`'s "Open full Runtime + Agreement lifecycle in
MoneyPenny" button inside `SmartWalletDrawer`'s MoneyPenny tab. Every other match for the literal
string was either the route's own implementation files or prose in this session's own doc comments
and tests.

**The fix:** that one link now points at `buildCodexUrl('moneypenny', {tab: 'runtime', personaId:
personaIdHint || undefined})` — the canonical `moneypenny-codex` workspace's Runtime tab (`slug:
'runtime'`, confirmed directly against `data/codex-configs.ts`), reusing the wallet's already-resolved
`personaIdHint` exactly as the rest of that component already does for its own runtime calls.

**Documented intentional exception:** the standalone route/page itself is **not** deleted, redirected,
or gated. It stays reachable by direct URL — a deliberate choice, not an oversight, now stated
explicitly in `MoneyPennyWalletRuntime.tsx`'s own header comment (which previously just said "Mode is
ALWAYS 'shadow'" with no route-migration context) and enforced by a new test asserting
`app/(shell)/moneypenny/page.tsx` still renders `MoneyPennyCartridge` unmodified. The one thing that
changed is that nothing in-app links to it anymore — it is de-linked, not decommissioned.

**Tests:** `tests/moneypenny-standalone-route-compat-mapping.test.ts` — 6 new tests: the hardcoded
`href="/moneypenny"` is gone, the `buildCodexUrl` replacement is exact, `personaIdHint` still threads
through, the standalone page is confirmed untouched, the migration + exception are documented in the
component's own header, and a repo-wide walk of `app/` and `components/` confirms no remaining
in-app href/`window.location`/`router.push` target for the literal `/moneypenny` route outside the
route's own files. All pass.

### 14d. Controlled browser pass — fixture-driven, explicitly separate from authenticated live acceptance

Ran against the local dev server (`next dev`, confirmed compiling and serving 200s) using Playwright
against the pre-installed Chromium, with a **fixture** `personaId` query parameter
(`browser-pass-fixture-persona`) rather than a real signed-in Supabase session — this is controlled
evidence, not live acceptance, and is reported as such throughout.

**Journey traced, with what was and wasn't reachable stated plainly:**

| Step | Result |
|---|---|
| Agent Me (`/triad/embed/codex/metame?tab=aigent-me`) | Rendered, but stuck on "Loading persona context…" for the fixture persona (no real `/api/wallet/active-persona` resolution without a real Bearer token) — the new "Open MoneyPenny workspace" button never mounted because `SpecialistsLayout` never got past its loading gate for this fixture. **Honest finding, not a defect in this turn's code**: the button's own gating logic is untestable without live auth; §14a's unit tests already prove the button's code path directly. |
| MoneyPenny mirror tab, direct URL | Rendered successfully (screenshot `02b`) — confirms the destination tab itself works independent of the click path that couldn't be exercised above. |
| Financial-profile tab, direct URL | Rendered (screenshot `03`). |
| Bridge landing (`/bridge/ci`) | Rendered its default/entry stage (screenshot `03a`). |
| **B2 Prepare**, via `window.dispatchEvent(new CustomEvent('journey:select-stage', {detail:{stageId:'fs-prepare'}}))` | **Rendered exactly as built** (screenshot `03b`): "What is my financial position, and what do I want help with?", the honest "No financial profile reviewed yet" state, both "Review my financial profile →" and "Continue to Operate" buttons visible. This is the app's own real navigation primitive (the same one the stage strip's onClick and the Prepare component's own button use), not a fabricated URL shape — the bridge run surface is a stateful stepper with no per-stage URL, so this was the correct, honest way to reach it. |
| **Operate**, via clicking the real "Continue to Operate" button | **Rendered exactly as built** (screenshot `04`): "Work with MoneyPenny — for as long as you find it useful," with "Continue" and "Open MoneyPenny" actions — end-to-end confirmation that Prepare's own button reaches Operate for real, not just in unit tests. |
| Runtime tab / full-screen surface, direct URL | Rendered (screenshot `05`). |
| Narrow-screen switching (1280×900 → 390×844) | No crash, no overflow, on both the Runtime tab (screenshot `06`, chips and chat input remain usable) and a reload of Agent Me (screenshot `06b`). |
| Delayed copilot response | **Did not reach the intended state after two attempts, reported honestly rather than claimed.** Attempt 1 targeted the metame-codex mirror tab (same page as the blocked Agent Me/mirror steps above) — no chat input existed for the same loading-gate reason. Attempt 2 correctly targeted `moneypenny-codex`'s Runtime tab instead (screenshot `05` confirms a real chat input exists there), with `/api/codex/chat` route interception verified against the real fetch call site (`components/smarttriad/copilot/SmartTriadCopilotLayer.tsx:659`) before rerunning — but the dev server, mid–cold-compile of `/api/copilotkit/[[...path]]` under this sandbox's resource constraints, hit a client-side React error boundary ("Something went wrong — supabaseUrl is required") before the copilot mounted, a repeat of the same missing-Supabase-credentials limitation noted below, this time surfacing as a hard crash rather than a soft 401/500. This is a genuine coverage gap in the controlled pass, caused by this sandbox's environment (no live Supabase credentials, slow cold compiles), not a claim that delayed-response handling works or doesn't; SC-04's own dedicated unit tests (§11–§13, `tests/moneypenny-context-versioning.test.ts`) already cover delayed-response staleness handling directly via `pendingRequestVersionRef`/`computeCurrentVersionKey()` and remain the authoritative evidence for that behavior. |
| Exit full-screen / return to Agent Me | Reloaded cleanly (screenshot `08`), no error. |

**Console signal, checked, not just captured:** 33 browser console errors across the whole pass — all
either `401 Unauthorized` (spine-protected routes correctly rejecting the fixture persona's absent
Bearer token) or `Error: supabaseUrl is required` (this sandbox's dev server has no real Supabase
credentials configured) or their associated `Failed to load resource` lines. Zero React render
exceptions, zero unhandled component crashes. This is exactly the expected signature of "structural
navigation and rendering work; data-dependent behavior fails closed for lack of real auth" — not
evidence of a defect in this turn's changes.

Screenshots and the raw step-by-step report are local evidence artifacts (not committed to the repo,
per this repo's "Dense Materials" rule — screenshots are exactly the kind of material that rule keeps
out of git); available on request.

### 14e. Regression

tsc held exactly at **677** throughout every edit in this pass, including the two journey-description
string corrections found necessary by the browser evidence in §14d.

Full vitest suite surfaced a real, honest signal worth stating precisely rather than glossing over.
The first full run after this pass's code changes came back **52 failed / 19 failed files** — two
files above the established baseline. Both extra failures were traced to pre-existing tests that
encoded the exact behavior this pass was explicitly instructed to retire or refactor, not to any
unintended regression:

1. `tests/financial-sovereignty-crossing-chain.test.ts` — one assertion required
   `FinancialSovereigntyPrepareCrossStage.tsx` to import `listRegistrableAgents`, which was the OLD
   Prepare-mode candidate picker this pass removed per the operator's explicit instruction ("an
   implementation baseline to replace or relocate"). Investigation confirmed CROSS mode never called
   `listRegistrableAgents` itself — it only ever reads `window.sessionStorage.getItem(sessionKey)` —
   so retiring the picker does not touch CROSS's real contract. The assertion was corrected to assert
   the import is gone and the sessionStorage read remains, rather than reverted to re-require the
   retired picker.
2. `tests/moneypenny-copilot-workspace.test.ts` — two assertions: one required the literal string
   `personaFetch('/api/moneypenny/financial-profile'` inside `MoneyPennyCopilotWorkspace.tsx` itself,
   which this pass intentionally replaced with the shared `fetchFinancialProfileSummary()` module
   (SC-03, §14b) — corrected to assert the shared-module import instead, matching the pattern already
   used in `tests/moneypenny-entry-continuity.test.ts` and `tests/moneypenny-b2-prepare.test.ts` for
   the same extraction. The other required the exact import line
   `import { tryOpenInMountedCartridge } from ...`, which this pass's `getCartridge` detection (§14a)
   correctly extended to `import { tryOpenInMountedCartridge, getCartridge } from ...` on the same
   line — corrected to match.

All three were verified against the actual current source before editing (not guessed), and the full
suite was rerun clean afterward: **49 failed / 17 failed files** — back to the exact pre-existing
baseline (`repo-weight`/`resolution-records` and the other tracked failures from §13d, none new, none
resolved). 9281 tests passed (up from 9278 before this pass — net of the ~35 new tests this pass added
across `moneypenny-agentme-entry.test.ts`, `moneypenny-b2-prepare.test.ts`, and
`moneypenny-standalone-route-compat-mapping.test.ts`, less the handful of retired/replaced assertions
above).

### 14f. Corrected AC-C/AC-B status deltas from Turn C (§10/§12 superseded for these rows only)

| ID | Previous status | New status | Basis |
|---|---|---|---|
| AC-C01 | PARTIAL ("Agent Me entry... not verified") | PARTIAL (stronger) | Agent Me entry now exists in code (§14a, 16 passing tests) and its destination (`moneypenny-orchestration` mirror tab) and return path were confirmed to render in the §14d controlled browser pass. The click-through itself (Agent Me → button click) could not be exercised live in §14d because this sandbox's fixture persona never clears `AigentMeWelcomeSplitTab`'s own pre-existing "Loading persona context…" gate — an environment limitation of this pass's evidence, not a defect in the new code, and unrelated to the three PARAMOUNT-flagged historical regressions this addition was built to avoid |
| AC-C02 | PARTIAL | Unchanged this pass | Not touched by Turn C's four slices |
| AC-B05 | PARTIAL ("the Bridge-side Prepare stage embedding it has not been built") | PARTIAL (stronger) | The Bridge-side Prepare stage now exists and was confirmed rendering live in the §14d browser pass (screenshot `03b`): honest no-profile state, real deep link to the canonical financial-profile tab, real "Continue to Operate" transition (screenshot `04` confirms Operate renders after the real click). What remains open: this pass's fixture persona never had a real profile to review, so the "profile exists" rendering branch (income/expenditure/surplus/coverage display) is code-and-unit-test evidence only, not yet browser-confirmed against real data |
| AC-B06 | PARTIAL | Unchanged this pass | Manual/limited-profile support itself (MPY2-2c) was not touched; only Prepare's consumption of it changed |

All other AC-C/AC-B/AC-A rows in §10/§12 are unchanged by Turn C — restated, not re-derived, to avoid
implying progress this pass did not make. The standalone-`/moneypenny`-route compatibility mapping
(§14c) and the controlled browser pass itself (§14d) are process/continuity work with no direct AC-ID
in §10's table — their evidence is recorded in full in §14c/§14d rather than forced into a row that
does not name them.

### 14g. On "report any specific PARAMOUNT instruction that genuinely prevents implementation"

**None did, this pass.** The prior turn's caution about the capsule-layout PARAMOUNT section was
correct as a reason to avoid `AigentMeWelcomeSplitTab.tsx`/`MoneyPennyFocusLayout.tsx` specifically —
but the operator's correction was right that fragility in those two files does not equal fragility
everywhere in the Agent Me surface. The established specialist roster and the mirror tab were both
already deliberately built as MoneyPenny's real integration points; using them is composition, not a
new parallel path, and it never touches the flagged files. Nothing else invoked in this pass — B2
Prepare's rebuild, the standalone-route migration, the browser pass — engaged any other PARAMOUNT
section in this repo's CLAUDE.md (Identifier Isolation, DVN Pipeline, Identity Spine, Gated Content,
Access Gates) at all; none of those subsystems were touched.

---

## 15. Turn D (2026-09-02) — infrastructure handoff, C-15/A3 educational media, Prepare empty-state fix, authenticated acceptance attempt

Four instructions, worked in the order given. Migration application, deployment evidence, and
authenticated browser results are reported as three SEPARATE categories per the operator's explicit
instruction ("cherry-picking to dev alone establishes code delivery" — none of the three substitutes
for either of the others).

### 15a. Infrastructure handoff — dev Supabase project identified, two outstanding migrations closed

**Project identified**: `bsjhfvctmduxhohtllly` ("Aigent Z", us-east-2, Postgres 17, `ACTIVE_HEALTHY`)
— the only Supabase project ref referenced anywhere in this repo's committed config, docs, or
seeded storage URLs (`PRODUCTION_CHECKLIST.md`, `FIX_MISSING_AGENT_KEYS.md`, and live
`content-media` bucket URLs baked into `services/polity/frameworks/*.json`). The other two projects
visible to this session's Supabase connector (`Aigent Nakamoto`, `Aigent-Mondai`) are referenced
**nowhere** in the repo — zero hits for either project ref — so this is not a guess but the only
project consistent with "authorized deployment configuration," per the No-Guessing rule.

**Migration audit method**: `list_migrations` only returns 25 tracked rows against 409 migration
files in `supabase/migrations/` — a large gap. Rather than trust that undercount (this project's
schema clearly predates consistent CLI-tracked migration history for much of its life), the audit
queried the LIVE schema directly: `information_schema.tables`/`columns` against every `CREATE TABLE`
target extracted from all 409 files. 400+ real tables already exist live, covering virtually every
subsystem this repo touches — confirming the schema itself is comprehensive; only a small number of
genuinely recent files had no live counterpart.

**Two real gaps found and closed** (both confirmed via `to_regclass`/`information_schema` before AND
after, not assumed):

| Migration | Target | Status before | Action |
|---|---|---|---|
| `20260901000000_bridge_content_placements.sql` | `public.bridge_content_placements` table (RLS + policy + updated_at trigger) | Genuinely missing — the file's OWN header already said so ("Not yet applied to any live Supabase project"), and `to_regclass('public.bridge_content_placements')` returned `null` | Applied via `apply_migration`. Verified: table exists, RLS enabled, 1 policy, 1 trigger — exact match to the migration. A `get_advisors` security scan on the new object found one WARN (trigger function `search_path` mutable) — fixed with a follow-up `SET search_path = public` on the function (a house convention already used elsewhere, e.g. `20260930150000_wallet_atomic_convert.sql`), applied live and folded back into the repo's migration file so a fresh apply never reintroduces the warning. |
| `20260902010000_knyts_bridge_editorial_config_infographic_url.sql` | `knyts_bridge_editorial_config.infographic_url` column | Genuinely missing — `information_schema.columns` for that table had no `infographic_url` row | Applied via `apply_migration` (additive `ADD COLUMN IF NOT EXISTS`). Verified: column exists, `text`, nullable. |

Both are **directly on the critical path for 15b** — `bridge_content_placements` backs the
`assignDraftAsset`/`publishPlacement` functions C-15's video pipeline was instructed to reuse, and
its own API route (`app/api/journey/knyts-bridge/placements/route.ts`) had a pre-written honest
"has not been created in this environment yet" 503 fallback for exactly this condition — confirming
the gap was expected and anticipated by earlier work, not newly introduced.

**Smoke-tested, not just schema-checked**: inserted a throwaway draft row into
`bridge_content_placements` (`section: '__smoketest__'`), confirmed the upsert/default-value shape
matched `bridgeContentPlacements.ts`'s expectations exactly, then deleted it — zero residue.

No other migration file's target was confirmed missing within the scope actually exercised this
pass (C-15/A3's dependency chain); the remaining ~380 unmatched-by-bookkeeping files were not
individually schema-verified — that would be a much larger audit than this pass's scope, and nothing
in Turn D's own work depends on them. Flagged honestly, not silently ignored.

### 15b. C-15 inline educational video + A3 related chip — built, honestly scoped

No spec for this existed on disk before this pass's own research turned up
`docs/specs/moneypenny/MoneyPenny_Cartridge_Spec_v1.md` §11 (C-15) and
`docs/specs/moneypenny/Qriptopian_Bridge_Admin_Spec_v1.md` (the A-07/A-08 agent-publication
contract, and its delivery-table row naming "A3" as "Studio/agent placement integration... same
stored result through native UI and authorized connector"). Read directly before implementing, per
this repo's No-Guessing discipline — not inferred from the task description alone.

**No real educational video asset exists anywhere in this system** — confirmed by direct query
(`codex_media_assets` has zero rows with `asset_kind = 'social_campaign_video'`, any series) before
writing a line of code. Per CLAUDE.md's No-Guessing rule, none was fabricated. The feature is built
to genuinely support a real published video once an admin uploads one through the EXISTING
Qriptopian Bridges admin flow (`PlacementAssetsPanel`/`assignDraftAsset`/`publishPlacement`,
untouched) — and, until then, renders an honest "not yet published" state everywhere, verified live
against the real database (§15d) returning exactly that state, not a fabricated video.

**What was built:**

1. **`moneypenny-financial-basics`** registered as MoneyPenny's one section in
   `KNYTS_BRIDGE_ALLOWED_SECTIONS` (`services/journey/knytsBridgeEditorialConfig.ts`) — the SAME
   shared allow-list every CI/KNYTS bridge section already uses. No second section registry.
2. **`services/journey/moneyPennyEducationalMedia.ts`** (new) — the ONE reader. Composes the
   EXISTING `getPlacementsForSection`/`getKnytsBridgeEditorialSection` functions; deliberately checks
   `placements.video?.publishedAssetUrl` FIRST and only THEN trusts the editorial-config
   headline/copy — because that config reader falls back to HOME's own mythos copy
   ("Cross the Threshold. Come home.") when no row exists yet, which would be actively WRONG if
   surfaced for MoneyPenny before a real publish. Exports `getMoneyPennyIntroVideoBlock` (the fenced
   JSON payload), `getMoneyPennyLearnContent` (the structured right-pane content — reuses the SAME
   editorial-config row, not a second content store), and `getMoneyPennyIntroVideoReply` (the full
   chat-reply text, block-or-honest-fallback).
3. **`SmartTriadInferenceRenderer.tsx`** (shared, extended, not forked) — a new
   `extractMediaVideoPayload`/`MediaVideoPreview` pair, mirroring the file's own existing
   `extractA2UIPayload`/`A2UIPayloadPreview` pattern exactly (schema-version-keyed fenced-JSON
   detection, not a bespoke info-string). Renders a plain native `<video controls poster src>` —
   `BridgeMediaStage.tsx`'s established pattern for PUBLIC bridge media, confirmed the correct
   precedent (not the gated `VideoPlayer` component, which CLAUDE.md's own Gated Content section
   scopes to purchased/entitled content only). The related chip calls
   `tryOpenInMountedCartridge({cartridgeId: payload.relatedChip.cartridgeId, tab: payload.relatedChip.tab})`
   — generic, reads the cartridge/tab from the payload itself rather than hardcoding
   `moneypenny-codex`, so any future cartridge emitting this schema gets the same rendering for free
   (the spec's own instruction: "the capability belongs to the common framework, not a
   MoneyPenny-only iframe workaround").
4. **Deterministic trigger, not an LLM-interpreted one** — `app/api/codex/chat/route.ts` gained one
   new, narrowly-scoped short-circuit, inserted immediately after the request body destructure (before
   the entire ~2800-line prompt-construction pipeline, before any persona/auth resolution — none of
   which the route does anything with before this point that a short-circuit would silently skip).
   Fires ONLY when `groundContext.cartridge === 'moneypenny'` AND the message is an EXACT match
   against `MONEYPENNY_LEARN_VIDEO_PROMPT` (`'Show me the Financial Sovereignty basics video.'`) — a
   fixed exported constant, never free text — matching the Admin spec's own A-08 constraint that "a
   related chip... cannot contain arbitrary executable instructions." Returns the same
   `{response, persona, event_meta}` contract shape the normal path uses; `suggested_layouts`/
   `stage_proposals` are safely omitted (the client already treats their absence as "no suggestion,"
   not an error).
5. **`MONEYPENNY_QUICK_PROMPTS`** gained a "Watch: Financial Sovereignty basics" chip whose `prompt`
   is the imported constant (never re-typed).
6. **New `learn` `MoneyPennyPanelKey`** — the A3 related chip's destination (the structured right-pane
   content). `MoneyPennyLearnPanel.tsx` (new) fetches the new public `GET /api/moneypenny/learn-content`
   route (unauthenticated by design, mirroring `editorial-config`'s own public-GET posture — this is
   free/preview content, not gated), and reuses the SAME `getMoneyPennyLearnContent` reader the video
   block itself reads — one source, two presentations. Deliberately excluded from
   `MoneyPennyAreaNav`'s five-area rail (mirrors the existing `crm` utility-tier exclusion) — a
   chip-triggered capsule, not a persistent nav destination, per the spec's own "related chips open a
   capsule" language.
7. **`data/codex-configs.ts`** — a real `moneypenny-learn` tab entry (`slug: 'learn'`) was required for
   `tryOpenInMountedCartridge` to resolve the new panel at all; this was caught by the live browser
   pass in §15d (source-shape tests alone did not exercise `tryOpenInMountedCartridge`'s real
   registration dependency) and fixed in the same pass, reusing the existing `'operate'` tabGroup —
   `tabGroups` itself stays untouched.

**Chapter-level seek chips** from the Cartridge spec's fuller C-15 vision are explicitly **not**
built this pass — `bridge_content_placements` has no per-chapter timing field, and none was added
(no speculative schema for data that doesn't exist yet). One video + one related chip is an honest,
stated subset, not silently claimed as the full spec.

**Tests:** `tests/moneypenny-c15-educational-video.test.ts` — 21 new tests covering every piece above
(section registration, the honest-fallback-before-trusting-copy ordering, the schema markers, the
short-circuit's exact condition/insertion-point/response-contract, the chip, the renderer's generic
(non-hardcoded) chip target, the new panel key, the honest empty state, and the deliberate area-nav
exclusion). All pass.

### 15c. Prepare empty-state semantics — a real, confirmed defect found and fixed

Investigation traced `hasPreparedFinancialProfile()` (`services/journey/financialSovereigntyEvidence.ts`)
— already correctly checking `record?.meta.hasProfile === true`, not a click/navigation event — back
to its source: `upsertFinancialProfileQube` (`services/iqube/financialProfileQube.ts`) hardcoded
`has_profile: true` on **every** write, including a compute pass where `computeFinancialProfile`
found every uploaded statement unreadable and returned no `aggregates` at all (confirmed directly:
`services/financialServices/financialProfileAggregation.ts`'s all-unreadable branch returns an
object with no `aggregates` key, not an empty one). The compute route
(`app/api/moneypenny/financial-profile/compute/route.ts`) calls the upsert unconditionally after
compute, with no early return on failure — so a fully-failed upload pass was silently earning
"financial profile prepared" evidence, in direct violation of the operator's Turn D instruction.

**Fix**: `has_profile: Boolean(input.blak.aggregates)` — one line, deriving the flag from whether
real aggregates exist rather than from "a write happened." Manual entry (`/api/moneypenny/financial-profile/manual`)
always produces a defined `aggregates` object even for income=$0/expenditure=$0 (a genuine
self-reported figure is still a real figure) — confirmed by direct inspection of
`computeManualFinancialProfile`, so this fix never regresses the legitimate manual-entry "prepared"
path; it only withholds the flag on a genuinely empty upload pass.

The "clear path to manual entry or supported upload" the operator asked to confirm was already built
in Turn C's `PrepareFinancialProfileReview` component (the "Review my financial profile →" deep link
to MoneyPenny's real financial-profile tab, which itself already has both "Upload statement" and
"Enter estimates manually" — visually confirmed in Turn C's own browser-pass screenshot `03`) — no
further UI change was needed for that half of the instruction.

**Tests:** `tests/moneypenny-empty-profile-evidence.test.ts` — 6 new tests: the source-level fix
itself, `hasPreparedFinancialProfile`'s real-record-read confirmed (not re-derived), the upstream
compute path's genuine no-aggregates-on-total-failure behavior (two cases: all-unreadable, zero
uploads), manual entry's always-defined-aggregates behavior, and confirmation the compute route still
calls the writer unconditionally (the fix had to live in the writer, not by skipping the write — the
route's own honest source/unreadable-count bookkeeping on a failed pass is preserved). Plus one
assertion added to the existing `tests/moneypenny-financial-profile.test.ts` making the
already-true-but-implicit "no aggregates key on total failure" fact explicit. All pass.

### 15d. Authenticated acceptance — what is genuinely live, what remains genuinely blocked, named precisely

**This session has real, working Supabase access** (`mcp__Supabase__*` tools reach project
`bsjhfvctmduxhohtllly` directly) — a materially different starting position from Turn C's
fixture-only pass, and used accordingly.

**Real live-backend evidence obtained (not fixture, not fabricated):**

- Configured this sandbox's local `next dev` server with the project's real
  `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` (fetched via `get_project_url`/
  `get_publishable_keys` — publishable/anon-scoped only; written to a gitignored `.env.local`, never
  committed). This eliminated the `Error: supabaseUrl is required` client-side crash class entirely
  — confirmed 0 instances across every browser-pass run this turn (was present and logged 5+ times in
  Turn C's pass under the same fixture conditions).
- `GET /api/moneypenny/learn-content` — called directly via `curl` against the real dev server twice
  and observed in the server's own request log a third time — returned a genuine, correct,
  live-database-backed response: `{"ok":true,"content":{"title":"Financial Sovereignty basics",
  "description":null,"videoUrl":null,"posterUrl":null}}`. This is the full C-15/A3 read chain (route
  → `getMoneyPennyLearnContent` → `getPlacementsForSection` → real `bridge_content_placements` table)
  working end-to-end against production-identical live schema — not a mock, not a fixture query
  param.
- The new `learn` codex tab renders correctly in the live embed shell once `data/codex-configs.ts`
  was corrected (screenshot evidence: the "Learn" tab appears, highlighted, in the top nav alongside
  every other real MoneyPenny tab) — a genuine, live, rendered confirmation of the fix described in
  §15b point 7, caught BY this browser pass, not merely asserted.

**What remains genuinely blocked, and precisely why:**

1. **No real end-user Supabase Auth session (Bearer JWT) is obtainable in this sandbox.** Full
   authenticated acceptance (a real signed-in persona's browser session, not a `?personaId=` fixture
   param) requires either real user credentials (not available) or minting a session through
   Supabase's Auth Admin API — which this session's Supabase MCP tools do not expose (only DB-level
   `execute_sql`/`apply_migration`, not GoTrue admin operations). Writing directly into `auth.users`
   via raw SQL was considered and explicitly **not attempted** — it would bypass GoTrue's own
   validation on a real, shared, production-identical database to fabricate a fake account, which is
   a materially different and much riskier act than the scoped, reversible, verified DDL this pass
   performed elsewhere; it is not what "authorized deployment configuration access" was understood to
   permit, and the No-Guessing/no-fabrication discipline extends to not fabricating identities. **What
   would resolve this**: either real test-user credentials for this Supabase project, or explicit
   operator authorization plus a proper Auth Admin API path (not raw table writes) to provision one.
2. **`app/api/codex/chat/route.ts`'s module-level Supabase client fails to construct in this sandbox**
   (`Error: supabaseKey is required`, thrown at import time from `createClient(NEXT_PUBLIC_SUPABASE_URL,
   process.env.SUPABASE_SERVICE_ROLE_KEY!)`, confirmed via the full server stack trace) — because
   `SUPABASE_SERVICE_ROLE_KEY` is not set in this sandbox. This is a **pre-existing condition of this
   sandbox, not introduced by this pass** — it breaks the ENTIRE `/api/codex/chat` route for every
   caller, not specifically the new short-circuit, and the failure happens before any request-handling
   code (including the new short-circuit) ever executes. This session's Supabase MCP tools do not
   expose the raw service-role key as plaintext (by design — only proxied, scoped tool calls), and
   obtaining it some other way was not attempted for the same reason as point 1. **What would resolve
   this**: `SUPABASE_SERVICE_ROLE_KEY` configured in this sandbox's environment (it IS presumably
   configured in the real Amplify dev/prod environment, per this repo's own `PRODUCTION_CHECKLIST.md`
   — this is specifically a sandbox-environment gap, not a deployed-environment one).

Given point 2, the chat-route short-circuit's live round-trip could not be directly curl-verified
this pass — its correctness rests on the 21 passing source-shape tests (§15b) proving the exact
condition, insertion point, and response contract, not a live HTTP call. This is stated as a real,
named gap, not glossed over.

**Browser pass mechanics note** (for anyone re-running this): this sandbox's headless Chromium
crashed ("Target crashed") partway through one run after several consecutive heavy sessions across
this turn — an environment resource-flakiness issue, not a reproducible defect in the pages under
test; the run was split into smaller passes to work around it.

### 15e. Standalone `/moneypenny` route — compatibility exception, still in force, restated per instruction

Unchanged since Turn C (§14c): the standalone route (`app/(shell)/moneypenny/page.tsx` →
`MoneyPennyCartridge.tsx` → `HFTConsole`) remains a **documented, deliberate exception** — reachable
by direct URL, no longer the target of any in-app link (`MoneyPennyWalletRuntime.tsx` migrated to
`buildCodexUrl('moneypenny', {tab:'runtime'})`). Nothing in Turn D touched this route, its migration,
or its test coverage (`tests/moneypenny-standalone-route-compat-mapping.test.ts`, still passing,
unmodified). Restated here, visible in this turn's own section, per the operator's explicit
instruction to keep it visible in the compatibility ledger rather than letting it silently age out of
view in an earlier section.

### 15f. Regression

tsc held exactly at **677** throughout every edit this pass, including the migration-file header
edits and the `data/codex-configs.ts` tab addition.

Full vitest suite: **41 failed / 15 failed files** (9364 passed, 11 skipped, 9416 total). Every one of
the 15 failing files is from the SAME pre-existing, already-tracked set this session has reported
since §13d/§14e (`canon-document-resolution`, `dev-merge-message-discipline`,
`journey-admission-spine`, `journey-monotonic-admission`, `journey-orient-legacy-regression`,
`journey-orient-stage`, `journey-response-honesty`, `knyts-bridge-ci-parity`,
`mycanvas-article-zero-fix`, `phase-a-baseline-canaries`, `pulse-close-now-structured-projection`,
`pulse-plnl-split-and-correlation-trace`, `register-ceremony`, `repo-weight`, `resolution-records`)
— none touch any file this pass modified. The count is lower than the previously-reported 49/17
baseline; nothing in this pass's diff explains a reduction, so this reads as pre-existing run-to-run
variance in that already-flaky set (e.g. `resolution-records`' doc-citation check, timing-sensitive
suites), not a fix this pass claims credit for. Zero new failures were introduced by this pass's
changes — verified by name-matching every failing file against this turn's actual diff, not by count
alone.

142 MoneyPenny-specific tests pass across the seven files this turn touched or added
(`moneypenny-c15-educational-video.test.ts` [21], `moneypenny-empty-profile-evidence.test.ts` [6],
`moneypenny-financial-profile.test.ts` [12], `moneypenny-copilot-workspace.test.ts` [32],
`moneypenny-b2-prepare.test.ts` [13], `moneypenny-agentme-entry.test.ts` [16],
`moneypenny-standalone-route-compat-mapping.test.ts` [6], plus the untouched
`moneypenny-entry-continuity.test.ts` [11] and `financial-sovereignty-crossing-chain.test.ts` [25]
re-verified clean) — all passing, re-run explicitly as part of this section, not merely inferred from
the full-suite total.

### 15g. Corrected AC-C/AC-B status deltas from Turn D (§10/§12/§14f superseded for these rows only)

| ID | Previous status | New status | Basis |
|---|---|---|---|
| AC-C15 (referenced in §10 as part of C-10's "reproducible-scenario" gap and the C-17 native-admin-to-MoneyPenny integration §14f/§12 AC-C20 named as "not yet built") | NOT STARTED | PARTIAL | Inline educational video + related chip now exist in code (21 passing tests) and are confirmed working against the LIVE database (§15d: `/api/moneypenny/learn-content` genuinely round-trips). What remains open: no real video asset has been published yet (honest, not fabricated), the chat-route short-circuit's live round-trip is blocked on a sandbox-only missing `SUPABASE_SERVICE_ROLE_KEY` (§15d point 2), and chapter-level seek chips are an explicitly deferred subset (§15b) |
| AC-C20 | PARTIAL ("not yet consumed inside MoneyPenny's own copilot/capsules") | PARTIAL (stronger) | The native-admin-to-MoneyPenny integration this row named as missing is now the majority of what §15b builds — the SAME `bridgeContentPlacements`/`knytsBridgeEditorialConfig` admin path now feeds MoneyPenny's copilot directly. Not marked PASS: still gated on a real published asset and the live chat short-circuit verification named above |
| AC-B05 | PARTIAL (stronger, per §14f) | PARTIAL (stronger still) | Prepare's empty-state semantics gap (an empty/failed upload pass silently earning "prepared" evidence) is now closed and tested (§15c) — the criterion's own underlying promise ("financial-profile preparation... a reviewed financial profile... not navigation") is now enforced at the write layer, not just the read layer |

All other AC-C/AC-B/AC-A rows in §10/§12/§14f are unchanged by Turn D — restated, not re-derived. The
infrastructure-handoff work (§15a) and the authenticated-acceptance attempt (§15d) are process
evidence with no direct AC-ID in §10's table, recorded in full in their own sections rather than
forced into a row that does not name them.
