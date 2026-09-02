# MPY2-0b — MoneyPenny002 Real-Source Donor Audit (closes the access gap in MPY2-0)

**Status:** AUDIT OUTPUT — no implementation performed by this document
**Date:** 2026-09-02
**Governing spec:** `2026-09-01_spec-moneypenny-cartridge-capability-harvest-upgrade.md` (SPEC-MPY-002)
**Supersedes the donor-blind portions of:** `2026-09-01_mpy2-0-donor-harvest-audit.md`

---

## 0. Why this document exists

The prior donor-harvest audit (MPY2-0) was performed with **zero filesystem/GitHub access to
MoneyPenny002** — it derived its donor-capability column entirely from SPEC-MPY-002's own §4 table,
not from reading real code, and said so explicitly in its own §0. The operator has since made the
repository available: `https://github.com/iQube-Protocol/MoneyPenny002`, cloned read-only to
`/home/user/iqube-protocol/moneypenny002` for this pass.

This document reads the actual donor source, file-by-file, and corrects or confirms every claim in
MPY2-0's harvest matrix. Per CLAUDE.md's No-Guessing rule, every claim below is cited to a real
file:line in the donor repo — nothing here restates the spec's description of the donor without
having independently verified it.

**Headline finding: the donor does not close any of the six open C0 gaps.** It is equally or more
mocked than the main repo in almost every dimension. The one genuine exception — a real, working
market-data call — is narrow and is acted on separately (see §3).

---

## 1. Corrected harvest matrix

