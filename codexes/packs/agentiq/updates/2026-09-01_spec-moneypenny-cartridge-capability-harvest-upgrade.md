# SPEC-MPY-002 — MoneyPenny Cartridge Capability Harvest & Upgrade

**Status:** IMPLEMENTATION SPECIFICATION — parallel-safe build workstream  
**Date:** 2026-09-01  
**Canonical destination:** `moneypenny-codex` cartridge in AigentZBeta  
**Donor application:** MoneyPenny002 Lovable project `0fb506ff-5a80-47bf-ad39-ae370e8e8b3c`  
**Parents / governing architecture:** PRD-MPY-001, AEE-XP-001 / AEE-XP-001A, SPEC-AEE-001, SPEC-JS-001, CTP-001A, CFS-020 DCIR  

---

## 0. Operator ruling

MoneyPenny002 is not to survive as a parallel MoneyPenny product/client.

It is a **capability donor and interaction-design donor** for the canonical MoneyPenny cartridge.

The upgrade SHALL harvest the useful financial capabilities, interaction patterns, navigation and polished console experience from MoneyPenny002 and reconstitute them inside the existing `moneypenny-codex` cartridge, while preserving the newer estate's canonical authority, state, wallet, Journey, AEE, CTP, DCIR, receipt and service-orchestration architecture.

> **Do not port MoneyPenny002. Harvest it.**

> **One MoneyPenny cartridge. One canonical runtime. Many experience altitudes.**

The goal is a MoneyPenny cartridge that is useful to a novice making a first foray into financial services and remains useful to an experienced trader/operator using professional-grade market, strategy, risk and execution tooling.

---

## 1. Existing canonical substrate — reuse, do not replace

The target estate already has the correct constitutional skeleton and SHALL remain authoritative:

- `moneypenny-codex` — canonical MoneyPenny cartridge;
- `ServiceOrchestrationPanel` — current live service chooser/orchestration surface;
- `services/financialServices/serviceCatalog.ts` — canonical service catalogue;
- service modes:
  - `moneypenny.advisor` — grounded/cited informational guidance;
  - `moneypenny.architect` — proposed structures/strategies/artifacts for human ratification;
  - `moneypenny.runtime.constitutional` — consequential Constitutional Service Pipeline;
  - `moneypenny.runtime` — bounded confidential Runtime / Constitutional Commerce path;
- Financial Services Journey / Bridge;
- Journey Spine + AEE control plane;
- canonical wallet/ledger services;
- canonical Activity Receipts and CTP transition evidence;
- CTP Constitutional Runtime for migrated constitutional/consequential acts;
- DCIR for observation and consequence feedback;
- existing persona/agent/passport/delegation/Standing systems.

No MoneyPenny002 implementation may become a parallel owner of these responsibilities.

---

## 2. Core architecture

MoneyPenny needs two independent axes.

### 2.1 User-facing capability axis

The upgraded cartridge SHOULD organize work around what the person is trying to do:

```text
OVERVIEW

UNDERSTAND
  Financial Profile
  Market Research
  Learn / Explain

DESIGN
  Strategy Lab
  Risk & Limits
  Scenario / Backtest

MARKETS
  Market Console
  Quotes / Prices
  Liquidity
  Opportunities / Arbitrage

OPERATE
  Trading Intents
  Automation
  Runtime
  Executions

MONITOR
  Portfolio
  Risk
  Performance
  Execution Insights
  History
```

Exact labels may be refined against the existing cartridge navigation framework, but the capability grouping is canonical for this build.

### 2.2 Service-mode axis

Advisor / Architect / Runtime remain the constitutional/service mode underneath those capabilities.

Examples:

```text
"Explain BTC liquidity"
  → Advisor

"Design a strategy within my risk envelope"
  → Architect

"Run the approved strategy within delegated limits"
  → Runtime
```

