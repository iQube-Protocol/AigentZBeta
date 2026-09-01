/**
 * MoneyPenny capability navigation — single source of truth for the
 * user-facing capability axis (SPEC-MPY-002 §2.1, work package MPY2-1).
 *
 * `MoneyPennyCapabilityRail.tsx` (persistent side rail, every panel) and
 * `MoneyPennyOverviewPanel.tsx` (the codex-tab landing hub) both render
 * from THIS list rather than each hand-rolling their own — one authoritative
 * location per concern (CLAUDE.md "Source-of-truth parity").
 *
 * SPEC-MPY-002 §2 is explicit that this is a SEPARATE axis from the
 * Advisor/Architect/Runtime service mode: "Capability is user-facing.
 * Provider/service mode governs how the capability may act." `mode` below
 * is carried only as a small secondary badge — never the primary label —
 * and reuses the canonical `MoneyPennyProviderMode` vocabulary
 * (`types/financialServices.ts`) rather than inventing a parallel one.
 *
 * `panel` is a `MoneyPennyPanelKey` (see `MoneyPennyPanelTab.tsx`) when the
 * destination already exists; `null` means the capability is named by the
 * spec but has no live surface yet — the rail/hub render it disabled with
 * a "Coming soon" state rather than linking to a fake destination
 * (SPEC-MPY-002 §7 truthfulness rule: never represent a capability as real
 * when the canonical runtime can't back it yet).
 */

import type { MoneyPennyProviderMode } from "@/types/financialServices";
import type { MoneyPennyPanelKey } from "@/app/triad/components/codex/tabs/MoneyPennyPanelTab";

export interface MoneyPennyCapabilityItem {
  id: string;
  label: string;
  description: string;
  /** Existing/adapted destination panel, or null if not yet built (MPY2-2..5 backlog). */
  panel: MoneyPennyPanelKey | null;
  /** Secondary badge only — never the primary label (SPEC-MPY-002 §2.2). */
  mode: MoneyPennyProviderMode | null;
}

export interface MoneyPennyCapabilityGroup {
  id: string;
  label: string;
  items: MoneyPennyCapabilityItem[];
}

export const MONEYPENNY_CAPABILITY_GROUPS: MoneyPennyCapabilityGroup[] = [
  {
    id: "understand",
    label: "Understand",
    items: [
      { id: "financial-profile", label: "Financial Profile", description: "Bank-statement-derived financial aggregates and a candidate risk/trading envelope (SPEC-MPY-002 §5, MPY2-2).", panel: "financial-profile", mode: "ADVISOR" },
      { id: "market-research", label: "Market Research", description: "Grounded, cited market research and explainers, via MoneyPenny Advisor.", panel: "chat", mode: "ADVISOR" },
      { id: "learn", label: "Learn / Explain", description: "Concept explainers — volatility, spread, slippage, liquidity, position sizing.", panel: "chat", mode: "ADVISOR" },
    ],
  },
  {
    id: "design",
    label: "Design",
    items: [
      { id: "strategy-lab", label: "Strategy Lab", description: "Describe, structure, compare and ratify candidate strategies (Architect proposal, not executable authority).", panel: "strategies", mode: "ARCHITECT" },
      { id: "risk-envelope", label: "Risk & Limits", description: "Risk factors and recommended limits derived from your Financial Profile — position/notional caps, drawdown, concentration (SPEC-MPY-002 §8, MPY2-3).", panel: "risk-envelope", mode: "ARCHITECT" },
      { id: "scenario-backtest", label: "Scenario / Backtest", description: "Stress-test a candidate strategy before ratification — not yet built; the donor's random-number backtester is explicitly excluded (SPEC-MPY-002 §6).", panel: null, mode: "ARCHITECT" },
    ],
  },
  {
    id: "markets",
    label: "Markets",
    items: [
      { id: "market-console", label: "Market Console", description: "Quotes, spread/edge, liquidity, venue comparison.", panel: "hft-console", mode: "ADVISOR" },
      { id: "opportunities", label: "Opportunities / Arbitrage", description: "Candidate arbitrage/opportunity surface backed by a real market-data provider — not yet built (donor's simulated scanner is explicitly excluded).", panel: null, mode: "ADVISOR" },
    ],
  },
  {
    id: "operate",
    label: "Operate",
    items: [
      { id: "trading-intents", label: "Trading Intents", description: "Advanced intent composition, handed off to canonical Runtime.", panel: "architect", mode: "ARCHITECT" },
      { id: "runtime", label: "Runtime", description: "Constitutional Service Pipeline — shadow/authoritative execution.", panel: "runtime", mode: "RUNTIME" },
      { id: "smarttriad", label: "Automation", description: "Trading operations hub.", panel: "smarttriad", mode: "RUNTIME" },
      { id: "orchestration", label: "Service Orchestration", description: "Oversight console — admitted agents consuming MoneyPenny Financial Services.", panel: "service-orchestration", mode: null },
    ],
  },
  {
    id: "monitor",
    label: "Monitor",
    items: [
      { id: "portfolio", label: "Portfolio / Performance", description: "Analytics and performance over canonical balances and executions.", panel: "portfolio", mode: null },
      { id: "execution-insights", label: "Execution Insights", description: "Receipt/evidence-backed execution history — not yet built as a dedicated surface.", panel: null, mode: null },
    ],
  },
];

/** Flat lookup: panel key -> the capability item that targets it (for rail highlighting). */
export function findCapabilityItemsForPanel(panel: MoneyPennyPanelKey): MoneyPennyCapabilityItem[] {
  return MONEYPENNY_CAPABILITY_GROUPS.flatMap((g) => g.items).filter((item) => item.panel === panel);
}
