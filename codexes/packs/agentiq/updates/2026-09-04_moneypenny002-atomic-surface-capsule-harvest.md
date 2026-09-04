# MoneyPenny002 live-surface harvest — atomic, capsule-composable SmartTriad surfaces

**Date:** 2026-09-04
**Ruling:** operator, same-day — "The earlier ruling not to transplant the donor's simulated Q¢
computation does NOT prohibit harvesting its UI, component composition, interaction patterns and
live-surface contracts... Harvest the experience; replace or truthfully qualify the data," followed
by the explicit "ATOMIC, CAPSULE-COMPOSABLE SURFACES" correction: the harvested components are
portable SmartTriad surface primitives composable at multiple depths, not pieces of a single market
console page.
**Supersedes nothing** in `2026-09-01_mpy2-0-donor-harvest-audit.md` or
`2026-09-02_mpy2-0b-moneypenny002-real-source-audit.md` — this document extends them with the new
atomic-surface/capsule rendering layer; it does not re-litigate their gap classifications (MPY2-4,
"no real market-data provider," remains open and unstarted — this pass does not close it).

---

## 0. What this pass is and is not

**Is:** promotes two of MoneyPenny002's live-console UI components (EdgeGauge, InventoryGauge) into
governed SmartTriad rich-block "atomic surfaces," composable into a capsule, renderable inline in a
copilot message, and reconstituted into the canonical `HFTConsole.tsx` (not forked into a second
console). Replaces every `Math.random()` call in `HFTConsole.tsx` and `app/api/moneypenny/quotes/route.ts`
with the ONE deterministic, seeded simulation service required by the ruling
(`services/moneypenny/marketSimulation.ts`), with explicit source classification on every value.