The user should not have to choose a technical service mode before expressing their goal. AEE / orchestration may resolve the appropriate mode from intent, eligibility and consequence class.

> **Capability is user-facing. Provider/service mode governs how the capability may act.**

---

## 3. Experience rule — one professional system, graduated experience

Do not create a beginner MoneyPenny and an expert MoneyPenny.

Use the same professional capability system at different experience altitudes:

```text
novice
  → explanation / Pill / Capsule / guided view

intermediate
  → guided tools / simulations / recommendations

advanced
  → full strategy, market, risk and analytics surfaces

operator
  → bounded Runtime / automation / consequential execution
```

AEE may change presentation, sequence, density and composition. It may not change constitutional truth, eligibility, authority, delegation or execution semantics.

> **Capability does not get dumbed down; experience gets graduated.**

---

## 4. MoneyPenny002 donor inventory — initial mandatory harvest map

The parallel agent MUST complete a file-by-file donor inventory before deleting or rewriting donor concepts. The following capabilities are already confirmed and form the minimum harvest scope.

| Donor capability | Representative donor files | Canonical destination | Mode(s) | Treatment |
|---|---|---|---|---|
| Bank statement / financial profile analysis | `supabase/functions/banking-document-parser/index.ts`, banking UI/profile flow | Financial Profile / Risk Envelope | Advisor + Architect | **Adapt** concept and UX; replace crude heuristics and donor persistence |
| AI Trade Advisor | `src/components/AITradeAdvisor.tsx`, `supabase/functions/ai-trade-advisor/index.ts` | Advisor / Research | Advisor | **Adapt** UX; use canonical grounded/cited intelligence, not donor prompt-only epistemics |
| Research Agent → strategy recommendation | `ResearchPanel.tsx`, `research-agent/index.ts`, `StrategyComparison.tsx` | Market Research → Strategy Lab | Advisor → Architect | **Adapt** end-to-end handoff; replace heuristic/static research |
| Strategy Builder | `StrategyBuilder.tsx` | Strategy Lab | Architect | **Reuse/adapt** domain model and polished builder UX |
| Backtesting | `StrategyBuilder.tsx` | Scenario / Backtest | Architect | **Replace engine**; donor random simulation may remain only as clearly labelled mock in tests, never product evidence |
| Advanced intent capture | `AdvancedIntentForm.tsx`, `IntentForm.tsx` | Trading Intents | Architect → Runtime | **Adapt** form/validation; submit only through canonical Runtime seams |
| Execution lifecycle/feed/history | `ExecutionFeed.tsx`, `ExecutionHistory*.tsx`, `execution-engine/index.ts` | Operate / Monitor | Runtime | **Keep views/models, replace execution engine** |
| Execution insights / memories | `ExecutionInsights.tsx`, `AgentMemoryPanel.tsx`, execution memory generation | Monitor / MoneyPenny memory projection | Advisor / Runtime observation | **Converge** with canonical receipts/DCIR/experience-memory architecture |
| Risk dashboard | `RiskDashboard.tsx` | Risk & Limits | Advisor + Architect + Runtime | **Adapt** monitoring + policy UX; consequential enforcement only through canonical runtime |
| Portfolio analytics | `PortfolioAnalytics.tsx` | Portfolio / Performance | Advisor + Monitor | **Adapt** analytics UI to real canonical balances/executions |
| Arbitrage scanning | `ArbitrageDetector.tsx`, `arbitrage-scanner/index.ts` | Opportunities | Advisor / Architect | **Adapt concept; replace simulated scanner** with real market-data provider(s) when available |
| Liquidity analytics | `LiquidityAnalytics.tsx` | Markets / Liquidity | Advisor | **Adapt UI/model; replace mock data** |
| Live market / DEX feed | `LiveMarketFeed.tsx`, `LiveDexFeed.tsx`, `LivePriceTicker.tsx`, oracle functions | Market Console | Advisor | **Adapt** to canonical market-data providers |
| Quotes / fee / edge / inventory views | `QuotesTable.tsx`, `FeeEstimator.tsx`, `EdgeGauge.tsx`, `InventoryGauge.tsx`, `CaptureSparkline.tsx` | Market Console / Operate | Advisor + Runtime | **Reuse/adapt** polished instrumentation |
| Notifications | `NotificationCenter.tsx`, realtime hooks | MoneyPenny shell | all | **Adapt** to canonical event/receipt sources |
| Chat with capability overlays | `MoneyPennyChat.tsx`, overlay manager/components | MoneyPenny shell | all | **Borrow interaction design**; canonical agent/runtime remains current MoneyPenny |
| FIO / X402 / custody modules | `FIO*`, `X402CustodyDashboard.tsx`, `modules/fio.ts`, `modules/x402.ts` | Future/optional financial capability | TBD | **Audit and defer** unless a current canonical service maps cleanly |
| Donor wallet/persona/auth | `WalletDrawer`, `PersonaManager`, donor auth | none | none | **Do not port as authority/state owners**; map UI concepts only where useful |

