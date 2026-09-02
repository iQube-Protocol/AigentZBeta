# MoneyPenny Authoritative Three-Spec Import and Reconciliation (2026-09-02)

**Status:** Import complete. Crosswalk complete. Baseline-reconciliation findings recorded below.
No further implementation was performed as part of this pass — per the operator's explicit
instruction, the specs' existence does not establish implementation or deployment, and their
dated code baseline had to be reconciled against current source first.

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
