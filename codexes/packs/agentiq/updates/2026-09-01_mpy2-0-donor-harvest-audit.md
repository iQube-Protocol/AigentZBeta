# MPY2-0 — MoneyPenny002 Donor Harvest Audit

**Status:** TRANCHE 1 OUTPUT — parallel-safe build workstream
**Date:** 2026-09-01
**Governing spec:** `2026-09-01_spec-moneypenny-cartridge-capability-harvest-upgrade.md` (SPEC-MPY-002)
**Work package:** MPY2-0 (spec §14) — mandatory before any further implementation

---

## 0. Access note — read before trusting this audit's donor column

This session had **no filesystem, GitHub, or browsable access to the MoneyPenny002 Lovable
project** (`0fb506ff-5a80-47bf-ad39-ae370e8e8b3c`) — it is not a repo attached to this session, and
no URL for it was supplied. Per this repo's No-Guessing rule, nothing below states donor source
contents as directly observed. Instead:

- The **donor capability/file list** is taken verbatim from SPEC-MPY-002 §4's own mandatory
  inventory table — the spec author's record of the donor, treated as the input, not re-derived.
- The **"already live in canonical repo?" and KEEP/ADAPT/REPLACE/RETIRE columns** are derived from
  direct inspection of this repo's actual `moneypenny-codex` cartridge, `app/(shell)/moneypenny/**`,
  and `services/financialServices/**` — real, read files, cited by path.
- Where a donor row cannot be adapted without a canonical service that doesn't exist yet, this is
  named as a **genuine canonical gap** (spec §14 step 5) rather than guessed at.

**Operator action, if closer donor fidelity is wanted:** attach the MoneyPenny002 repo (GitHub URL
or export) to a future session so its actual source can be read file-by-file against this matrix.

---

## 1. What already exists in the canonical repo (read before assuming a donor row is new work)

The most important finding of this audit: **the canonical `moneypenny-codex` cartridge already
contains components with the SAME names and SAME shape as several donor rows** —
`app/(shell)/moneypenny/components/HFTConsole.tsx`, `PortfolioAnalytics.tsx`, `StrategyBuilder.tsx`,
`ArchitectPanel.tsx`, `RuntimePanel.tsx`, `ServiceOrchestrationPanel.tsx`, `CRMIntegration.tsx`,
`X402Dashboard.tsx`, `FIOManager.tsx`, `MoneyPennySmartTriad.tsx`, `MoneyPennyChat.tsx` — dispatched
through `app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx` into the ten `MONEYPENNY_CARTRIDGE`
tabs (`data/codex-configs.ts`). This is the "Standard Cartridge Navigation Framework" SPEC-MPY-002
§10 refers to.

**These are not harvested-and-adapted donor components — they appear to be an earlier, independent
implementation that already converged on similar names and similar mock-data patterns to the donor
description.** Concretely:

- `HFTConsole.tsx` generates quotes/executions with `Math.random()` in a `setInterval`, styled with
  `bg-white/5 ring-1 ring-white/10` (the CLAUDE.md-forbidden white-hairline residual, not the
  mandated slate house style) — the exact shape SPEC-MPY-002 §7's truthfulness rule and §9
  "Do NOT migrate `execution-engine/index.ts` as the canonical executor" warn about, just already
  present natively rather than freshly ported from the donor.
- `PortfolioAnalytics.tsx` renders fully hardcoded static numbers (`totalValue: 125000`, five fixed
  `recentPerformance` rows dated `2024-01-19`..`2024-01-23`) as if live P&L — same violation class.
- `StrategyBuilder.tsx` has **no backtest/simulation engine at all** (confirmed by grep — no
  `Math.random`, no "backtest" keyword) — so the donor's random-number backtester (§6, explicitly
  excluded) has nothing to collide with here; Scenario/Backtest is a genuine gap, not a donor
  replacement.
- `services/financialServices/serviceCatalog.ts` already implements the canonical Advisor/Architect/
  Runtime/Runtime-Constitutional four-service catalog SPEC-MPY-002 §1/§2.2 requires — this is
  authoritative and untouched by this tranche.