Every donor feature SHALL be classified `KEEP/ADAPT/REPLACE/RETIRE` with an explicit reason.

---

## 5. Financial Profile / bank-statement capability

This is a priority capability and MUST be preserved in stronger form.

Desired flow:

```text
bank statements / financial records
        ↓
secure extraction + categorisation
        ↓
financial aggregates
  income / expenditure
  available surplus
  volatility / cash-flow stability
  liquidity buffer
  concentration / recurring commitments
        ↓
recommended financial/trading envelope
  candidate maximum notional
  candidate loss/risk budget
  liquidity reserve
  concentration limits
  strategy constraints
        ↓
MoneyPenny explains recommendation
        ↓
person reviews / changes
        ↓
Architect may turn it into a proposed strategy/risk artifact
```

### Hard constraints

1. Do NOT copy the donor's simplistic balance-derived formulas as authoritative financial analysis.
2. Do NOT create a parallel `bank_statements` truth store merely because the donor has one.
3. Audit existing secure/private-document and blakQube/private data facilities first.
4. Raw bank statements are high-sensitivity inputs. They must not be exported to an external AEE/rendering provider.
5. Prefer derived, bounded aggregates for downstream experience composition.
6. A recommendation is not authority to trade.
7. Any later Runtime enforcement of a financial envelope requires the canonical authority/delegation/CTP path appropriate to the consequential act.

---

## 6. Strategy Lab

The donor Strategy Builder becomes a first-class MoneyPenny Architect capability.

Minimum strategy object vocabulary to preserve/adapt:

- asset / market / chain/venue scope;
- BUY / SELL / HOLD or broader position intent where canonical model supports it;
- position/notional size;
- minimum edge;
- maximum slippage;
- entry/exit triggers;
- price/volume/time conditions;
- stop-loss;
- take-profit;
- time-in-force;
- risk envelope binding;
- active/paused proposal state;
- simulation/backtest refs;
- provenance/rationale;
- ratification status;
- execution eligibility.

Canonical progression:

```text
Describe
→ Structure
→ Simulate
→ Compare
→ Stress-test
→ Ratify
→ optionally Delegate / Activate
```

A proposed strategy is an Architect output, not executable authority.

---

## 7. Markets / HFT console

MoneyPenny002's polished HFT console is a major UX donor.

The upgraded MoneyPenny cartridge SHOULD support a composable professional console using real data where available:

- live/reference price;
- quotes;
- spread / edge;
- liquidity / depth;
- slippage;
- fees;
- venue/chain comparison;
- arbitrage/opportunity candidates;
- inventory/exposure;
- fills;
- execution state;
- P&L;
- performance;
- risk alerts.

### Truthfulness rule