| Donor capability | What it actually does (read, not guessed) | Live in canonical AigentZBeta? | Classification | Reason/action |
|---|---|---|---|---|
| Bank statement OCR/parsing (`banking-document-parser/index.ts`) | **No OCR or PDF parsing anywhere.** Receives already-extracted plain text (`:122-126`, throws if absent) and runs three balance regexes (`:26-30`), two date-range regexes (`:42-45`), and a crude transaction-*count* guess (counts `$`-amount substrings, divides by 3, `:60-61`) — no per-transaction extraction ever happens. PDF text comes from `src/lib/pdf/extractText.ts:11-34`, pdf.js **text-layer extraction only** (`:21`); a scanned/image PDF yields empty text (`:32`) and the pipeline silently produces zero aggregates. | No (CSV-only, confirmed) | **CREATE stands** | The donor does **not** close the OCR gap — it is arguably more primitive than the main repo's CSV parser, since it never structures individual transactions at all. |
| AI Trade Advisor (`ai-trade-advisor/index.ts`) | Real LLM call (Lovable AI gateway, `google/gemini-2.5-flash`, `:37,44`) with a BUY/SELL/HOLD + confidence system prompt (`:21-35`). No market data, retrieval, or citations injected — pure prompt-only completion. | Partially — `moneypenny.advisor` mode + `MoneyPennyChat.tsx` | ADAPT (unchanged) | Confirmed genuine LLM call, but exactly the "prompt-only epistemics" already predicted — nothing to harvest beyond the fact that it works. |
| Research Agent (`research-agent/index.ts`) | **Not LLM-backed.** Own comment: "Very lightweight heuristic scoring for now" (`:54`). Topic-keyword matching drives fixed template text (`:56,62-83`) and **three hardcoded, topic-invariant "sources"** (coindesk.com/glassnode.com/theblock.co, `:84-106`) never actually fetched. `riskScore`/`trustScore` are literal constants keyed on BTC/ETH substring match (`:59-60`). | No | CREATE | Nothing worth harvesting as logic; at most the response shape is a UI-contract reference. |
| Strategy Builder — **donor's** `src/components/StrategyBuilder.tsx` (a different file from the main repo's own) | Real localStorage CRUD (`:56-132`) + a genuine 3-tab UI (Active/Builder/Backtest, `:223-228`) with a recharts line chart and stat cards (`:566-611`). **Backtest tab is 100% synthetic**: 30-day loop, coin-flip trade trigger (`Math.random()>0.7`, `:184`), PnL = `(Math.random()-0.45)*200` (`:186`) — no price data, no fee/slippage model, one scalar portfolio value. | Yes, canonical `StrategyBuilder.tsx` exists but has no backtest tab at all | KEEP UI shape / REPLACE computation | The 3-tab flow + chart + stat cards is worth borrowing as *interaction design*; the computation is not a legitimate backtest methodology (no historical data, no fee/slippage engine) — a coin-flip skeleton, thinner than a naive Monte Carlo. |
| Execution engine (`execution-engine/index.ts`) | Real Supabase CRUD/router for `trading_intents`/`executions` (`:60-264`), a legitimate intent-lifecycle state machine (`pending→quoted→executing→filled`, `:285-297`). `simulateExecution()` (`:283-371`) fabricates every fill: random price/slippage/capture (`:302-307`), random DEX pick (`:308-309`), and a **fake tx hash** (`` `0x${Math.random().toString(16).substring(2,66)}` ``, `:325`). Never calls a real chain/DEX. | No | REPLACE | This is a live-request-time fake-fill simulator, not a historical backtest (no date loop, no historical price series) — distinct from StrategyBuilder's coin-flip backtest above. The intent/execution **schema/status machine** is a legitimate, reusable shape independent of the fake generator. |
| Arbitrage scanning (`arbitrage-scanner/index.ts`) | Comparison logic is real and venue-agnostic: spread-bps (`:88`), net-profit-after-gas (`:94`), min-threshold filter (`:97`), confidence heuristic (`:161-177`), top-10 sort (`:121-124`). **All price inputs are synthetic**: hardcoded base-price table (`:127-136`), random per-DEX variation (`:75`), random DEX assignment (`:73`), hardcoded gas-cost table (`:140-148`). | No | CREATE | The pairwise comparison *algorithm* is real and portable — the strongest "salvageable methodology over fake data" case in the donor — but nothing to compare without a real multi-venue price feed, which the donor also lacks (see next two rows). |
| Oracle — reference price (`oracle-refprice/index.ts`) | **Real.** Calls CoinGecko's public API (`:46`) for BTC/ETH/SOL only (`:13-17`), returns live USD spot price, no randomness. | No (`HFTConsole.tsx`/quotes confirmed `Math.random()`-mocked) | **ADAPT — acted on, see §3** | The single cleanest real, non-mocked market-data call found anywhere in the donor. |
| Oracle — DEX (`oracle-dex/index.ts`) | **Explicitly synthetic** — own comment: "For now we return a synthetic snapshot… wire this up to a real DEX analytics API" (`:38-39`); every field a hardcoded literal, `source: "synthetic-demo"` (`:48`). | No | RETIRE | No venue/DEX-level liquidity, spread, or volume data available anywhere in this donor. |
| `aggregates.ts` client module | **Correction to the spec's own attribution**: this file has no formulas at all — it's a thin Supabase wrapper (`getAggregates`/`getRecommendations`/`applyRecommendations`, `:11-73`). The actual "simplistic balance-derived formulas" SPEC-MPY-002 §5 warns against live in `banking-document-parser/index.ts:77-114`: `avg_daily_surplus = closing_balance>0 ? closing_balance/30 : 100` (`:64`, treats a balance as a monthly flow), `surplus_volatility = avg_daily_surplus*0.35` (`:65`, arbitrary fixed multiplier, not computed variance), `max_notional_usd`/`daily_loss_limit_bps`/`inventory_max` all chained off that one guessed number (`:93-108`). No currency handling; `top_categories` hardcoded `[]` (`:212`) — no transaction-level data exists anywhere in the pipeline. | No | CREATE stands | Worse than "simplistic": balance-only math with zero transaction-level basis, not merely crude income/expense math. |
| `execution.ts`, `quotes.ts`, `oracles.ts`, `memories.ts` client modules | `execution.ts`: real passthrough to the fake-fill engine above (`:38-149`). `quotes.ts`: dual SIM/LIVE design (`:3`) pointing at endpoints (`/sim/stream`, external `quotesUrl`) that have **no corresponding deployed function anywhere in this donor's 8 `supabase/functions/*` dirs** — neither mode is real from this repo alone. `oracles.ts`: **empty stub class**, 9 lines, no methods. `memories.ts`: **stub**, both methods just `console.log`, explicit `// Stub implementation` comment (`:10-18`), no persistence. | No | RETIRE (`oracles.ts`, `memories.ts`) / do not adapt as-is (`quotes.ts`) | New finding, not in MPY2-0 at all: two of these four "modules" are literally empty stubs. |
| `ProfileOverlay.tsx` | PDF-upload-only (`accept=".pdf"`, `:499`) → `extractPDFText` → `banking-document-parser`. **No manual-entry form of any kind.** | Confirmed gap in main repo | Gap not closed by donor either | The donor has the identical unbuilt "manual entry" gap as the main repo's own Financial Profile. |
| `PortfolioOverlay.tsx` / donor `PortfolioAnalytics.tsx` | Reads real DB rows dynamically (`moneyPenny.execution.getStats`, live realtime subscription, `:25,38-46`) rather than hardcoded literals — more architecturally honest than the main repo's static `totalValue: 125000` — but those rows are 100% populated by `execution-engine`'s fake fills, plus an explicit `// Mock price` on wallet/custody balance valuation (`:119`). | Confirmed hardcoded in main repo | More honest architecture, not more truthful data | Real read-path pattern over fabricated data — worth noting as a UI/architecture pattern only. |
| `LiquidityAnalytics.tsx` | **100% mocked** — own comment: "Simulate liquidity data… in production, this would call moneyPenny.aggregates or similar" (`:39`), hardcoded 5-pool array recomputed identically every 30s (`:32,40-111`). | No | RETIRE data / ADAPT UI only | No oracle/API call exists at all. |
| `CaptureSparkline.tsx` | Attempts real bucketed data via `listExecutions(500)` (`:36`) but silently falls back to fabricated sine+random data plus a suspiciously specific hardcoded total `1247.83` (`:107-125`) with **no UI label distinguishing the two states**. | No | ADAPT with caution | The silent-fallback pattern is itself a truthfulness risk to avoid replicating. |
| `LiveMarketFeed.tsx` | Renders real executions labeled `LIVE` (`:385`) **side-by-side** with simulated SSE fills labeled `SIM` (`:373-455`) — the one place in the donor that already visibly separates and labels live-vs-simulated data. | No | UI pattern worth borrowing | "LIVE" here still means "read from DB," not "backed by a real trade" — the DB rows are still execution-engine's fake fills — but the labeling discipline itself is exactly SPEC-MPY-002 §7's own instinct, already native to this donor component. |
| KNYT pricing | Repo-wide grep for `KNYT`/`0.0005`/`0.005` across `src/` and `supabase/`: **zero matches.** | N/A | No evidence found | Clean negative — this donor provides no data point toward resolving the main repo's live `KNYT_ETH_RATE` discrepancy (D-02, still open). |
| DB schema (3 migrations) | Storage bucket allows `application/pdf`/`image/png`/`image/jpeg` but **no code path ever processes an image** — a latent, dead capability. `bank_statements` is statement-level only, no transaction table. `trading_recommendations`/`recommendation_history` is a real, versioned risk/policy-envelope shape (inventory bounds, min edge, max notional, daily-loss limit, reasoning). `trading_intents`/`executions` is a reasonably normalized intent/fill schema with real CHECK-constrained lifecycle states. | No | Schema shape informs, values do not | No transaction-level table exists anywhere — confirms the "financial profile" pipeline is balance-and-regex-only at the schema level too, not just the code level. |

