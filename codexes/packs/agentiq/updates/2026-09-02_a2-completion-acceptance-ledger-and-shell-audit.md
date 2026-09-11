# A2 Completion, Acceptance Ledger, and MoneyPenny Shell Audit (2026-09-02)

**Status:** Implementation + honest reporting. Deployment (Amplify build) status separately tracked, not asserted.

---

## 1. Live-review fixes (operator watching dev directly)

- `fs-operate`'s breadcrumb label corrected from "Operate with MoneyPenny" to bare **"Operate"** in
  both `knytsBridgeCrossingJourney.ts` and `constitutionalInternetBridgeJourney.ts` — the qualified
  label read poorly truncated in the stage stepper, and the distinct `fs-operate` stage id already
  prevents any routing/receipt collision with the advanced Horizen `aigentme` stage (which also
  shows "Operate") without needing a qualified label. Labels never serve as routing/receipt
  identifiers in this codebase — only stage ids do.
- "Open MoneyPenny" in `FinancialSovereigntyOperateStage.tsx` switched from
  `window.open(url, '_blank')` (popped a new browser tab) to `window.location.assign(url)`
  (navigates within the SAME frame — this stage renders inside the Journey Spine's own iframe).

## 2. A2 completion — integrated asset selection/upload + infographic coverage

Landed inside the **existing native Qriptopian Admin → Bridges** tab (`QriptopianAdminTab.tsx`'s
`BridgesManager`/`PlacementAssetsPanel`), not a new admin surface:

- `PlacementSlot` extended to `'video' | 'poster' | 'infographic'`. Infographic publish updates
  ONLY `bridge_content_placements` bookkeeping — no `knyts_bridge_editorial_config` column exists
  for it, so no bridge page renders one yet. Documented explicitly in code and in the panel's own UI
  copy, never silently presented as equivalent to video/poster.
- `PlacementAssetsPanel` gained real browse/upload, replacing the original paste-a-URL-only slice
  (kept as a fallback):
  - **Browse existing** — `GET /api/admin/codex/assets-by-category?series=bridge&category=social`,
    filtered client-side by the slot's asset kind.
  - **Upload new** — the EXISTING sign → PUT → register pipeline `CodexUploadModal.tsx` already
    uses, with `series='bridge'` and the existing `social_campaign_video`/`social_campaign_image`
    asset kinds (no new kind invented).
- **Authorization closure, done first per the operator's own instruction** — two more routes in the
  same defect class as the upload-asset/storage-register fix from earlier this session:
  - `POST /api/admin/codex/storage/sign` — had **zero auth check** and handed out a signed
    Supabase Storage **write** URL (plus an `existingPath` overwrite of an arbitrary object with no
    ownership check) to any caller. The most severe of the four routes fixed this session.
  - `GET /api/admin/codex/assets-by-category` — had zero auth check, leaked internal asset
    titles/CIDs/status to any caller.
  Both now gated by `requireAdminPersona`; `codexStorageSignHandler.ts` extracted for symmetry with
  its sibling. `QriptopianAdminTab.tsx`'s one caller of `assets-by-category` switched from a raw
  `fetch` to `personaFetch`.
- `codexStorageRegisterHandler.ts`'s encryption skip-list gained `series === 'bridge'` alongside the
  existing `'qriptopian'` exemption — bridge media is served directly to unauthenticated visitors,
  so it must stay genuinely unencrypted/public, the same reasoning that exempts `'qriptopian'`.

## 3. Migration-dependency honest-unavailable audit

A background research pass read every write path touching the two not-yet-applied tables and found
two real gaps (not hypothetical):

| Path | Before | After |
|---|---|---|
| `assignDraftAsset` (bridge placements) | No missing-table detection at all — threw the raw Postgres error, surfaced by the route as a generic "This request threw before it could answer: ...does not exist..." string. | Throws a named `'bridge-placements-table-missing'` error; the route returns a clean `503 { error: 'bridge-placements-unavailable' }`. |
| `POST /api/moneypenny/financial-profile/{compute,manual}` | **Zero try/catch in either route.** `upsertFinancialProfileQube`'s throw on a missing table was unhandled — an unhandled 500 with no JSON body. Client-side this rendered as a generic "compute failed (500)". | `upsertFinancialProfileQube` throws a named `FinancialProfileTableMissingError`; both routes now wrap their handler and return a clean `503 { error: 'financial-profile-unavailable' }`. |

**Left unchanged, deliberately:** the READ paths (`getPlacement`, `getPlacementsForSection`,
`getFinancialProfileQube`) already degrade silently to `null`/empty on a missing table — the same
honest-empty convention this codebase uses everywhere else for a passive read. Only the ACTIVE WRITE
attempts needed a distinct signal, since "your save just failed" and "no data exists yet" are
different facts a user acting on the result needs told apart. `hasPreparedFinancialProfile`'s existing
silent-false degrade is also unchanged and correct — a real user who hasn't prepared a profile and an
environment where the table doesn't exist are indistinguishable to that gate by design.

**Unaffected features stay usable**: nothing in this pass touches the upload/CSV-parse path, the
risk-envelope derivation, the manual-entry compute function, or any bridge page's public read path —
only the write boundary's error handling changed.

## 4. Acceptance ledger — against the REAL specification text

A background research pass searched the entire repo for a committed document defining lettered
criteria "A2", "B1", "C1", "C2", "C-04", "C-05", "C-06". **None exists.** Those labels are ad-hoc
shorthand coined inline in commit messages and code comments across this session (and, per matching
branch name and co-authorship, an earlier portion of this same session that fell outside the
summarized context) — never collected into a lettered spec document. `C-04`–`C-06` in particular do
not appear anywhere in `codexes/packs/agentiq/**`; the only `C-0NN` identifiers in the repo belong to
an unrelated constitutional-invariant numbering scheme in `codexes/packs/irl/foundation/**`. Stating
this precisely rather than inventing a mapping for labels that were never defined.

What DOES exist as committed spec text, and what this session's work maps to:

**SPEC-MPY-002** (`2026-09-01_spec-moneypenny-cartridge-capability-harvest-upgrade.md`) §15, 20
numbered criteria:

| # | Criterion (as written) | Evidence | Status |
|---|---|---|---|
| 7 | Financial Profile can derive a bounded proposed risk/trading envelope without granting trade authority | `riskEnvelope.ts` (MPY2-3), wired into compute/manual routes + `RiskEnvelopePanel.tsx` | **Implemented.** Browser-verified: no (sandbox has no live Supabase credentials — see §6). |
| — | Manual/no-statement financial-profile preparation | `computeManualFinancialProfile`, `POST /financial-profile/manual`, manual-entry form | **Implemented** this session (MPY2-2c). This is the item the operator's own directive named: *"Manual profile entry primarily advances C2/C-04–C-06"* — since no C-numbered doc exists, the closest REAL anchor is SPEC-MPY-002's own §5 "recommendation, never authority" framing plus the standing directive's own "reviewed financial profile or supported manual preparation" language. Recorded here rather than under a fabricated C-code. |
| 8 | Strategy Lab can create/edit/compare/simulate candidate strategies without executing them | Not touched this session — `StrategyBuilder.tsx` exists; backtest explicitly excluded (donor's random-number version, per MPY2-0/0b) | **Not implemented** (backtest). Strategy CRUD: implemented pre-session. |

The other 17 SPEC-MPY-002 criteria were not in scope for this turn's directive and are unchanged
from their state at the start of this session.

**AEE-XP-001** (`2026-08-31_aee-xp-three-paper-execution-build-spec.md`) §17, 25 numbered criteria —
not touched this session; no new claim made against it here.

**A2** (code-comment/commit-message shorthand, `QRP-BRIDGE-ADMIN`) — the one lettered label this
session's own work actually completes, tracked against its own stated scope (per the commit history,
not a separate doc): draft → preview → publish for an asset (implemented, prior session), **integrated
asset selection/upload** (implemented THIS turn — §2 above), **infographic coverage** (implemented
THIS turn as a placement-bookkeeping capability — §2 above; live rendering is a separate, open gap,
stated honestly rather than claimed done). Concurrent-edit/destination-validation/partial-failure
recovery: implemented in the prior A2-hardening pass (`PlacementConflictError`, config-write-first
ordering).

**B1** (`fs-operate` stage) — label/navigation corrected this turn per live review (§1). Structurally
complete per its own prior acceptance (distinct stage id, real fs-prepare evidence, empty
completionEvidence by design).

## 5. MoneyPenny shared shell — audited, NOT restructured this turn

The operator asked to continue toward "copilot left, chips/capsules right, common navigation" for
MoneyPenny. A background research pass found the current reality is materially different from that
target, and restructuring it carries real risk to an already-shipped surface:

- MoneyPenny has **two separate shells** today: the standalone `/moneypenny` route
  (`MoneyPennyCartridge.tsx`, a flat 10-tab interface, no rail, no copilot) and the codex-tab shell
  (`MoneyPennyShell.tsx`, capability rail **LEFT** + panel content **right** — the opposite
  arrangement from "copilot left, chips right", and there is no copilot pane in either shell at all).
- `CodexCopilotLayer.tsx` — the canonical Wallet-Over-Cartridge Overlay pattern CLAUDE.md documents
  (copilot + capability-rail/capsule composition) — has **zero MoneyPenny references**. MoneyPenny
  is simply not wired into that pattern today; it is not that the arrangement is flipped, it is that
  the copilot layer doesn't exist for this cartridge at all.
- Wiring MoneyPenny into `CodexCopilotLayer` per CLAUDE.md's own documented recipe (add to the
  hardcoded `codexId` list in `CodexPanelDynamic.tsx`, pick a copilot agent, let the copilot own
  wallet/panel activation) is a real, bounded recipe — but it is a **structural change to a shipped,
  actively-used 14-panel shell** (`MoneyPennyPanelTab.tsx`'s panel-key switch), not a styling tweak.
  Attempting it inside this already-large turn risked a half-migrated, partially-broken shell with
  no browser verification available to catch the breakage (see §6).
- **Recommendation, not executed this turn:** treat "wire MoneyPenny into `CodexCopilotLayer`" as its
  own bounded slice — audit which of the 14 existing panels genuinely need copilot-driven activation
  vs. which are fine as direct rail destinations, then migrate following the documented recipe with
  its own regression pass. Financial-profile-preparation → Operate connectivity already exists
  independently of this shell question (`FinancialSovereigntyOperateStage.tsx`'s `buildCodexUrl`
  link, §1) and does not require the shell restructure to keep working.
- Existing task/profile/authority models are untouched — nothing in this turn's actual code changes
  touched `moneypennyCapabilities.ts`, `MoneyPennyShell.tsx`, `MoneyPennyCartridge.tsx`, or any
  authority/service-mode logic.

## 6. Deployment precision

- `45e4b132b` (previous turn's push): pushed to dev, confirmed via GitHub. The only checkable GitHub
  Actions signal is "Dev Integration Checks" (a test-suite gate) — its "Run tests" step failed, but
  identically on the two prior dev pushes too (pre-existing, matches the local 49-test baseline, not
  introduced by that push). **No Amplify-specific check exists in GitHub Actions for this repo** —
  Amplify builds via its own external webhook, invisible to this tool. **Deployment (Amplify build)
  status: unverified**, not "deployed."
- `98c0e1274` (this turn's push, four squashed commits): pushed to dev, confirmed via GitHub
  (`b3dd892ab..98c0e1274`). Its GitHub Actions checks were still `in_progress` at push time; same
  caveat applies — **no Amplify signal is visible from this session, so deployment is unverified**,
  separate from the confirmed push.

## 7. Standing unresolved items (unchanged, tracked separately)

- **Infrastructure identity / migration application**: `bridge_content_placements` and
  `financial_profile_qubes` — neither confirmed applied to a live, reachable Supabase project from
  this sandbox. (The repo's own commit history carries an internal contradiction on whether
  `financial_profile_qubes` was applied+verified by the operator directly — noted, not resolved by
  guessing; the operator's own record takes precedence over this session's inability to see it.)
- **Browser/rendering verification**: not performed this turn — this sandbox has no live Supabase
  credentials (confirmed earlier this session; unchanged).
- **KNYT pricing** (`KNYT_ETH_RATE`): untouched, per standing instruction.