**Is not:** a real market-data provider (MPY2-4, confirmed absent — see `mpy2-0b` §3: the donor's one
genuine real call, CoinGecko BTC/ETH/SOL spot price, prices an unrelated asset and would be a
fabricated mapping if substituted for Q¢'s cross-chain arbitrage edge). Every value in this pass is
honestly `mode: 'simulation'`. Not a full LiveMarketFeed parity build — Quotes/Fills/Performance/
History atomic surfaces are not implemented this pass (sequenced below). Not an implementation of the
five other MoneyPenny002 overlays (Portfolio, Intent Capture, Live Insights, Financial Profile/Profile,
Research, MetaVatar) beyond classification.

---

## 1. Donor files reviewed (read directly, `/home/user/iqube-protocol/moneypenny002`)

| File | Reviewed | Harvested this pass |
|---|---|---|
| `src/pages/Console.tsx` | Yes | No — page shell only (tabs, header); no canonical equivalent needed, MoneyPenny already has its own copilot-flanked workspace shell |
| `src/components/LiveMarketFeed.tsx` | Yes, in full | Partially — layout/interaction pattern for the Edge/Inventory gauge pairing and the "restart stream" control informed the reconstituted `HFTConsole.tsx`; the SSE/chain-toggle/quotes-and-fills half is deferred |
| `src/components/EdgeGauge.tsx` | Yes, in full | **Yes** — `components/smarttriad/surfaces/EdgeGaugeSurface.tsx` (`kind: 'market.edge'`) |
| `src/components/InventoryGauge.tsx` | Yes, in full | **Yes** — `components/smarttriad/surfaces/InventoryGaugeSurface.tsx` (`kind: 'market.inventory'`) |
| `src/components/CaptureSparkline.tsx` | Yes, in full | No — confirmed fabricates sine+`Math.random()` history AND hardcodes `1247.83` Q¢ fallback (`:107-125`), exactly the donor risk the ruling names. Deferred; `simulateCaptureHistory()` in the new simulation service is a safe drop-in replacement whenever the sparkline UI itself is harvested |
| `src/components/QuotesTable.tsx` | Not read this pass | Deferred — sequenced below |
| `src/components/FillsTicker.tsx` | Not read this pass | Deferred |
| `src/components/ChainChip.tsx` | Not read this pass | Deferred — `LiveMarketFeed.tsx`'s inline chain-toggle button pattern (`:210-226`) is the closest reference already reviewed |
| `src/components/ExecutionFeed.tsx` | Not read this pass | Deferred |
| `src/components/ExecutionHistory.tsx` | Not read this pass | Deferred |
| `src/components/ExecutionInsights.tsx` | Not read this pass | Deferred |
| `src/components/PortfolioAnalytics.tsx` | Reviewed via `mpy2-0b` §1 (prior pass) | No — `mpy2-0b` already found a canonical equivalent exists (`app/(shell)/moneypenny/components/PortfolioAnalytics.tsx`) with a `SimulationNotice` label; no new work needed here |
| `src/components/LiquidityAnalytics.tsx` | Reviewed via `mpy2-0b` §1 | No — confirmed 100% mocked, no oracle call; UI-only harvest candidate, not started |
| `src/components/RiskDashboard.tsx` | Not read this pass | Deferred — canonical `RiskEnvelopePanel.tsx` already exists as a different, real (non-donor) risk surface; reconciliation needed before any harvest |
| `src/components/StrategyBuilder.tsx` | Reviewed via `mpy2-0b` §1 | No — donor's 3-tab UI/chart interaction pattern flagged as worth borrowing; canonical `StrategyBuilder.tsx` already exists without a backtest tab. Not started this pass |
| `src/components/AITradeAdvisor.tsx` | Reviewed via `mpy2-0b` §1 | No — confirmed a real LLM call with no market data; nothing new to harvest beyond what MoneyPenny's advisor mode already does |
| `src/components/ResearchPanel.tsx` | Not read this pass | Deferred |
| `src/components/overlays/OverlayManager.tsx` | Skimmed (`Console.tsx` import graph) | No — explicitly ruled out as a navigation authority (see §2) |
| `src/components/overlays/PortfolioOverlay.tsx` | Reviewed via `mpy2-0b` §1 | No — classified in §3 below |
| `src/components/overlays/IntentCaptureOverlay.tsx` | Not read this pass | Classified in §3 below from spec-level knowledge only — flagged, not verified |
| `src/components/overlays/LiveInsightsOverlay.tsx` | Not read this pass | Classified in §3 below, same caveat |
| `src/components/overlays/ProfileOverlay.tsx` | Reviewed via `mpy2-0b` §1 | No — classified in §3 below |
| `src/components/overlays/ResearchOverlay.tsx` | Not read this pass | Classified in §3 below, same caveat |
| `src/components/overlays/MetaVatarOverlay.tsx` | Not read this pass | Classified in §3 below, same caveat |
| `src/hooks/use-overlay-manager.ts` | Skimmed | No — global `activeOverlay` design explicitly NOT transplanted (ruling §3) |
| `src/lib/aigent/moneypenny/modules/quotes.ts` | Reviewed via `mpy2-0b` §1 | No — confirmed dual SIM/LIVE design pointing at endpoints with no deployed backing function |
| `src/lib/aigent/moneypenny/modules/execution.ts` | Reviewed via `mpy2-0b` §1 | No — confirmed real Supabase CRUD wrapper around a fake-fill generator |
| `src/stores/marketFeedStore.ts` | Skimmed (`LiveMarketFeed.tsx` import) | No — a Zustand store for `selectedChains`/`qcentEarned`; not transplanted as a second state authority (see §2) |

Per the No-Guessing rule: rows marked "classified... from spec-level knowledge only, not verified" are
explicitly NOT claims about the donor's actual code — they restate the operator's own request text and
must be independently read before any implementation decision is made about them.

---

## 2. Architectural ruling actually implemented this pass

- **No second navigation authority.** `OverlayManager`/`use-overlay-manager`'s global `activeOverlay`
  Zustand store is not transplanted. The copilot/cartridge host remains the single owner of which
  surface is active — every action a harvested surface emits (`open-cartridge-tab`) resolves through
  the EXISTING `CartridgePresenceRegistry` (`tryOpenInMountedCartridge`), the same mechanism the rest of
  this session's SmartTriad Rich Block work already established.
- **Atomic surfaces, not a page-owned component.** `EdgeGaugeSurface`/`InventoryGaugeSurface` accept
  only their payload + a `compact` boolean; they have no host-specific logic. They render identically
  whether mounted inline in a copilot message (via the rich-block dispatcher), inside a capsule (same
  dispatcher, recursive), or inside `HFTConsole.tsx`'s own panel (direct import) — one component, three
  mount points, confirmed by this pass wiring all three.
- **One data controller per delivery, honest by construction.** `services/moneypenny/marketSimulation.ts`
  is the ONE place synthetic values originate. `HFTConsole.tsx`'s own `setInterval` and
  `app/api/moneypenny/quotes/route.ts`'s `GET` handler both now call it instead of `Math.random()`
  directly — a `stripComments`-canary (`tests/smarttriad-market-console-surfaces.test.ts`) asserts
  no `Math.random(` token remains in either file, or in the simulation service itself.
- **Capsule composition reuses the SAME envelope/dispatcher family** established earlier this session
  for `smarttriad.block.v1` video blocks — `kind: 'capsule'`'s `surfaces` array is validated by the
  SAME `validateSmartTriadRichBlockEnvelope` a top-level block uses (recursively, depth-bounded), and
  rendered by the SAME `SmartTriadRichBlockListRenderer` (recursively). No second capsule-specific
  schema or renderer was introduced, per the ruling's explicit "reconcile with the existing
  implementation before introducing a new one."
- **Conversational invocation resolves the smallest adequate block.** "What is our current edge?" →
  a bare `market.edge` block. "Show my inventory exposure" → a bare `market.inventory` block. "Open the
  market console" → a `capsule` composing both. None of these ever let the model construct or guess a
  URL/value — `services/smarttriad/mediaProviders.ts`'s `moneyPennyMarketConsoleProvider` is a plain
  regex classifier over the raw message, evaluated server-side before any LLM call, exactly like the
  existing MoneyPenny video provider it sits beside.

---

## 3. Sequenced harvest map — the remaining MoneyPenny002 surfaces

Not implemented this pass, per the ruling's own instruction ("do not implement all six blindly in the
first tranche... provide a concrete sequenced harvest map"). Ordered by dependency, not by donor file
order — a real data-binding gap blocks several of these regardless of UI harvest effort.

| Overlay | Existing canonical equivalent | Harvestable UI | Canonical data/service binding | Proposed block kind | Compact / expanded / right-pane | Authority level | Read-only or action-bearing |
|---|---|---|---|---|---|---|---|
| Portfolio (`PortfolioOverlay.tsx` / donor `PortfolioAnalytics.tsx`) | Yes — `app/(shell)/moneypenny/components/PortfolioAnalytics.tsx`, already `SimulationNotice`-labelled (`mpy2-0b` §1) | Donor's dynamic real-DB-read pattern (architecturally more honest than a static literal) — UI-pattern only, not its fake-fill-populated data | None real yet; MPY2-5 (execution/receipt-backed evidence read path) is the blocking gap, unstarted | `finance.portfolio` | compact: top-line balance; expanded: full breakdown; right-pane: `moneypenny-codex` → existing panel | Observational | Read-only |
| Intent Capture (`IntentCaptureOverlay.tsx`) | Not verified this pass — spec-level only | Unknown, not read | Would need MoneyPenny's existing `trading_intents`-shaped concept, if any exists canonically (not verified) | `finance.intent-capture` | Unknown until donor file is read | Likely preparatory (captures intent, does not execute) | Action-bearing (drafts only) — must pass through existing delegation/approval boundary before any execution semantics |
| Live Insights (`LiveInsightsOverlay.tsx`) | Not verified this pass | Unknown | Unknown | `research.market-brief`-adjacent, TBD | Unknown | Observational, pending review | Read-only, provisionally |
| Financial Profile (`ProfileOverlay.tsx`) | Yes — MoneyPenny's own Financial Profile panel (MPY2-2/MPY2-2c, this session's own prior work) already has manual entry; donor is PDF-upload-only with no manual entry (`mpy2-0b` §1) | Nothing donor-side worth harvesting — canonical is already ahead of the donor here | Already bound to `financial_profile_qubes` | N/A — no new block needed | N/A | N/A | N/A |
| Research (`ResearchOverlay.tsx` / donor `ResearchPanel.tsx`) | Not verified this pass | Unknown — `mpy2-0b` flags the donor's underlying `research-agent` function as heuristic-only, not LLM-backed, with three hardcoded, never-fetched "sources" | Real MoneyPenny Research Copilot integration would need a genuine retrieval binding, not the donor's fixed template text | `research.market-brief` | Unknown | Observational | Read-only |
| MetaVatar (`MetaVatarOverlay.tsx`) | Not verified this pass | Unknown | Unknown — likely ties to the existing MetaAvatar host (`app/components/metaVatar/`), not verified | TBD | Unknown | Unknown | Unknown |