---

## 2. Gap-by-gap verdict (MPY2-0 §5 table, re-checked against real source)

| Gap | Closed by donor? | Evidence |
|---|---|---|
| OCR/scanned-statement ingestion | **No.** | `extractText.ts:21,32`; `banking-document-parser/index.ts:122-126`. Text-layer-only PDF extraction, empty result on scanned documents, never structures transactions. |
| Real backtest engine | **No.** | `StrategyBuilder.tsx:171-208` (donor's actual "backtest") is a 30-day coin-flip/random-PnL loop. `execution-engine`'s simulator is a live-request fake-fill generator, not a historical backtest — a distinct, separately-confirmed non-solution. |
| Risk-envelope model | **Partially informs, does not close.** | `trading_recommendations` schema shape (`supabase/migrations/20251117054821_*.sql:63-119`) is real and versioned, but every value it would hold derives from the single-balance-number formulas SPEC-MPY-002 §5 already forbids treating as authoritative. |
| Arbitrage/opportunity service | **No — but the comparison algorithm is genuinely reusable.** | `arbitrage-scanner/index.ts:82-124,161-177` real logic, `:73-75,127-148` synthetic inputs. Cannot close the gap as delivered; no real venue price feed exists to drive it. |
| Market-data provider adapter | **Partially closed, spot reference price only.** | `oracle-refprice/index.ts:46` — genuine CoinGecko call, BTC/ETH/SOL. `oracle-dex/index.ts:38-48` is hardcoded/"synthetic-demo" — venue/DEX-level data remains fully unaddressed. Acted on in §3 below. |
| Execution/receipt-backed evidence path | **No.** | `trading_intents`/`executions` schema is reusable in shape, but every row is populated by fabricated fills including a fake tx hash (`execution-engine/index.ts:300-326`). `LiveMarketFeed.tsx`'s `LIVE`/`SIM` labeling discipline (`:373-455`) is worth borrowing as a UI pattern even though the underlying "LIVE" data is not receipt-backed. |

---

## 3. The one genuine finding does not transplant into canonical AigentZBeta — corrected

An earlier draft of this section stated that `oracle-refprice/index.ts`'s CoinGecko call would
directly replace `HFTConsole.tsx`'s `Math.random()`-generated quotes for BTC/ETH/SOL. That was
wrong, caught before implementation by re-reading `HFTConsole.tsx` itself rather than the spec's
description of it: **`HFTConsole.tsx`'s `chain` field (`ETH`, `ARB`, `OP`, `BASE`, `POLYGON`, and
the canonical `StrategyBuilder.tsx`'s identical `availableChains` list) names blockchain networks,
not crypto assets.** `price_usdc` is the Q¢ token's cross-chain arbitrage price (per CLAUDE.md's
Q¢ canon, ~$0.01 with per-chain variance representing the arbitrage edge) — it is not a BTC, ETH,
or SOL spot price. Confirmed by grep: no component under `app/(shell)/moneypenny/` displays a
BTC/ETH/SOL asset price anywhere; every `ETH` hit in this cartridge is the Ethereum L1 network.