Any surface still backed by simulated/mock data MUST be labelled `SIMULATION` or remain development-only. Mock prices, random fills, random arbitrage spreads, random backtests and fabricated transaction hashes from MoneyPenny002 SHALL NOT appear as live financial truth in the canonical cartridge.

---

## 8. Risk architecture

The donor Risk Dashboard supplies useful interaction design but not constitutional enforcement.

Use three levels:

```text
Advisor
  observes/explains risk

Architect
  proposes risk envelope / limits / rules

Runtime
  enforces only ratified/delegated limits through canonical execution
```

Candidate rule families:

- maximum position/notional;
- maximum drawdown/loss;
- exposure by asset/venue/chain;
- concentration;
- slippage ceiling;
- minimum edge;
- liquidity floor;
- stop/pause conditions;
- time-window or aggregate budget where the authority model can express it.

Do not represent `pause`, `liquidate`, `auto-trade` or equivalent controls as real if the canonical runtime cannot yet enforce them.

---

## 9. Operate / execution / monitoring

Preserve the useful lifecycle and console experience, but bind it to real estate infrastructure.

Target conceptual lifecycle:

```text
intent
→ proposal/quote
→ authorization where required
→ canonical Runtime
→ CTP for migrated constitutional/consequential transition
→ domain execution
→ receipt/evidence
→ DCIR consequence observation
→ execution/portfolio analytics
```

Do NOT migrate `supabase/functions/execution-engine/index.ts` as the canonical executor. It is a donor simulation engine.

Execution Feed, Execution History, Fills, Portfolio Analytics and Execution Insights SHOULD instead become projections over real canonical execution/receipt/evidence sources.

---

## 10. UI / interaction-system upgrade

MoneyPenny002 is a design donor as well as a capability donor.

The parallel agent SHALL audit and selectively borrow:

- compact professional console density;
- vertical side/folder navigation;
- contextual overlays/drawers rather than route proliferation;
- chat as a persistent coordination surface;
- capability shortcuts alongside conversation;
- instrument-like cards/gauges;
- live feed + console switching;
- small status badges;
- risk and performance summaries;
- progressive disclosure of advanced trading controls;
- strategy-to-intent handoff;
- research-to-strategy handoff;
- bank-profile-to-risk-policy handoff.

### Integration rule

Do not create a second application router/shell inside MoneyPenny.

Borrow the donor's navigation grammar **inside the Standard Cartridge Navigation Framework** already used by `moneypenny-codex` / `MoneyPennyPanelTab` / `TabRenderer`.

Preferred shape:

```text
canonical cartridge shell
  ↓
MoneyPenny capability rail / contextual side menu
  ↓
capability workspace
  ↓
MoneyPenny companion / contextual actions
```

Existing estate chrome, identity context, companion resolution and cartridge routing remain canonical.

---

## 11. Financial Sovereignty / pre-Horizen experience integration

The new capabilities should enrich the already-shipped conditional Financial Sovereignty branch:

```text
CHOOSE
→ DISCOVER
→ LEARN
→ EXPLORE
→ PREPARE
→ CROSS
→ ExperienceHandoff
→ Financial Services Journey
```

### DISCOVER

AEE may project a lightweight orientation using real MoneyPenny capabilities: simple market orientation, capability overview, introductory financial profile, explainers.

### LEARN

Use existing experience primitives (Pill/Capsule/mini-runtime) around concepts encountered in real tools: volatility, spread, slippage, liquidity, position sizing, custody, diversification, risk budget, stop-loss, etc.

### EXPLORE

Expose safe, non-consequential versions of real cartridge capabilities:

- Advisor research;
- Financial Profile;
- Strategy Lab;
- Market Console;
- Liquidity;
- scenario/backtest;
- risk envelope design.

### PREPARE

Produce meaningful readiness objects/state where supported:

- declared financial intent;
- candidate risk envelope;
- candidate strategy;
- valid agent candidate;
- intended service relationship.

Do not fabricate Passport, delegation, registration or authority.