**Immediate next harvest candidates** (smallest, most independently verifiable, per this pass's own
precedent): `ChainChip.tsx` (a single, already-partially-reviewed presentational chip — LiveMarketFeed's
inline version was already read in full) and `QuotesTable.tsx`/`FillsTicker.tsx` as the next atomic
surfaces (`market.quotes`, `market.fills`), composed into the SAME Market Status capsule this pass
already established. Each remains gated on being read from the real donor source first, per the
No-Guessing rule — none of the "not read this pass" rows above should be treated as scoped or estimated
until that reading happens.

---

## Tranche 2 (same day) — quotes, fills, performance, history + shared session controller

**Commit base:** `ab616eb17` (tranche 1, verified clean — `git diff --stat ab616eb17..HEAD` was empty
before this tranche began; no restated or duplicated work).

Closes the four surfaces this doc's §0/§3 explicitly left open, plus the shared controller §2 had not
yet built:

- **`market.quotes`** (`components/smarttriad/surfaces/QuotesSurface.tsx`) — harvested from
  `QuotesTable.tsx` + `ChainChip.tsx` (row layout, chain badge, edge/price/qty/time columns).
- **`market.fills`** (`FillsSurface.tsx`) — harvested from `FillsTicker.tsx` + `ChainChip.tsx`
  (BUY/SELL icon, chain badge, qty/price/capture layout).