**Consequence for every row below:** "ADAPT the donor's polished UX" in several rows is qualified —
the canonical repo does not need the donor's *code*, because equivalent (if less polished, and less
honest about simulation) canonical components already exist at the same cartridge location. The real
work is (a) truthfulness labelling and house-style correction on what's already live, (b) adding the
capability-navigation layer SPEC-MPY-002 §2.1 describes, and (c) building the genuinely-missing
capabilities (Financial Profile, Risk Envelope, Scenario/Backtest, Opportunities/Arbitrage,
Execution Insights) against real canonical services rather than the donor's Supabase functions.

---

## 2. Harvest matrix

Columns: **Donor capability** (SPEC-MPY-002 §4, as given) · **Already live in canonical repo?**
(file:path, or "no") · **Classification** · **Reason / this tranche's action**.

| Donor capability | Already live in canonical repo? | Classification | Reason / this tranche's action |
|---|---|---|---|
| Bank statement / financial profile analysis | No | **CREATE** (real, not donor-derived) | Genuine gap. Spec §5 hard constraints forbid copying the donor's "simplistic balance-derived formulas" and forbid a parallel `bank_statements` truth store. Before building, a future tranche MUST audit existing secure/private-document and blakQube facilities (spec §5.3) — not done in this tranche; **flagged as MPY2-2 open work**, not started. |
| AI Trade Advisor | Partially — `moneypenny.advisor` service definition (`services/financialServices/serviceCatalog.ts:26-42`) and the `chat` tab (`MoneyPennyChat.tsx`) exist | **ADAPT** (future tranche) | The service mode already exists; a dedicated "Market Research" capability surface reusing it does not yet exist. Referenced as a not-yet-built rail/hub item (`market-research`) in this tranche's capability data; not implemented as a distinct panel yet. |
| Research Agent → strategy recommendation | No | **CREATE** (future tranche) | Genuine gap — no research-to-strategy handoff exists. Not started. |
| Strategy Builder | Yes — `app/(shell)/moneypenny/components/StrategyBuilder.tsx` (`moneypenny.architect` mode) | **KEEP** | Already canonical, already Architect-scoped, already has no fake backtest engine to strip. Wired into this tranche's capability rail under Design → Strategy Lab. No code change this tranche. |
| Backtesting | No (confirmed absent from `StrategyBuilder.tsx`) | **CREATE, engine TBD — never the donor's random-number simulator** | Genuine gap, explicitly flagged as "not yet built" in the capability rail/overview data (`moneypennyCapabilities.ts`) rather than left unlabelled or faked. |
| Advanced intent capture | Partially — `ArchitectPanel.tsx` exists (`architect` panel) | **ADAPT** (future tranche) | Present as a general Architect surface; a dedicated advanced-intent form is not yet built. |
| Execution lifecycle/feed/history | Partially — `HFTConsole.tsx`'s "Recent Executions" list | **REPLACE the mock generator; KEEP the list UX shape** | This tranche added a `SimulationNotice` truthfulness label (`app/(shell)/moneypenny/components/SimulationNotice.tsx`) rather than ripping out the generator outright — replacing it with a real execution feed requires a canonical evidence source (receipts/DVN) this tranche does not wire up. Flagged for MPY2-5. |
| Execution insights / memories | No | **CREATE** (future tranche) | Genuine gap; listed as "not yet built" in the Monitor capability group. |
| Risk dashboard | No | **CREATE** (future tranche) | Genuine gap; listed as "not yet built" in the Design capability group (Risk & Limits). |
| Portfolio analytics | Yes — `app/(shell)/moneypenny/components/PortfolioAnalytics.tsx` | **KEEP shape, REPLACE data, label truthfully now** | This tranche added `<SimulationNotice>` and fixed slate styling. Wiring to real canonical balances/executions is a larger MPY2-5 lift, not done this tranche. |
| Arbitrage scanning | No | **CREATE** (future tranche) | Genuine gap; listed as "not yet built" in the Markets capability group (Opportunities/Arbitrage). Donor's simulated scanner explicitly excluded per spec §9. |
| Liquidity analytics | No | **CREATE** (future tranche) | Genuine gap. |
| Live market / DEX feed | Partially — `HFTConsole.tsx`'s "Live Quotes" list (mock) | **REPLACE data source; KEEP list UX** | Same treatment as Execution lifecycle above — labelled `SIMULATION` this tranche, real provider wiring deferred. |
| Quotes / fee / edge / inventory views | Partially — `HFTConsole.tsx`'s P&L/edge cards | **ADAPT** (future tranche) | Present in simplified form; donor's dedicated `FeeEstimator`/`EdgeGauge`/`InventoryGauge`/`CaptureSparkline` instrumentation is not replicated 1:1 — not started this tranche. |
| Notifications | No | **CREATE** (future tranche) | Genuine gap; MoneyPenny has no notification center today. |
| Chat with capability overlays | Yes — `MoneyPennyChat.tsx` (`chat` tab), plus the platform-wide `CodexCopilotLayer` every cartridge gets | **KEEP** | Canonical agent/runtime remains current MoneyPenny per spec §4's own "Treatment" column; no change needed. |
| FIO / X402 / custody modules | Yes — `FIOManager.tsx` (`identity` tab), `X402Dashboard.tsx` (`x402` tab) | **KEEP, deferred per spec** | Spec §4 marks this donor row "Audit and defer unless a current canonical service maps cleanly" — canonical FIO/X402 panels already exist independently; no donor porting needed or attempted. |
| Donor wallet/persona/auth | N/A — canonical spine only | **RETIRE (donor)** | Per spec §4/§16: never ported. This repo's identity spine (`getActivePersona`, `personaFetch`) remains the only auth surface. No action needed — nothing to retire because nothing was imported. |