### CROSS

Use the existing typed `ExperienceHandoff`. Do not merge source/target JourneyRuns and do not treat the handoff itself as authority.

This workstream MAY expose capability descriptors/hooks for AEE, but SHALL NOT modify AEE core while the parallel AEE workstream is active.

---

## 12. Evidence, DCIR and CTP boundaries

### 12.1 DCIR

Instrument new MoneyPenny interactions through the existing DCIR vocabulary/seam where practical, but do not create a second observation system.

Useful observation moments include:

- financial profile generated/reviewed;
- Pill/Capsule engaged;
- research completed;
- strategy created/compared/ratified;
- simulation run;
- risk envelope proposed/accepted;
- market capability explored;
- intent composed;
- runtime result observed.

Raw DCIR session observations do not automatically equal competence or durable Journey completion.

### 12.2 CTP

Browsing, learning, research, simulation and designing a strategy are not automatically CTPs.

Any canonical/consequential mutation SHALL:

- resolve an existing active CTP where one applies; or
- identify a constitutional gap for a genuinely new act;
- never embed state-changing authority inside a donor component.

The current active wallet-conversion CTP remains canonical for its migrated scope.

### 12.3 Receipts / state

Reuse canonical Activity Receipts, artifact records, CTP evidence and domain systems of record. Do not re-create the donor's Supabase tables as a shadow MoneyPenny backend unless a specific canonical gap is first demonstrated.

---

## 13. Parallel-agent touch boundaries

This work is intentionally structured to run in parallel with AEE.

### Preferred ownership for this workstream

Primarily:

- `app/(shell)/moneypenny/**`
- MoneyPenny-specific cartridge tabs/components;
- additive MoneyPenny capability components;
- additive `services/financialServices/**` adapters/capability definitions;
- MoneyPenny-specific tests;
- donor-harvest documentation.

### Avoid modifying while AEE work is active unless strictly necessary

- `services/adaptive/**`
- `types/adaptiveExperience.ts`
- `services/journey/resolveJourneyState.ts`
- core Journey/AEE orchestration;
- `services/ctp/**`
- `types/ctp.ts`
- `services/dcir/**`
- canonical wallet ledger mutation semantics;
- Passport/delegation/Standing authority logic.

Where integration is needed, expose a narrow MoneyPenny adapter/capability descriptor and let the owning workstream connect it.

### Git discipline

Use a dedicated implementation branch. Rebase/sync from current `dev` before each integration tranche. Do not use unrelated refactors to resolve merge conflicts.

---

## 14. Work packages

### MPY2-0 — donor harvest audit

Before implementation:

1. inventory every non-generic MoneyPenny002 component/function/module;
2. mark each `KEEP / ADAPT / REPLACE / RETIRE`;
3. identify real vs heuristic vs mock/simulated behavior;
4. map each to an existing canonical service/state owner;
5. flag any genuine canonical gaps;
6. identify UI patterns worth borrowing.

Output: checked-in donor migration matrix.

### MPY2-1 — cartridge shell & capability navigation

- retain canonical cartridge shell;
- introduce polished capability rail/menu using donor interaction grammar;
- create Overview / Understand / Design / Markets / Operate / Monitor grouping;
- preserve Service Orchestration as canonical mode/eligibility engine;
- no consequential behavior change.

### MPY2-2 — Understand / early-user capabilities

- Financial Profile / statement analysis flow;
- Advisor research;
- market explainers;
- real/mock truth labels;
- safe privacy boundary;
- non-consequential only.

### MPY2-3 — Design

- Strategy Lab;
- risk envelope;
- strategy comparison;
- scenario/backtest adapter;
- Architect artifact/proposal integration;
- no automatic execution.

### MPY2-4 — Markets

- market console;
- quotes/prices;
- liquidity;
- opportunity/arbitrage candidate surface;
- fees/edge/inventory gauges;
- real provider adapters where available; explicit simulation otherwise.