- **`market.performance`** (`PerformanceSurface.tsx`) — harvested from `LiveMarketFeed.tsx`'s
  "Capture Performance" panel (accumulated Q¢, last/avg capture, bar chart).
- **`market.history`** (`HistorySurface.tsx`) — harvested UI shape from `CaptureSparkline.tsx`
  (bucketed bar chart) — explicitly NOT its fabricated sine+`Math.random()` fallback or hardcoded
  `1247.83` total (confirmed present at `CaptureSparkline.tsx:107-125` by direct read this tranche).
- **`ChainChipSurface.tsx`** — shared internal primitive both list surfaces use, harvested from
  `ChainChip.tsx`.
- **`services/moneypenny/marketSessionController.ts`** — the shared, client-side, module-singleton
  market session (`useMoneyPennyMarketSession()`), consumed by:
  - `components/smarttriad/surfaces/MarketConsoleCapsule.tsx` (compact/expanded/panel presentation
    variants, in-place Expand/Collapse — no navigation, no remount);
  - `app/(shell)/moneypenny/components/HFTConsole.tsx`, now mounting `<MarketConsoleCapsule
    initialPresentation="panel" hideToggle />` instead of owning its own quote/execution state.
  - `components/smarttriad/richblocks/SmartTriadRichBlockRenderer.tsx`'s new
    `LIVE_CAPSULE_COMPONENTS` registry mounts the SAME live `MarketConsoleCapsule` for a copilot
    message's `capsuleId === 'moneypenny.market-status'` capsule, instead of the static child
    recursion every other capsule still uses.

**Controller ownership and lifecycle** (proved behaviorally, not just documented — see
`tests/smarttriad-market-console-tranche2.test.ts`'s controller suite, fake-timer-based): a single
module-level `state` object; `subscribeMarketSession` starts the one `setInterval` on the first
subscriber and stops it on the last unsubscribe; `getMarketSessionSnapshot()` returns the identical
object reference to every simultaneous subscriber; `restartMarketSession()` is the ONLY thing that
resets ring buffers/accumulated result (bumping a `generation` counter); a subscribe → unsubscribe →
re-subscribe cycle (modeling a compact capsule unmounting while an expanded modal mounts in its
place) resumes the SAME state rather than losing it.

**Honest scope boundary, stated explicitly (per this pass's own instruction not to overclaim)**: the
copilot's server-resolved snapshot blocks (`edgeGaugeEnvelope`, `quotesEnvelope`, etc., in
`services/smarttriad/mediaProviders.ts`) are point-in-time chat replies — they do NOT literally share
the browser's `marketSessionController` singleton (a server API route runs in a different process and
cannot subscribe to client-side state). The market-status CAPSULE is the one place this pass makes
the connection real: `SmartTriadRichBlockRenderer.tsx` substitutes the live, controller-backed
`MarketConsoleCapsule` for that specific `capsuleId` rather than rendering the server's static
snapshot, so "open the market console" inside a copilot message becomes a genuinely ticking surface
sharing the SAME session `HFTConsole.tsx` reads. Individual point-answer requests ("what is our
current edge") remain honest one-shot reports, as a chat reply inherently is.

**Conversational triggers added**: "show recent fills" → `market.fills`; "how is the strategy
performing?" → `market.performance` (moved OFF the market-console trigger, per the operator's own
example mapping); "show me the live quotes" → `market.quotes`. "Show me quotes, spread and liquidity"
and "open the market console" still resolve the full capsule, per the operator's own example list.

