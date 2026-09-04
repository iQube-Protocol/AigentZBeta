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