### MPY2-5 — Operate / Monitor convergence

- advanced intent composition;
- real canonical Runtime handoff;
- execution feed/history from canonical evidence;
- portfolio/performance/risk analytics;
- DCIR/receipt-backed execution insights;
- no donor execution engine.

### MPY2-6 — AEE/Journey activation hooks

Only after the parallel AEE owner confirms the integration contract:

- expose capability descriptors suitable for `AdaptiveInteractionContext`;
- map safe experiences into DISCOVER/LEARN/EXPLORE/PREPARE;
- preserve CROSS → existing `ExperienceHandoff` → FS Journey;
- validate novice/intermediate/expert projections over the same capability substrate.

---

## 15. Acceptance criteria

The upgrade is acceptable when all of the following hold:

1. There is still exactly one canonical MoneyPenny cartridge/runtime.
2. MoneyPenny002 is treated as donor/reference, not a parallel production client.
3. The cartridge offers materially richer novice and advanced-user financial capabilities.
4. Advisor / Architect / Runtime remain the canonical service-mode axis.
5. The user-facing UI is capability-led rather than forcing service-mode jargon first.
6. A polished side/capability navigation pattern is integrated without creating a second shell/router.
7. Financial Profile can derive a bounded proposed risk/trading envelope without granting trade authority.
8. Strategy Lab can create, edit, compare and simulate candidate strategies without executing them.
9. Market Console presents only real data as real; simulations are clearly labelled.
10. Risk controls distinguish observation, proposed policy and actual Runtime enforcement.
11. Advanced intent composition hands off to canonical Runtime rather than donor execution code.
12. Donor random execution/backtest/arbitrage logic is absent from authoritative production paths.
13. Portfolio/execution/history views read canonical evidence/state wherever available.
14. No parallel wallet, identity, Passport, delegation, Standing, receipt, Journey, AEE, DCIR or CTP owner is created.
15. High-sensitivity bank/financial data respects the estate's private-data/provider disclosure boundaries.
16. MoneyPenny capability surfaces can be projected into the Financial Sovereignty branch without merging the two JourneyRuns.
17. Existing MoneyPenny Service Orchestration remains functional and regression-tested.
18. Existing baseline typecheck/test failures do not increase.
19. Each work package is independently deployable/revertible.
20. The final migration matrix records what was harvested, replaced, deferred and retired.

---

## 16. Explicit non-goals

This specification does NOT authorize:

- porting the Lovable Supabase backend wholesale;
- adopting donor authentication/persona/wallet state;
- treating donor simulations as live markets/trades;
- building a second MoneyPenny shell/client;
- replacing the canonical MoneyPenny service catalogue;
- creating new Journey/AEE/CTP/DCIR engines;
- making bank-statement recommendations automatically executable;
- creating automated liquidation/trading authority that the canonical delegation model cannot express;
- forcing all MoneyPenny002 features into the first tranche;
- merging the CI/KNYTS Financial Sovereignty Journey with the target FS Journey.

---

## 17. Parallel-agent completion report

For every tranche, return:

1. donor components/capabilities harvested;
2. canonical components/services reused;
3. code that was adapted vs replaced;
4. simulated donor behavior removed or explicitly labelled;
5. UI/interaction improvements imported;
6. new capability surfaces and their Advisor/Architect/Runtime classification;
7. state/evidence/CTP/DCIR boundaries touched;
8. AEE/Journey seams exposed but not independently reimplemented;
9. tests/typecheck delta;
10. commit(s) ready for integration to `dev`.

---

## 18. Canonical implementation statement

> **MoneyPenny002 contributes capability and experience. The canonical MoneyPenny cartridge contributes sovereignty, authority and runtime truth.**

> **Harvest the polished financial workstation, replace simulated truth with canonical services, and expose the same professional MoneyPenny capability progressively from first financial exploration through bounded consequential operation.**