**Browser verification**: `/moneypenny` standalone route (no auth gate), HFT Console tab, Start →
all six surfaces (Edge, Inventory, Performance, History, Quotes, Fills) render live with distinct
SIMULATION badges and no raw JSON anywhere; Stop → Start again (unmount/remount the live capsule)
preserves accumulated state rather than resetting it. Screenshots delivered to the operator.

**Tests**: 27 new (`tests/smarttriad-market-console-tranche2.test.ts`) + 1 updated stale assertion
in tranche 1's own test (`market-console-surfaces.test.ts`, capsule now composes 5 surfaces not 2)
+ 1 updated stale literal in `tests/moneypenny-fullscreen-takeover.test.ts` (SimulationNotice wording
changed with the HFTConsole rewrite). Full regression: 735 passing across 29 files (up from 708).
`tsc --noEmit`: 680 errors, same baseline as tranche 1 — zero new type errors.

**Still open after this tranche** (explicitly, not silently): the LIVE controller only backs the
`moneypenny.market-status` capsule inside a copilot message and `HFTConsole.tsx` — a bare
`market.quotes`/`market.fills`/`market.performance` block resolved as a standalone chat reply is
still a one-shot snapshot, not wired to the live session (architecturally correct for a chat reply,
per the boundary above, but worth stating plainly). The five other MoneyPenny002 overlays (Portfolio,
Intent Capture, Live Insights, Research, MetaVatar) remain unbuilt, per this doc's original §3.
Host-responsive breakpoint variants (narrow/wide capsule sizing beyond the three named presentation
values) and full accessibility labeling pass were not separately audited this tranche.

## 4. Files changed this pass

- `types/smarttriad/richBlocks.ts` — `SmartTriadDataSourceClass`, `SmartTriadSourceDescriptor`,
  `SmartTriadMarketGaugeBasePayload`, `SmartTriadEdgeGaugePayload`, `SmartTriadInventoryGaugePayload`,
  `SmartTriadCapsulePayload`; `SmartTriadRichBlockEnvelope` is now a proper discriminated union over
  `kind`.
- `services/smarttriad/richBlocks.ts` — validators for the three new kinds, `describeSmartTriadBlockEnvelope`.
- `services/moneypenny/marketSimulation.ts` (new) — the one deterministic, seeded simulation service.
- `components/smarttriad/surfaces/EdgeGaugeSurface.tsx`, `InventoryGaugeSurface.tsx`,
  `SmartTriadSourceBadge.tsx` (new) — the harvested atomic surfaces.
- `components/smarttriad/richblocks/SmartTriadRichBlockRenderer.tsx` — dispatcher cases for
  `market.edge` / `market.inventory` / `capsule` (recursive).
- `services/smarttriad/mediaProviders.ts` — `moneyPennyMarketConsoleProvider` (edge/inventory/console
  conversational triggers).
- `app/(shell)/moneypenny/components/HFTConsole.tsx` — reconstituted around the harvested atomic
  surfaces; `Math.random()` replaced by the simulation service.
- `app/api/codex/chat/route.ts` — `describeSmartTriadBlockEnvelope` used instead of an unsafe
  `.payload.title` access now that payload is a union.
- `app/api/moneypenny/quotes/route.ts` — `Math.random()` replaced by the simulation service; explicit
  `source` classification added to the response.
- `tests/smarttriad-market-console-surfaces.test.ts` (new, 24 tests).

Tests: 708 passing across 28 focused/regression files (up from 611 before this pass — 91 new tests
across the two SmartTriad-capability test files added this session, plus the pre-existing 611
unaffected). `tsc --noEmit`: 680 errors, matching this session's earlier post-Rich-Block baseline
exactly (net zero new type errors after fixing one genuine union-narrowing bug this pass introduced
and then corrected in `app/api/codex/chat/route.ts`).