CoinGecko's public API has no listing for Q¢ — it is not a real, externally-traded token. Wiring
`oracle-refprice`'s BTC/ETH/SOL call into `HFTConsole.tsx` would therefore require displaying an
unrelated real asset's price as if it were the Q¢ cross-chain quote — a fabricated mapping, and a
worse truthfulness violation than the current explicit `Math.random()` generation plus
`SimulationNotice` disclosure it would replace. **No code change was made.** The CoinGecko call
remains a confirmed-real capability with no current transplant target in canonical AigentZBeta; it
becomes actionable only if/when a genuine Q¢ (or other real, CoinGecko-listed asset) price display
is added to a MoneyPenny surface — tracked as an open opportunity, not a pending commit.

## 4. What remains open, unchanged by this audit

Every gap in MPY2-0's §5 table remains open: OCR ingestion, a real backtest engine, a real
risk-envelope model, a real arbitrage/opportunity service beyond spot-price comparison, and a real
execution/receipt-backed evidence path. This audit's contribution is narrowing "not found in the
inspected source" (an access limitation) to "confirmed absent in the actual source" (an evidenced
finding) — none of these six gaps can be closed by harvesting MoneyPenny002; each remains build-fresh
work against canonical services, per SPEC-MPY-002's own hard constraints.
