# MoneyPenny Authoritative Three-Spec Import and Reconciliation (2026-09-02)

**Status:** Import complete. Crosswalk complete (§2, revised §6). Baseline reconciliation performed
in two passes: the first (§3) reconciled the specs' dated snapshot against prior-session work; the
second (§6, this revision) verified the C1 shell's shared-context/copilot-to-capsule/navigation
behavior against the Cartridge spec's actual code and closed the copilot-to-capsule gap it found —
see §7 for what shipped in this pass, preserving every previously-implemented feature untouched.

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