---

## 3. This tranche's actual work (MPY2-1, partial)

Scoped conservatively against the risk surface found during the audit (a pinned exact-match test on
`MONEYPENNY_CARTRIDGE.tabGroups`, ~100 MoneyPenny-adjacent test files). See §4 for the discrepancy
this produced against the spec's literal wording.

1. **New file** `app/(shell)/moneypenny/components/moneypennyCapabilities.ts` — the single
   authoritative list of the six SPEC-MPY-002 §2.1 capability groups (Understand/Design/Markets/
   Operate/Monitor, plus Overview), each item pointing at either a real existing tab (`panel:
   MoneyPennyPanelKey`) or `null` for "not yet built" (rendered disabled, never as a fake link).
2. **New file** `app/(shell)/moneypenny/components/MoneyPennyCapabilityRail.tsx` — the persistent
   left-side capability navigation, rendered inside `MoneyPennyShell` on every panel. Navigates via
   the EXISTING `tryOpenInMountedCartridge` seam (`services/cartridge/CartridgePresenceRegistry.ts`)
   — the same mechanism the wallet and Living Canon chips already use to switch a mounted
   cartridge's tab in place. No second router was created.
3. **New file** `app/(shell)/moneypenny/components/MoneyPennyOverviewPanel.tsx` — the capability-led
   landing hub (SPEC-MPY-002's "OVERVIEW"), a card-grid view over the same capability data.
4. **New file** `app/(shell)/moneypenny/components/SimulationNotice.tsx` — the shared truthfulness
   label (spec §7/§9/§13), applied to `HFTConsole.tsx` and `PortfolioAnalytics.tsx`.
5. **Modified** `app/(shell)/moneypenny/components/MoneyPennyShell.tsx` — mounts the capability rail
   alongside `children`; fixed the white-hairline styling to the CLAUDE.md slate house style; fixed
   the connection-status strip to derive ALL four rows from `healthCheck.services` (previously two
   rows — X402/FIO — were hardcoded `"online"` unconditionally, and the "Quotes" row read a
   nonexistent `redis` key that always evaluated `false`/offline regardless of the real stub value).
6. **Modified** `app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx` — added the `overview`
   panel key and now threads `activePanel` down to `MoneyPennyShell` for rail highlighting.
7. **Modified** `data/codex-configs.ts` — added ONE new tab (`moneypenny-overview`, `order: -1`) to
   the existing `operate` tabGroup. `tabGroups` itself is untouched.
8. **Modified** `app/(shell)/moneypenny/components/HFTConsole.tsx` /
   `PortfolioAnalytics.tsx` — slate house-style pass (removed all `white/NN` hairline/text classes)
   and `<SimulationNotice>` labelling.

No AEE, Journey, CTP, DCIR, or wallet-ledger file was read for write access or modified. No
consequential behavior changed — every existing tab, panel, and service definition still resolves
exactly as before; the rail is a pure navigation addition and the status-strip fix only corrects
what "online" badges are allowed to claim.

---

## 4. Discrepancy flagged (spec wording vs. live pinned test — CLAUDE.md "prefer live code, note the discrepancy")

SPEC-MPY-002 §14 (MPY2-1) says to "create Overview / Understand / Design / Markets / Operate /
Monitor grouping." Read literally, this could mean restructuring `MONEYPENNY_CARTRIDGE.tabGroups`
itself into those six group ids.

`tests/fs-operate-embed-viewport-parity.test.ts` (`describe('registry entry
'moneypenny-orchestration-focused'...')`) asserts, with an explicit rationale comment about deep
links and the FS Bridge's Explore-metaMe expand affordance:

```ts
const groupIds = (MONEYPENNY_CARTRIDGE.tabGroups ?? []).map((g) => g.id);
expect(groupIds).toEqual(['operate', 'connect', 'service', 'administer']);
```

Renaming or extending `tabGroups` would require deliberately updating this canary and re-verifying
every consumer of those four ids (the FS Bridge's expand affordance, `journeySurfaceRegistry.ts`,
and an estimated 100 MoneyPenny-adjacent test files surfaced by a repo-wide grep). SPEC-MPY-002
§2.1 itself allows this reading: "Exact labels may be refined against the existing cartridge
navigation framework, but the capability grouping is canonical for this build" — i.e. the
*grouping*, not necessarily the underlying `tabGroups` id array, is what's canonical.

**Decision this tranche:** implement the capability grouping as an ADDITIVE navigation layer (the
rail + overview panel described in §3) rather than renaming `tabGroups`. `tabGroups` stays
`['operate', 'connect', 'service', 'administer']`, unchanged, and the pinned test is untouched and
still green. This satisfies SPEC-MPY-002's acceptance criterion #6 ("A polished side/capability
navigation pattern is integrated without creating a second shell/router") at lower risk than a
tabGroups rename, and is reversible without touching the FS Bridge or its own tests.

**If the operator wants the literal `tabGroups` restructuring instead** (so the top-level codex tab
bar itself shows Understand/Design/Markets/Operate/Monitor rather than Operate(HFT)/Connect/
Service/Administer with a rail nested inside), that is a distinct, larger follow-up tranche —
it requires updating the pinned canary deliberately with operator sign-off and re-verifying the FS
Bridge's expand affordance, not a decision this session made unilaterally.

---

## 5. Canonical gaps flagged for future tranches (spec §14 step 5)

| Gap | Blocks | Priority (spec's stated tranche order) |
|---|---|---|
| No real market-data provider adapter | Market Console truthfulness (real quotes, not `Math.random()`) | MPY2-4 |
| No canonical execution/receipt-backed evidence read path for MoneyPenny | Portfolio/Execution Insights/History as real projections | MPY2-5 |
| No secure bank-statement ingestion + aggregate-derivation service | Financial Profile | MPY2-2 |
| No risk-envelope proposal/storage model | Risk & Limits | MPY2-3 |
| No backtest/scenario engine (real, not random) | Scenario / Backtest | MPY2-3 |
| No arbitrage/opportunity candidate service | Opportunities | MPY2-4 |
| `MoneyPennyClient.healthCheck()` itself is fully stubbed (`"simplified for now"`) | Any real connection-status chrome | Not scoped to any MPY2-N package; flagged here since this tranche's honesty fix (§3.5) only stops it from claiming MORE than the stub reports, it doesn't make the stub real |

None of these are started in this tranche. They are the backlog for MPY2-2 through MPY2-5.

---

## 6. Test/typecheck delta

See the tranche-1 commit message and session report for the before/after `tsc --noEmit` error
count and the test files run.
