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

/**
 * Five-area information architecture (Cartridge spec C-03, reconciled
 * 2026-09-02 — "Home is part of the specification"). Retires the flat
 * 14-item capability rail (`MoneyPennyCapabilityRail.tsx`, deleted) as the
 * primary navigation: one shared top-level menu (the 5 areas below) with
 * contextual sub-navigation for the active area's capsules, per C-01
 * ("do not retain a competing full capability sidebar").
 *
 * This is navigation ONLY. Advisor/Architect/Runtime provider mode,
 * simulation/live execution environment, and authority stay independent
 * dimensions (C-10) — an item's `mode` badge is carried through unchanged
 * from MONEYPENNY_CAPABILITY_GROUPS, never redefined here, and area
 * selection never implies or changes mode/environment/authority.
 */
export type MoneyPennyAreaId = "home" | "my-money" | "plan" | "markets" | "activity";

export interface MoneyPennyArea {
  id: MoneyPennyAreaId;
  label: string;
  /** The natural question this area answers (Cartridge spec C-03's own framing). */
  question: string;
}

export const MONEYPENNY_AREAS: MoneyPennyArea[] = [
  { id: "home", label: "Home", question: "Where am I? What needs attention?" },
  { id: "my-money", label: "My Money", question: "What do I have? What is committed? What can I use?" },
  { id: "plan", label: "Plan", question: "What am I trying to achieve? How do the assumptions change it?" },
  { id: "markets", label: "Markets", question: "What am I considering? What are the costs and possible outcomes?" },
  { id: "activity", label: "Activity", question: "Who did what? What happened? What should change?" },
];

/**
 * Cartridge spec C-03's existing-surface relocation table, applied to this
 * repo's actual MoneyPennyPanelKey set (§5, "Existing-surface relocation").
 * `crm` is deliberately absent — C-03's own closing paragraph carves
 * "privileged administration" out of the five areas as contextual utility
 * access, not a sixth beginner journey; it is reachable as a utility link
 * instead (see MoneyPennyAreaNav.tsx), same deep link, same functionality.
 *
 * `learn` is likewise deliberately absent — the C-15/A3 structured
 * right-pane content a video block's related chip opens is a chip-triggered
 * capsule, not a persistent area-nav destination (see
 * MoneyPennyPanelTab.tsx's own comment on the `learn` panel key).
 */
export const MONEYPENNY_AREA_FOR_PANEL: Record<Exclude<MoneyPennyPanelKey, "crm" | "learn">, MoneyPennyAreaId> = {
  overview: "home",
  "financial-profile": "my-money",
  identity: "my-money",
  x402: "my-money",
  "risk-envelope": "plan",
  "hft-console": "markets",
  strategies: "markets",
  architect: "markets",
  chat: "markets",
  portfolio: "activity",
  smarttriad: "activity",
  runtime: "activity",
  "service-orchestration": "activity",
};

export function areaForPanel(panel: MoneyPennyPanelKey): MoneyPennyAreaId | null {
  if (panel === "crm" || panel === "learn") return null;
  return MONEYPENNY_AREA_FOR_PANEL[panel] ?? "home";
}

/**
 * The `overview` panel has no MONEYPENNY_CAPABILITY_GROUPS entry (the old
 * rail rendered it as a hardcoded button, not a group item) — represented
 * here as its own item so Home has real, honest content rather than an
 * empty area.
 */
export const MONEYPENNY_HOME_ITEM: MoneyPennyCapabilityItem = {
  id: "overview",
  label: "Overview",
  description: "Financial brief, current journey, pending decisions and next actions.",
  panel: "overview",
  mode: null,
};

/**
 * Capability items belonging to an area, DERIVED from
 * MONEYPENNY_CAPABILITY_GROUPS (never hand-duplicated labels/descriptions/
 * modes — single source of truth per CLAUDE.md source-of-truth parity).
 */
export function capabilityItemsForArea(areaId: MoneyPennyAreaId): MoneyPennyCapabilityItem[] {
  const fromGroups = MONEYPENNY_CAPABILITY_GROUPS.flatMap((g) => g.items).filter(
    (item) => item.panel !== null && areaForPanel(item.panel) === areaId,
  );
  return areaId === "home" ? [MONEYPENNY_HOME_ITEM, ...fromGroups] : fromGroups;
}

/**
 * Panels with real capsules but no MONEYPENNY_CAPABILITY_GROUPS entry
 * (`identity`, `x402`, plus `overview` covered by MONEYPENNY_HOME_ITEM
 * above) — added here so their deep links/functionality remain reachable
 * from the new area nav, not just as a raw URL. Honest minimal labels,
 * matching this file's own "never link to a fake destination" rule.
 */
export const MONEYPENNY_UNGROUPED_ITEMS: MoneyPennyCapabilityItem[] = [
  { id: "identity", label: "Identity & Wallets", description: "FIO handle and wallet addressing (SPEC-MPY-CARTRIDGE C-03: My Money connections and account settings).", panel: "identity", mode: null },
  { id: "x402", label: "Settlement (X402)", description: "Task entry over the native X402 settlement service (SPEC-MPY-CARTRIDGE C-03: My Money task entry).", panel: "x402", mode: "RUNTIME" },
];

/** Same derivation as capabilityItemsForArea, folding in MONEYPENNY_UNGROUPED_ITEMS. */
export function areaItems(areaId: MoneyPennyAreaId): MoneyPennyCapabilityItem[] {
  const ungrouped = MONEYPENNY_UNGROUPED_ITEMS.filter(
    (item) => item.panel !== null && areaForPanel(item.panel) === areaId,
  );
  return [...capabilityItemsForArea(areaId), ...ungrouped];
}

/** The single utility item outside the five areas (see MONEYPENNY_AREA_FOR_PANEL's own note on `crm`). */
export const MONEYPENNY_UTILITY_ITEM: MoneyPennyCapabilityItem = {
  id: "crm",
  label: "Relationships (CRM)",
  description: "Contextual relationships and privileged business/service management — utility access, not a sixth area (SPEC-MPY-CARTRIDGE C-03).",
  panel: "crm",
  mode: null,
};
